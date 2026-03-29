<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type * as Leaflet from 'leaflet';
	import { SvelteMap } from 'svelte/reactivity';
	import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png';
	import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
	import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

	type OverlayMarker = {
		id: string;
		position: [number, number];
		label?: string;
		html?: string;
		iconSize?: [number, number];
		iconAnchor?: [number, number];
	};

	let {
		center = [14.5995, 120.9842] as [number, number],
		zoom = 13,
		marker = center as [number, number],
		destination = null as [number, number] | null,
		useOsrm = false,
		destinationLabel = 'Destination',
		height = '420px',
		liveMarker = null as [number, number] | null,
		liveMarkerLabel = 'Driver',
		liveMarkerHtml = null as string | null,
		followLiveMarker = false,
		overlayMarkers = [] as OverlayMarker[],
		onOverlayMarkerClick = () => {},
		fullBleed = false,
		mapAriaLabel = 'Map'
	}: {
		center?: [number, number];
		zoom?: number;
		marker?: [number, number];
		destination?: [number, number] | null;
		useOsrm?: boolean;
		destinationLabel?: string;
		height?: string;
		liveMarker?: [number, number] | null;
		liveMarkerLabel?: string;
		liveMarkerHtml?: string | null;
		followLiveMarker?: boolean;
		overlayMarkers?: OverlayMarker[];
		onOverlayMarkerClick?: (id: string) => void;
		fullBleed?: boolean;
		mapAriaLabel?: string;
	} = $props();

	let mapElement: HTMLDivElement;
	let map: Leaflet.Map | null = null;
	let L: typeof import('leaflet') | null = null;

	// let selfMarkerLayer: Leaflet.Marker | null = null;
	let destinationMarkerLayer: Leaflet.Marker | null = null;
	let routeLine: Leaflet.Polyline | null = null;
	let liveMarkerLayer: Leaflet.Marker | null = null;
	let overlayMarkerLayers = new SvelteMap<string, Leaflet.Marker>();

	let routeAbortController: AbortController | null = null;
	let routeRenderToken = 0;

	onMount(() => {
		void (async () => {
			L = await import('leaflet');
			L.Icon.Default.mergeOptions({
				iconRetinaUrl: markerIcon2xUrl,
				iconUrl: markerIconUrl,
				shadowUrl: markerShadowUrl
			});
			map = L.map(mapElement, { zoomControl: false }).setView(center, zoom);

			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);

			renderDestinationMarker();
			renderLiveMarker();
			renderOverlayMarkers();
			void renderRoute();
		})();

		return () => {
			routeAbortController?.abort();
			map?.remove();
		};
	});

	// Re-render route + markers when core props change
	$effect(() => {
		void [marker, destination, useOsrm, center, zoom];
		if (!map || !L) return;
		
		// Pan to marker if not following live marker and no destination
		if (!followLiveMarker && !destination) {
			map.setView(marker, map.getZoom());
		}
		
		renderDestinationMarker();
		void renderRoute();
	});

	// Live marker updates independently — no route re-fetch needed
	$effect(() => {
		void [liveMarker, followLiveMarker];
		renderLiveMarker();
	});

	// Overlay markers update independently
	$effect(() => {
		void overlayMarkers;
		renderOverlayMarkers();
	});

	// function renderSelfMarker() {
	// 	if (!map || !L) return;

	// 	if (selfMarkerLayer) {
	// 		selfMarkerLayer.setLatLng(marker);
	// 		selfMarkerLayer.bindPopup(markerLabel);
	// 	} else {
	// 		selfMarkerLayer = L.marker(marker, {
	// 			icon: markerHtml
	// 				? L.divIcon({ className: '', html: markerHtml, iconSize: [20, 20], iconAnchor: [10, 10] })
	// 				: new L.Icon.Default()
	// 		})
	// 			.addTo(map)
	// 			.bindPopup(markerLabel);
	// 	}

	// 	// Only pan to self marker if not following a live marker and no route is shown
	// 	if (!followLiveMarker && !destination) {
	// 		map.setView(marker, map.getZoom());
	// 	}
	// }

	function renderDestinationMarker() {
		if (!map || !L) return;

		if (!destination) {
			destinationMarkerLayer?.remove();
			destinationMarkerLayer = null;
			return;
		}

		if (destinationMarkerLayer) {
			destinationMarkerLayer.setLatLng(destination);
			destinationMarkerLayer.bindPopup(destinationLabel);
		} else {
			destinationMarkerLayer = L.marker(destination).addTo(map).bindPopup(destinationLabel);
		}
	}

	async function renderRoute() {
		if (!map || !L) return;

		const currentToken = ++routeRenderToken;
		routeAbortController?.abort();
		routeAbortController = null;
		routeLine?.remove();
		routeLine = null;

		if (!destination) return;

		if (useOsrm) {
			routeAbortController = new AbortController();
			try {
				const res = await fetch(
					`https://router.project-osrm.org/route/v1/driving/${marker[1]},${marker[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`,
					{ signal: routeAbortController.signal }
				);
				const data = await res.json();

				if (currentToken !== routeRenderToken) return;

				if (data.code === 'Ok' && data.routes?.length) {
					const latlngs: [number, number][] = data.routes[0].geometry.coordinates.map(
						([lon, lat]: [number, number]) => [lat, lon]
					);
					routeLine = L.polyline(latlngs, {
						color: '#2563eb',
						weight: 4,
						opacity: 0.85
					}).addTo(map);
					map.fitBounds(routeLine.getBounds(), { padding: [60, 60] });
					return;
				}
			} catch {
				if (currentToken !== routeRenderToken) return;
				// fall through to straight line
			}
		}

		if (currentToken !== routeRenderToken) return;

		// Straight line fallback
		routeLine = L.polyline([marker, destination], {
			color: '#2563eb',
			weight: 4,
			opacity: 0.85,
			dashArray: '8 6'
		}).addTo(map);
		map.fitBounds(L.latLngBounds([marker, destination]), { padding: [60, 60] });
	}

	function renderLiveMarker() {
		if (!map || !L) return;

		if (!liveMarker) {
			liveMarkerLayer?.remove();
			liveMarkerLayer = null;
			return;
		}

		if (liveMarkerLayer) {
			liveMarkerLayer.setLatLng(liveMarker);
		} else {
			liveMarkerLayer = L.marker(liveMarker, {
				icon: liveMarkerHtml
					? L.divIcon({
							className: '',
							html: liveMarkerHtml,
							iconSize: [40, 40],
							iconAnchor: [20, 20]
						})
					: new L.Icon.Default()
			})
				.addTo(map)
				.bindPopup(liveMarkerLabel);
		}

		if (followLiveMarker) {
			map.setView(liveMarker, map.getZoom());
		}
	}

	function renderOverlayMarkers() {
		if (!map || !L) return;

		// Remove stale markers
		const currentIds = new Set(overlayMarkers.map((m) => m.id));
		overlayMarkerLayers.forEach((layer, id) => {
			if (!currentIds.has(id)) {
				layer.remove();
				overlayMarkerLayers.delete(id);
			}
		});

		// Add or update
		overlayMarkers.forEach((m) => {
			if (overlayMarkerLayers.has(m.id)) {
				overlayMarkerLayers.get(m.id)!.setLatLng(m.position);
			} else {
				const icon = m.html
					? L!.divIcon({
							className: '',
							html: m.html,
							iconSize: m.iconSize ?? [32, 32],
							iconAnchor: m.iconAnchor ?? [16, 16]
						})
					: new L!.Icon.Default();

				const layer = L!.marker(m.position, { icon }).addTo(map!);
				if (m.label) layer.bindPopup(m.label);
				layer.on('click', () => onOverlayMarkerClick(m.id));
				overlayMarkerLayers.set(m.id, layer);
			}
		});
	}
</script>

<div class="map-wrapper" class:full-bleed={fullBleed}>
	<div
		bind:this={mapElement}
		class="map"
		style={`height: ${height};`}
		aria-label={mapAriaLabel}
	></div>
</div>

<style>
	.map-wrapper {
		width: 80%;
		margin: 0 auto;
		border: 6px solid #e5e7eb;
		border-radius: 1rem;
	}

	.map-wrapper.full-bleed {
		width: 100%;
		margin: 0;
		border: none;
		border-radius: 0;
	}

	.map {
		width: 100%;
		border-radius: 0.75rem;
		overflow: hidden;
		box-shadow: 0 10px 30px rgb(0 0 0 / 10%);
	}

	.full-bleed .map {
		border-radius: 0;
		box-shadow: none;
	}

	:global(.leaflet-control-zoom),
	:global(.leaflet-control-attribution),
	:global(.leaflet-control) {
		z-index: 2 !important;
	}

	:global(.leaflet-pane),
	:global(.leaflet-top),
	:global(.leaflet-bottom) {
		z-index: 1 !important;
	}
</style>