<script lang="ts">
	import type { DemandSlot } from '$lib/api/analytics.remote';
	import { getCooperativeDashboard,  } from '$lib/api/admin.remote';
	import { getDemandPatterns, getAnalytics } from '$lib/api/analytics.remote';

	// Components
	import KPICards from '$lib/components/dashboard/KPICards.svelte';
	import Alerts from '$lib/components/dashboard/Alerts.svelte';
	import TodaysRides from '$lib/components/dashboard/TodaysRides.svelte';
	import DirectionSplit from '$lib/components/dashboard/DirectionSplit.svelte';
	import DemandHeatmap from '$lib/components/dashboard/DemandHeatmap.svelte';
	import DemandForecast from '$lib/components/dashboard/DemandForecast.svelte';
	import Suggestions from '$lib/components/dashboard/Suggestions.svelte';
	import DriverMap from '$lib/components/dashboard/DriverMap.svelte';

	// ─── Queries ─────────────────────────────────────────────────────────────────
	const dashboard = getCooperativeDashboard();
	const analytics = getAnalytics();
	const demand = getDemandPatterns();
	const DASHBOARD_DISPLAY_TIME_ZONE = 'Asia/Manila';
	const dashboardWeekdayFormatter = new Intl.DateTimeFormat('en-PH', {
		weekday: 'long',
		timeZone: DASHBOARD_DISPLAY_TIME_ZONE
	});
	const dashboardHourFormatter = new Intl.DateTimeFormat('en-PH', {
		hour: 'numeric',
		hour12: false,
		timeZone: DASHBOARD_DISPLAY_TIME_ZONE
	});

	function parseHourSlotStart(slot: string): number | null {
		const match = slot.match(/^(\d+)(AM|PM)/i);
		if (!match) return null;
		let hour = Number.parseInt(match[1], 10);
		const period = match[2].toUpperCase();
		if (period === 'PM' && hour !== 12) hour += 12;
		if (period === 'AM' && hour === 12) hour = 0;
		return hour;
	}

	function formatHourSlot(hour24: number): string {
		const next = (hour24 + 1) % 24;
		const formatHour = (hour: number) => {
			const normalized = hour % 12 || 12;
			const suffix = hour < 12 ? 'AM' : 'PM';
			return `${normalized}${suffix}`;
		};
		return `${formatHour(hour24)}–${formatHour(next)}`;
	}

	function convertUtcDemandSlot(day: string, hourSlot: string): { day: string; hourSlot: string } {
		const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
		const dayIndex = dayOrder.indexOf(day);
		const startHour = parseHourSlotStart(hourSlot);
		if (dayIndex === -1 || startHour === null) return { day, hourSlot };

		const utcDate = new Date(Date.UTC(2024, 0, 1 + dayIndex, startHour, 0, 0, 0));
		const convertedDay = dashboardWeekdayFormatter.format(utcDate);
		const convertedHour = Number.parseInt(dashboardHourFormatter.format(utcDate), 10);
		if (!Number.isFinite(convertedHour)) return { day, hourSlot };

		return {
			day: convertedDay,
			hourSlot: formatHourSlot(convertedHour)
		};
	}

	let localizedDemandPatterns = $derived.by(() => {
		if (!demand.ready || !demand.current?.patterns) return [];
		return (demand.current.patterns as DemandSlot[]).map((pattern) => {
			const converted = convertUtcDemandSlot(pattern.day, pattern.hourSlot);
			return {
				...pattern,
				day: converted.day,
				hourSlot: converted.hourSlot
			};
		});
	});

	// ─── Derived chart data ───────────────────────────────────────────────────────

	// Data for heatmap
	let heatmapData = $derived.by(() => {
		return localizedDemandPatterns.map((p) => ({
			hourSlot: p.hourSlot,
			day: p.day,
			historicDemandLevel: p.historicDemandLevel,
			totalRides: p.totalRides
		}));
	});

	// Top suggestions
	let topSuggestions = $derived.by(() => {
		return localizedDemandPatterns
			.filter(p => p.suggestion && p.forecastConfidence !== null)
			.sort((a, b) => {
				const order = { high: 0, medium: 1, low: 2 };
				return (order[a.forecastConfidence ?? 'low'] ?? 2) - (order[b.forecastConfidence ?? 'low'] ?? 2);
			})
			.slice(0, 5);
	});

	// Loading and error states
	const loading = $derived(dashboard.loading && !dashboard.ready);
	const error = $derived(!!(dashboard.error || analytics.error));
	const ready = $derived(!!(dashboard.ready && analytics.ready));
	let showAiInfo = $state(false);
