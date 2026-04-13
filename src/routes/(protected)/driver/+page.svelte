<script lang="ts">
	// ─── Imports ─────────────────────────────────────────────────────────────────
	import { onMount, onDestroy } from 'svelte';
	import MapView from '$lib/components/mapView.svelte';
	import {
		getCooperativeRoutes,
		getDriverBootstrap,
		getDriverLiveState,
		startRide,
		endRide,
		acceptBooking,
		completeBooking,
		rejectBooking,
		manualBoardPassenger,
		manualAlightPassenger,
		updateDriverLocation,
		toggleDriverAvailability
	} from '$lib/api/driver.remote';
	import { subscribeToRealtimeTables } from '$lib/supabase/realtime';
	import { haversineDistance, calcETA } from '$lib/utils/eta';
	import { CarTaxiFront, Check, Play, UsersRound, X } from '@lucide/svelte';

	// ─── Types ────────────────────────────────────────────────────────────────────
	type Route = {
		id: string;
		name: string;
		distance: number;
		originLatitude: number;
		originLongitude: number;
		destinationLatitude: number;
		destinationLongitude: number;
	};

	type Vehicle = {
		id: string;
		plateNumber: string;
		model: string;
		capacity: number;
	};

	type DriverProfile = {
		id: string;
		name: string;
		isAvailable: boolean;
		latitude: number | null;
		longitude: number | null;
		vehicleId: string | null;
		vehicle: Vehicle | null;
		cooperative: { name: string } | null;
	};

	type OngoingRide = {
		id: string;
		availableSeats: number;
		totalSeats?: number;
		occupiedSeats?: number;
		route: Route | null;
		vehicle: Vehicle | null;
	} | null;

	type Booking = {
		id: string;
		status: 'pending' | 'onboard' | 'completed' | 'cancelled';
		boardingLatitude: number | null;
		boardingLongitude: number | null;
		passenger: {
			name: string;
			latitude: number | null;
			longitude: number | null;
			user: { name: string };
		};
	};

	type PageState = 'loading' | 'offline' | 'driving';

	// ─── Queries (SvelteKit $app/server query handles) ────────────────────────────
	const routesQuery = getCooperativeRoutes();
	const bootstrapQuery = getDriverBootstrap();
	const liveStateQuery = getDriverLiveState();

	// ─── Page State ───────────────────────────────────────────────────────────────
	let pageState: PageState = $state('loading');
	let profile: DriverProfile | null = $state(null);
	let ongoingRide: OngoingRide = $state(null);
	let bookings: Booking[] = $state([]);
	let routes: Route[] = $state([]);
	let errorMsg: string = $state('');
	let liveStateRequestSeq = 0;
	let bookingsMutationEpoch = 0;

	function isValidLatLng(point: [number, number] | null | undefined): point is [number, number] {
		if (!point) return false;
		const [lat, lng] = point;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
		if (lat < -90 || lat > 90) return false;
		if (lng < -180 || lng > 180) return false;
		return true;
	}

	// UI toggles
	let showStartSheet: boolean = $state(false);
	let showEndRideModal: boolean = $state(false);

	// Start ride form fields
	let selectedRouteId: string = $state('');

	let acceptingBookingId: string | null = $state(null);
	let completingBookingId: string | null = $state(null);
	let rejectingBookingId: string | null = $state(null);
	let isTogglingAvailability = $state(false);
	let isStartingRide = $state(false);
	let isEndingRide = $state(false);
	let isUpdatingLocation = $state(false);
	let isAddingManualPassenger = $state(false);
	let isRemovingManualPassenger = $state(false);

	// Live location
	let driverLocation: [number, number] | null = $state(null);

	// Ride state tracking (for preventing stale query overwrites)
	let lastRideEndTime: number = 0;
	let lastCompleteAttemptTime: number = 0;
	let lastAcceptAttemptTime: number = 0;
	let lastRejectAttemptTime: number = 0;
	const BOOKING_ACTION_DEBOUNCE = 500;
	const COMPLETE_DEBOUNCE = 500;

	// Timers
	let locationWatcher: number | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let realtimeCleanup: (() => void) | null = null;
	let realtimeRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	let lastLocUpdate = 0;
	const LOC_THROTTLE = 5000;

	function getErrorMessage(error: unknown, fallback: string) {
		if (error instanceof Error && error.message) return error.message;
		return fallback;
	}

	function getDriverReferenceLocation(): [number, number] | null {
		if (isValidLatLng(driverLocation)) return driverLocation;
		if (profile?.latitude != null && profile?.longitude != null) {
			const coords: [number, number] = [profile.latitude, profile.longitude];
			return isValidLatLng(coords) ? coords : null;
		}
		return null;
	}

	function getPassengerTargetLocation(booking: Booking): [number, number] | null {
		if (booking.passenger.latitude != null && booking.passenger.longitude != null) {
			const passengerCoords: [number, number] = [booking.passenger.latitude, booking.passenger.longitude];
			if (isValidLatLng(passengerCoords)) return passengerCoords;
		}

		if (booking.boardingLatitude != null && booking.boardingLongitude != null) {
			const boardingCoords: [number, number] = [booking.boardingLatitude, booking.boardingLongitude];
			if (isValidLatLng(boardingCoords)) return boardingCoords;
		}

		return null;
	}

	function formatDistance(distanceKm: number): string {
		if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
		return `${distanceKm.toFixed(1)} km`;
	}

	function getPassengerProximityLabel(booking: Booking): string | null {
		const driverCoords = getDriverReferenceLocation();
		const passengerCoords = getPassengerTargetLocation(booking);
		if (!driverCoords || !passengerCoords) return null;

		const distanceKm = haversineDistance(driverCoords, passengerCoords);
		return `${formatDistance(distanceKm)} • ETA ${calcETA(distanceKm)}`;
	}

	function getMidpoint(a: [number, number], b: [number, number]): [number, number] {
		return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
	}

	function createEtaBadgeHtml(passengerName: string, proximityLabel: string): string {
		return `<div style="display:inline-flex;flex-direction:column;gap:1px;padding:2px 4px;background:rgba(15,23,42,0.88);color:#f8fafc;border:1px solid rgba(148,163,184,0.4);border-radius:10px;box-shadow:0 4px 14px rgba(2,6,23,0.25);font-family:'Outfit',sans-serif;line-height:1.2;white-space:nowrap"><span style="font-size:10px;font-weight:700;opacity:.85">${passengerName}</span><span style="font-size:11px;font-weight:700">${proximityLabel}</span></div>`;
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMount(() => void init());
	onDestroy(() => {
		stopPoll();
		stopWatch();
		stopRealtime();
	});

	async function init() {
		startRealtime();
		await refreshBootstrap();
		if (ongoingRide) {
			pageState = 'driving';
			startPoll();
			startWatch();
		} else {
			pageState = 'offline';
		}
	}

	async function refreshBootstrap() {
		try {
			await bootstrapQuery.refresh();
			const snapshot = bootstrapQuery.current as {
				profile: DriverProfile | null;
				ongoingRide: OngoingRide;
				bookings: Booking[];
			};

			profile = snapshot.profile;
			bookings = snapshot.bookings ?? [];

			if (profile && !profile.isAvailable) {
				ongoingRide = null;
			} else {
				const timeSinceRideEnd = Date.now() - lastRideEndTime;
				if (!(timeSinceRideEnd < 3000 && ongoingRide === null)) {
					ongoingRide = snapshot.ongoingRide ?? null;
				}
			}

			if (profile?.latitude != null && profile?.longitude != null) {
				driverLocation = [profile.latitude, profile.longitude];
			}
		} catch {
			pageState = 'offline';
		}
	}

	async function refreshLiveState() {
		try {
			const requestSeq = ++liveStateRequestSeq;
			const mutationEpochAtStart = bookingsMutationEpoch;
			await liveStateQuery.refresh();
			if (requestSeq !== liveStateRequestSeq) return;
			if (mutationEpochAtStart !== bookingsMutationEpoch) return;

			const snapshot = liveStateQuery.current as {
				ongoingRide: OngoingRide;
				bookings: Booking[];
			};
			bookings = snapshot.bookings ?? [];

			const timeSinceRideEnd = Date.now() - lastRideEndTime;
			if (!(timeSinceRideEnd < 3000 && ongoingRide === null)) {
				ongoingRide = snapshot.ongoingRide ?? null;
			}
		} catch {
			/* silent poll failure */
		}
	}

	function startPoll() {
		if (pollInterval) return;
		pollInterval = setInterval(async () => {
			if (pageState !== 'driving') return;
			if (acceptingBookingId) return;
			if (completingBookingId) return;
			await refreshLiveState();
		}, 5000);
	}

	function stopPoll() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function queueRealtimeRefresh() {
		if (pageState !== 'driving') return;
		if (realtimeRefreshTimer) return;

		realtimeRefreshTimer = setTimeout(async () => {
			realtimeRefreshTimer = null;
			await refreshLiveState();
		}, 300);
	}

	function startRealtime() {
		if (realtimeCleanup) return;

		realtimeCleanup =
			subscribeToRealtimeTables({
				channelName: 'driver-live-state',
				tables: ['driver', 'ride', 'booking'],
				onChange: () => {
					void queueRealtimeRefresh();
				}
			}) ?? null;
	}

	function stopRealtime() {
		if (realtimeRefreshTimer) {
			clearTimeout(realtimeRefreshTimer);
			realtimeRefreshTimer = null;
		}

		realtimeCleanup?.();
		realtimeCleanup = null;
	}

	// ─── Geolocation ─────────────────────────────────────────────────────────────
	function startWatch() {
		if (!navigator.geolocation) {
			errorMsg = 'Geolocation not available.';
			return;
		}
		if (locationWatcher !== null) return;

		locationWatcher = navigator.geolocation.watchPosition(
			async (pos) => {
				const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
				driverLocation = coords;

				const now = Date.now();
				if (now - lastLocUpdate < LOC_THROTTLE) return;
				if (isUpdatingLocation) return;
				lastLocUpdate = now;
				isUpdatingLocation = true;

				try {
					await updateDriverLocation({
						latitude: String(coords[0]),
						longitude: String(coords[1])
					});
				} catch {
					// Keep location watcher alive even if one update fails.
				} finally {
					isUpdatingLocation = false;
				}
			},
			() => {
				errorMsg = 'Location access denied.';
			},
			{ enableHighAccuracy: true, maximumAge: 3000 }
		);
	}

	function stopWatch() {
		if (locationWatcher !== null) {
			navigator.geolocation.clearWatch(locationWatcher);
			locationWatcher = null;
		}
	}


	// ─── Action handlers ──────────────────────────────────────────────────────────
	async function handleToggleAvailability() {
		if (isTogglingAvailability) return;
		isTogglingAvailability = true;
		errorMsg = '';

		try {
			const result = (await toggleDriverAvailability({})) as {
				success?: boolean;
				error?: string;
				isAvailable?: boolean;
			};

			if (!result?.success) {
				errorMsg = result?.error ?? 'Unable to update availability.';
				return;
			}

			if (result.isAvailable === false) {
				ongoingRide = null;
				bookings = [];
				driverLocation = null;
				stopPoll();
				stopWatch();
				pageState = 'offline';
				lastRideEndTime = Date.now();
			}

			await refreshBootstrap();

			if (result.isAvailable === true) {
				routes = [];
				showStartSheet = false;
			}
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to update availability.');
		} finally {
			isTogglingAvailability = false;
		}
	}

	async function openStartSheet() {
		try {
			await routesQuery.refresh();
			routes = (routesQuery.current as Route[] | undefined) ?? [];
			if (routes.length > 0) selectedRouteId = routes[0].id;
			showStartSheet = true;
		} catch {
			errorMsg = 'Failed to load routes.';
		}
	}

	async function handleStartRide() {
		if (!selectedRouteId || !profile?.vehicleId || isStartingRide) return;
		isStartingRide = true;
		errorMsg = '';

		try {
			const result = (await startRide({
				vehicleId: profile.vehicleId,
				routeId: selectedRouteId
			})) as { success?: boolean; error?: string };

			if (!result?.success) {
				errorMsg = result?.error ?? 'Unable to start ride right now.';
				return;
			}

			showEndRideModal = false;
			await refreshBootstrap();
			pageState = 'driving';
			showStartSheet = false;
			startPoll();
			startWatch();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to start ride right now.');
		} finally {
			isStartingRide = false;
		}
	}

	function openEndRideModal() {
		if (!ongoingRide?.id) {
			errorMsg = 'No active ride to end.';
			return;
		}

		errorMsg = '';
		if (onboardBookings.length === 0) {
			showEndRideModal = false;
			void submitEndRide();
			return;
		}
		showEndRideModal = true;
	}

	async function submitEndRide() {
		if (isEndingRide) return;
		const rideId = ongoingRide?.id;
		if (!rideId) {
			errorMsg = 'No active ride to end.';
			showEndRideModal = false;
			return;
		}

		isEndingRide = true;
		errorMsg = '';

		try {
			const result = (await endRide({ rideId })) as {
				success?: boolean;
				error?: string;
				autoAlightedCount?: number;
			};

			if (!result?.success) {
				showEndRideModal = false;
				errorMsg = result?.error ?? 'Unable to end ride right now.';
				return;
			}

			showEndRideModal = false;
			ongoingRide = null;
			bookings = [];
			driverLocation = null;
			errorMsg = '';
			stopPoll();
			stopWatch();
			pageState = 'offline';
			selectedRouteId = '';
			lastRideEndTime = Date.now();
			await refreshBootstrap();
		} catch (error) {
			showEndRideModal = false;
			errorMsg = getErrorMessage(error, 'Unable to end ride right now.');
		} finally {
			isEndingRide = false;
		}
	}

	async function handleAccept(bookingId: string) {
		if (acceptingBookingId) return;
		
		// Add debounce to prevent rapid accept spam
		const timeSinceLastAttempt = Date.now() - lastAcceptAttemptTime;
		if (timeSinceLastAttempt < BOOKING_ACTION_DEBOUNCE) return;
		
		lastAcceptAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		acceptingBookingId = bookingId;
		// Optimistically move request to onboard to avoid remove/reinsert flicker.
		bookings = bookings.map((b) => (b.id === bookingId ? { ...b, status: 'onboard' } : b));

		try {
			await acceptBooking({ bookingId });
			await refreshLiveState();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to accept booking right now.');
			await refreshLiveState();
		} finally {
			acceptingBookingId = null;
		}
	}

	async function handleComplete(bookingId: string) {
		if (completingBookingId) return;
		
		// Add debounce to prevent rapid complete actions
		const timeSinceLastAttempt = Date.now() - lastCompleteAttemptTime;
		if (timeSinceLastAttempt < COMPLETE_DEBOUNCE) return;
		
		lastCompleteAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		completingBookingId = bookingId;
		// Optimistically mark passenger as completed so occupancy updates immediately.
		bookings = bookings.map((b) => (b.id === bookingId ? { ...b, status: 'completed' } : b));

		try {
			await completeBooking({ bookingId });
			await refreshLiveState();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to complete booking right now.');
			await refreshLiveState();
		} finally {
			completingBookingId = null;
		}
	}

	async function handleReject(bookingId: string) {
		if (rejectingBookingId) return;
		
		// Add debounce to prevent rapid reject spam
		const timeSinceLastAttempt = Date.now() - lastRejectAttemptTime;
		if (timeSinceLastAttempt < BOOKING_ACTION_DEBOUNCE) return;
		
		lastRejectAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		rejectingBookingId = bookingId;
		// Optimistically remove from list
		bookings = bookings.filter((b) => b.id !== bookingId);

		try {
			await rejectBooking({ bookingId });
			await refreshLiveState();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to reject booking right now.');
			await refreshLiveState();
		} finally {
			rejectingBookingId = null;
		}
	}

	async function handleManualBoardPassenger() {
		if (isAddingManualPassenger) return;
		isAddingManualPassenger = true;
		errorMsg = '';

		try {
			const result = (await manualBoardPassenger({})) as { success?: boolean; error?: string };
			if (!result?.success) {
				errorMsg = result?.error ?? 'Unable to add passenger right now.';
				return;
			}
			await refreshLiveState();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to add passenger right now.');
		} finally {
			isAddingManualPassenger = false;
		}
	}

	async function handleManualAlightPassenger() {
		if (isRemovingManualPassenger) return;
		isRemovingManualPassenger = true;
		errorMsg = '';

		try {
			const result = (await manualAlightPassenger({})) as { success?: boolean; error?: string };
			if (!result?.success) {
				errorMsg = result?.error ?? 'Unable to remove passenger right now.';
				return;
			}
			await refreshLiveState();
		} catch (error) {
			errorMsg = getErrorMessage(error, 'Unable to remove passenger right now.');
		} finally {
			isRemovingManualPassenger = false;
		}
	}

	// ─── Derived ─────────────────────────────────────────────────────────────────
	let pendingBookings = $derived(bookings.filter((b) => b.status === 'pending'));
	let onboardBookings = $derived(bookings.filter((b) => b.status === 'onboard'));
	let occupancy = $derived.by(() => {
		const currentRide = ongoingRide;
		if (currentRide?.occupiedSeats != null) return currentRide.occupiedSeats;
		return onboardBookings.length;
	});
	let capacity = $derived.by(() => {
		const currentRide = ongoingRide;
		return (
			currentRide?.totalSeats ?? currentRide?.vehicle?.capacity ?? profile?.vehicle?.capacity ?? 0
		);
	});
	let manualPassengers = $derived(Math.max(0, occupancy - onboardBookings.length));
	let occupancyPct = $derived(capacity > 0 ? (occupancy / capacity) * 100 : 0);
	let activeRoute = $derived.by(() => {
		const currentRide = ongoingRide;
		return currentRide?.route ?? null;
	});
	let routeDestination: [number, number] | null = $derived.by(() => {
		if (!activeRoute) return null;
		const destination: [number, number] = [
			activeRoute.destinationLatitude,
			activeRoute.destinationLongitude
		];
		return isValidLatLng(destination) ? destination : null;
	});
	let mapMarker: [number, number] = $derived.by(() => {
		const liveLocation = driverLocation;
		if (isValidLatLng(liveLocation)) return liveLocation;

		if (activeRoute) {
			const origin: [number, number] = [activeRoute.originLatitude, activeRoute.originLongitude];
			if (isValidLatLng(origin)) return origin;
		}

		return [14.5995, 120.9842];
	});
	let passengerMarkers = $derived(
		pendingBookings
			.map((b) => {
				const target = getPassengerTargetLocation(b);
				if (!target) return null;
				return {
					id: `pending-${b.id}`,
					position: target,
					label: `${b.passenger.user.name} waiting`,
					html: PASSENGER_MARKER_HTML,
					iconSize: [32, 32] as [number, number],
					iconAnchor: [16, 32] as [number, number]
				};
			})
			.filter((marker): marker is NonNullable<typeof marker> => marker !== null)
	);
	let passengerEtaMarkers = $derived.by(() => {
		const driverCoords = getDriverReferenceLocation();
		if (!driverCoords) return [];

		return pendingBookings
			.map((b) => {
				const target = getPassengerTargetLocation(b);
				const proximityLabel = getPassengerProximityLabel(b);
				if (!target || !proximityLabel) return null;

				return {
					id: `pending-eta-${b.id}`,
					position: getMidpoint(driverCoords, target),
					html: createEtaBadgeHtml(b.passenger.user.name, proximityLabel),
					iconSize: [150, 40] as [number, number],
					iconAnchor: [75, 20] as [number, number]
				};
			})
			.filter((marker): marker is NonNullable<typeof marker> => marker !== null);
	});
	let mapOverlays = $derived([...passengerMarkers, ...passengerEtaMarkers]);


	// ─── Static marker HTML ───────────────────────────────────────────────────────
	const SELF_MARKER_HTML = `
		<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#191970;border-radius:12px;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25)">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-car-taxi-front-icon lucide-car-taxi-front"><path d="M10 2h4"/><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/></svg>		
		</div>`;

	const PASSENGER_MARKER_HTML = `
		<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f59e0b;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round-icon lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
		</div>`;
</script>

<!-- ─── Root ──────────────────────────────────────────────────────────────── -->
<div class="driver-root">
	<!-- Map -->
	<div class="map-layer">
		<MapView
			center={mapMarker}
			zoom={14}
			marker={mapMarker}
			destination={routeDestination}
			useOsrm={pageState === 'driving' && routeDestination !== null}
			destinationLabel="Route destination"
			liveMarker={driverLocation}
			liveMarkerLabel="You are here"
			liveMarkerHtml={SELF_MARKER_HTML}
			overlayMarkers={pageState === 'driving' ? mapOverlays : []}
			followLiveMarker={pageState === 'driving' && driverLocation !== null}
			fullBleed={true}
			height="100dvh"
			mapAriaLabel="Driver map"
		/>
	</div>

	<!-- Error toast -->
	{#if errorMsg}
		<div class="error-toast" role="alert">
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line
					x1="12"
					x2="12.01"
					y1="16"
					y2="16"
				/></svg
			>
			{errorMsg}
			<button type="button" onclick={() => (errorMsg = '')} aria-label="Dismiss">✕</button>
		</div>
	{/if}

	<!-- Bottom sheet area -->
	<div class="bottom-area">
		<!-- LOADING -->
		{#if pageState === 'loading'}
			<div class="sheet justify-center text-center">
				<div class="handle"></div>
				<div class="loading-row">
					<div class="spinner"></div>
					<span class="text-center">Loading your profile…</span>
				</div>
			</div>

			<!-- OFFLINE -->
		{:else if pageState === 'offline'}
			<div class="sheet">
				<div class="handle"></div>

				{#if profile?.vehicle}
					<div class="vehicle-strip">
						<CarTaxiFront size="24" color="#334155" />
						<div class="vehicle-info">
							<span class="vehicle-model">{profile.vehicle.model}</span>
							<span class="vehicle-plate"
								>{profile.vehicle.plateNumber} · {profile.vehicle.capacity} seats</span
							>
						</div>
						<div class="ready-badge">Ready</div>
					</div>
				{:else}
					<div class="notice warning">
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="#f59e0b"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line
								x1="12"
								x2="12.01"
								y1="16"
								y2="16"
							/></svg
						>
						No vehicle assigned. Contact your cooperative admin.
					</div>
				{/if}

				<div class="offline-actions">
					{#if !profile?.isAvailable}
						<p class="hint">Go online first to start accepting passengers.</p>
						<button
							type="button"
							class="outline-btn"
							onclick={handleToggleAvailability}
							disabled={isTogglingAvailability}
						>
							{isTogglingAvailability ? 'Updating…' : 'Go Online'}
						</button>
					{:else}
						<button
							type="button"
							class="primary-btn"
							onclick={openStartSheet}
							disabled={!profile?.vehicle}
						>
							<Play size="16" />
							Start a Ride
						</button>
					{/if}
				</div>
			</div>

			<!-- DRIVING -->
		{:else if pageState === 'driving' && ongoingRide}
			<div class="sheet driving-sheet">
				<div class="handle"></div>

				<!-- Ride header -->
				<div class="ride-header">
					<div>
						<span class="live-badge"><span class="live-dot"></span>Ride Active</span>
						<h2 class="route-name">{ongoingRide.route?.name ?? 'Active Route'}</h2>
					</div>
					<button
						type="button"
						class="end-btn"
						onclick={openEndRideModal}
						disabled={isEndingRide || !ongoingRide?.id}
					>
						{isEndingRide ? 'Ending…' : 'End Ride'}
					</button>
				</div>

				<!-- Occupancy -->
				<div class="occ-section">
					<div class="occ-nums">
						<span class="occ-cur">{occupancy}</span>
						<span class="occ-sep">/</span>
						<span class="occ-cap">{capacity}</span>
						<span class="occ-lbl">passengers</span>
					</div>
					<div class="occ-track">
						<div
							class="occ-fill"
							class:warn={occupancyPct >= 75 && occupancyPct < 100}
							class:full={occupancyPct >= 100}
							style="width:{Math.min(occupancyPct, 100)}%"
						></div>
					</div>
					<div class="manual-actions">
						<button
							type="button"
							class="manual-btn add"
							onclick={handleManualBoardPassenger}
							disabled={isAddingManualPassenger || occupancy >= capacity}
						>
							{isAddingManualPassenger ? 'Adding…' : '+ Walk-in'}
						</button>
						<button
							type="button"
							class="manual-btn remove"
							onclick={handleManualAlightPassenger}
							disabled={isRemovingManualPassenger || manualPassengers <= 0}
						>
							{isRemovingManualPassenger ? 'Removing…' : '- Walk-in'}
						</button>
					</div>
					<p class="manual-meta">Manual passengers: {manualPassengers}</p>
				</div>

				<!-- Pending -->
				{#if pendingBookings.length > 0}
					<div class="section-label">
						<span>Requests</span>
						<span class="chip">{pendingBookings.length}</span>
					</div>
					<ul class="booking-list">
						{#each pendingBookings as b (b.id)}
							{@const proximityLabel = getPassengerProximityLabel(b)}
							<li class="booking-card pending">
								<div class="avatar">{b.passenger.user.name.charAt(0).toUpperCase()}</div>
								<div class="pax-info">
									<span class="pax-name">{b.passenger.user.name}</span>
									<span class="pax-meta"
										>Requesting pickup{proximityLabel ? ` • ${proximityLabel}` : ''}</span
									>
								</div>
								<div class="card-actions">
									<button
										type="button"
										class="reject-btn"
										onclick={() => handleReject(b.id)}
										aria-label="Reject"
										disabled={rejectingBookingId !== null}
									>
									<X size="14" />
									</button>
									<button
										type="button"
										class="accept-btn"
										onclick={() => handleAccept(b.id)}
										aria-label="Accept"
										disabled={acceptingBookingId !== null}
									>
										{#if acceptingBookingId === b.id}
											<span class="mini-spinner" aria-hidden="true"></span>
										{:else}
											<Check size="14" />
										{/if}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}

				<!-- Onboard -->
				{#if onboardBookings.length > 0}
					<div class="section-label" style="margin-top:.75rem">
						<span>On Board</span>
						<span class="chip onboard-chip">{onboardBookings.length}</span>
					</div>
					<ul class="booking-list">
						{#each onboardBookings as b (b.id)}
							<li class="booking-card onboard">
								<div class="avatar onboard-av">{b.passenger.user.name.charAt(0).toUpperCase()}</div>
								<div class="pax-info">
									<span class="pax-name">{b.passenger.user.name}</span>
									<span class="pax-meta">On board</span>
								</div>
								<button
									type="button"
									class="alight-btn"
									onclick={() => handleComplete(b.id)}
									disabled={completingBookingId !== null}
								>
									{completingBookingId === b.id ? 'Alighting…' : 'Alight'}
								</button>
							</li>
						{/each}
					</ul>
				{/if}

				{#if pendingBookings.length === 0 && onboardBookings.length === 0}
					<div class="empty">
						<UsersRound size="48" color="#94a3b8" />
						<p>No passengers yet</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Start ride sheet -->
	{#if showStartSheet}
		<div
			class="overlay"
			role="button"
			tabindex="0"
			aria-label="Close"
			onclick={() => (showStartSheet = false)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showStartSheet = false)}
		></div>
		<div class="action-sheet">
			<div class="handle"></div>
			<h3 class="sheet-title">Start a New Ride</h3>

			<div class="form-group">
				<p class="form-label">Select Route</p>
				{#if routes.length === 0}
					<div class="notice">No routes available. Ask your admin to add routes.</div>
				{:else}
					<div class="route-list">
						{#each routes as r (r.id)}
							<button
								type="button"
								class="route-opt"
								class:selected={selectedRouteId === r.id}
								onclick={() => (selectedRouteId = r.id)}
							>
								<span class="route-opt-name">{r.name}</span>
								<span class="route-opt-dist">{r.distance.toFixed(1)} km</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if errorMsg}<p class="form-error">{errorMsg}</p>{/if}

			<button
				type="button"
				class="primary-btn"
				onclick={handleStartRide}
				disabled={!selectedRouteId || isStartingRide || routes.length === 0}
			>
				{isStartingRide ? 'Starting…' : 'Start Ride'}
			</button>
			<button type="button" class="ghost-btn" onclick={() => (showStartSheet = false)}
				>Cancel</button
			>
		</div>
	{/if}

	{#if showEndRideModal}
		<div
			class="overlay"
			role="button"
			tabindex="0"
			aria-label="Close end ride confirmation"
			onclick={() => (showEndRideModal = false)}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (showEndRideModal = false)}
		></div>
		<div class="action-sheet confirm-sheet">
			<div class="handle"></div>
			<h3 class="sheet-title">End Ride?</h3>
			<p class="confirm-copy">
				There {onboardBookings.length === 1 ? 'is' : 'are'} still
				<strong>{onboardBookings.length}</strong>
				onboard passenger{onboardBookings.length === 1 ? '' : 's'}. Are you sure you want to
				continue?
			</p>
			<p class="confirm-note">Continuing will automatically mark onboard passengers as alighted.</p>
			<div class="confirm-actions">
				<button
					type="button"
					class="ghost-btn"
					onclick={() => (showEndRideModal = false)}
					disabled={isEndingRide}>Cancel</button
				>
				<button
					type="button"
					class="end-btn confirm-end-btn"
					onclick={submitEndRide}
					disabled={isEndingRide}
				>
					{isEndingRide ? 'Ending…' : 'Yes, End Ride'}
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Outfit', sans-serif;
	}

	/* ── Root ── */
	.driver-root {
		position: relative;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background: #f1f5f9;
	}
	.map-layer {
		position: absolute;
		inset: 0;
		z-index: 1;
	}
	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}

	/* ── Error toast ── */
	.error-toast {
		position: absolute;
		top: 5rem;
		left: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.625rem;
		padding: 0.625rem 0.875rem;
		font-size: 0.825rem;
		font-weight: 500;
		color: #dc2626;
		z-index: 20;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}
	.error-toast button {
		margin-left: auto;
		background: none;
		border: none;
		color: #dc2626;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
	}

	/* ── Bottom area ── */
	.bottom-area {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 30;
	}

	/* ── Sheet base ── */
	.sheet {
		background: white;
		border-radius: 1.5rem 1.5rem 0 0;
		padding: 0.75rem 1.25rem 2.5rem;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.08);
		border-top: 1px solid #f1f5f9;
	}
	.driving-sheet {
		max-height: 70dvh;
		overflow-y: auto;
	}
	.handle {
		width: 40px;
		height: 4px;
		background: #e2e8f0;
		border-radius: 2px;
		margin: 0 auto 1.25rem;
	}

	/* ── Loading ── */
	.loading-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.875rem;
		color: #64748b;
		padding: 0.5rem 0;
		text-align: center;
	}
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #e2e8f0;
		border-top-color: #334155;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		flex-shrink: 0;
	}
	.mini-spinner {
		width: 12px;
		height: 12px;
		border: 2px solid rgba(255, 255, 255, 0.5);
		border-top-color: #fff;
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
		display: inline-block;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Vehicle strip ── */
	.vehicle-strip {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
	}
	.vehicle-info {
		flex: 1;
	}
	.vehicle-model {
		display: block;
		font-size: 0.875rem;
		font-weight: 700;
		color: #0f172a;
	}
	.vehicle-plate {
		display: block;
		font-size: 0.75rem;
		color: #64748b;
	}
	.ready-badge {
		font-size: 0.7rem;
		font-weight: 700;
		color: #16a34a;
		background: #dcfce7;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.notice {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.825rem;
		color: #475569;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.625rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
	}
	.notice.warning {
		color: #92400e;
		background: #fffbeb;
		border-color: #fde68a;
	}

	.offline-actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.hint {
		font-size: 0.825rem;
		color: #94a3b8;
		text-align: center;
		margin: 0 0 0.75rem;
	}

	/* ── Ride header ── */
	.ride-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.live-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #16a34a;
		margin-bottom: 0.25rem;
	}
	.live-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #22c55e;
		animation: blink 1.5s ease-in-out infinite;
	}
	.route-name {
		font-size: 1.2rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 0.25rem;
		letter-spacing: -0.02em;
	}

	.end-btn {
		padding: 0.5rem 0.875rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.5rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.8rem;
		font-weight: 700;
		color: #ef4444;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s;
	}
	.end-btn:hover:not(:disabled) {
		background: #fee2e2;
	}
	.end-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── Occupancy ── */
	.occ-section {
		margin-bottom: 1rem;
	}
	.occ-nums {
		display: flex;
		align-items: baseline;
		gap: 0.2rem;
		margin-bottom: 0.5rem;
	}
	.occ-cur {
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
		line-height: 1;
	}
	.occ-sep {
		font-size: 1.25rem;
		color: #cbd5e1;
	}
	.occ-cap {
		font-size: 1.25rem;
		font-weight: 600;
		color: #94a3b8;
	}
	.occ-lbl {
		font-size: 0.8rem;
		color: #94a3b8;
		margin-left: 0.25rem;
		font-weight: 500;
	}
	.occ-track {
		height: 6px;
		background: #f1f5f9;
		border-radius: 3px;
		overflow: hidden;
	}
	.occ-fill {
		height: 100%;
		background: #22c55e;
		border-radius: 3px;
		transition:
			width 0.4s ease,
			background 0.3s;
	}
	.occ-fill.warn {
		background: #f59e0b;
	}
	.occ-fill.full {
		background: #ef4444;
	}
	.manual-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.manual-btn {
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		background: white;
		padding: 0.45rem 0.6rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.manual-btn.add {
		color: #166534;
		border-color: #86efac;
		background: #f0fdf4;
	}
	.manual-btn.add:hover:not(:disabled) {
		background: #dcfce7;
	}
	.manual-btn.remove {
		color: #9a3412;
		border-color: #fdba74;
		background: #fff7ed;
	}
	.manual-btn.remove:hover:not(:disabled) {
		background: #ffedd5;
	}
	.manual-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.manual-meta {
		margin: 0.4rem 0 0;
		font-size: 0.74rem;
		color: #64748b;
	}

	/* ── Bookings ── */
	.section-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
		margin-bottom: 0.5rem;
	}
	.chip {
		background: #fef3c7;
		color: #d97706;
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.1rem 0.4rem;
		border-radius: 0.375rem;
	}
	.onboard-chip {
		background: #dcfce7;
		color: #16a34a;
	}

	.booking-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.booking-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
	}
	.booking-card.pending {
		background: #fffbeb;
		border-color: #fde68a;
	}
	.booking-card.onboard {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}

	.avatar {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: #e2e8f0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 800;
		color: #475569;
		flex-shrink: 0;
	}
	.onboard-av {
		background: #dcfce7;
		color: #16a34a;
	}
	.pax-info {
		flex: 1;
		min-width: 0;
	}
	.pax-name {
		display: block;
		font-size: 0.875rem;
		font-weight: 700;
		color: #0f172a;
	}
	.pax-meta {
		display: block;
		font-size: 0.75rem;
		color: #64748b;
	}

	.card-actions {
		display: flex;
		gap: 0.375rem;
		flex-shrink: 0;
	}
	.reject-btn,
	.accept-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 0.15s;
	}
	.reject-btn {
		background: #fee2e2;
		color: #ef4444;
	}
	.reject-btn:hover {
		background: #fecaca;
	}
	.accept-btn {
		background: #dcfce7;
		color: #16a34a;
	}
	.accept-btn:hover {
		background: #bbf7d0;
	}
	.accept-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.alight-btn {
		padding: 0.375rem 0.75rem;
		background: white;
		border: 1px solid #bbf7d0;
		border-radius: 0.5rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.775rem;
		font-weight: 700;
		color: #16a34a;
		cursor: pointer;
		flex-shrink: 0;
		transition: background 0.15s;
	}
	.alight-btn:hover {
		background: #f0fdf4;
	}

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem;
		color: #94a3b8;
		font-size: 0.825rem;
		text-align: center;
	}

	/* ── Overlay ── */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.35);
		z-index: 40;
		backdrop-filter: blur(2px);
	}
	@keyframes popIn {
		from {
			opacity: 0;
			transform: translateY(-8px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	/* ── Action sheets ── */
	.action-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		border-radius: 1.5rem 1.5rem 0 0;
		padding: 0.75rem 1.5rem 2.5rem;
		z-index: 41;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.12);
		animation: slideUp 0.2s ease-out;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.sheet-title {
		font-size: 1.2rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 1.25rem;
		letter-spacing: -0.02em;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}
	.form-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #94a3b8;
		margin-bottom: 0.5rem;
	}
	.form-error {
		font-size: 0.8rem;
		color: #ef4444;
		margin: 0 0 0.75rem;
	}

	.route-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		max-height: 180px;
		overflow-y: auto;
	}
	.route-opt {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: #f8fafc;
		border: 1.5px solid #e2e8f0;
		border-radius: 0.625rem;
		cursor: pointer;
		transition: all 0.15s;
		font-family: 'Outfit', sans-serif;
		text-align: left;
	}
	.route-opt.selected {
		background: #eff6ff;
		border-color: #3b82f6;
	}
	.route-opt-name {
		font-size: 0.875rem;
		font-weight: 600;
		color: #0f172a;
	}
	.route-opt-dist {
		font-size: 0.775rem;
		color: #94a3b8;
		font-weight: 500;
	}
	.route-opt.selected .route-opt-dist {
		color: #3b82f6;
	}

	/* ── Buttons ── */
	.primary-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.875rem;
		background: #0f172a;
		color: white;
		border: none;
		border-radius: 0.75rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.9375rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
		margin-bottom: 0.5rem;
	}
	.primary-btn:hover:not(:disabled) {
		background: #1e293b;
	}
	.primary-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.outline-btn {
		width: 100%;
		padding: 0.875rem;
		background: white;
		border: 1.5px solid #0f172a;
		border-radius: 0.75rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.9375rem;
		font-weight: 700;
		color: #0f172a;
		cursor: pointer;
		transition: background 0.15s;
	}
	.outline-btn:hover:not(:disabled) {
		background: #f8fafc;
	}
	.outline-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.ghost-btn {
		width: 100%;
		padding: 0.75rem;
		background: none;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.875rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		transition: background 0.15s;
		margin-top: 0.5rem;
	}
	.ghost-btn:hover {
		background: #f8fafc;
	}

	.confirm-sheet {
		text-align: center;
	}
	.confirm-copy {
		margin: 0 0 0.5rem;
		color: #334155;
		font-size: 0.9rem;
		line-height: 1.45;
	}
	.confirm-note {
		margin: 0 0 1rem;
		color: #64748b;
		font-size: 0.8rem;
	}
	.confirm-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.confirm-end-btn {
		margin-top: 0.5rem;
	}

	/* ── Leaflet z-index fixes ── */
	:global(.leaflet-control-zoom),
	:global(.leaflet-control-attribution),
	:global(.leaflet-control) {
		z-index: 9 !important;
	}
	:global(.leaflet-pane),
	:global(.leaflet-top),
	:global(.leaflet-bottom) {
		z-index: 8 !important;
	}
</style>
