<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { getBookingHistory } from '$lib/api/passenger.remote';

	type BookingHistoryItem = {
		id: string;
		status: 'completed' | 'cancelled';
		createdAt: string | Date;
		ride: {
			route: { name: string } | null;
			vehicle: { model: string; plateNumber: string } | null;
		} | null;
	};

	const historyQuery = getBookingHistory();
	let history = $state<BookingHistoryItem[]>([]);
	let isLoading = $state(true);
	let loadError = $state('');

	onMount(() => {
		void loadHistory();
	});

	async function loadHistory() {
		isLoading = true;
		loadError = '';
		try {
			await historyQuery.refresh();
			history = (historyQuery.current as BookingHistoryItem[] | null) ?? [];
		} catch {
			loadError = 'Failed to load booking history.';
		} finally {
			isLoading = false;
		}
	}

	function formatDate(value: string | Date) {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return 'Unknown date';
		return new Intl.DateTimeFormat('en-PH', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(date);
	}
</script>

<div class="min-h-screen bg-slate-50 p-4 pt-20 sm:p-6 sm:pt-20">
	<div class="mx-auto max-w-3xl">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Past History</h1>
			<a
				href={resolve('/passenger')}
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
				>Back to Passenger</a
			>
		</div>

		<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			{#if isLoading}
				<p class="text-sm text-slate-500">Loading booking history...</p>
			{:else if loadError}
				<p class="text-sm text-red-600">{loadError}</p>
			{:else if history.length === 0}
				<p class="text-sm text-slate-500">No booking history yet.</p>
			{:else}
				<ul class="space-y-3">
					{#each history as item (item.id)}
						<li class="rounded-xl border border-slate-200 p-4">
							<div class="mb-2 flex items-start justify-between gap-3">
								<p class="font-semibold text-slate-900">
									{item.ride?.route?.name ?? 'Unknown Route'}
								</p>
								<span
									class={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}
								>
									{item.status}
								</span>
							</div>
							<p class="text-sm text-slate-600">
								{item.ride?.vehicle?.model ?? 'Vehicle N/A'} ({item.ride?.vehicle?.plateNumber ??
									'N/A'})
							</p>
							<p class="mt-1 text-xs text-slate-500">{formatDate(item.createdAt)}</p>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
