<script lang="ts">
	// ─── Imports ─────────────────────────────────────────────────────────────────
	import { onMount, onDestroy, tick } from 'svelte';
	import MapView from '$lib/components/mapView.svelte';
	import {
		getDriverProfile,
		getCooperativeRoutes,
		getOngoingRide,
		getBookings,
		startRide,
		endRide,
		acceptBooking,
		completeBooking,
		rejectBooking,
		updateDriverLocation,
		toggleDriverAvailability
	} from '$lib/api/driver.remote';
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
	const profileQuery = getDriverProfile();
	const routesQuery = getCooperativeRoutes();
	const rideQuery = getOngoingRide();
	const bookingsQuery = getBookings();

	// ─── Page State ───────────────────────────────────────────────────────────────
	let pageState: PageState = $state('loading');
	let profile: DriverProfile | null = $state(null);
	let ongoingRide: OngoingRide = $state(null);
	let bookings: Booking[] = $state([]);
	let routes: Route[] = $state([]);
	let errorMsg: string = $state('');
	let endRidePayloadId: string = $state('');
	let bookingsRequestSeq = 0;
	let bookingsMutationEpoch = 0;
	let lastSeenAcceptResult: unknown = null;
	let lastSeenCompleteResult: unknown = null;
	let lastSeenRejectResult: unknown = null;
	let lastSeenStartRideResult: unknown = null;
	let lastSeenEndRideResult: unknown = null;

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

	// Hidden form payload state — each action gets its own var to avoid races
	let startVehicleId: string = $state('');
	let startRouteId: string = $state('');
	let acceptId: string = $state('');
	let acceptingBookingId: string | null = $state(null);
	let completeId: string = $state('');
	let completingBookingId: string | null = $state(null);
	let rejectId: string = $state('');
	let rejectingBookingId: string | null = $state(null);
	let locLat: string = $state('');
	let locLng: string = $state('');

	// Live location
	let driverLocation: [number, number] | null = $state(null);

	// Ride state tracking (for preventing stale query overwrites)
	let lastRideEndTime: number = 0;
	let lastCompleteAttemptTime: number = 0;
	let lastAcceptAttemptTime: number = 0;
	let lastRejectAttemptTime: number = 0;
	const BOOKING_ACTION_DEBOUNCE: number = 500;
	const COMPLETE_DEBOUNCE: number = 500;

	// Timers
	let locationWatcher: number | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let lastLocUpdate = 0;
	const LOC_THROTTLE = 5000;

	// ─── Form element refs ────────────────────────────────────────────────────────
	let toggleAvailForm: HTMLFormElement;
	let updateLocForm: HTMLFormElement;
	let startRideForm: HTMLFormElement;
	let endRideForm: HTMLFormElement;
	let acceptForm: HTMLFormElement;
	let completeForm: HTMLFormElement;
	let rejectForm: HTMLFormElement;

	// ─── Lifecycle ────────────────────────────────────────────────────────────────
	onMount(() => void init());
	onDestroy(() => {
		stopPoll();
		stopWatch();
	});

	async function init() {
		await refreshCore();
		if (ongoingRide) {
			pageState = 'driving';
			await loadBookings();
			startPoll();
			startWatch();
		} else {
			pageState = 'offline';
		}
	}

	async function refreshCore() {
		try {
			await Promise.all([profileQuery.refresh(), rideQuery.refresh()]);
			profile = (profileQuery.current as DriverProfile | null) ?? null;

			// If driver is offline, never show a ride
			if (profile && !profile.isAvailable) {
				ongoingRide = null;
			} else {
				// Prevent stale queries from overwriting a recently-ended ride
				const timeSinceRideEnd = Date.now() - lastRideEndTime;
				if (timeSinceRideEnd < 3000 && ongoingRide === null) {
					// Keep ride cleared for 3 seconds after end to avoid race conditions
				} else {
					ongoingRide = (rideQuery.current as OngoingRide) ?? null;
				}
			}

			if (profile?.latitude != null && profile?.longitude != null) {
				driverLocation = [profile.latitude, profile.longitude];
			}
		} catch {
			pageState = 'offline';
		}
	}

	async function loadBookings() {
		try {
			const requestSeq = ++bookingsRequestSeq;
			const mutationEpochAtStart = bookingsMutationEpoch;
			await Promise.all([bookingsQuery.refresh(), rideQuery.refresh()]);
			if (requestSeq !== bookingsRequestSeq) return;
			if (mutationEpochAtStart !== bookingsMutationEpoch) return;
			bookings = (bookingsQuery.current as Booking[] | undefined) ?? [];
			
			// Only update ride if not in the stale period after ride end
			const timeSinceRideEnd = Date.now() - lastRideEndTime;
			if (!(timeSinceRideEnd < 3000 && ongoingRide === null)) {
				ongoingRide = (rideQuery.current as OngoingRide) ?? null;
			}
		} catch {
			/* silent poll failure */
		}
	}

	// ─── Polling ──────────────────────────────────────────────────────────────────
	function startPoll() {
		if (pollInterval) return;
		pollInterval = setInterval(async () => {
			if (pageState !== 'driving') return;
			if (acceptingBookingId || acceptBooking.pending > 0) return;
			if (completingBookingId || completeBooking.pending > 0) return;
			await loadBookings();
		}, 5000);
	}

	function stopPoll() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
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
				lastLocUpdate = now;

				locLat = String(coords[0]);
				locLng = String(coords[1]);
				await tick();
				updateLocForm.requestSubmit();
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
	function handleToggleAvailability() {
		errorMsg = '';
		toggleAvailForm.requestSubmit();
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
		if (!selectedRouteId || !profile?.vehicleId) return;
		errorMsg = '';
		startVehicleId = profile.vehicleId;
		startRouteId = selectedRouteId;
		await tick();
		startRideForm.requestSubmit();
	}

	function openEndRideModal() {
		if (!ongoingRide?.id) {
			errorMsg = 'No active ride to end.';
			return;
		}

		errorMsg = '';
		showEndRideModal = true;
	}

	async function submitEndRide() {
		const rideId = ongoingRide?.id;
		if (!rideId) {
			errorMsg = 'No active ride to end.';
			showEndRideModal = false;
			return;
		}

		if (!endRideForm) {
			errorMsg = 'End ride form is not ready.';
			return;
		}

		errorMsg = '';
		endRidePayloadId = rideId;
		await tick();
		endRideForm.requestSubmit();
	}

	async function handleAccept(bookingId: string) {
		if (acceptingBookingId || acceptBooking.pending > 0) return;
		
		// Add debounce to prevent rapid accept spam
		const timeSinceLastAttempt = Date.now() - lastAcceptAttemptTime;
		if (timeSinceLastAttempt < BOOKING_ACTION_DEBOUNCE) return;
		
		lastAcceptAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		acceptingBookingId = bookingId;
		// Optimistically move request to onboard to avoid remove/reinsert flicker.
		bookings = bookings.map((b) => (b.id === bookingId ? { ...b, status: 'onboard' } : b));

		acceptId = bookingId;
		await tick();
		acceptForm.requestSubmit();
	}

	async function handleComplete(bookingId: string) {
		if (completingBookingId || completeBooking.pending > 0) return;
		
		// Add debounce to prevent rapid complete actions
		const timeSinceLastAttempt = Date.now() - lastCompleteAttemptTime;
		if (timeSinceLastAttempt < COMPLETE_DEBOUNCE) return;
		
		lastCompleteAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		completingBookingId = bookingId;
		// Optimistically mark passenger as completed so occupancy updates immediately.
		bookings = bookings.map((b) => (b.id === bookingId ? { ...b, status: 'completed' } : b));

		completeId = bookingId;
		await tick();
		completeForm.requestSubmit();
	}

	async function handleReject(bookingId: string) {
		if (rejectingBookingId || rejectBooking.pending > 0) return;
		
		// Add debounce to prevent rapid reject spam
		const timeSinceLastAttempt = Date.now() - lastRejectAttemptTime;
		if (timeSinceLastAttempt < BOOKING_ACTION_DEBOUNCE) return;
		
		lastRejectAttemptTime = Date.now();
		bookingsMutationEpoch += 1;
		rejectingBookingId = bookingId;
		// Optimistically remove from list
		bookings = bookings.filter((b) => b.id !== bookingId);

		rejectId = bookingId;
		await tick();
		rejectForm.requestSubmit();
	}

	// ─── Form result effects ──────────────────────────────────────────────────────
	$effect(() => {
		const r = toggleDriverAvailability.result as {
			success?: boolean;
			error?: string;
			isAvailable?: boolean;
		} | null;
		if (!r) return;
		if (r.success) {
			void (async () => {
				// When going offline, immediately clear ride state to prevent stale data
				if (r.isAvailable === false) {
					ongoingRide = null;
					bookings = [];
					driverLocation = null;
					stopPoll();
					stopWatch();
					pageState = 'offline';
					lastRideEndTime = Date.now();
				}
				await refreshCore();
				if (r.isAvailable === true) {
					routes = [];
					showStartSheet = false;
				}
			})();
		} else if (r.error) errorMsg = r.error;
	});

	$effect(() => {
		const r = startRide.result as { success?: boolean; error?: string } | null;
		if (!r) return;
		if (r === lastSeenStartRideResult) return;
		lastSeenStartRideResult = r;
		if (r.success) {
			showEndRideModal = false;
			void (async () => {
				await refreshCore();
				pageState = 'driving';
				await loadBookings();
				showStartSheet = false;
				startPoll();
				startWatch();
			})();
		} else if (r.error) errorMsg = r.error;
	});

	$effect(() => {
		const r = endRide.result as {
			success?: boolean;
			error?: string;
			autoAlightedCount?: number;
		} | null;
		if (!r) return;
		if (r === lastSeenEndRideResult) return;
		lastSeenEndRideResult = r;
		if (r.success) {
			showEndRideModal = false;
			ongoingRide = null;
			bookings = [];
			driverLocation = null;
			endRidePayloadId = '';
			errorMsg = '';
			stopPoll();
			stopWatch();
			pageState = 'offline';
			// Clear all form state to prevent stale data on page reload
			startVehicleId = '';
			startRouteId = '';
			selectedRouteId = '';
			lastRideEndTime = Date.now();
			void (async () => {
				await refreshCore();
			})();
		} else if (r.error) {
			showEndRideModal = false;
			errorMsg = r.error;
		}
	});

	$effect(() => {
		const ar = acceptBooking.result as { success?: boolean; error?: string } | null;
		const cr = completeBooking.result as { success?: boolean; error?: string } | null;
		const rr = rejectBooking.result as { success?: boolean; error?: string } | null;

		if (ar?.success || cr?.success || rr?.success) {
			void loadBookings();
		}

		if (ar && ar !== lastSeenAcceptResult) {
			lastSeenAcceptResult = ar;
			acceptingBookingId = null;
		}
		if (ar?.error) {
			errorMsg = ar.error;
			acceptingBookingId = null;
			void loadBookings();
		}

		if (cr && cr !== lastSeenCompleteResult) {
			lastSeenCompleteResult = cr;
			completingBookingId = null;
		}
		if (cr?.error) {
			errorMsg = cr.error;
			completingBookingId = null;
			void loadBookings();
		}

		if (rr && rr !== lastSeenRejectResult) {
			lastSeenRejectResult = rr;
			rejectingBookingId = null;
		}
		if (rr?.error) {
			errorMsg = rr.error;
			rejectingBookingId = null;
			void loadBookings();
		}
	});

	// ─── Derived ─────────────────────────────────────────────────────────────────
	let pendingBookings = $derived(bookings.filter((b) => b.status === 'pending'));
	let onboardBookings = $derived(bookings.filter((b) => b.status === 'onboard'));
	let occupancy = $derived(onboardBookings.length);
	let capacity = $derived.by(() => {
		const currentRide = ongoingRide;
		return (
			currentRide?.totalSeats ?? currentRide?.vehicle?.capacity ?? profile?.vehicle?.capacity ?? 0
		);
	});
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
		bookings
			.filter(
				(b) => b.status === 'pending' && b.boardingLatitude != null && b.boardingLongitude != null
			)
			.map((b) => ({
				id: `pending-${b.id}`,
				position: [b.boardingLatitude!, b.boardingLongitude!] as [number, number],
				label: `${b.passenger.user.name} waiting`,
				html: PASSENGER_MARKER_HTML,
				iconSize: [32, 32] as [number, number],
				iconAnchor: [16, 32] as [number, number]
			}))
	);
	let isEndingRide = $derived(endRide.pending > 0);

	// ─── Static marker HTML ───────────────────────────────────────────────────────
	const SELF_MARKER_HTML = `
		<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:#fffcc0;border-radius:12px;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.25)">
			<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-van-icon lucide-van"><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"/><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
		</div>`;

	const PASSENGER_MARKER_HTML = `
		<div style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:#f59e0b;border-radius:50%;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)">
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-round-icon lucide-user-round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
		</div>`;
