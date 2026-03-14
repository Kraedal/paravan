<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';

	let {
		center = [14.5995, 120.9842],
		zoom = 13,
		marker = center,
		markerLabel = 'You are here',
		height = '420px'
	}: {
		center?: [number, number];
		zoom?: number;
		marker?: [number, number];
		markerLabel?: string;
		height?: string;
	} = $props();

	let mapElement: HTMLDivElement;
	let map: {
		setView: (position: [number, number], zoomLevel: number) => void;
		remove: () => void;
	} | null = null;
	let markerLayer: {
		setLatLng: (position: [number, number]) => void;
		bindPopup: (text: string) => void;
	} | null = null;

	onMount(() => {
		void (async () => {
			const L = await import('leaflet');

			map = L.map(mapElement).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			markerLayer = L.marker(marker).addTo(map).bindPopup(markerLabel);
		})();

		return () => {
			map?.remove();
		};
	});

	$effect(() => {
		if (!map || !markerLayer) return;

		map.setView(center, zoom);
		markerLayer.setLatLng(marker);
		markerLayer.bindPopup(markerLabel);
	});
</script>

<div class="map-wrapper flex flex-col items-center justify-center">
	<div
		bind:this={mapElement}
		class="map"
		style={`height: ${height};`}
		aria-label="Passenger map"
	></div>
</div>

<style>
	.map-wrapper {
		width: 80%;
		margin: 0rem auto;
		border: 6px solid #e5e7eb;
		border-radius: 1rem;
	}

	.map {
		width: 100%;
		border-radius: 0.75rem;
		overflow: hidden;
		box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
	}

	/* Override Leaflet's default z-index to be less than 1000 */
	:global(.leaflet-control-zoom),
	:global(.leaflet-control-attribution),
	:global(.leaflet-control) {
		z-index: 999 !important;
	}

	:global(.leaflet-pane),
	:global(.leaflet-top),
	:global(.leaflet-bottom) {
		z-index: 998 !important;
	}
</style>
