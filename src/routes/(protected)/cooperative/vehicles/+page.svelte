<script lang="ts">
	import { createVehicle, getVehicles } from '$lib/api/admin.remote';
	const vehicles = getVehicles();
	let isOpen = $state(false);

	const closeModal = () => {
		isOpen = false;
	};
</script>

<!-- Page header -->
<div class="mb-6 flex items-center justify-between">
	<div>
		<h2 class="text-xl font-semibold text-gray-900">Vehicles</h2>
		<p class="mt-1 text-sm text-gray-500">Manage your cooperative's vehicles.</p>
	</div>
	<button
		type="button"
		onclick={() => (isOpen = true)}
		class="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
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
		Add Vehicle
	</button>
</div>

<!-- Drivers Table -->
<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
	<table class="min-w-full divide-y divide-gray-200 overflow-scroll">
		<thead class="bg-gray-50">
			<tr>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Model</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Plate Number</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Capacity</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Assigned Driver</th
				>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100 bg-white">
			{#if vehicles.loading && !vehicles.ready}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-gray-400"
						>Loading vehicles...</td
					>
				</tr>
			{:else if vehicles.error}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-red-500"
						>Failed to load vehicles.</td
					>
				</tr>
			{:else if vehicles.ready && vehicles.current.length === 0}
				<tr>
					<td colspan="4" class="px-6 py-10 text-center text-sm text-gray-400"
						>No vehicles yet. Add one to get started.</td
					>
				</tr>
			{:else if vehicles.ready}
				{#each vehicles.current as vehicleRecord (vehicleRecord.id)}
					{@const assignedDriver = vehicleRecord.drivers[0]}
					<tr class="transition-colors hover:bg-gray-50">
						<td class="px-6 py-4 text-sm font-medium text-gray-900">
							<div>{vehicleRecord.model}</div>
						</td>
						<td class="px-6 py-4 text-sm text-gray-600">{vehicleRecord.plateNumber}</td>
						<td class="px-6 py-4 text-sm text-gray-600">{vehicleRecord.capacity}</td>
						<td class="px-6 py-4 text-sm text-gray-600">
							{#if assignedDriver}
								<div class="font-medium text-gray-900">{assignedDriver.name}</div>
								<div class="mt-0.5 text-xs text-gray-500">{assignedDriver.user.email}</div>
							{:else}
								<span class="text-gray-400">Unassigned</span>
							{/if}
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<!-- Add Vehicle Modal -->
{#if isOpen}
	<button
		type="button"
		aria-label="Close modal"
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
		onclick={closeModal}
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="add-vehicle-title"
		class="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-center justify-between">
			<h2 id="add-vehicle-title" class="text-lg font-semibold text-gray-900">Add Vehicle</h2>
			<button
				type="button"
				onclick={closeModal}
				class="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
				</svg>
			</button>
		</div>

		<form {...createVehicle} class="mt-4 space-y-4">
			<div class="col-span-2 flex flex-col gap-1.5">
				<label for="plateNumber" class="text-sm font-medium text-gray-700">Plate Number</label>
				<input
					{...createVehicle.fields.plateNumber.as('text')}
					placeholder="ABC-1234"
					class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
				/>
			</div>
			<div class="col-span-2 flex flex-col gap-1.5">
				<label for="model" class="text-sm font-medium text-gray-700">Model</label>
				<input
					{...createVehicle.fields.model.as('text')}
					placeholder="ABC-1234"
					class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
				/>
			</div>
			<div class="col-span-2 flex flex-col gap-1.5">
				<label for="capacity" class="text-sm font-medium text-gray-700">Capacity</label>
				<input
					{...createVehicle.fields.capacity.as('number')}
					placeholder="ABC-1234"
					class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
				/>
			</div>
			<div class="flex justify-end">
				<button
					type="button"
					onclick={() => (isOpen = false)}
					class="mr-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none"
				>
					Cancel</button
				>
				<button
					type="submit"
					class="rounded-md border border-gray-300 bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none"
				>
					Add</button
				>
			</div>
		</form>
	</div>
{/if}
