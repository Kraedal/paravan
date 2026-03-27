<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { DAY_ORDER, demandColor, type DemandLevel } from './dashboardUtils';

	interface DemandSlotData {
		hourSlot: string;
		day: string;
		historicDemandLevel: DemandLevel | null;
		totalRides: number;
	}

	interface Props {
		patterns?: DemandSlotData[];
	}

	let { patterns = [] }: Props = $props();

	const heatmapByDay = $derived.by(() => {
		const map = new SvelteMap<string, DemandSlotData[]>();
		for (const day of DAY_ORDER) map.set(day, []);
		for (const p of patterns) {
			if (!map.has(p.day)) map.set(p.day, []);
			map.get(p.day)!.push(p);
		}
		return map;
	});

	const allHourSlots = $derived.by(() => {
		const slots = new SvelteSet<string>();
		for (const p of patterns) slots.add(p.hourSlot);
		return Array.from(slots).sort((a, b) => {
			const toH = (s: string) => {
				const m = s.match(/^(\d+)(AM|PM)/i);
				if (!m) return 0;
				let h = parseInt(m[1]);
				if (m[2].toUpperCase() === 'PM' && h !== 12) h += 12;
				if (m[2].toUpperCase() === 'AM' && h === 12) h = 0;
				return h;
			};
			return toH(a) - toH(b);
		});
	});

	const cellW = 52;
	const cellH = 28;
	const labelW = 78;
	const totalW = $derived(labelW + allHourSlots.length * cellW + 16);
	const totalH = $derived(24 + DAY_ORDER.length * cellH);
</script>

{#if patterns.length > 0 && allHourSlots.length > 0}
	<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
		<div class="flex items-start justify-between mb-2">
			<div>
				<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Demand Heatmap</h2>
				<p class="text-xs text-slate-400 mt-1">Historic demand level by day and time slot</p>
			</div>
			<div class="flex items-center gap-3 text-xs text-slate-400">
			{#each [['#ef4444','High'],['#f59e0b','Normal'],['#22c55e','Low']] as [color, label] (label)}
					<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm inline-block" style="background:{color}"></span>{label}</span>
				{/each}
			</div>
		</div>

		<div class="overflow-x-auto mt-4">
			<svg width={totalW} height={totalH} viewBox="0 0 {totalW} {totalH}">
				<!-- Hour labels -->
			{#each allHourSlots as slot, si (slot)}
					<text
						x={labelW + si * cellW + cellW / 2}
						y={14}
						text-anchor="middle"
						font-size="9"
						fill="#94a3b8"
						font-family="Outfit, sans-serif"
					>{slot.split('–')[0]}</text>
				{/each}

				<!-- Rows -->
			{#each DAY_ORDER as day, di (day)}
					{@const daySlots = heatmapByDay.get(day) ?? []}
					<text
						x={labelW - 8}
						y={24 + di * cellH + cellH / 2 + 4}
						text-anchor="end"
						font-size="10"
						fill="#64748b"
						font-family="Outfit, sans-serif"
					>{day.slice(0, 3)}</text>

					{#each allHourSlots as slot, si (slot + di)}
						{@const match = daySlots.find(p => p.hourSlot === slot)}
						{@const level = match?.historicDemandLevel ?? null}
						{@const x = labelW + si * cellW}
						{@const y = 24 + di * cellH}

						<rect
							x={x + 2}
							y={y + 2}
							width={cellW - 4}
							height={cellH - 4}
							rx="4"
							fill={level ? demandColor(level) : '#f8fafc'}
							opacity={level ? 0.75 : 1}
						/>
						{#if match}
							<text
								x={x + cellW / 2}
								y={y + cellH / 2 + 4}
								text-anchor="middle"
								font-size="9"
								font-weight="700"
								fill={level ? 'white' : '#e2e8f0'}
								font-family="Outfit, sans-serif"
							>{match.totalRides}</text>
						{/if}
					{/each}
				{/each}
			</svg>
		</div>
	</div>
{/if}
