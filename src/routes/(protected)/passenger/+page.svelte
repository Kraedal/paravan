<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { haversineDistance, calcETA } from '$lib/utils/eta';
	import Greetings from '$lib/components/greetings.svelte';

	import MapView from '$lib/components/mapView.svelte';
	import {
		setReady,
		setNotReady,
		getNearbyDrivers,
		requestBooking,
		cancelBooking,
		getActiveBooking,
		getPassengerProfile,
		alightSelf
	} from '$lib/api/passenger.remote';
	import { MapPin, Van } from '@lucide/svelte';

	type Driver = {
		driverId: string;
		name: string;
		latitude: number;
		longitude: number;
		vehicle: { plateNumber: string; model: string; capacity: number } | null;
		ride: {
			id: string;
			routeId: string;
			route: {
				name: string;
				originLatitude: number;
				originLongitude: number;
				destinationLatitude: number;
				destinationLongitude: number;
			} | null;
		} | null;
		availableSeats: number;
	};

	type ActiveBooking = {
		id: string;
		status: 'pending' | 'onboard' | 'completed' | 'cancelled';
		ride: {
			driver: { user: { name: string }; latitude: number | null; longitude: number | null };
			vehicle: { plateNumber: string; model: string };
			route: {
				name: string;
				originLatitude: number;
				originLongitude: number;
				destinationLatitude: number;
				destinationLongitude: number;
			} | null;
		};
	} | null;

	type PageState = 'idle' | 'locating' | 'waiting' | 'pending' | 'onboard';
	let pageState: PageState = $state('idle');
	let nearbyDrivers: Driver[] = $state([]);
	let selectedDriverId: string | null = $state(null);
	let selectedDriver: Driver | null = $derived.by(() => {
		if (!selectedDriverId) return null;
		return nearbyDrivers.find((d: Driver) => d.driverId === selectedDriverId) ?? null;
	});
	let activeBooking: ActiveBooking = $state(null);
	let passengerLocation: [number, number] | null = $state(null);
	let locationError: string = $state('');
	let locationWatcher: number | null = null;
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let showDriverSheet: boolean = $state(false);
	let pendingLocationPayload: [string, string] | null = $state(null);
	let bookingRideId: string = $state('');
	let cancelBookingId: string = $state('');
	let alightingBookingId: string | null = $state(null);
	let mapCenter: [number, number] = $state([14.5995, 120.9842]);
	let activeBookingRequestSeq = 0;
	let bookingMutationEpoch = 0;
	let lastAlightAttemptTime = 0;
	let lastSeenSetReadyResult: unknown = null;
	let lastSeenSetNotReadyResult: unknown = null;
	let lastSeenRequestBookingResult: unknown = null;
	let lastSeenCancelBookingResult: unknown = null;
	let lastSeenAlightSelfResult: unknown = null;

	let setReadyFormEl: HTMLFormElement;
	let setNotReadyFormEl: HTMLFormElement;
	let requestBookingFormEl: HTMLFormElement;
	let cancelBookingFormEl: HTMLFormElement;
	let alightSelfFormEl: HTMLFormElement;

	const passengerProfileQuery = getPassengerProfile();
	const nearbyDriversQuery = getNearbyDrivers();
	const activeBookingQuery = getActiveBooking();

	onMount(() => {
		void initializePage();
	});

	async function initializePage() {
		try {
			await Promise.all([activeBookingQuery.refresh(), passengerProfileQuery.refresh()]);

			const booking = activeBookingQuery.current as ActiveBooking;
			if (booking) {
				activeBooking = booking;
				pageState = booking.status === 'onboard' ? 'onboard' : 'pending';
				startLocationWatch();
				startPolling();
				return;
			}

			const profile = passengerProfileQuery.current as {
				isWaiting: boolean;
				latitude: number | null;
				longitude: number | null;
			} | null;

			if (profile?.isWaiting && profile.latitude != null && profile.longitude != null) {
				passengerLocation = [profile.latitude, profile.longitude];
				mapCenter = passengerLocation;
				pageState = 'waiting';
				startLocationWatch();
				await refreshDrivers();
				startPolling();
			}
		} catch {
			pageState = 'idle';
		}
	}

	onDestroy(() => {
		stopPolling();
		stopLocationWatch();
	});

	let distanceToDriver = $derived.by(() => {
		if (!passengerLocation || !driverLiveLocation) return null;
		return haversineDistance(passengerLocation, driverLiveLocation);
	});

	let etaToPassenger = $derived.by(() => {
		if (distanceToDriver == null) return null;
		return calcETA(distanceToDriver);
	});

	$effect(() => {
		const result = setReady.result as { success?: boolean; error?: string } | null;
		if (!result) return;
		if (result === lastSeenSetReadyResult) return;
		lastSeenSetReadyResult = result;

		if (result.success) {
			if (passengerLocation) mapCenter = passengerLocation;
			pageState = 'waiting';
			startLocationWatch();
			void refreshDrivers();
			startPolling();
			pendingLocationPayload = null;
			return;
		}

		if (result.error) {
			locationError = result.error;
			pageState = 'idle';
			pendingLocationPayload = null;
		}
	});

	$effect(() => {
		const result = setNotReady.result as { success?: boolean; error?: string } | null;
		if (!result) return;
		if (result === lastSeenSetNotReadyResult) return;
		lastSeenSetNotReadyResult = result;

		if (result.success) {
			window.location.reload();
			return;
		}

		if (result.error) {
			locationError = result.error;
		}
	});

	$effect(() => {
		if (!showDriverSheet) return;
		if (selectedDriverId && !selectedDriver) {
			showDriverSheet = false;
			selectedDriverId = null;
		}
	});

	$effect(() => {
		const result = requestBooking.result as { success?: boolean; error?: string } | null;
		if (!result) return;
		if (result === lastSeenRequestBookingResult) return;
		lastSeenRequestBookingResult = result;

		if (result.success) {
			bookingMutationEpoch += 1;
			showDriverSheet = false;
			pageState = 'pending';
			void checkBookingStatus();
			startPolling();
			bookingRideId = '';
			return;
		}

		if (result.error) {
			alert(result.error);
			bookingRideId = '';
		}
	});

	$effect(() => {
		const result = cancelBooking.result as { success?: boolean; error?: string } | null;
		if (!result) return;
		if (result === lastSeenCancelBookingResult) return;
		lastSeenCancelBookingResult = result;

		if (result.success) {
			bookingMutationEpoch += 1;
			activeBooking = null;
			pageState = 'waiting';
			void refreshDrivers();
			cancelBookingId = '';
			return;
		}

		if (result.error) {
			alert(result.error);
			cancelBookingId = '';
		}
	});

	$effect(() => {
		const result = alightSelf.result as { success?: boolean; error?: string } | null;
		if (!result) return;
		if (result === lastSeenAlightSelfResult) return;
		lastSeenAlightSelfResult = result;

		if (result.success) {
			pageState = 'idle';
			activeBooking = null;
			alightingBookingId = null;
			// Refresh booking data then reload with longer delay to ensure database persistence
			void activeBookingQuery.refresh().then(() => {
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			});
			return;
		}

		if (result.error) {
			alert(result.error);
			alightingBookingId = null;
			// Refresh booking state to sync with server and recover UI state
			void activeBookingQuery.refresh().then(() => {
				const updatedBooking = (activeBookingQuery.current as ActiveBooking) ?? null;
				if (updatedBooking) {
					activeBooking = updatedBooking;
					pageState = updatedBooking.status === 'onboard' ? 'onboard' : 'pending';
				} else {
					// Booking is no longer active, reset to waiting
					pageState = 'waiting';
					activeBooking = null;
				}
			});
		}
	});

	function shareLocation() {
		pageState = 'locating';
		locationError = '';

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
				passengerLocation = coords;
				mapCenter = coords;
				pendingLocationPayload = [String(coords[0]), String(coords[1])];
				const latInput = setReadyFormEl.querySelector('input[name="latitude"]') as HTMLInputElement;
				const lngInput = setReadyFormEl.querySelector(
					'input[name="longitude"]'
				) as HTMLInputElement;
				latInput.value = String(coords[0]);
				lngInput.value = String(coords[1]);
				setReadyFormEl.requestSubmit();
			},
			() => {
				locationError = 'Location access denied. Please enable GPS.';
				pageState = 'idle';
			}
		);
	}

	function startLocationWatch() {
		if (!navigator.geolocation || locationWatcher !== null) return;

		locationWatcher = navigator.geolocation.watchPosition(
			(pos) => {
				const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
				passengerLocation = coords;
				if (pageState === 'waiting' || pageState === 'locating') {
					mapCenter = coords;
				}
			},
			() => {
				if (pageState !== 'pending' && pageState !== 'onboard') {
					locationError = 'Unable to keep your live location updated.';
				}
			},
			{ enableHighAccuracy: true, maximumAge: 3000 }
		);
	}

	function stopLocationWatch() {
		if (locationWatcher === null) return;

		navigator.geolocation.clearWatch(locationWatcher);
		locationWatcher = null;
	}

	function stopWaiting() {
		setNotReadyFormEl.requestSubmit();
	}

	async function refreshDrivers() {
		try {
			await nearbyDriversQuery.refresh();
			nearbyDrivers = (nearbyDriversQuery.current as Driver[] | undefined) ?? [];
		} catch {
			// silently fail on poll
		}
	}

	function startPolling() {
		if (pollInterval) return;
		pollInterval = setInterval(async () => {
			if (pageState === 'waiting') await refreshDrivers();
			if (pageState === 'pending' || pageState === 'onboard') await checkBookingStatus();
		}, 5000);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function checkBookingStatus() {
		try {
			const requestSeq = ++activeBookingRequestSeq;
			const mutationEpochAtStart = bookingMutationEpoch;
			await activeBookingQuery.refresh();
			if (requestSeq !== activeBookingRequestSeq) return;
			if (mutationEpochAtStart !== bookingMutationEpoch) return;
			const booking = (activeBookingQuery.current as ActiveBooking) ?? null;
			if (!booking) {
				pageState = 'waiting';
				activeBooking = null;
				return;
			}
			activeBooking = booking;
			if (booking.status === 'onboard' && pageState === 'pending') pageState = 'onboard';
		} catch {
			// silent
		}
	}

	function requestRide() {
		if (!selectedDriver?.ride) return;
		if (requestBooking.pending > 0) return;
		bookingMutationEpoch += 1;
		bookingRideId = selectedDriver.ride.id;
		const rideIdInput = requestBookingFormEl.querySelector(
			'input[name="rideId"]'
		) as HTMLInputElement;
		rideIdInput.value = selectedDriver.ride.id;
		requestBookingFormEl.requestSubmit();
	}

	function cancelRide() {
		if (!activeBooking) return;
		cancelBookingId = activeBooking.id;
		const bookingIdInput = cancelBookingFormEl.querySelector(
			'input[name="bookingId"]'
		) as HTMLInputElement;
		bookingIdInput.value = activeBooking.id;
		cancelBookingFormEl.requestSubmit();
	}

	function closeDriverSheet() {
		showDriverSheet = false;
		selectedDriverId = null;
	}

	function handleMapOverlayMarkerClick(markerId: string) {
		if (pageState !== 'waiting') return;
		if (!markerId.startsWith('driver-')) return;

		const driverId = markerId.replace('driver-', '');
		const driver = nearbyDrivers.find((d: Driver) => d.driverId === driverId);
		if (!driver) return;

		selectedDriverId = driver.driverId;
		showDriverSheet = true;
	}

	function handleAlightSelf() {
		if (!activeBooking) return;
		if (alightingBookingId || alightSelf.pending > 0) return; // Prevent double-clicks
		
		// Add 500ms debounce to prevent rapid race conditions with driver accept
		const timeSinceLastAttempt = Date.now() - lastAlightAttemptTime;
		if (timeSinceLastAttempt < 500) return;
		
		if (!activeBooking.id) return;
		
		lastAlightAttemptTime = Date.now();
		alightingBookingId = activeBooking.id;
		const bookingIdInput = alightSelfFormEl.querySelector(
			'input[name="bookingId"]'
		) as HTMLInputElement;
		bookingIdInput.value = activeBooking.id;
		alightSelfFormEl.requestSubmit();
	}

	let activeRoute: {
		name: string;
		originLatitude: number;
		originLongitude: number;
		destinationLatitude: number;
		destinationLongitude: number;
	} | null = $derived.by(() => {
		const booking = activeBooking;
		return booking ? booking.ride.route : null;
	});
	let routeOrigin: [number, number] = $derived.by(() => {
		if (activeRoute) return [activeRoute.originLatitude, activeRoute.originLongitude];
		if (passengerLocation) return passengerLocation;
		return mapCenter;
	});
	let routeDestination: [number, number] | null = $derived.by(() => {
		if (!activeRoute) return null;
		return [activeRoute.destinationLatitude, activeRoute.destinationLongitude];
	});
	let driverLiveLocation: [number, number] | null = $derived.by(() => {
		const lat = activeBooking?.ride.driver.latitude;
		const lng = activeBooking?.ride.driver.longitude;
		if (lat == null || lng == null) return null;
		return [lat, lng];
	});
	let mapOverlayMarkers = $derived.by(() => {
		const markers: Array<{
			id: string;
			position: [number, number];
			label?: string;
			html?: string;
			iconSize?: [number, number];
			iconAnchor?: [number, number];
		}> = [];

		if (passengerLocation) {
			markers.push({
				id: 'passenger-self',
				position: passengerLocation,
				label: 'You are here',
				html: selfMarkerHtml,
				iconSize: [20, 20],
				iconAnchor: [10, 10]
			});
		}

		if (pageState === 'waiting') {
			markers.push(
				...nearbyDrivers.map((d: Driver) => ({
					id: `driver-${d.driverId}`,
					position: [d.latitude, d.longitude] as [number, number],
					label: `${d.name} (${d.availableSeats} seats)`,
					html: driverMarkerHtml(d.availableSeats),
					iconSize: [40, 40] as [number, number],
					iconAnchor: [20, 20] as [number, number]
				}))
			);
		}

		return markers;
	});

	const selfMarkerHtml = `
		<div style="width:20px;height:20px;border-radius:50%;background:#f59e0b;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">
			<div style="position:absolute;inset:-6px;border-radius:50%;background:rgba(245,158,11,0.2);animation:pulse 2s infinite;"></div>
		</div>`;

	function driverMarkerHtml(seats: number) {
		const color = seats === 0 ? '#ef4444' : seats <= 2 ? '#f59e0b' : '#22c55e';
		return `
			<div style="width:40px;height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${color};border-radius:10px;border:2px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.25);cursor:pointer;">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect width="13" height="9" x="9" y="11" rx="1"/><circle cx="11.5" cy="20" r="1.5"/><circle cx="19.5" cy="20" r="1.5"/></svg>
				<span style="font-size:9px;font-weight:700;color:white;line-height:1;">${seats}</span>
			</div>`;
	}

	const vanMarkerHtml = `
		<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:#1e293b;border-radius:10px;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,0.25);">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect width="13" height="9" x="9" y="11" rx="1"/><circle cx="11.5" cy="20" r="1.5"/><circle cx="19.5" cy="20" r="1.5"/></svg>
		</div>`;
</script>

<div class="passenger-root">
	<form bind:this={setReadyFormEl} {...setReady} class="hidden">
		<input type="hidden" name="latitude" value={pendingLocationPayload?.[0] ?? ''} />
		<input type="hidden" name="longitude" value={pendingLocationPayload?.[1] ?? ''} />
	</form>

	<form bind:this={setNotReadyFormEl} {...setNotReady} class="hidden"></form>

	<form bind:this={requestBookingFormEl} {...requestBooking} class="hidden">
		<input type="hidden" name="rideId" value={bookingRideId} />
	</form>

	<form bind:this={cancelBookingFormEl} {...cancelBooking} class="hidden">
		<input type="hidden" name="bookingId" value={cancelBookingId} />
	</form>

	<form bind:this={alightSelfFormEl} {...alightSelf} class="hidden">
		<input type="hidden" name="bookingId" value={activeBooking?.id ?? ''} />
	</form>

	<!-- Full screen map -->
	<div class="map-layer" aria-label="Passenger map">
		<MapView
			center={passengerLocation ?? routeOrigin}
			zoom={14}
			marker={passengerLocation ?? mapCenter}
			destination={routeDestination}
			useOsrm={routeDestination !== null}
			markerLabel="Route origin"
			destinationLabel="Route destination"
			liveMarker={pageState === 'pending' || pageState === 'onboard' ? driverLiveLocation : null}
			liveMarkerLabel="Driver"
			liveMarkerHtml={vanMarkerHtml}
			overlayMarkers={mapOverlayMarkers}
			onOverlayMarkerClick={handleMapOverlayMarkerClick}
			followLiveMarker={pageState === 'pending' || pageState === 'onboard'}
			fullBleed={true}
			height="100dvh"
			mapAriaLabel="Passenger map"
		/>
	</div>

	<!-- Bottom sheet area -->
	<div class="bottom-area">
		<!-- IDLE STATE -->
		{#if pageState === 'idle'}
			<div class="bottom-sheet idle-sheet">
				<div class="sheet-handle"></div>
				<Greetings />
				<p class="sheet-eyebrow">Ready to ride?</p>
				<h2 class="sheet-title">Find a van near you</h2>
				<p class="sheet-sub">Share your location to see available UV Express vans on the map.</p>
				{#if locationError}
					<p class="error-note">{locationError}</p>
				{/if}
				<button class="primary-btn" onclick={shareLocation}>
					<MapPin size="16"  />
					Share My Location
				</button>
			</div>

			<!-- LOCATING STATE -->
		{:else if pageState === 'locating'}
			<div class="bottom-sheet locating-sheet">
				<div class="sheet-handle"></div>
				<div class="locating-anim">
					<div class="pulse-ring"></div>
					<div class="pulse-core"></div>
				</div>
				<p class="locating-text">Getting your location…</p>
			</div>

			<!-- WAITING STATE -->
		{:else if pageState === 'waiting'}
			<div class="bottom-sheet waiting-sheet">
				<div class="sheet-handle"></div>
				<div class="waiting-header">
					<div>
						<p class="sheet-eyebrow">You're visible to drivers</p>
						<h2 class="sheet-title">
							{#if nearbyDrivers.length === 0}
								No vans nearby yet
							{:else}
								{nearbyDrivers.length} van{nearbyDrivers.length !== 1 ? 's' : ''} available
							{/if}
						</h2>
					</div>
					<button class="stop-btn" onclick={stopWaiting}>Stop</button>
				</div>

				{#if nearbyDrivers.length === 0}
					<div class="empty-state">
						<Van size="48" color="#94a3b8" />
						<p>Tap a van on the map to request a ride</p>
					</div>
				{:else}
					<ul class="driver-list">
						{#each nearbyDrivers as d (d.driverId)}
							<li>
								<button
									class="driver-card"
									onclick={() => {
										selectedDriverId = d.driverId;
										showDriverSheet = true;
									}}
								>
									<div
										class="driver-icon"
										style="background: {d.availableSeats === 0 ? '#fee2e2' : '#dcfce7'}"
									>
										<svg
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke={d.availableSeats === 0 ? '#ef4444' : '#16a34a'}
											stroke-width="2.5"
											stroke-linecap="round"
											stroke-linejoin="round"
											><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect
												width="13"
												height="9"
												x="9"
												y="11"
												rx="1"
											/><circle cx="11.5" cy="20" r="1.5" /><circle
												cx="19.5"
												cy="20"
												r="1.5"
											/></svg
										>
									</div>
									<div class="driver-info">
										<span class="driver-name">{d.name}</span>
										<span class="driver-meta"
											>{d.vehicle?.model ?? 'UV Express'} · {d.ride?.route?.name ?? 'Route'}</span
										>
									</div>
									<div class="seat-badge" class:full={d.availableSeats === 0}>
										<span class="seat-num">{d.availableSeats}</span>
										<span class="seat-label">seats</span>
									</div>
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>

			<!-- PENDING STATE -->
		{:else if pageState === 'pending'}
			<div class="bottom-sheet status-sheet pending-state">
				<div class="sheet-handle"></div>
				<div class="status-icon pending-icon">
					<div class="status-spinner"></div>
				</div>
				<p class="sheet-eyebrow">Waiting for driver</p>
				<h2 class="sheet-title">Request Sent</h2>
				{#if activeBooking}
					<div class="booking-detail">
						<div class="detail-row">
							<span class="detail-key">Driver</span>
							<span class="detail-val">{activeBooking.ride.driver.user.name}</span>
						</div>
						<div class="detail-row">
							<span class="detail-key">Vehicle</span>
							<span class="detail-val"
								>{activeBooking.ride.vehicle.model} · {activeBooking.ride.vehicle.plateNumber}</span
							>
						</div>
						<div class="detail-row">
							<span class="detail-key">Route</span>
							<span class="detail-val">{activeBooking.ride.route?.name ?? '—'}</span>
						</div>
					</div>
				{/if}
				{#if pageState === 'pending' && distanceToDriver != null}
					<div class="eta-card">
						<div class="eta-item">
							<span class="eta-label">Distance</span>
							<span class="eta-value">{distanceToDriver.toFixed(2)} km</span>
						</div>
						<div class="eta-divider"></div>
						<div class="eta-item">
							<span class="eta-label">ETA</span>
							<span class="eta-value">{etaToPassenger}</span>
						</div>
					</div>
				{/if}
				<button class="ghost-btn" onclick={cancelRide}>Cancel Request</button>
			</div>

			<!-- ONBOARD STATE -->
		{:else if pageState === 'onboard'}
			<div class="bottom-sheet status-sheet onboard-state">
				<div class="sheet-handle"></div>
				<div class="status-icon onboard-icon">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
					>
				</div>
				<p class="sheet-eyebrow">You're on board!</p>
				<h2 class="sheet-title">Enjoy your ride</h2>
				{#if activeBooking}
					<div class="booking-detail">
						<div class="detail-row">
							<span class="detail-key">Driver</span>
							<span class="detail-val">{activeBooking.ride.driver.user.name}</span>
						</div>
						<div class="detail-row">
							<span class="detail-key">Vehicle</span>
							<span class="detail-val"
								>{activeBooking.ride.vehicle.model} · {activeBooking.ride.vehicle.plateNumber}</span
							>
						</div>
						<div class="detail-row">
							<span class="detail-key">Route</span>
							<span class="detail-val">{activeBooking.ride.route?.name ?? '—'}</span>
						</div>
					</div>
				{/if}
				{#if activeBooking?.status === 'onboard'}
					<button
						class="primary-btn"
						onclick={handleAlightSelf}
						disabled={alightingBookingId !== null}
					>
						{alightingBookingId ? 'Alighting...' : "I'm Alighting"}
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Driver request bottom sheet (overlay) -->
	{#if showDriverSheet && selectedDriver}
		<div
			class="overlay"
			role="button"
			tabindex="0"
			aria-label="Close driver request"
			onclick={closeDriverSheet}
			onkeydown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') closeDriverSheet();
			}}
		></div>
		<div class="driver-request-sheet">
			<div class="sheet-handle"></div>
			<div class="request-header">
				<div class="request-van-icon">
					<svg
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3" /><rect
							width="13"
							height="9"
							x="9"
							y="11"
							rx="1"
						/><circle cx="11.5" cy="20" r="1.5" /><circle cx="19.5" cy="20" r="1.5" /></svg
					>
				</div>
				<div>
					<h3 class="request-driver-name">{selectedDriver.name}</h3>
					<p class="request-meta">
						{selectedDriver.vehicle?.model ?? 'UV Express'} · {selectedDriver.vehicle
							?.plateNumber ?? '—'}
					</p>
				</div>
			</div>

			<div class="request-details">
				<div class="req-detail">
					<span class="req-label">Route</span>
					<span class="req-val">{selectedDriver.ride?.route?.name ?? '—'}</span>
				</div>
				<div class="req-detail">
					<span class="req-label">Available seats</span>
					<span class="req-val seats-val" class:no-seats={selectedDriver.availableSeats === 0}>
						{selectedDriver.availableSeats} / {selectedDriver.vehicle?.capacity ?? '?'}
					</span>
				</div>
			</div>

			{#if selectedDriver.availableSeats > 0}
				<button
					class="primary-btn request-ride-btn"
					onclick={requestRide}
					disabled={requestBooking.pending > 0}
				>
					Request This Van
				</button>
			{:else}
				<div class="full-notice">This van is full. Try another one.</div>
			{/if}

			<button class="ghost-btn" onclick={closeDriverSheet}> Cancel </button>
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

	.passenger-root {
		position: relative;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background: #0f172a;
	}

	/* Map */
	.map-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* Bottom area */
	.bottom-area {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 10;
	}

	/* Bottom sheet base */
	.bottom-sheet {
		background: white;
		border-radius: 1.5rem 1.5rem 0 0;
		padding: 0.75rem 1.5rem 2.5rem;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.15);
	}

	.sheet-handle {
		width: 40px;
		height: 4px;
		background: #e2e8f0;
		border-radius: 2px;
		margin: 0 auto 1.25rem;
	}

	.sheet-eyebrow {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #f59e0b;
		margin: 0 0 0.25rem;
	}

	.sheet-title {
		font-size: 1.5rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 0.5rem;
		letter-spacing: -0.03em;
	}

	.sheet-sub {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0 0 1.25rem;
		line-height: 1.5;
	}

	/* Idle */
	.idle-sheet {
		text-align: center;
	}
	.idle-sheet .sheet-eyebrow,
	.idle-sheet .sheet-title,
	.idle-sheet .sheet-sub {
		text-align: center;
	}

	/* Locating */
	.locating-sheet {
		text-align: center;
		padding-top: 1rem;
	}
	.locating-anim {
		position: relative;
		width: 56px;
		height: 56px;
		margin: 0 auto 1rem;
	}
	.pulse-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: rgba(245, 158, 11, 0.15);
		animation: expand 1.5s ease-out infinite;
	}
	.pulse-core {
		position: absolute;
		inset: 12px;
		border-radius: 50%;
		background: #f59e0b;
	}
	@keyframes expand {
		0% {
			transform: scale(0.8);
			opacity: 1;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}
	.locating-text {
		font-size: 0.95rem;
		font-weight: 600;
		color: #475569;
	}

	/* Waiting */
	.waiting-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		margin-bottom: 1rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.5rem;
		color: #94a3b8;
		font-size: 0.875rem;
		text-align: center;
	}

	.eta-card {
		display: flex;
		align-items: center;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		margin: 0.75rem 0;
		gap: 1rem;
	}

	.eta-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.2rem;
	}

	.eta-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #3b82f6;
	}

	.eta-value {
		font-size: 1.1rem;
		font-weight: 800;
		color: #1e40af;
	}

	.eta-divider {
		width: 1px;
		height: 36px;
		background: #bfdbfe;
	}

	.driver-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		max-height: 220px;
		overflow-y: auto;
	}

	.driver-card {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: background 0.15s;
		text-align: left;
	}
	.driver-card:hover {
		background: #f1f5f9;
	}

	.driver-icon {
		width: 36px;
		height: 36px;
		border-radius: 0.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.driver-info {
		flex: 1;
		min-width: 0;
	}
	.driver-name {
		display: block;
		font-size: 0.875rem;
		font-weight: 700;
		color: #0f172a;
	}
	.driver-meta {
		display: block;
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.seat-badge {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #dcfce7;
		border-radius: 0.5rem;
		padding: 0.375rem 0.625rem;
		flex-shrink: 0;
	}
	.seat-badge.full {
		background: #fee2e2;
	}
	.seat-num {
		font-size: 1.1rem;
		font-weight: 800;
		color: #16a34a;
		line-height: 1;
	}
	.seat-badge.full .seat-num {
		color: #ef4444;
	}
	.seat-label {
		font-size: 0.6rem;
		font-weight: 600;
		color: #16a34a;
		text-transform: uppercase;
	}
	.seat-badge.full .seat-label {
		color: #ef4444;
	}

	/* Status states */
	.status-sheet {
		text-align: center;
	}
	.status-icon {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 1rem;
	}

	.pending-icon {
		background: #fef3c7;
		position: relative;
	}
	.status-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid #fde68a;
		border-top-color: #f59e0b;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.onboard-icon {
		background: #16a34a;
	}

	.booking-detail {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		margin: 1rem 0;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.825rem;
	}
	.detail-key {
		color: #64748b;
		font-weight: 500;
	}
	.detail-val {
		color: #0f172a;
		font-weight: 600;
		text-align: right;
	}

	.alight-note {
		font-size: 0.8rem;
		color: #64748b;
		line-height: 1.5;
		margin: 0;
	}

	/* Driver request overlay */
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.4);
		z-index: 20;
		backdrop-filter: blur(2px);
	}

	.driver-request-sheet {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: white;
		border-radius: 1.5rem 1.5rem 0 0;
		padding: 0.75rem 1.5rem 2.5rem;
		z-index: 21;
		box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.2);
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

	.request-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.request-van-icon {
		width: 48px;
		height: 48px;
		background: #0f172a;
		border-radius: 0.75rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.request-driver-name {
		font-size: 1.1rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 0.2rem;
	}
	.request-meta {
		font-size: 0.8rem;
		color: #64748b;
		margin: 0;
	}

	.request-details {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		margin-bottom: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.req-detail {
		display: flex;
		justify-content: space-between;
		font-size: 0.875rem;
	}
	.req-label {
		color: #64748b;
		font-weight: 500;
	}
	.req-val {
		color: #0f172a;
		font-weight: 700;
	}
	.seats-val {
		color: #16a34a;
	}
	.no-seats {
		color: #ef4444 !important;
	}

	.request-ride-btn {
		margin-bottom: 0.75rem;
	}

	.full-notice {
		text-align: center;
		background: #fee2e2;
		color: #ef4444;
		font-size: 0.875rem;
		font-weight: 600;
		padding: 0.875rem;
		border-radius: 0.75rem;
		margin-bottom: 0.75rem;
	}

	/* Buttons */
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
		transition:
			background 0.15s,
			transform 0.1s;
	}
	.primary-btn:hover {
		background: #1e293b;
	}
	.primary-btn:active {
		transform: scale(0.98);
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
	}
	.ghost-btn:hover {
		background: #f8fafc;
	}

	.stop-btn {
		padding: 0.375rem 0.875rem;
		background: #fee2e2;
		border: none;
		border-radius: 0.5rem;
		font-family: 'Outfit', sans-serif;
		font-size: 0.8rem;
		font-weight: 700;
		color: #ef4444;
		cursor: pointer;
		flex-shrink: 0;
	}

	.error-note {
		font-size: 0.8rem;
		color: #ef4444;
		margin: 0 0 1rem;
		text-align: center;
	}

	/* Leaflet z-index fixes */
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

	/* Pulse animation for self marker */
	@keyframes pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.5);
			opacity: 0;
		}
	}
</style>
