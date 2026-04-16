<script lang="ts">
	import MapView from '$lib/components/mapView.svelte';

	type DriverLocation = {
		id: string;
		name: string;
		latitude: number | null;
		longitude: number | null;
		lastLocationUpdate: Date | string | null;
		isAvailable: boolean;
		ongoingRide: {
			id: string;
			route: {
				id: string;
				name: string;
				origin: [number, number];
				destination: [number, number];
			};
		} | null;
		vehicle: {
			id: string;
			plateNumber: string;
			model: string;
		} | null;
	};

	interface Props {
		drivers?: DriverLocation[];
	}

	let { drivers = [] }: Props = $props();

	const fallbackCenter: [number, number] = [14.5995, 120.9842];
	let selectedDriverId = $state<string | null>(null);

	const locatedDrivers = $derived.by(() =>
		drivers.filter(
			(driver) =>
				typeof driver.latitude === 'number' &&
				typeof driver.longitude === 'number' &&
				!Number.isNaN(driver.latitude) &&
				!Number.isNaN(driver.longitude)
		)
	);

	const availableCount = $derived(locatedDrivers.filter((driver) => driver.isAvailable).length);

	const selectedDriver = $derived.by(() =>
		selectedDriverId ? drivers.find((driver) => driver.id === selectedDriverId) ?? null : null
	);

	const selectedDriverPosition = $derived.by<[number, number] | null>(() => {
		if (!selectedDriver) return null;
		if (typeof selectedDriver.latitude !== 'number' || typeof selectedDriver.longitude !== 'number') return null;
		return [selectedDriver.latitude, selectedDriver.longitude];
	});

	const selectedRouteDestination = $derived.by<[number, number] | null>(() => {
		if (!selectedDriverPosition || !selectedDriver?.ongoingRide?.route) return null;
		const [lat, lng] = selectedDriver.ongoingRide.route.destination;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
		return [lat, lng];
	});

	$effect(() => {
		if (!drivers.length) {
			selectedDriverId = null;
			return;
		}

		if (!selectedDriverId || !drivers.some((driver) => driver.id === selectedDriverId)) {
			selectedDriverId = locatedDrivers[0]?.id ?? drivers[0]?.id ?? null;
		}
	});

	const staleCount = $derived.by(() => {
		const staleThresholdMs = 3 * 60 * 1000;
		const now = Date.now();
		return locatedDrivers.filter((driver) => {
			if (!driver.lastLocationUpdate) return true;
			const lastUpdate = new Date(driver.lastLocationUpdate).getTime();
			return Number.isNaN(lastUpdate) || now - lastUpdate > staleThresholdMs;
		}).length;
	});

	const mapCenter = $derived.by<[number, number]>(() => {
		if (locatedDrivers.length === 0) return fallbackCenter;
		const sum = locatedDrivers.reduce(
			(acc, driver) => {
				acc.lat += driver.latitude as number;
				acc.lng += driver.longitude as number;
				return acc;
			},
			{ lat: 0, lng: 0 }
		);
		return [sum.lat / locatedDrivers.length, sum.lng / locatedDrivers.length];
	});

	const mapMarkers = $derived.by(() => {
		const staleThresholdMs = 3 * 60 * 1000;
		const now = Date.now();
		return locatedDrivers.map((driver) => {
			const lastUpdateTime = driver.lastLocationUpdate
				? new Date(driver.lastLocationUpdate).getTime()
				: null;
			const isStale =
				lastUpdateTime === null || Number.isNaN(lastUpdateTime) || now - lastUpdateTime > staleThresholdMs;
			const color = isStale ? '#94a3b8' : driver.isAvailable ? '#10b981' : '#f59e0b';
			const label = `${driver.name}${driver.vehicle ? ` (${driver.vehicle.plateNumber})` : ''}`;
			const detail = isStale ? 'Location stale' : driver.isAvailable ? 'Available' : 'On trip';

			const isSelected = selectedDriverId === driver.id;

			return {
				id: driver.id,
				position: [driver.latitude as number, driver.longitude as number] as [number, number],
				label: `${label} - ${detail}`,
				html: `<div style="width:${isSelected ? 20 : 16}px;height:${isSelected ? 20 : 16}px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 0 0 ${isSelected ? 3 : 2}px rgba(15,23,42,0.16);"></div>`,
				iconSize: [isSelected ? 20 : 16, isSelected ? 20 : 16] as [number, number],
				iconAnchor: [isSelected ? 10 : 8, isSelected ? 10 : 8] as [number, number]
			};
		});
	});

	function handleDriverSelect(driverId: string) {
		selectedDriverId = driverId;
	}
</script>

<div class="bg-white rounded-xl border border-slate-100 p-1 lg:p-2">
	<div class="mb-3 flex items-center justify-between gap-3">
		<div>
			<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Driver Map</h2>
			<p class="mt-1 text-xs text-slate-500">Live view of active driver coordinates</p>
		</div>
		<div class="flex items-center gap-2 text-[11px]">
			<span class="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700 ring-1 ring-emerald-100">
				{availableCount} available
			</span>
			<span class="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600 ring-1 ring-slate-200">
				{staleCount} stale
			</span>
		</div>
	</div>

	{#if drivers.length > 0}
		<div class="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
			<div class="max-h-90 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2">
				<div class="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Drivers</div>
				<div class="space-y-1.5">
					{#each drivers as driver (driver.id)}
						{@const hasLocation = typeof driver.latitude === 'number' && typeof driver.longitude === 'number'}
						<button
							type="button"
							onclick={() => handleDriverSelect(driver.id)}
							class={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${selectedDriverId === driver.id ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} ${!hasLocation ? 'opacity-60' : ''}`}
						>
							<div class="font-semibold">{driver.name}</div>
							<div class="mt-0.5 text-[11px] text-slate-500">
								{#if !hasLocation}
									No location yet
								{:else if driver.ongoingRide}
									On trip: {driver.ongoingRide.route.name}
								{:else}
									{driver.isAvailable ? 'Available' : 'Not available'}
								{/if}
							</div>
						</button>
					{/each}
				</div>
			</div>

			<div class="relative">
				<MapView
					fullBleed={false}
					center={selectedDriverPosition ?? mapCenter}
					zoom={13}
					marker={selectedDriverPosition ?? mapCenter}
					destination={selectedRouteDestination}
					useOsrm={!!selectedRouteDestination}
					showFullscreenControl={true}
					destinationLabel={selectedDriver?.ongoingRide ? `${selectedDriver.ongoingRide.route.name} endpoint` : 'Destination'}
					overlayMarkers={mapMarkers}
					onOverlayMarkerClick={handleDriverSelect}
					height="360px"
					mapAriaLabel="Driver location map"
				/>
			</div>
		</div>
	{:else}
		<div class="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
			No driver locations yet. Drivers need to share location first.
		</div>
	{/if}
</div>
