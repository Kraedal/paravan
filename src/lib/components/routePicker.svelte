<script lang="ts">
	import { onMount } from 'svelte';
	import 'leaflet/dist/leaflet.css';
	import type * as Leaflet from 'leaflet';

	type SelectedRoute = {
		origin: [number, number];
		destination: [number, number];
		distance: number;
	};

	const noopRouteChange: (route: SelectedRoute | null) => void = () => {};

	let {
		height = '420px',
		onRouteChange = noopRouteChange
	}: {
		height?: string;
		onRouteChange?: (route: SelectedRoute | null) => void;
	} = $props();

	type NominatimResult = {
		place_id: number;
		display_name: string;
		lat: string;
		lon: string;
	};

	let originQuery = $state('');
	let destinationQuery = $state('');
	let originResults: NominatimResult[] = $state([]);
	let destinationResults: NominatimResult[] = $state([]);
	let originSelected: [number, number] | null = $state(null);
	let destinationSelected: [number, number] | null = $state(null);
	let originLabel = $state('');
	let destinationLabel = $state('');
	let isSearchingOrigin = $state(false);
	let isSearchingDestination = $state(false);
	let distance = $state<number | null>(null);
	let error = $state('');

	let mapElement: HTMLDivElement;
	let map: Leaflet.Map | null = null;
	let originMarker: Leaflet.Marker | null = null;
	let destinationMarker: Leaflet.Marker | null = null;
	let routeLine: Leaflet.Polyline | null = null;
	let L: typeof import('leaflet');
	let lastEmittedRouteKey: string | null = $state(null);

	/**
	 * Escapes HTML special characters to prevent XSS attacks.
	 * Converts user-controlled input into safe text for HTML display.
	 * @param text - The string to escape
	 * @returns The escaped string safe for HTML
	 */
	function escapeHtml(text: string): string {
		const htmlEscapeMap: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#039;'
		};
		return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] ?? char);
	}

	onMount(() => {
		void (async () => {
			const leaflet = await import('leaflet');
			L = leaflet;
			map = L.map(mapElement).setView([14.5995, 120.9842], 11);
			L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '&copy; OpenStreetMap contributors'
			}).addTo(map);
		})();
		return () => map?.remove();
	});

	async function searchLocation(query: string, type: 'origin' | 'destination') {
		if (query.length < 3) {
			if (type === 'origin') originResults = [];
			else destinationResults = [];
			return;
		}
		if (type === 'origin') isSearchingOrigin = true;
		else isSearchingDestination = true;
		try {
			const res = await fetch(
				`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ph`,
				{ headers: { 'Accept-Language': 'en' } }
			);
			const results: NominatimResult[] = await res.json();
			if (type === 'origin') originResults = results;
			else destinationResults = results;
		} catch {
			error = 'Failed to search location. Please try again.';
		} finally {
			if (type === 'origin') isSearchingOrigin = false;
			else isSearchingDestination = false;
		}
	}

	function selectLocation(result: NominatimResult, type: 'origin' | 'destination') {
		const coords: [number, number] = [parseFloat(result.lat), parseFloat(result.lon)];
		const shortLabel = result.display_name.split(',').slice(0, 2).join(',');

		if (type === 'origin') {
			originSelected = coords;
			originLabel = shortLabel;
			originQuery = shortLabel;
			originResults = [];
			updateMarker(coords, shortLabel, 'origin');
		} else {
			destinationSelected = coords;
			destinationLabel = shortLabel;
			destinationQuery = shortLabel;
			destinationResults = [];
			updateMarker(coords, shortLabel, 'destination');
		}

		if (originSelected && destinationSelected) {
			drawRoute(originSelected, destinationSelected);
		}
	}

	function updateMarker(coords: [number, number], label: string, type: 'origin' | 'destination') {
		if (!map || !L) return;
		const isOrigin = type === 'origin';

		if (isOrigin) originMarker?.remove();
		else destinationMarker?.remove();

		const marker = L.marker(coords, {
			icon: L.divIcon({
				className: '',
				html: `<div class="custom-marker ${isOrigin ? 'origin-marker' : 'destination-marker'}">${isOrigin ? 'A' : 'B'}</div>`,
				iconSize: [32, 32],
				iconAnchor: [16, 32]
			})
		}).addTo(map);

		// Safely create popup with escaped user-controlled label to prevent XSS
		// The label comes from external API (Nominatim) and must be escaped before HTML insertion
		const escapedLabel = escapeHtml(label);
		const locationLabel = isOrigin ? 'Origin' : 'Destination';
		marker.bindPopup(`<b>${locationLabel}:</b> ${escapedLabel}`);

		if (isOrigin) {
			originMarker = marker;
			map.setView(coords, 13);
		} else {
			destinationMarker = marker;
		}
	}

	let isLoadingRoute = $state(false);

	async function drawRoute(origin: [number, number], destination: [number, number]) {
		if (!map || !L) return;
		routeLine?.remove();
		routeLine = null;
		distance = null;
		isLoadingRoute = true;
		error = '';

		try {
			// OSRM expects lon,lat order
			const res = await fetch(
				`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`
			);
			const data = await res.json();

			if (data.code !== 'Ok' || !data.routes?.length) {
				error = 'Could not find a road route between these locations.';
				// Fallback: draw straight line
				routeLine = L.polyline([origin, destination], {
					color: '#f59e0b',
					weight: 3,
					opacity: 0.7,
					dashArray: '8, 6'
				}).addTo(map);
				distance = haversineDistance(origin, destination);
			} else {
				const route = data.routes[0];
				// GeoJSON coords are [lon, lat], Leaflet needs [lat, lon]
				const latlngs: [number, number][] = route.geometry.coordinates.map(
					([lon, lat]: [number, number]) => [lat, lon]
				);
				routeLine = L.polyline(latlngs, {
					color: '#2563eb',
					weight: 4,
					opacity: 0.85
				}).addTo(map);
				distance = route.distance / 1000; // meters to km
			}

			map.fitBounds(L.latLngBounds([origin, destination]), { padding: [60, 60] });
		} catch {
			error = 'Failed to fetch route. Check your connection.';
			// Fallback: draw straight line
			routeLine = L.polyline([origin, destination], {
				color: '#f59e0b',
				weight: 3,
				opacity: 0.7,
				dashArray: '8, 6'
			}).addTo(map);
			distance = haversineDistance(origin, destination);
			map.fitBounds(L.latLngBounds([origin, destination]), { padding: [60, 60] });
		} finally {
			isLoadingRoute = false;
		}
	}

	function haversineDistance(a: [number, number], b: [number, number]): number {
		const R = 6371;
		const dLat = ((b[0] - a[0]) * Math.PI) / 180;
		const dLon = ((b[1] - a[1]) * Math.PI) / 180;
		const lat1 = (a[0] * Math.PI) / 180;
		const lat2 = (b[0] * Math.PI) / 180;
		const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
		return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
	}

	$effect(() => {
		const route =
			originSelected && destinationSelected && distance !== null && !isLoadingRoute
				? {
						origin: originSelected,
						destination: destinationSelected,
						distance: parseFloat(distance.toFixed(2))
					}
				: null;

		const routeKey = route
			? `${route.origin[0]},${route.origin[1]}:${route.destination[0]},${route.destination[1]}:${route.distance}`
			: 'empty';

		if (routeKey === lastEmittedRouteKey) return;

		lastEmittedRouteKey = routeKey;
		onRouteChange(route);
	});

	function clearAll() {
		originSelected = null;
		destinationSelected = null;
		originQuery = '';
		destinationQuery = '';
		originLabel = '';
		destinationLabel = '';
		distance = null;
		error = '';
		originMarker?.remove();
		destinationMarker?.remove();
		routeLine?.remove();
		originMarker = null;
		destinationMarker = null;
		routeLine = null;
		map?.setView([14.5995, 120.9842], 11);
	}

	let originDebounce: ReturnType<typeof setTimeout>;
	let destinationDebounce: ReturnType<typeof setTimeout>;

	function handleOriginInput() {
		clearTimeout(originDebounce);
		originSelected = null;
		distance = null;
		routeLine?.remove();
		routeLine = null;
		originDebounce = setTimeout(() => searchLocation(originQuery, 'origin'), 400);
	}

	function handleDestinationInput() {
		clearTimeout(destinationDebounce);
		destinationSelected = null;
		distance = null;
		routeLine?.remove();
		routeLine = null;
		destinationDebounce = setTimeout(() => searchLocation(destinationQuery, 'destination'), 400);
	}
