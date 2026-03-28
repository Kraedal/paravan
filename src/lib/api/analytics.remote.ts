import { db } from '$lib/server/db';
import { cooperative, route, ride, driver, vehicle } from '$lib/server/db/schema';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { query, getRequestEvent } from '$app/server';

function requireAdmin() {
	const { locals } = getRequestEvent();
	if (!locals.user || locals.user.role !== 'admin') {
		throw new Error('Unauthorized');
	}
	return locals.user;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEMAND_THRESHOLDS = {
	high: 0.2,  // <= 20% seats remaining → high demand
	normal: 0.6 // <= 60% seats remaining → normal, else low
} as const;

// WMA weights for the past 4 weeks — most recent week is weighted highest.
// Must sum to 1.0.
// week[0] = oldest (4 weeks ago), week[3] = most recent (last week)
const WMA_WEIGHTS = [0.1, 0.2, 0.3, 0.4] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyDemand(fillRatio: number): 'high' | 'normal' | 'low' {
	const availableRatio = 1 - fillRatio;
	if (availableRatio <= DEMAND_THRESHOLDS.high) return 'high';
	if (availableRatio <= DEMAND_THRESHOLDS.normal) return 'normal';
	return 'low';
}

function getHourSlot(date: Date): string {
	const hour = date.getHours();
	const next = hour + 1;
	const fmt = (h: number) => `${h % 12 || 12}${h < 12 ? 'AM' : 'PM'}`;
	return `${fmt(hour)}–${fmt(next)}`;
}

function getDayLabel(dayIndex: number): string {
	return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
}

function getWeekIndex(rideDate: Date, referenceDate: Date): number {
	const msPerWeek = 7 * 24 * 60 * 60 * 1000;
	const diffMs = referenceDate.getTime() - rideDate.getTime();
	// 0 = most recent week, 1 = two weeks ago, etc.
	return Math.floor(diffMs / msPerWeek);
}

/**
 * Weighted Moving Average over up to 4 weeks of fill ratios.
 * Returns the forecasted fill ratio for the next occurrence of this slot.
 *
 * weeklyFillRatios: index 0 = oldest week, last index = most recent week
 */
function weightedMovingAverage(weeklyFillRatios: (number | null)[]): number | null {
	// Need at least 2 weeks of data to produce a meaningful forecast
	const available = weeklyFillRatios.filter((v) => v !== null) as number[];
	if (available.length < 2) return null;

	// Align weights to available data — always use the tail of WMA_WEIGHTS
	const alignedWeights = WMA_WEIGHTS.slice(WMA_WEIGHTS.length - available.length);
	const weightSum = alignedWeights.reduce((a, b) => a + b, 0);

	const forecast = available.reduce((sum, ratio, i) => {
		return sum + ratio * (alignedWeights[i] / weightSum);
	}, 0);

	return Math.min(1, Math.max(0, forecast)); // clamp to [0, 1]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DemandSlot = {
	routeName: string;
	day: string;
	hourSlot: string;
	// Descriptive
	totalRides: number;
	avgFillRatio: number;
	historicDemandLevel: 'high' | 'normal' | 'low';
	// Predictive (WMA)
	forecastedFillRatio: number | null;
	forecastedDemandLevel: 'high' | 'normal' | 'low' | null;
	forecastConfidence: 'low' | 'medium' | 'high' | null; // based on weeks of data available
	// Prescriptive
	suggestion: string | null;
};

export type DemandSummary = {
	highDemandSlots: number;
	lowDemandSlots: number;
	forecastedHighSlots: number;
	totalPatternsAnalyzed: number;
	ridesAnalyzed: number;
};

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export const getDemandPatterns = query(async () => {
	const admin = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, admin.id)
	});

	if (!cooperativeData) throw new Error('Cooperative not found');

	const coopRoutes = await db.query.route.findMany({
		where: eq(route.cooperativeId, cooperativeData.id)
	});

	if (!coopRoutes.length) return { patterns: [], summary: null };

	const cooperativeRouteIds = coopRoutes.map((r) => r.id);

	// Pull last 28 days (4 full weeks) of completed rides
	const twentyEightDaysAgo = new Date();
	twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
	const now = new Date();

	const recentRides = await db.query.ride.findMany({
		where: and(
			inArray(ride.routeId, cooperativeRouteIds),
			eq(ride.status, 'completed'),
			gte(ride.createdAt, twentyEightDaysAgo)
		),
		with: { vehicle: true, route: true }
	});

	if (!recentRides.length) return { patterns: [], summary: null };

	// ---------------------------------------------------------------------------
	// Step 1 — DESCRIPTIVE: Group rides into route+day+hour slots per week
	// ---------------------------------------------------------------------------

	// slotWeeks[slotKey][weekIndex] = array of fill ratios for that week
	// weekIndex: 0 = oldest, 3 = most recent
	type SlotKey = string;
	const slotWeeks = new Map<SlotKey, { fillRatios: (number[] | undefined)[]; capacity: number; routeName: string }>();

	for (const r of recentRides) {
		const date = new Date(r.createdAt);
		const day = getDayLabel(date.getDay());
		const hourSlot = getHourSlot(date);
		const routeName = r.route?.name ?? 'Unknown Route';
		const key: SlotKey = `${routeName}|${day}|${hourSlot}`;

		const capacity = r.vehicle?.capacity ?? 12;
		const fillRatio = 1 - (r.availableSeats ?? 0) / capacity;

		// rawWeekIndex: 0 = most recent, flip to store oldest at index 0
		const rawWeekIndex = getWeekIndex(date, now);
		if (rawWeekIndex > 3) continue; // older than 4 weeks, skip

		if (!slotWeeks.has(key)) {
			slotWeeks.set(key, { fillRatios: [undefined, undefined, undefined, undefined], capacity, routeName });
		}

		const slot = slotWeeks.get(key)!;
		const storeIndex = 3 - rawWeekIndex; // oldest = 0, most recent = 3
		if (!slot.fillRatios[storeIndex]) slot.fillRatios[storeIndex] = [];
		slot.fillRatios[storeIndex]!.push(fillRatio);
	}

	// ---------------------------------------------------------------------------
	// Step 2 — PREDICTIVE: Apply WMA across weekly averages per slot
	// ---------------------------------------------------------------------------

	const patterns: DemandSlot[] = [];
	const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	for (const [key, { fillRatios, routeName }] of slotWeeks.entries()) {
		const [, day, hourSlot] = key.split('|');

		// Average fill ratio per week (null if no data that week)
		const weeklyAvgs: (number | null)[] = fillRatios.map((week) => {
			if (!week || week.length === 0) return null;
			return week.reduce((a, b) => a + b, 0) / week.length;
		});

		// Overall descriptive average across all rides in this slot
		const allFillRatios = (fillRatios.flat().filter(Boolean)) as number[];
		const totalRides = allFillRatios.length;
		const avgFillRatio = allFillRatios.reduce((a, b) => a + b, 0) / totalRides;
		const historicDemandLevel = classifyDemand(avgFillRatio);

		// WMA forecast
		const forecastedFillRatio = weightedMovingAverage(weeklyAvgs);
		const forecastedDemandLevel = forecastedFillRatio !== null
			? classifyDemand(forecastedFillRatio)
			: null;

		// Confidence based on how many weeks of data we have
		const weeksWithData = weeklyAvgs.filter((v) => v !== null).length;
		const forecastConfidence =
			weeksWithData >= 4 ? 'high' :
			weeksWithData >= 3 ? 'medium' :
			weeksWithData >= 2 ? 'low' : null;

		// ---------------------------------------------------------------------------
		// Step 3 — PRESCRIPTIVE: Generate suggestion based on forecasted demand
		// ---------------------------------------------------------------------------

		let suggestion: string | null = null;
		if (forecastedDemandLevel === 'high') {
			suggestion = `High demand on ${routeName} on ${day}s during ${hourSlot}. Consider deploying an additional vehicle.`;
		} else if (forecastedDemandLevel === 'low') {
			suggestion = `Low demand on ${routeName} on ${day}s during ${hourSlot}. Consider reducing dispatch frequency.`;
		}

		patterns.push({
			routeName,
			day,
			hourSlot,
			totalRides,
			avgFillRatio: Math.round(avgFillRatio * 100) / 100,
			historicDemandLevel,
			forecastedFillRatio: forecastedFillRatio !== null
				? Math.round(forecastedFillRatio * 100) / 100
				: null,
			forecastedDemandLevel,
			forecastConfidence,
			suggestion
		});
	}

	patterns.sort((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

	// ---------------------------------------------------------------------------
	// Summary
	// ---------------------------------------------------------------------------

	const summary: DemandSummary = {
		highDemandSlots: patterns.filter((p) => p.historicDemandLevel === 'high').length,
		lowDemandSlots: patterns.filter((p) => p.historicDemandLevel === 'low').length,
		forecastedHighSlots: patterns.filter((p) => p.forecastedDemandLevel === 'high').length,
		totalPatternsAnalyzed: patterns.length,
		ridesAnalyzed: recentRides.length
	};

	return { patterns, summary };
});

