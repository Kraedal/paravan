<script lang="ts">
	interface KPI {
		label: string;
		value: number;
		icon: string;
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
				icon: 'M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zm0 12c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z',
				accent: '#6366f1'
			},
			{
				label: 'Vehicles',
				value: vehicles ?? 0,
				icon: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3m0 0h4l3 5v3h-2m-5-8v8m-9 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
				accent: '#0ea5e9'
			},
			{
				label: 'Routes',
				value: routes ?? 0,
				icon: 'M3 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm12-14a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM6 19h9.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15',
				accent: '#f59e0b'
			},
			{
				label: 'Earnings',
				value: "TBD",
				icon: 'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3m0 0h4l3 5v3h-2m-5-8v8',
				accent: '#22c55e'
			}
		];
	});
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-1 lg:gap-4">
	{#each defaultKpis as kpi (kpi.label)}
		<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5 flex items-start gap-3">
			<div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style="background:{kpi.accent}18">
				<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={kpi.accent} stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d={kpi.icon}/>
				</svg>
			</div>
			<div>
				<p class="text-xs font-medium text-slate-400 uppercase tracking-widest">{kpi.label}</p>
				<p class="mt-0.5 text-xl font-semibold text-slate-900 tabular-nums tracking-tight">{kpi.value}</p>
			</div>
		</div>
	{/each}
</div>