</script>

<!-- ─── Hidden forms (SvelteKit form actions) ──────────────────────────────── -->
<form bind:this={toggleAvailForm} {...toggleDriverAvailability} class="hidden"></form>

<form bind:this={updateLocForm} {...updateDriverLocation} class="hidden">
	<input type="hidden" name="latitude" value={locLat} />
	<input type="hidden" name="longitude" value={locLng} />
</form>

<form bind:this={startRideForm} {...startRide} class="hidden">
	<input type="hidden" name="vehicleId" value={startVehicleId} />
	<input type="hidden" name="routeId" value={startRouteId} />
</form>

<form bind:this={endRideForm} {...endRide} class="hidden">
	<input type="hidden" name="rideId" value={endRidePayloadId} />
</form>

<form bind:this={acceptForm} {...acceptBooking} class="hidden">
	<input type="hidden" name="bookingId" value={acceptId} />
</form>

<form bind:this={completeForm} {...completeBooking} class="hidden">
	<input type="hidden" name="bookingId" value={completeId} />
</form>

<form bind:this={rejectForm} {...rejectBooking} class="hidden">
	<input type="hidden" name="bookingId" value={rejectId} />
</form>

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
			markerLabel={driverLocation ? 'You are here' : 'Route origin'}
			destinationLabel="Route destination"
			liveMarker={driverLocation}
			liveMarkerLabel="You are here"
			liveMarkerHtml={SELF_MARKER_HTML}
			overlayMarkers={pageState === 'driving' ? passengerMarkers : []}
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
							disabled={toggleDriverAvailability.pending > 0}
						>
							{toggleDriverAvailability.pending > 0 ? 'Updating…' : 'Go Online'}
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
				</div>

				<!-- Pending -->
				{#if pendingBookings.length > 0}
					<div class="section-label">
						<span>Requests</span>
						<span class="chip">{pendingBookings.length}</span>
					</div>
					<ul class="booking-list">
						{#each pendingBookings as b (b.id)}
							<li class="booking-card pending">
								<div class="avatar">{b.passenger.user.name.charAt(0).toUpperCase()}</div>
								<div class="pax-info">
									<span class="pax-name">{b.passenger.user.name}</span>
									<span class="pax-meta">Requesting pickup</span>
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
				disabled={!selectedRouteId || startRide.pending > 0 || routes.length === 0}
			>
				{startRide.pending > 0 ? 'Starting…' : 'Start Ride'}
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
	.hidden {
		display: none !important;
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
	.vehicle-icon {
		width: 36px;
		height: 36px;
		background: #e2e8f0;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
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
	.dir-tag {
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		background: #f1f5f9;
		padding: 0.2rem 0.5rem;
		border-radius: 0.375rem;
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
	.overlay-passive {
		pointer-events: none;
	}

	/* ── Incoming popup ── */
	.incoming-popup {
		position: fixed;
		left: 1rem;
		right: 1rem;
		top: 5.75rem;
		background: white;
		border: 1px solid #fcd34d;
		border-radius: 1rem;
		padding: 1rem;
		box-shadow: 0 18px 45px rgba(15, 23, 42, 0.25);
		z-index: 43;
		animation: popIn 0.2s ease-out;
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
	.inc-kicker {
		margin: 0 0 0.25rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b45309;
	}
	.inc-title {
		margin: 0;
		font-size: 1.1rem;
		font-weight: 800;
		color: #0f172a;
	}
	.inc-sub {
		margin: 0.2rem 0 0.9rem;
		font-size: 0.85rem;
		color: #475569;
	}
	.inc-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.inc-reject,
	.inc-accept {
		padding: 0.7rem;
		border-radius: 0.65rem;
		border: none;
		font-family: 'Outfit', sans-serif;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
	}
	.inc-reject {
		background: #fee2e2;
		color: #b91c1c;
	}
	.inc-accept {
		background: #dcfce7;
		color: #166534;
	}
	.inc-later {
		width: 100%;
		margin-top: 0.55rem;
		padding: 0.55rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.65rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.8rem;
		font-weight: 600;
		color: #64748b;
		background: white;
		cursor: pointer;
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

	.dir-toggle {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.dir-btn {
		padding: 0.75rem;
		background: #f8fafc;
		border: 1.5px solid #e2e8f0;
		border-radius: 0.625rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.825rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		transition: all 0.15s;
	}
	.dir-btn.active {
		background: #eff6ff;
		border-color: #3b82f6;
		color: #1d4ed8;
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
