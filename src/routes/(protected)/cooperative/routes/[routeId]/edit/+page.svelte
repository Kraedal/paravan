<script lang="ts">
	import { page } from '$app/state';
	import { invalidateAll, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RoutePicker from '$lib/components/routePicker.svelte';
	import { getRoutes, updateRoute } from '$lib/api/admin.remote';

	const routes = getRoutes();
	const routeId = $derived(page.params.routeId);
	const selectedRoute = $derived.by(() => {
		if (!routes.ready) return null;
		return routes.current.find((item) => item.id === routeId) ?? null;
	});

	let formEl = $state<HTMLFormElement | null>(null);
	let routeName = $state('');
	let direction = $state<'northbound' | 'southbound' | ''>('');
	let didSubmit = $state(false);
	let didInitialize = $state(false);
	let routeCoords = $state<{
		originLatitude: number;
		originLongitude: number;
		destinationLatitude: number;
		destinationLongitude: number;
		distance: number;
	} | null>(null);

	type UpdateRouteResult = { success?: boolean; error?: string };

	$effect(() => {
		if (!selectedRoute || didInitialize) return;
		routeName = selectedRoute.name;
		direction = selectedRoute.direction;
		routeCoords = {
			originLatitude: selectedRoute.originLatitude,
			originLongitude: selectedRoute.originLongitude,
			destinationLatitude: selectedRoute.destinationLatitude,
			destinationLongitude: selectedRoute.destinationLongitude,
			distance: selectedRoute.distance
		};
		didInitialize = true;
	});

	$effect(() => {
		if (!didSubmit) return;

		const result = updateRoute.result as UpdateRouteResult | null;
		if (!result?.success) return;

		didSubmit = false;

		void invalidateAll().then(() => {
			goto(resolve('/cooperative/routes'));
		});
	});

	function handleRouteChange(
		route: {
			origin: [number, number];
			destination: [number, number];
			distance: number;
		} | null
	) {
		routeCoords = route
			? {
					originLatitude: route.origin[0],
					originLongitude: route.origin[1],
					destinationLatitude: route.destination[0],
					destinationLongitude: route.destination[1],
					distance: route.distance
				}
			: null;
	}
</script>

<div class="mb-6 flex items-center justify-between">
	<div>
		<h2 class="text-xl font-semibold text-gray-900">Edit Route</h2>
		<p class="mt-1 text-sm text-gray-500">Update route details for your cooperative.</p>
	</div>
	<button
		type="button"
		onclick={() => goto(resolve('/cooperative/routes'))}
		class="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
	>
		Back
	</button>
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
	<form
		bind:this={formEl}
		{...updateRoute}
		onsubmit={() => {
			didSubmit = true;
		}}
		class="space-y-4"
	>
		<input {...updateRoute.fields.routeId.as('text')} type="hidden" value={selectedRoute.id} />

		<input
			{...updateRoute.fields.name.as('text')}
			type="text"
			placeholder="Route name (e.g. Alabang to BGC)"
			bind:value={routeName}
			class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-gray-900 focus:outline-none"
		/>

		<select
			{...updateRoute.fields.direction.as('text')}
			bind:value={direction}
			class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-gray-900 focus:outline-none"
		>
			<option value="" disabled>Select direction</option>
			<option value="northbound">Northbound</option>
			<option value="southbound">Southbound</option>
		</select>

		{#each updateRoute.fields.name.issues() ?? [] as issue, index (index)}
			<p class="text-sm text-red-600">{issue.message}</p>
		{/each}

		<input
			{...updateRoute.fields.originLatitude.as('number')}
			value={routeCoords?.originLatitude ?? ''}
			readonly
			tabindex="-1"
			aria-hidden="true"
			class="hidden"
		/>
		<input
			{...updateRoute.fields.originLongitude.as('number')}
			value={routeCoords?.originLongitude ?? ''}
			readonly
			tabindex="-1"
			aria-hidden="true"
			class="hidden"
		/>
		<input
			{...updateRoute.fields.destinationLatitude.as('number')}
			value={routeCoords?.destinationLatitude ?? ''}
			readonly
			tabindex="-1"
			aria-hidden="true"
			class="hidden"
		/>
		<input
			{...updateRoute.fields.destinationLongitude.as('number')}
			value={routeCoords?.destinationLongitude ?? ''}
			readonly
			tabindex="-1"
			aria-hidden="true"
			class="hidden"
		/>
		<input
			{...updateRoute.fields.distance.as('number')}
			value={routeCoords?.distance ?? ''}
			readonly
			tabindex="-1"
			aria-hidden="true"
			class="hidden"
		/>

		<RoutePicker onRouteChange={handleRouteChange} height="400px" />

		{#if routeCoords}
			<p class="mt-3 text-sm text-gray-600">
				Selected route: {routeCoords.distance.toFixed(2)} km
			</p>
		{/if}

		{#if (updateRoute.result as UpdateRouteResult | null)?.error}
			<p class="text-sm text-red-600">{(updateRoute.result as UpdateRouteResult | null)?.error}</p>
		{/if}

		<button
			type="submit"
			disabled={!routeName.trim() || !routeCoords || !direction || updateRoute.pending > 0}
			class="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
		>
			{updateRoute.pending > 0 ? 'Saving Changes…' : 'Save Changes'}
		</button>
	</form>
{/if}
