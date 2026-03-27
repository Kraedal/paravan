<script lang="ts">
	import { demandColor, confidenceColor, type DemandLevel } from './dashboardUtils';

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
	}

	let { suggestions = [], summary }: Props = $props();
</script>

<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
	<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Suggestions</h2>

	{#if suggestions.length === 0}
		<div class="flex flex-col items-center justify-center py-8 gap-2">
			<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
			<p class="text-xs text-slate-300 text-center">No suggestions yet. More data needed.</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each suggestions as s (s.routeName + s.day + s.hourSlot)}
				<div class="rounded-lg p-3 border" style="background:{s.forecastedDemandLevel === 'high' ? '#fef2f2' : '#f0fdf4'}; border-color:{s.forecastedDemandLevel === 'high' ? '#fecaca' : '#bbf7d0'}">
					<div class="flex items-center gap-1.5 mb-1">
						<div class="w-1.5 h-1.5 rounded-full" style="background:{demandColor(s.forecastedDemandLevel)}"></div>
						<span class="text-xs font-semibold" style="color:{s.forecastedDemandLevel === 'high' ? '#b91c1c' : '#166534'}">{s.day.slice(0, 3)} · {s.hourSlot.split('–')[0]}</span>
						{#if s.forecastConfidence}
							<span class="ml-auto text-xs font-medium capitalize" style="color:{confidenceColor(s.forecastConfidence)}">{s.forecastConfidence}</span>
						{/if}
					</div>
					<p class="text-xs text-slate-600 leading-relaxed">{s.suggestion}</p>
				</div>
			{/each}
		</div>
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