</script>

<!-- ─── Loading ──────────────────────────────────────────────────────────────── -->
{#if loading}
	<div class="flex items-center justify-center h-64">
		<div class="flex items-center gap-2.5 text-sm text-slate-400">
			<svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
			Loading dashboard…
		</div>
	</div>

<!-- ─── Error ───────────────────────────────────────────────────────────────── -->
{:else if error}
	<div class="flex items-center justify-center h-64">
		<p class="text-sm text-red-500">Failed to load dashboard data.</p>
	</div>

<!-- ─── Dashboard ──────────────────────────────────────────────────────────── -->
{:else if ready && dashboard.current && analytics.current}
<div class="space-y-6 pb-10">

	<!-- Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="text-xl font-semibold text-slate-900 tracking-tight">
				{dashboard.current.cooperative?.name ?? 'Dashboard'}
			</h1>
			<p class="text-sm text-slate-400 mt-0.5">
				{new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
			</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="relative">
				<button
					type="button"
					onclick={() => (showAiInfo = !showAiInfo)}
					class={`rounded-full px-2.5 py-1.5 text-xs font-medium ring-1 transition-colors ${demand.current?.aiAssisted ? 'bg-violet-50 text-violet-600 ring-violet-100 hover:bg-violet-100' : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'}`}
				>
					{demand.current?.aiAssisted ? 'AI-assisted insights' : 'Rules-only insights'}
				</button>
				{#if showAiInfo}
					<div class="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-snug text-slate-600 shadow-lg">
						{demand.current?.aiAssisted
							? 'Generated using Groq + fallback rules.'
							: 'Using fallback rules only (Groq was not used for this response).'}
					</div>
				{/if}
			</div>
			{#if analytics.current.today.ongoingRides > 0}
				<div class="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full ring-1 ring-emerald-100">
					<span class="relative flex h-1.5 w-1.5">
						<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
						<span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
					</span>
					{analytics.current.today.ongoingRides} active ride{analytics.current.today.ongoingRides !== 1 ? 's' : ''}
				</div>
			{/if}
		</div>
	</div>

	<!-- KPI Cards -->
	<KPICards 
		drivers={analytics.current.fleet.totalDrivers}
		vehicles={analytics.current.fleet.totalVehicles}
		routes={analytics.current.fleet.totalRoutes}
	/>

	<!-- Driver map -->
	<DriverMap drivers={dashboard.current.driverLocations} />

	<!-- Alerts -->
	<Alerts 
		unassignedDrivers={analytics.current.flags.unassignedDrivers.length}
		expiringLicenses={analytics.current.flags.expiringLicenses.length}
		stalledRides={analytics.current.flags.stalledRides.length}
	/>

	<!-- Today's activity + Direction split -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<TodaysRides 
			totalRides={analytics.current.today.totalRides}
			completedRides={analytics.current.today.completedRides}
			ongoingRides={analytics.current.today.ongoingRides}
			avgDurationMinutes={analytics.current.today.avgDurationMinutes}
			aiAssisted={demand.current?.aiAssisted ?? false}
		/>
		<DirectionSplit 
			northbound={analytics.current.today.directionSplit.northbound}
			southbound={analytics.current.today.directionSplit.southbound}
		/>
	</div>

	<!-- Demand heatmap -->
	<DemandHeatmap patterns={heatmapData} />



	<!-- Demand table + suggestions -->
	{#if demand.ready && demand.current?.summary}
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
			<div class="lg:col-span-2">
				<DemandForecast 
					patterns={localizedDemandPatterns as DemandSlot[]}
					summary={demand.current.summary}
					// aiAssisted={demand.current.aiAssisted ?? false}
				/>
			</div>
			<Suggestions 
				suggestions={topSuggestions.map(s => ({
					routeName: s.routeName,
					day: s.day,
					hourSlot: s.hourSlot,
					suggestion: s.suggestion ?? '',
					forecastedDemandLevel: s.forecastedDemandLevel,
					forecastConfidence: s.forecastConfidence
				}))}
				summary={demand.current.summary}
				aiAssisted={demand.current.aiAssisted ?? false}
			/>
		</div>
	{/if}
</div>
{/if}
