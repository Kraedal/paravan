<script lang="ts">
	import { deleteTrip, getTripHistory } from '$lib/api/admin.remote';
	import { formatUtcTimestamp } from '$lib/utils/format-timestamp';

	type TripRecord = {
		id: string;
		status: 'ongoing' | 'completed' | 'cancelled';
		createdAt: string | Date;
		endAt: string | Date | null;
		availableSeats: number;
		manualCompletedPassengers: number;
		bookings: Array<{ status: 'pending' | 'onboard' | 'completed' | 'cancelled' }>;
		driver: {
			id: string;
			name: string;
			user: { email: string };
		} | null;
		vehicle: {
			plateNumber: string;
			model: string;
			capacity: number;
		} | null;
		route: {
			id: string;
			name: string;
			direction: 'northbound' | 'southbound';
		} | null;
	};

	const tripHistory = getTripHistory();
	let isSubmitting = $state(false);
	const PAGE_SIZE = 25;
	let currentPage = $state(1);

	const totalTrips = $derived(tripHistory.current?.length ?? 0);
	const totalPages = $derived(Math.max(1, Math.ceil(totalTrips / PAGE_SIZE)));

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	const pageStart = $derived((currentPage - 1) * PAGE_SIZE);
	const pageEnd = $derived(pageStart + PAGE_SIZE);
	const pagedTrips = $derived(
		tripHistory.current ? tripHistory.current.slice(pageStart, pageEnd) : []
	);

	const statusBadgeClass = (status: TripRecord['status']) => {
		if (status === 'ongoing') return 'bg-emerald-100 text-emerald-700';
		if (status === 'completed') return 'bg-blue-100 text-blue-700';
		return 'bg-slate-100 text-slate-600';
	};

	const formatDateTime = (value: string | Date | null) => {
		if (!value) return '—';
		return formatUtcTimestamp(value, { dateStyle: 'medium', timeStyle: 'short' });
	};

	const getPassengersServed = (trip: TripRecord) => {
		const appCompletedPassengers = trip.bookings.filter((b) => b.status === 'completed').length;
		return appCompletedPassengers + (trip.manualCompletedPassengers ?? 0);
	};

	function goToPreviousPage() {
		if (currentPage > 1) currentPage -= 1;
	}

	function goToNextPage() {
		if (currentPage < totalPages) currentPage += 1;
	}
</script>

<div class="mb-6">
	<h2 class="text-xl font-semibold text-gray-900">Trip History</h2>
	<p class="mt-1 text-sm text-gray-500">View and manage trips created by your cooperative drivers.</p>
</div>

<div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
	<table class="min-w-full divide-y divide-gray-200">
		<thead class="bg-gray-50">
			<tr>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Driver</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Route</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Vehicle</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Started</th>
				<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Ended</th>
				<th class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">Status</th>
				<th class="px-6 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase">Passengers</th>
				<th class="px-6 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase">Actions</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-gray-100 bg-white">
			{#if tripHistory.loading && !tripHistory.ready}
				<tr>
					<td colspan="8" class="px-6 py-10 text-center text-sm text-gray-400">Loading trips...</td>
				</tr>
			{:else if tripHistory.error}
				<tr>
					<td colspan="8" class="px-6 py-10 text-center text-sm text-red-500">Failed to load trip history.</td>
				</tr>
			{:else if tripHistory.ready && tripHistory.current.length === 0}
				<tr>
					<td colspan="8" class="px-6 py-10 text-center text-sm text-gray-400">No trips yet.</td>
				</tr>
			{:else if tripHistory.ready}
				{#each pagedTrips as trip (trip.id)}
					{@const deleteTripForm = deleteTrip.for(trip.id)}
					<tr class="transition-colors hover:bg-gray-50">
						<td class="px-6 py-4 text-sm text-gray-700">
							{#if trip.driver}
								<div class="font-medium text-gray-900">{trip.driver.name}</div>
								<div class="mt-0.5 text-xs text-gray-500">{trip.driver.user.email}</div>
							{:else}
								<span class="text-gray-400">Unknown driver</span>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm text-gray-700">
							{#if trip.route}
								<div class="font-medium text-gray-900">{trip.route.name}</div>
								<div class="mt-0.5 text-xs text-gray-500 capitalize">{trip.route.direction}</div>
							{:else}
								<span class="text-gray-400">Unknown route</span>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm text-gray-700">
							{#if trip.vehicle}
								<div class="font-medium text-gray-900">{trip.vehicle.plateNumber}</div>
								<div class="mt-0.5 text-xs text-gray-500">{trip.vehicle.model}</div>
							{:else}
								<span class="text-gray-400">Unknown vehicle</span>
							{/if}
						</td>
						<td class="px-6 py-4 text-sm text-gray-700">{formatDateTime(trip.createdAt)}</td>
						<td class="px-6 py-4 text-sm text-gray-700">{formatDateTime(trip.endAt)}</td>
						<td class="px-6 py-4 text-center text-sm">
							<span class={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadgeClass(trip.status)}`}>
								{trip.status}
							</span>
						</td>
						<td class="px-6 py-4 text-center text-sm font-medium text-gray-900">
							{getPassengersServed(trip)}
						</td>
						<td class="px-6 py-4 text-right text-sm">
							<form
								{...deleteTripForm.enhance(async ({ submit }) => {
									if (!confirm('Delete this trip? This action cannot be undone.')) return;
									isSubmitting = true;
									try {
										await submit().updates(getTripHistory());
									} finally {
										isSubmitting = false;
									}
								})}
							>
								<input {...deleteTripForm.fields.rideId.as('text')} type="hidden" value={trip.id} />
								<button
									type="submit"
									disabled={isSubmitting}
									class="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
								>
									Delete
								</button>
							</form>
						</td>
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>

	{#if tripHistory.ready && totalTrips > PAGE_SIZE}
		<div class="flex items-center justify-between border-t border-gray-100 px-6 py-3">
			<p class="text-xs text-gray-500">
				Showing {pageStart + 1}-{Math.min(pageEnd, totalTrips)} of {totalTrips} trips
			</p>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={goToPreviousPage}
					disabled={currentPage === 1}
					class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Prev
				</button>
				<span class="text-xs text-gray-500">Page {currentPage} / {totalPages}</span>
				<button
					type="button"
					onclick={goToNextPage}
					disabled={currentPage === totalPages}
					class="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
				>
					Next
				</button>
			</div>
		</div>
	{/if}
</div>