</script>

<div class="route-picker">
	<!-- Search Panel -->
	<div class="search-panel">
		<div class="search-header">
			<h3>Define Route</h3>
			{#if originSelected || destinationSelected}
				<button class="clear-btn" onclick={clearAll}>Clear</button>
			{/if}
		</div>

		<!-- Origin -->
		<div class="search-group">
			<div class="search-label">
				<span class="dot dot-origin">A</span>
				<span>Origin</span>
			</div>
			<div class="search-input-wrap">
				<input
					type="text"
					placeholder="Search origin (e.g. Alabang Terminal)"
					bind:value={originQuery}
					oninput={handleOriginInput}
					class:selected={!!originSelected}
				/>
				{#if isSearchingOrigin}<span class="spinner"></span>{/if}
			</div>
			{#if originResults.length > 0}
				<ul class="results-list">
					{#each originResults as result (result.place_id)}
						<li>
							<button onclick={() => selectLocation(result, 'origin')}>
								{result.display_name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Destination -->
		<div class="search-group">
			<div class="search-label">
				<span class="dot dot-destination">B</span>
				<span>Destination</span>
			</div>
			<div class="search-input-wrap">
				<input
					type="text"
					placeholder="Search destination (e.g. BGC Bus Stop)"
					bind:value={destinationQuery}
					oninput={handleDestinationInput}
					class:selected={!!destinationSelected}
				/>
				{#if isSearchingDestination}<span class="spinner"></span>{/if}
			</div>
			{#if destinationResults.length > 0}
				<ul class="results-list">
					{#each destinationResults as result (result.place_id)}
						<li>
							<button onclick={() => selectLocation(result, 'destination')}>
								{result.display_name}
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<!-- Route loading -->
		{#if isLoadingRoute}
			<div class="route-loading">
				<span class="spinner"></span>
				<span>Finding road route...</span>
			</div>
		{/if}

		<!-- Route Summary -->
		{#if originSelected && destinationSelected && distance !== null && !isLoadingRoute}
			<div class="route-summary">
				<div class="summary-row">
					<span class="summary-label">Distance</span>
					<span class="summary-value">{distance.toFixed(2)} km</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">From</span>
					<span class="summary-value truncate">{originLabel}</span>
				</div>
				<div class="summary-row">
					<span class="summary-label">To</span>
					<span class="summary-value truncate">{destinationLabel}</span>
				</div>
			</div>
		{/if}

		{#if error}
			<p class="error-msg">{error}</p>
		{/if}
	</div>

	<!-- Map Preview -->
	<div class="map-wrap" style={`height: ${height}`}>
		<div bind:this={mapElement} class="map" aria-label="Route preview map"></div>
		{#if !originSelected && !destinationSelected}
			<div class="map-hint">Search for origin and destination to preview route</div>
		{/if}
	</div>
</div>

<style>
	.route-picker {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
	}

	.search-panel {
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.search-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.search-header h3 {
		font-size: 0.95rem;
		font-weight: 600;
		color: #111827;
		margin: 0;
	}

	.clear-btn {
		font-size: 0.8rem;
		color: #6b7280;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		transition: background 0.15s;
	}

	.clear-btn:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.search-group {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		position: relative;
	}

	.search-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: #374151;
	}

	.dot {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: white;
		flex-shrink: 0;
	}

	.dot-origin {
		background: #16a34a;
	}
	.dot-destination {
		background: #dc2626;
	}

	.search-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	input {
		width: 100%;
		padding: 0.6rem 2rem 0.6rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		background: white;
		color: #111827;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #2563eb;
		box-shadow: 0 0 0 3px rgb(37 99 235 / 10%);
	}

	input.selected {
		border-color: #16a34a;
		background: #f0fdf4;
	}

	.spinner {
		position: absolute;
		right: 0.6rem;
		width: 16px;
		height: 16px;
		border: 2px solid #e5e7eb;
		border-top-color: #2563eb;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.results-list {
		list-style: none;
		margin: 0;
		padding: 0;
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.5rem;
		box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
		overflow: hidden;
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 1000;
	}

	.results-list li button {
		width: 100%;
		text-align: left;
		padding: 0.6rem 0.75rem;
		font-size: 0.8rem;
		color: #374151;
		background: none;
		border: none;
		cursor: pointer;
		border-bottom: 1px solid #f3f4f6;
		transition: background 0.1s;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.results-list li:last-child button {
		border-bottom: none;
	}
	.results-list li button:hover {
		background: #eff6ff;
		color: #1d4ed8;
	}

	.route-summary {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 0.625rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.summary-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		font-size: 0.825rem;
	}

	.summary-label {
		color: #6b7280;
		font-weight: 500;
		flex-shrink: 0;
	}
	.summary-value {
		color: #111827;
		font-weight: 600;
		text-align: right;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 200px;
	}

	.map-wrap {
		position: relative;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.map {
		width: 100%;
		height: 100%;
	}

	.map-hint {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		transform: translateX(-50%);
		background: rgb(0 0 0 / 60%);
		color: white;
		font-size: 0.78rem;
		padding: 0.4rem 0.85rem;
		border-radius: 2rem;
		pointer-events: none;
		white-space: nowrap;
	}

	.route-loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.825rem;
		color: #2563eb;
		padding: 0.5rem 0;
	}

	.route-loading .spinner {
		position: static;
		border-color: #bfdbfe;
		border-top-color: #2563eb;
	}

	.error-msg {
		font-size: 0.8rem;
		color: #dc2626;
		margin: 0;
	}

	:global(.custom-marker) {
		width: 32px;
		height: 32px;
		border-radius: 50% 50% 50% 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: white;
		transform: rotate(-45deg);
		box-shadow: 0 2px 8px rgb(0 0 0 / 25%);
	}

	:global(.origin-marker) {
		background: #16a34a;
	}
	:global(.destination-marker) {
		background: #dc2626;
	}

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
