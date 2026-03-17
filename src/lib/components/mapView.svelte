<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type * as Leaflet from 'leaflet';

	let {
		center = [14.5995, 120.9842],
		zoom = 13,
		marker = center,
		destination = null,
		useOsrm = false,
		markerLabel = 'You are here',
		destinationLabel = 'Destination',
		height = '420px'
	}: {
		center?: [number, number];
		zoom?: number;
		marker?: [number, number];
		destination?: [number, number] | null;
		useOsrm?: boolean;
		markerLabel?: string;
		destinationLabel?: string;
		height?: string;
	} = $props();

	let mapElement: HTMLDivElement;
	let map: Leaflet.Map | null = null;
	let markerLayer: Leaflet.Marker | null = null;
	let destinationLayer: Leaflet.Marker | null = null;
	let routeLine: Leaflet.Polyline | null = null;
	let L: typeof import('leaflet') | null = null;
	let routeAbortController: AbortController | null = null;
	let routeRenderToken = 0;

	onMount(() => {
		void (async () => {
			L = await import('leaflet');

			map = L.map(mapElement).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			void renderLayers();
		})();

		return () => {
			routeAbortController?.abort();
			map?.remove();
		};
	});

	$effect(() => {
		void renderLayers();
	});

	async function renderLayers() {
		if (!map || !L) return;

		const currentToken = ++routeRenderToken;
		routeAbortController?.abort();
		routeAbortController = null;

		markerLayer?.remove();
		destinationLayer?.remove();
		routeLine?.remove();

		markerLayer = L.marker(marker).addTo(map).bindPopup(markerLabel);

		if (destination) {
			destinationLayer = L.marker(destination).addTo(map).bindPopup(destinationLabel);

			if (useOsrm) {
				routeAbortController = new AbortController();

				try {
					const response = await fetch(
						`https://router.project-osrm.org/route/v1/driving/${marker[1]},${marker[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`,
						{ signal: routeAbortController.signal }
					);
					const data = await response.json();

					if (
						currentToken === routeRenderToken &&
						data.code === 'Ok' &&
						data.routes?.length
					) {
						const latlngs: [number, number][] = data.routes[0].geometry.coordinates.map(
							([lon, lat]: [number, number]) => [lat, lon]
						);

						routeLine = L.polyline(latlngs, {
							color: '#2563eb',
							weight: 4,
							opacity: 0.85
						}).addTo(map);
						map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
						return;
					}
				} catch {
					// Fall through to straight-line route if OSRM is unavailable.
				}
			}

			if (currentToken !== routeRenderToken) return;

			routeLine = L.polyline([marker, destination], {
				color: '#2563eb',
				weight: 4,
				opacity: 0.85
			}).addTo(map);
			map.fitBounds(L.latLngBounds([marker, destination]), { padding: [40, 40] });
			return;
		}

		destinationLayer = null;
		routeLine = null;
		map.setView(center, zoom);
	}
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