// ---------------------------------------------------------------------------
// Operational Analytics
// ---------------------------------------------------------------------------

export const getAnalytics = query(async () => {
	const admin = requireAdmin();

	const cooperativeData = await db.query.cooperative.findFirst({
		where: eq(cooperative.userId, admin.id)
	});

	if (!cooperativeData) throw new Error('Cooperative not found');

	const coopId = cooperativeData.id;

	// --- Fleet snapshot ---
	const [allDrivers, allVehicles, allRoutes] = await Promise.all([
		db.query.driver.findMany({ where: eq(driver.cooperativeId, coopId) }),
		db.query.vehicle.findMany({ where: eq(vehicle.cooperativeId, coopId) }),
		db.query.route.findMany({ where: eq(route.cooperativeId, coopId) })
	]);

	// --- Rule: Unassigned drivers ---
	const unassignedDrivers = allDrivers.filter((d) => !d.vehicleId);

	// --- Rule: Expiring licenses (within 30 days) ---
	const thirtyDaysFromNow = new Date();
	thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
	const expiringLicenses = allDrivers.filter((d) => {
		if (!d.licenseExpiry) return false;
		const expiry = new Date(d.licenseExpiry);
		return expiry <= thirtyDaysFromNow && expiry >= new Date();
	});

	// --- Ride data for today ---
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const cooperativeRouteIds = allRoutes.map((r) => r.id);

	const todayRides = cooperativeRouteIds.length > 0
		? await db.query.ride.findMany({
			where: and(
				inArray(ride.routeId, cooperativeRouteIds),
				gte(ride.createdAt, startOfDay)
			),
			with: { driver: true, vehicle: true, route: true }
		})
		: [];

	// --- Rule: Stalled rides (ongoing, not updated in 10+ minutes) ---
	const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
	const stalledRides = todayRides.filter(
		(r) => r.status === 'ongoing' && new Date(r.updatedAt) < tenMinutesAgo
	);

	// --- Rule: Full vehicles ---
	const fullVehicles = todayRides.filter(
		(r) => r.status === 'ongoing' && r.availableSeats === 0
	);

	// --- Direction split ---
	const directionSplit = { northbound: 0, southbound: 0 };
	todayRides.forEach((r) => {
		if (r.route.direction === 'northbound') directionSplit.northbound++;
		else if (r.route.direction === 'southbound') directionSplit.southbound++;
	});

	const completedToday = todayRides.filter((r) => r.status === 'completed');

	// --- Average ride duration (completed rides with end_at) ---
	const ridesWithDuration = completedToday.filter((r) => r.endAt);
	const avgDurationMinutes =
		ridesWithDuration.length > 0
			? ridesWithDuration.reduce((sum, r) => {
				const duration =
					(new Date(r.endAt!).getTime() - new Date(r.createdAt).getTime()) / 1000 / 60;
				return sum + duration;
			}, 0) / ridesWithDuration.length
			: null;

	return {
		// KPI counts
		fleet: {
			totalDrivers: allDrivers.length,
			totalVehicles: allVehicles.length,
			totalRoutes: allRoutes.length
		},
		// Rule-based flags
		flags: {
			unassignedDrivers,
			expiringLicenses,
			stalledRides,
			fullVehicles
		},
		// Ride analytics
		today: {
			totalRides: todayRides.length,
			completedRides: completedToday.length,
			ongoingRides: todayRides.filter((r) => r.status === 'ongoing').length,
			directionSplit: directionSplit,
			avgDurationMinutes: avgDurationMinutes ? Math.round(avgDurationMinutes) : null
		}
	};
});