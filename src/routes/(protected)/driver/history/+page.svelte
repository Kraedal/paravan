<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { getTripHistory } from '$lib/api/driver.remote';
	import { formatUtcTimestamp } from '$lib/utils/format-timestamp';

	type RideHistoryItem = {
		id: string;
		endAt: string | Date | null;
		availableSeats: number;
		manualCompletedPassengers: number;
		vehicle: { capacity: number; plateNumber: string; model: string } | null;
		route: { name: string } | null;
		bookings: Array<{ status: 'pending' | 'onboard' | 'completed' | 'cancelled' }>;
	};

	const tripHistoryQuery = getTripHistory();
	let rides = $state<RideHistoryItem[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');

	onMount(() => {
		void loadTripHistory();
	});

	async function loadTripHistory() {
		isLoading = true;
		loadError = '';
		try {
			await tripHistoryQuery.refresh();
			rides = (tripHistoryQuery.current as RideHistoryItem[] | null) ?? [];
		} catch {
			loadError = 'Failed to load trip history.';
		} finally {
			isLoading = false;
		}
	}

	function formatWhen(value: string | Date | null) {
		return formatUtcTimestamp(value, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}

	function servedPassengersCount(ride: RideHistoryItem) {
		return (
			ride.bookings.filter((b) => b.status === 'completed').length +
			(ride.manualCompletedPassengers ?? 0)
		);
	}
</script>

<div class="mt-20 min-h-screen bg-slate-50 p-4 sm:p-6">
	<div class="mx-auto max-w-3xl">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-extrabold tracking-tight text-slate-900">History</h1>
			<a
				href={resolve('/driver')}
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
				>Back to Home</a
			>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			{#if isLoading}
				<p class="text-sm text-slate-500">Loading trip history...</p>
			{:else if loadError}
				<p class="text-sm text-red-600">{loadError}</p>
			{:else if rides.length === 0}
				<p class="text-sm text-slate-500">No completed rides yet.</p>
			{:else}
				<ul class="space-y-3">
					{#each rides as ride (ride.id)}
						<li class="rounded-xl border border-slate-200 p-4">
							<div class="mb-2 flex items-start justify-between gap-3">
								<p class="font-semibold text-slate-900">{ride.route?.name ?? 'Unnamed Route'}</p>
								<p class="shrink-0 text-xs font-medium text-slate-500">{formatWhen(ride.endAt)}</p>
							</div>
							<p class="text-sm text-slate-600">
								{servedPassengersCount(ride)} passenger(s) served •
								{ride.vehicle?.model ?? 'Unknown vehicle'}
								({ride.vehicle?.plateNumber ?? 'N/A'})
							</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
