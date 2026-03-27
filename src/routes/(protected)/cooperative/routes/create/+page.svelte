<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import RoutePicker from '$lib/components/routePicker.svelte';
	import { createRoute } from '$lib/api/admin.remote';

	let formEl = $state<HTMLFormElement | null>(null);
	let routeName = $state('');
	let routeCoords = $state<{
		originLatitude: number;
		originLongitude: number;
		destinationLatitude: number;
		destinationLongitude: number;
		distance: number;
	} | null>(null);

	type CreateRouteResult = { success?: boolean; error?: string };

	$effect(() => {
		const result = createRoute.result as CreateRouteResult | null;
		if (!result?.success) return;

		void invalidateAll();

		// Navigate to routes page after successful submission
		const timeout = setTimeout(() => {
			goto(resolve('/cooperative/routes'));
		}, 500);

		return () => clearTimeout(timeout);
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

<form bind:this={formEl} {...createRoute} class="space-y-4">
	<input
		{...createRoute.fields.name.as('text')}
		type="text"
		placeholder="Route name (e.g. Alabang to BGC)"
		bind:value={routeName}
		class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-gray-900 focus:outline-none"
	/>
	<select
			{...createRoute.fields.direction.as('text')}
			placeholder="Select direction"
			class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-gray-900 focus:outline-none"
		>
			<option value="" disabled selected>Select direction</option>
			<option value="northbound">Northbound</option>
			<option value="southbound">Southbound</option>
	</select>

	{#each createRoute.fields.name.issues() ?? [] as issue, index (index)}
		<p class="text-sm text-red-600">{issue.message}</p>
	{/each}

	<input
		{...createRoute.fields.originLatitude.as('number')}
		value={routeCoords?.originLatitude ?? ''}
		readonly
		tabindex="-1"
		aria-hidden="true"
		class="hidden"
	/>
	<input
		{...createRoute.fields.originLongitude.as('number')}
		value={routeCoords?.originLongitude ?? ''}
		readonly
		tabindex="-1"
		aria-hidden="true"
		class="hidden"
	/>
	<input
		{...createRoute.fields.destinationLatitude.as('number')}
		value={routeCoords?.destinationLatitude ?? ''}
		readonly
		tabindex="-1"
		aria-hidden="true"
		class="hidden"
	/>
	<input
		{...createRoute.fields.destinationLongitude.as('number')}
		value={routeCoords?.destinationLongitude ?? ''}
		readonly
		tabindex="-1"
		aria-hidden="true"
		class="hidden"
	/>
	<input
		{...createRoute.fields.distance.as('number')}
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

	{#if (createRoute.result as CreateRouteResult | null)?.error}
		<p class="text-sm text-red-600">{(createRoute.result as CreateRouteResult | null)?.error}</p>
	{/if}

	<button
		type="submit"
		disabled={!routeName.trim() || !routeCoords || createRoute.pending > 0}
		class="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
	>
		{createRoute.pending > 0 ? 'Saving Route…' : 'Save Route'}
	</button>
</form>
