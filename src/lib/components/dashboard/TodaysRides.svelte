<script lang="ts">
	interface Props {
		totalRides?: number;
		completedRides?: number;
		ongoingRides?: number;
		avgDurationMinutes?: number | null;
	}

	let { totalRides = 0, completedRides = 0, ongoingRides = 0, avgDurationMinutes = null }: Props = $props();

	const maxVal = $derived(Math.max(totalRides, 1));

	const rideMetrics = $derived([
		{ label: 'Total', value: totalRides, color: '#6366f1' },
		{ label: 'Completed', value: completedRides, color: '#22c55e' },
		{ label: 'Ongoing', value: ongoingRides, color: '#0ea5e9' }
	]);
</script>

<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
	<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-5">Today's Rides</h2>
	<div class="space-y-3.5">
		{#each rideMetrics as row (row.label)}
			<div>
				<div class="flex justify-between mb-1.5">
					<span class="text-xs font-medium text-slate-500">{row.label}</span>
					<span class="text-xs font-semibold text-slate-900 tabular-nums">{row.value}</span>
				</div>
				<div class="h-2 bg-slate-100 rounded-full overflow-hidden">
					<div
						class="h-full rounded-full transition-all duration-700"
						style="width:{Math.max(row.value > 0 ? 4 : 0, Math.round((row.value / maxVal) * 100))}%; background:{row.color}"
					></div>
				</div>
			</div>
		{/each}
		{#if avgDurationMinutes}
			<div class="flex items-center justify-between pt-3 border-t border-slate-100 mt-1">
				<span class="text-xs text-slate-400">Avg. ride duration</span>
				<span class="text-sm font-semibold text-slate-900 tabular-nums">
					{avgDurationMinutes} min
				</span>
			</div>
		{/if}
	</div>
</div>
