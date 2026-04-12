<script lang="ts">
	import { getRoutes, deleteRoute } from '$lib/api/admin.remote';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const routes = getRoutes();

	type DeleteRouteResult = { success?: boolean; error?: string };

	$effect(() => {
		const result = deleteRoute.result as DeleteRouteResult | null;
		if (!result?.success) return;
		void routes.refresh();
	});
</script>


<div class="mb-6 flex items-center justify-between">
	<div>
		<h2 class="text-xl font-semibold text-gray-900">Routes</h2>
		<p class="mt-1 text-sm text-gray-500">Manage your cooperative's routes.</p>
	</div>
	<button
		type="button"
		onclick={() => goto(resolve('/cooperative/routes/create'))}
		class="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-2 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<line x1="12" x2="12" y1="5" y2="19" />
			<line x1="5" x2="19" y1="12" y2="12" />
		</svg>
		<p class="hidden md:block">Add Routes</p>
	</button>
</div>

<!-- Drivers Table -->
<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
	<table class="min-w-full divide-y divide-gray-200 overflow-scroll">
		<thead class="bg-gray-50">
			<tr>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Name</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Distance</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Action</th
				>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100 bg-white">
			{#if routes.loading && !routes.ready}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-gray-400">Loading routes...</td
					>
				</tr>
			{:else if routes.error}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-red-500"
						>Failed to load routes.</td
					>
				</tr>
			{:else if routes.ready && routes.current.length === 0}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-gray-400"
						>No routes yet. Add one to get started.</td
					>
				</tr>
			{:else if routes.ready}
				{#each routes.current as route (route.id)}
					<tr class="transition-colors hover:bg-gray-50">
						<td class="px-6 py-4 text-sm font-medium text-gray-900">
							<div>{route.name}</div>
						</td>
						<td class="px-6 py-4 text-sm text-gray-600">{route.distance.toFixed(2)} km</td>
						<td class="px-6 py-4 text-sm text-gray-600">
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => goto(resolve(`/cooperative/routes/${route.id}/edit`))}
									class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
								>
									Edit
								</button>

								<button
									type="button"
									onclick={() => goto(resolve(`/cooperative/routes/${route.id}`))}
									class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
								>
									View
								</button>

								<form
									{...deleteRoute}
									onsubmit={(event) => {
										if (!confirm('Delete this route? This action cannot be undone.')) {
											event.preventDefault();
										}
									}}
								>
									<input type="hidden" name="routeId" value={route.id} />
									<button
										type="submit"
										disabled={deleteRoute.pending > 0}
										class="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
									>
										{deleteRoute.pending > 0 ? 'Deleting…' : 'Delete'}
									</button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

