<script lang="ts">
	import MapView from '$lib/components/mapView.svelte';

	type DriverLocation = {
		id: string;
		name: string;
		latitude: number | null;
		longitude: number | null;
		lastLocationUpdate: Date | string | null;
		isAvailable: boolean;
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

			return {
				id: driver.id,
				position: [driver.latitude as number, driver.longitude as number] as [number, number],
				label: `${label} - ${detail}`,
				html: `<div style="width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid #ffffff;box-shadow:0 0 0 2px rgba(15,23,42,0.12);"></div>`,
				iconSize: [16, 16] as [number, number],
				iconAnchor: [8, 8] as [number, number]
			};
		});
	});
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

	{#if mapMarkers.length > 0}
		<MapView
			fullBleed={false}
			center={mapCenter}
			zoom={13}
			marker={mapCenter}
			overlayMarkers={mapMarkers}
			height="360px"
			mapAriaLabel="Driver location map"
		/>
	{:else}
		<div class="flex h-72 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
			No driver locations yet. Drivers need to share location first.
		</div>
	{/if}
</div>
