<script lang="ts">
	import { demandBg, confidenceColor, type DemandLevel } from './dashboardUtils';

	interface DemandSlot {
		routeName: string;
		day: string;
		hourSlot: string;
		totalRides: number;
		historicDemandLevel: DemandLevel;
		forecastedDemandLevel: DemandLevel | null;
		forecastConfidence: 'low' | 'medium' | 'high' | null;
	}

	interface DemandSummary {
		ridesAnalyzed: number;
		highDemandSlots: number;
		lowDemandSlots: number;
		forecastedHighSlots: number;
	}

	interface Props {
		patterns?: DemandSlot[];
		summary?: DemandSummary;
		// aiAssisted?: boolean;
	}

	let { patterns = [], summary }: Props = $props();
	// let showAiInfo = $state(false);

	const PAGE_SIZE = 8;
	let currentPage = $state(1);
	const totalPages = $derived(Math.max(1, Math.ceil(patterns.length / PAGE_SIZE)));

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	const pageStart = $derived((currentPage - 1) * PAGE_SIZE);
	const pageEnd = $derived(pageStart + PAGE_SIZE);
	const displayPatterns = $derived(patterns.slice(pageStart, pageEnd));

	function goToPreviousPage() {
		if (currentPage > 1) currentPage -= 1;
	}

	function goToNextPage() {
		if (currentPage < totalPages) currentPage += 1;
	}
</script>

<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
	<div class="flex items-start justify-between mb-4">
		<div>
			<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Demand Forecast</h2>
			{#if summary}
				<p class="text-xs text-slate-400 mt-1">{summary.ridesAnalyzed} rides · last 28 days</p>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<!-- <div class="relative">
				<button
					type="button"
					onclick={() => (showAiInfo = !showAiInfo)}
					class={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 transition-colors ${aiAssisted ? 'bg-violet-50 text-violet-600 ring-violet-100 hover:bg-violet-100' : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'}`}
				>
					{aiAssisted ? 'AI-assisted' : 'Rules-only'}
				</button>
				{#if showAiInfo}
					<div class="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-snug text-slate-600 shadow-lg">
						{aiAssisted
							? 'Generated using Groq + fallback rules.'
							: 'Using fallback rules only (Groq was not used for this response).'}
					</div>
				{/if}
			</div> -->
			{#if summary && summary.forecastedHighSlots > 0}
				<span class="text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full ring-1 ring-red-100 shrink-0">
					{summary.forecastedHighSlots} high-demand slot{summary.forecastedHighSlots !== 1 ? 's' : ''}
				</span>
			{/if}
		</div>
	</div>

	{#if patterns.length > 0}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-slate-100">
						<th class="text-left pb-2.5 text-xs font-medium text-slate-400 pr-3">Route</th>
						<th class="text-left pb-2.5 text-xs font-medium text-slate-400 pr-3">Day</th>
						<th class="text-left pb-2.5 text-xs font-medium text-slate-400 whitespace-nowrap">Time</th>
						<th class="text-center pb-2.5 text-xs font-medium text-slate-400">Rides</th>
						<th class="text-center pb-2.5 text-xs font-medium text-slate-400">Historic</th>
						<th class="text-center pb-2.5 text-xs font-medium text-slate-400">Forecast</th>
						<th class="text-center pb-2.5 text-xs font-medium text-slate-400 hidden md:table-cell">Conf.</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					{#each displayPatterns as p (p.routeName + p.day + p.hourSlot)}
						<tr class="hover:bg-slate-50/60 transition-colors">
							<td class="py-2.5 pr-3 text-xs font-medium text-slate-700 max-w-30 truncate">{p.routeName}</td>
							<td class="py-2.5 pr-3 text-xs text-slate-500">{p.day.slice(0, 3)}</td>
							<td class="py-2.5 text-xs text-slate-500 whitespace-nowrap">{p.hourSlot}</td>
							<td class="py-2.5 text-center text-sm font-semibold text-slate-900 tabular-nums">{p.totalRides}</td>
							<td class="py-2.5 text-center">
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {demandBg(p.historicDemandLevel)}">{p.historicDemandLevel}</span>
							</td>
							<td class="py-2.5 text-center">
								{#if p.forecastedDemandLevel}
									<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {demandBg(p.forecastedDemandLevel)}">{p.forecastedDemandLevel}</span>
								{:else}
									<span class="text-slate-300 text-xs">—</span>
								{/if}
							</td>
							<td class="py-2.5 text-center hidden md:table-cell">
								{#if p.forecastConfidence}
									<span class="text-xs font-semibold capitalize" style="color:{confidenceColor(p.forecastConfidence)}">{p.forecastConfidence}</span>
								{:else}
									<span class="text-slate-300 text-xs">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if patterns.length > PAGE_SIZE}
			<div class="mt-3 flex items-center justify-between gap-2">
				<p class="text-xs text-slate-300">
					Showing {pageStart + 1}-{Math.min(pageEnd, patterns.length)} of {patterns.length} patterns
				</p>
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						onclick={goToPreviousPage}
						disabled={currentPage === 1}
						class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Prev
					</button>
					<span class="text-xs text-slate-400">Page {currentPage} / {totalPages}</span>
					<button
						type="button"
						onclick={goToNextPage}
						disabled={currentPage === totalPages}
						class="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<p class="text-sm text-slate-400 py-6 text-center">Not enough ride data to generate forecasts yet.</p>
	{/if}
</div>
