<script lang="ts">
	import { UserRound, Van, Route, Wallet  } from "@lucide/svelte";
	import type { Component } from "svelte";
	interface KPI {
		label: string;
		value: number;
		icon: Component;
		accent: string;
	}

	interface Props {
		kpis?: KPI[];
		drivers?: number;
		vehicles?: number;
		routes?: number;
	}


	let { kpis, drivers, vehicles, routes }: Props = $props();

	const defaultKpis = $derived.by(() => {
		if (kpis) return kpis;
		return [
			{
				label: 'Drivers',
				value: drivers ?? 0,
				icon: UserRound,
				accent: '#6366f1'
			},
			{
				label: 'Vehicles',
				value: vehicles ?? 0,
				icon: Van,
				accent: '#0ea5e9'
			},
			{
				label: 'Routes',
				value: routes ?? 0,
				icon: Route,
				accent: '#f59e0b'
			},
			{
				label: 'Earnings',
				value: "TBD",
				icon: Wallet,
				accent: '#22c55e'
			}
		];
	});
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-4">
	{#each defaultKpis as kpi (kpi.label)}
		<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5 flex items-start gap-3">
			<div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style="background:{kpi.accent}18">
				<kpi.icon class="w-4 h-4" style="color:{kpi.accent}" />
			</div>
			<div>
				<p class="text-xs font-medium text-slate-400 uppercase tracking-widest">{kpi.label}</p>
				<p class="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums tracking-tight">{kpi.value}</p>
			</div>
		</div>
	{/each}
</div>
