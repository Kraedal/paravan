<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createDriver,
		updateDriver,
		getDrivers,
		assignVehicleToDriver,
		deleteDriver,
		unassignVehicleFromDriver,
		getVehicles
	} from '$lib/api/admin.remote';

	const drivers = getDrivers();
	const vehicles = getVehicles();

	let isOpen = $state(false);
	let formEl = $state<HTMLFormElement | null>(null);
	let editFormEl = $state<HTMLFormElement | null>(null);
	let isAssignOpen = $state(false);
	let isEditOpen = $state(false);
	let didCreateSubmit = $state(false);
	let didEditSubmit = $state(false);
	let lastHandledCreateResult = $state<CreateDriverResult | null>(null);
	let lastHandledUpdateResult = $state<AssignResult | null>(null);
	let showCreateSuccessToast = $state(false);
	let assigningDriverId = $state('');
	let editingDriver = $state<{
		id: string;
		name: string;
		licenseNumber: string;
		licenseExpiry: string | null;
	} | null>(null);

	const DRIVER_CREATED_TOAST_KEY = 'driver_created_success';
	const TOAST_DURATION_MS = 3000;

	onMount(() => {
		if (sessionStorage.getItem(DRIVER_CREATED_TOAST_KEY) !== '1') return;

		sessionStorage.removeItem(DRIVER_CREATED_TOAST_KEY);
		showCreateSuccessToast = true;

		const timeoutId = window.setTimeout(() => {
			showCreateSuccessToast = false;
		}, TOAST_DURATION_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	});

	type CreateDriverResult = { success?: boolean };
	type AssignResult = { success?: boolean };

	$effect(() => {
		if (!didCreateSubmit) return;

		const result = createDriver.result as CreateDriverResult | null;
		if (!result) return;
		if (result === lastHandledCreateResult) return;

		lastHandledCreateResult = result;
		didCreateSubmit = false;

		if (result.success) {
			sessionStorage.setItem(DRIVER_CREATED_TOAST_KEY, '1');
			window.location.reload();
		}
	});

	$effect(() => {
		const result = assignVehicleToDriver.result as AssignResult | null;
		if (!result) return;
		if (result.success) {
			isAssignOpen = false;
			void drivers.refresh();
		}
	});

	$effect(() => {
		const result = unassignVehicleFromDriver.result as AssignResult | null;
		if (!result) return;
		if (result.success) {
			void drivers.refresh();
		}
	});

	$effect(() => {
		const result = deleteDriver.result as AssignResult | null;
		if (!result) return;
		if (result.success) {
			void drivers.refresh();
		}
	});

	$effect(() => {
		if (!didEditSubmit) return;

		const result = updateDriver.result as AssignResult | null;
		if (!result) return;
		if (result === lastHandledUpdateResult) return;

		lastHandledUpdateResult = result;

		didEditSubmit = false;

		if (result.success) {
			isEditOpen = false;
			editingDriver = null;
			editFormEl?.reset();
			window.location.reload();
		}
	});

	const closeModal = () => {
		isOpen = false;
	};
	const closeAssignModal = () => {
		isAssignOpen = false;
		assigningDriverId = '';
	};

	const closeEditModal = () => {
		isEditOpen = false;
		didEditSubmit = false;
		editingDriver = null;
	};

	const openAssignModal = (driverId: string) => {
		assigningDriverId = driverId;
		isAssignOpen = true;
	};

	const openEditModal = (driverRecord: {
		id: string;
		name: string;
		licenseNumber: string;
		licenseExpiry: string | null;
	}) => {
		editingDriver = driverRecord;
		isEditOpen = true;
	};

	const assignableVehicles = $derived.by(() => {
		if (!vehicles.ready || !drivers.ready || !assigningDriverId) return [];

		const currentDriver = drivers.current.find((item) => item.id === assigningDriverId);
		if (!currentDriver || currentDriver.vehicleId) return [];

		const assignedVehicleIds = new Set(
			drivers.current.filter((item) => item.vehicleId).map((item) => item.vehicleId as string)
		);

		return vehicles.current.filter((item) => !assignedVehicleIds.has(item.id));
	});
	import { formatUtcDate } from '$lib/utils/format-timestamp';

	const formatDate = (value: string | null) => {
		if (!value) return 'No expiry set';
		return formatUtcDate(value);
	};
</script>

{#if showCreateSuccessToast}
	<div
		role="status"
		aria-live="polite"
		class="fixed bottom-4 right-4 z-60 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-green-800 shadow-lg"
	>
		Driver created successfully.
	</div>
{/if}

<!-- Page header -->
<div class="mb-6 flex items-center justify-between">
	<div>
		<h2 class="text-xl font-semibold text-gray-900">Drivers</h2>
		<p class="mt-1 text-sm text-gray-500">Manage your cooperative's drivers.</p>
	</div>
	<button
		type="button"
		onclick={() => (isOpen = true)}
		class="inline-flex items-center gap-1 rounded-lg bg-blue-900 px-2 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
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
		<p class="hidden md:block">Add Driver</p>
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
					>License No.</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>License Expiry</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Status</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Vehicle</th
				>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
					>Actions</th
				>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100 bg-white">
			{#if drivers.loading && !drivers.ready}
				<tr>
					<td colspan="6" class="px-6 py-10 text-center text-sm text-gray-400"
						>Loading drivers...</td
					>
				</tr>
			{:else if drivers.error}
				<tr>
					<td colspan="6" class="px-6 py-10 text-center text-sm text-red-500"
						>Failed to load drivers.</td
					>
				</tr>
			{:else if drivers.ready && drivers.current.length === 0}
				<tr>
					<td colspan="6" class="px-6 py-10 text-center text-sm text-gray-400"
						>No drivers yet. Add one to get started.</td
					>
				</tr>
			{:else if drivers.ready}
				{#each drivers.current as driverRecord (driverRecord.id)}
					<tr class="transition-colors hover:bg-gray-50">
						<td class="px-6 py-4 text-sm font-medium text-gray-900">
							<div>{driverRecord.name}</div>
							<div class="mt-0.5 text-xs text-gray-500">{driverRecord.user.email}</div>
						</td>
						<td class="px-6 py-4 text-sm text-gray-600">{driverRecord.licenseNumber}</td>
						<td class="px-6 py-4 text-sm text-gray-600">{formatDate(driverRecord.licenseExpiry)}</td
						>
						<td class="px-6 py-4 text-sm">
							<span
								class={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${driverRecord.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
							>
								{driverRecord.isAvailable ? 'Available' : 'Offline'}
							</span>
						</td>
						<td class="px-6 py-4 text-sm">
							{#if driverRecord.vehicle}
								<div class="font-medium text-gray-900">{driverRecord.vehicle.plateNumber}</div>
								<div class="mt-0.5 text-xs text-gray-500">{driverRecord.vehicle.model}</div>
							{:else}
								<span class="text-gray-400">No vehicle assigned</span>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm">
							<div class="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onclick={() =>
										openEditModal({
											id: driverRecord.id,
											name: driverRecord.name,
											licenseNumber: driverRecord.licenseNumber,
											licenseExpiry: driverRecord.licenseExpiry
										})}
									class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
								>
									Edit
								</button>

								{#if driverRecord.vehicle}
									<form {...unassignVehicleFromDriver}>
										<input type="hidden" name="driverId" value={driverRecord.id} />
										<button
											type="submit"
											disabled={unassignVehicleFromDriver.pending > 0}
											class="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
										>
											{unassignVehicleFromDriver.pending > 0 ? 'Unassigning…' : 'Unassign'}
										</button>
									</form>
								{:else}
									<button
										type="button"
										onclick={() => openAssignModal(driverRecord.id)}
										class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
									>
										Assign
									</button>
								{/if}
								<form
									{...deleteDriver}
									onsubmit={(event) => {
										if (!confirm('Delete this driver? This action cannot be undone.')) {
											event.preventDefault();
										}
									}}
								>
									<input type="hidden" name="driverId" value={driverRecord.id} />
									<button
										type="submit"
										disabled={deleteDriver.pending > 0}
										class="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
									>
										{deleteDriver.pending > 0 ? 'Deleting…' : 'Delete'}
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

<!-- Edit Driver Modal -->
{#if isEditOpen && editingDriver}
	<button
		type="button"
		aria-label="Close modal"
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
		onclick={closeEditModal}
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-driver-title"
		class="fixed top-1/2 left-1/2 z-50 w-80 md:w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-center justify-between">
			<h2 id="edit-driver-title" class="text-md font-semibold text-gray-900">Edit Driver</h2>
			<button
				type="button"
				onclick={closeEditModal}
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

		<form
			bind:this={editFormEl}
			{...updateDriver}
			onsubmit={() => {
				didEditSubmit = true;
			}}
			class="flex flex-col gap-4"
		>
			<input {...updateDriver.fields.driverId.as('text')} type="hidden" value={editingDriver.id} />

			<div class="grid grid-cols-2 gap-4">
				<div class="col-span-2 flex flex-col gap-1.5">
					<label for="edit-name" class="text-sm font-medium text-gray-700">Full Name</label>
					<input
						id="edit-name"
						{...updateDriver.fields.name.as('text')}
						value={editingDriver.name}
						placeholder="Juan dela Cruz"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="edit-license" class="text-sm font-medium text-gray-700">License No.</label>
					<input
						id="edit-license"
						{...updateDriver.fields.licenseNumber.as('text')}
						value={editingDriver.licenseNumber}
						placeholder="A01-23-456789"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label for="edit-expiry" class="text-sm font-medium text-gray-700">Expiry Date</label>
					<input
						id="edit-expiry"
						{...updateDriver.fields.licenseExpiry.as('date')}
						type="date"
						value={editingDriver.licenseExpiry ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
					{#each updateDriver.fields.licenseExpiry.issues() ?? [] as issue, index (index)}
						<p class="text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
			</div>

			<div class="mt-1 flex gap-3">
				<button
					type="button"
					onclick={closeEditModal}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={updateDriver.pending > 0}
					class="flex-1 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98] disabled:opacity-60"
				>
					{updateDriver.pending > 0 ? 'Saving…' : 'Save Changes'}
				</button>
			</div>
		</form>
	</div>
{/if}

<!-- Assign Vehicle Modal -->
{#if isAssignOpen}
	<div
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
		onclick={closeAssignModal}
		role="presentation"
	></div>

	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="assign-vehicle-title"
		class="fixed top-1/2 left-1/2 z-50 w-80 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-center justify-between w-full">
			<h2 id="assign-vehicle-title" class="text-lg font-semibold text-gray-900">Assign Vehicle</h2>
			<button
				type="button"
				onclick={closeAssignModal}
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

		<form {...assignVehicleToDriver} class="flex flex-col gap-4">
			<input type="hidden" name="driverId" value={assigningDriverId} />

			<div class="flex flex-col gap-1.5">
				<label for="vehicleId" class="text-sm font-medium text-gray-700">Vehicle</label>
				{#if vehicles.loading && !vehicles.ready}
					<p class="text-sm text-gray-400">Loading vehicles...</p>
				{:else if vehicles.ready && vehicles.current.length === 0}
					<p class="text-sm text-gray-400">No vehicles available. Add one first.</p>
				{:else if assignableVehicles.length === 0}
					<p class="text-sm text-gray-400">All vehicles are currently in use.</p>
				{:else}
					<select
						id="vehicleId"
						name="vehicleId"
						required
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					>
						<option value="" disabled selected>Select a vehicle</option>
						{#each assignableVehicles as v (v.id)}
							<option value={v.id}>{v.plateNumber} — {v.model}</option>
						{/each}
					</select>
				{/if}
			</div>

			<div class="mt-1 flex gap-3">
				<button
					type="button"
					onclick={closeAssignModal}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					<p>Cancel</p>
				</button>
				<button
					type="submit"
					disabled={assignVehicleToDriver.pending > 0 ||
						(vehicles.ready && (vehicles.current.length === 0 || assignableVehicles.length === 0))}
					class="flex-1 rounded-lg bg-blue-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-800 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98] disabled:opacity-60"
				>
					{assignVehicleToDriver.pending > 0 ? 'Assigning…' : 'Assign Vehicle'}
				</button>
			</div>
		</form>
	</div>
{/if}

<!-- Add Driver Modal -->
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
		aria-labelledby="add-driver-title"
		class="fixed top-1/2 left-1/2 z-50 w-80 md:w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
	>
		<div class="mb-5 flex items-center justify-between">
			<h2 id="add-driver-title" class="text-md font-semibold text-gray-900">Add Driver</h2>
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

		<form
			bind:this={formEl}
			{...createDriver}
			onsubmit={() => {
				didCreateSubmit = true;
			}}
			class="flex flex-col gap-4"
		>
			<div class="grid grid-cols-2 gap-4">
				<!-- Full Name -->
				<div class="col-span-2 flex flex-col gap-1.5">
					<label for="name" class="text-sm font-medium text-gray-700">Full Name</label>
					<input
						{...createDriver.fields.name.as('text')}
						placeholder="Juan dela Cruz"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
				</div>

				<!-- Email -->
				<div class="col-span-2 flex flex-col gap-1.5">
					<label for="email" class="text-sm font-medium text-gray-700">Email</label>
					<input
						{...createDriver.fields.email.as('email')}
						placeholder="driver@example.com"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
					{#each createDriver.fields.email.issues() ?? [] as issue, index (index)}
						<p class="text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>

				<!-- Password -->
				<div class="col-span-2 flex flex-col gap-1.5">
					<label for="password" class="text-sm font-medium text-gray-700">Password</label>
					<input
						{...createDriver.fields.password.as('password')}
						placeholder="Min. 8 characters"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
					{#each createDriver.fields.password.issues() ?? [] as issue, index (index)}
						<p class="text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>

				<!-- License Number -->
				<div class="flex flex-col gap-1.5">
					<label for="licenseNumber" class="text-sm font-medium text-gray-700">License No.</label>
					<input
						{...createDriver.fields.licenseNumber.as('text')}
						placeholder="A01-23-456789"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
					{#each createDriver.fields.licenseNumber.issues() ?? [] as issue, index (index)}
						<p class="text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>

				<!-- License Expiry -->
				<div class="flex flex-col gap-1.5">
					<label for="licenseExpiry" class="text-sm font-medium text-gray-700">Expiry Date</label>
					<input
						{...createDriver.fields.licenseExpiry.as('date')}
						type="date"
						class="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm transition outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
					/>
					{#each createDriver.fields.licenseExpiry.issues() ?? [] as issue, index (index)}
						<p class="text-sm text-red-600">{issue.message}</p>
					{/each}
				</div>
			</div>

			<div class="mt-1 flex gap-3">
				<button
					type="button"
					onclick={closeModal}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={createDriver.pending > 0}
					class="flex-1 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-800 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98] disabled:opacity-60"
				>
					{createDriver.pending > 0 ? 'Creating…' : 'Create Driver'}
				</button>
			</div>
		</form>
	</div>
{/if}
