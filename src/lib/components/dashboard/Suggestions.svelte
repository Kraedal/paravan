<script lang="ts">
	import { demandColor, confidenceColor, type DemandLevel } from './dashboardUtils';
	import { resolve } from '$app/paths';

	interface Suggestion {
		routeName: string;
		day: string;
		hourSlot: string;
		suggestion: string;
		forecastedDemandLevel: DemandLevel | null;
		forecastConfidence: 'low' | 'medium' | 'high' | null;
	}

	interface DemandSummary {
		highDemandSlots: number;
		lowDemandSlots: number;
	}

	interface Props {
		suggestions?: Suggestion[];
		summary?: DemandSummary;
		aiAssisted?: boolean;
	}

	let { suggestions = [], summary, aiAssisted = false }: Props = $props();
	let showAiInfo = $state(false);
	let selectedSuggestion = $state<Suggestion | null>(null);
	let currentPage = $state(1);
	const PAGE_SIZE = 3;

	const totalPages = $derived(Math.max(1, Math.ceil(suggestions.length / PAGE_SIZE)));
	const pagedSuggestions = $derived.by(() => {
		const start = (currentPage - 1) * PAGE_SIZE;
		return suggestions.slice(start, start + PAGE_SIZE);
	});

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	function openSuggestionModal(suggestion: Suggestion) {
		selectedSuggestion = suggestion;
	}

	function closeSuggestionModal() {
		selectedSuggestion = null;
	}
</script>

<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
	<div class="mb-4 flex items-center justify-between gap-2">
		<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Suggestions</h2>
		<div class="flex items-center gap-2">
			<a
				href={resolve('/cooperative/suggestions')}
				class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
			>
				Open summary
			</a>
			<div class="relative">
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
			</div>
		</div>
	</div>

	{#if suggestions.length === 0}
		<div class="flex flex-col items-center justify-center py-8 gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
			<p class="text-xs text-slate-300 text-center">No suggestions yet. More data needed.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each pagedSuggestions as s (s.routeName + s.day + s.hourSlot)}
				<div class="rounded-lg p-3 border" style="background:{s.forecastedDemandLevel === 'high' ? '#fef2f2' : '#f0fdf4'}; border-color:{s.forecastedDemandLevel === 'high' ? '#fecaca' : '#bbf7d0'}">
					<div class="flex items-center gap-1.5 mb-1">
						<div class="w-1.5 h-1.5 rounded-full" style="background:{demandColor(s.forecastedDemandLevel)}"></div>
						<span class="text-xs font-semibold" style="color:{s.forecastedDemandLevel === 'high' ? '#b91c1c' : '#166534'}">{s.day.slice(0, 3)} · {s.hourSlot.split('–')[0]}</span>
						{#if s.forecastConfidence}
							<span class="ml-auto text-xs font-medium capitalize" style="color:{confidenceColor(s.forecastConfidence)}">{s.forecastConfidence}</span>
						{/if}
					</div>
					<p class="text-xs text-slate-600 leading-relaxed">
						{s.suggestion.length > 120 ? `${s.suggestion.slice(0, 120)}...` : s.suggestion}
					</p>
					<button
						type="button"
						onclick={() => openSuggestionModal(s)}
						class="mt-2 text-[11px] font-semibold text-slate-600 underline-offset-2 hover:text-slate-800 hover:underline"
					>
						View details
					</button>
				</div>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="mt-3 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
				<button
					type="button"
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
					disabled={currentPage === 1}
					class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 disabled:opacity-40"
				>
					Prev
				</button>
				<p class="text-[11px] text-slate-500">Page {currentPage} / {totalPages}</p>
				<button
					type="button"
					onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
					disabled={currentPage === totalPages}
					class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 disabled:opacity-40"
				>
					Next
				</button>
			</div>
		{/if}
	{/if}

	<!-- Summary stats -->
	{#if summary}
		<div class="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
			<div class="text-center">
				<p class="text-xl font-semibold text-slate-900 tabular-nums">{summary.highDemandSlots}</p>
				<p class="text-xs text-slate-400 mt-0.5">High slots</p>
			</div>
			<div class="text-center">
				<p class="text-xl font-semibold text-slate-900 tabular-nums">{summary.lowDemandSlots}</p>
				<p class="text-xs text-slate-400 mt-0.5">Low slots</p>
			</div>
		</div>
	{/if}
</div>

{#if selectedSuggestion}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
		aria-label="Close suggestion details"
		onclick={closeSuggestionModal}
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="suggestion-details-title"
		class="fixed top-1/2 left-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
	>
		<div class="mb-3 flex items-center justify-between gap-3">
			<h3 id="suggestion-details-title" class="text-sm font-semibold text-slate-900">
				Suggestion details
			</h3>
			<button
				type="button"
				onclick={closeSuggestionModal}
				class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
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

		<div class="mb-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
			<p><span class="font-semibold text-slate-700">Route:</span> {selectedSuggestion.routeName}</p>
			<p><span class="font-semibold text-slate-700">When:</span> {selectedSuggestion.day} • {selectedSuggestion.hourSlot}</p>
			{#if selectedSuggestion.forecastedDemandLevel}
				<p>
					<span class="font-semibold text-slate-700">Demand:</span>
					<span class="capitalize">{selectedSuggestion.forecastedDemandLevel}</span>
				</p>
			{/if}
			{#if selectedSuggestion.forecastConfidence}
				<p>
					<span class="font-semibold text-slate-700">Confidence:</span>
					<span class="capitalize">{selectedSuggestion.forecastConfidence}</span>
				</p>
			{/if}
		</div>

		<p class="text-sm leading-relaxed text-slate-700">{selectedSuggestion.suggestion}</p>

		<div class="mt-4 flex justify-end">
			<button
				type="button"
				onclick={closeSuggestionModal}
				class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
			>
				Close
			</button>
		</div>
	</div>
{/if}
