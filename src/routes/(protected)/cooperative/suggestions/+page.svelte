<script lang="ts">
	import { getDemandPatterns, type DemandSlot } from '$lib/api/analytics.remote';
  import { resolve } from '$app/paths';

	const demand = getDemandPatterns();
	const PAGE_SIZE = 10;
	let currentPage = $state(1);
	let showAiInfo = $state(false);

	const actionableSuggestions = $derived.by(() => {
		if (!demand.ready || !demand.current?.patterns) return [];
		return (demand.current.patterns as DemandSlot[])
			.filter((p) => p.suggestion)
			.sort((a, b) => {
				const confidenceRank = (c: DemandSlot['forecastConfidence']) =>
					c === 'high' ? 0 : c === 'medium' ? 1 : c === 'low' ? 2 : 3;
				const demandRank = (d: DemandSlot['forecastedDemandLevel']) =>
					d === 'high' ? 0 : d === 'low' ? 1 : 2;
				const confidenceDelta = confidenceRank(a.forecastConfidence) - confidenceRank(b.forecastConfidence);
				if (confidenceDelta !== 0) return confidenceDelta;
				return demandRank(a.forecastedDemandLevel) - demandRank(b.forecastedDemandLevel);
			});
	});

	const totalPages = $derived(Math.max(1, Math.ceil(actionableSuggestions.length / PAGE_SIZE)));
	const pagedSuggestions = $derived.by(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return actionableSuggestions.slice(start, start + PAGE_SIZE);
	});

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-xl font-semibold text-slate-900 tracking-tight">Suggestions Summary</h1>
			<p class="mt-1 text-sm text-slate-500">Concise AI summary plus all actionable demand suggestions.</p>
		</div>
		<div class="flex items-center gap-2">
			<a
				href={resolve('/cooperative')}
				class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				Back to dashboard
			</a>
			<div class="relative">
				<button
					type="button"
					onclick={() => (showAiInfo = !showAiInfo)}
					class={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition-colors ${demand.current?.aiAssisted ? 'bg-violet-50 text-violet-600 ring-violet-100 hover:bg-violet-100' : 'bg-slate-100 text-slate-500 ring-slate-200 hover:bg-slate-200'}`}
				>
					{demand.current?.aiAssisted ? 'AI-assisted' : 'Rules-only'}
				</button>
				{#if showAiInfo}
					<div class="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 text-[11px] leading-snug text-slate-600 shadow-lg">
						{demand.current?.aiAssisted
							? 'Generated using Groq + fallback rules.'
							: 'Using fallback rules only (Groq was not used for this response).'}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if demand.loading && !demand.ready}
		<div class="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-400">Loading suggestions summary...</div>
	{:else if demand.error}
		<div class="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">Failed to load suggestions summary.</div>
	{:else}
		<div class="rounded-xl border border-slate-200 bg-white p-5">
			<h2 class="mb-2 text-sm font-semibold text-slate-900">Executive Summary</h2>
			<p class="text-sm leading-relaxed text-slate-700">
				{demand.current?.suggestionsSummary ?? 'No summary available yet.'}
			</p>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-4">
			<div class="mb-3 flex items-center justify-between gap-2">
				<h2 class="text-sm font-semibold text-slate-900">All Actionable Suggestions</h2>
				<p class="text-xs text-slate-500">{actionableSuggestions.length} total</p>
			</div>

			{#if actionableSuggestions.length === 0}
				<p class="py-8 text-center text-sm text-slate-400">No actionable suggestions yet.</p>
			{:else}
				<div class="space-y-2">
					{#each pagedSuggestions as s (s.routeName + s.day + s.hourSlot)}
						<div class="rounded-lg border border-slate-100 bg-slate-50 p-3">
							<p class="text-xs font-semibold text-slate-700">
								{s.routeName} • {s.day} • {s.hourSlot}
							</p>
							<p class="mt-1 text-sm text-slate-700">{s.suggestion}</p>
						</div>
					{/each}
				</div>

				{#if totalPages > 1}
					<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
						<button
							type="button"
							onclick={() => (currentPage = Math.max(1, currentPage - 1))}
							disabled={currentPage === 1}
							class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
						>
							Prev
						</button>
						<p class="text-xs text-slate-500">Page {currentPage} / {totalPages}</p>
						<button
							type="button"
							onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
							disabled={currentPage === totalPages}
							class="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 disabled:opacity-40"
						>
							Next
						</button>
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>
