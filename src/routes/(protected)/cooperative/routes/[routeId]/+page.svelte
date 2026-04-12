<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getRoutes } from '$lib/api/admin.remote';
	import MapView from '$lib/components/mapView.svelte';
	import { ChevronLeftIcon } from '@lucide/svelte';

	const routes = getRoutes();

	const routeId = $derived(page.params.routeId);
	const selectedRoute = $derived.by(() => {
		if (!routes.ready) return null;
		return routes.current.find((item) => item.id === routeId) ?? null;
	});
</script>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h2 class="text-xl font-semibold text-gray-900">Route Details</h2>
		<p class="mt-1 text-sm text-gray-500">View details for this cooperative route.</p>
	</div>
	<div class="flex items-center gap-2">
		{#if selectedRoute}
			<button
				type="button"
				onclick={() => goto(resolve(`/cooperative/routes/${selectedRoute.id}/edit`))}
				class="rounded-md border border-gray-300 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
			>
				Edit
			</button>
		{/if}
		<button
			type="button"
			onclick={() => goto(resolve('/cooperative/routes'))}
			class="rounded-md border border-gray-300 bg-white px-2 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
		>
			<ChevronLeftIcon class="h-4 w-4" />
		</button>
	</div>
</div>

{#if routes.loading && !routes.ready}
	<div class="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
		Loading route details...
	</div>
{:else if routes.error}
	<div class="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 shadow-sm">
		Failed to load route details.
	</div>
{:else if !selectedRoute}
	<div class="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
		Route not found.
	</div>
{:else}
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<dl class="grid gap-4 sm:grid-cols-2">
			<div>
				<dt class="text-xs font-medium tracking-wide text-gray-500 uppercase">Name</dt>
				<dd class="mt-1 text-sm font-medium text-gray-900">{selectedRoute.name}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-gray-500 uppercase">Distance</dt>
				<dd class="mt-1 text-sm text-gray-900">{selectedRoute.distance.toFixed(2)} km</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-gray-500 uppercase">Origin</dt>
				<dd class="mt-1 text-sm text-gray-900">
					{selectedRoute.originLatitude.toFixed(6)}, {selectedRoute.originLongitude.toFixed(6)}
				</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-gray-500 uppercase">Destination</dt>
				<dd class="mt-1 text-sm text-gray-900">
					{selectedRoute.destinationLatitude.toFixed(6)}, {selectedRoute.destinationLongitude.toFixed(
						6
					)}
				</dd>
			</div>
		</dl>
	</div>

	<div class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm pb-6">
		<h3 class="mb-3  px-8 pt-6 text-sm font-semibold tracking-wide text-gray-700 uppercase">Route Map</h3>
		<MapView
			center={[selectedRoute.originLatitude, selectedRoute.originLongitude]}
			marker={[selectedRoute.originLatitude, selectedRoute.originLongitude]}
			destination={[selectedRoute.destinationLatitude, selectedRoute.destinationLongitude]}
			useOsrm={true}
			destinationLabel="Destination"
			height="420px"
		/>
	</div>
{/if}
