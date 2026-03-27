<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

	// Register Chart.js components
	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	interface Props {
		northbound?: number;
		southbound?: number;
	}

	let { northbound = 0, southbound = 0 }: Props = $props();
	let canvasElement: HTMLCanvasElement | undefined = $state();
	let chartInstance: Chart | null = $state(null);

	const dirSplit = $derived({
		northbound,
		southbound,
		total: northbound + southbound
	});

	const directions = $derived([
		{ label: 'Northbound', value: dirSplit.northbound, color: '#1e293b' },
		{ label: 'Southbound', value: dirSplit.southbound, color: '#94a3b8' }
	]);

	onMount(() => {
		if (!canvasElement || dirSplit.total === 0) return;

		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		chartInstance = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: ['Northbound', 'Southbound'],
				datasets: [
					{
						data: [dirSplit.northbound, dirSplit.southbound],
						backgroundColor: ['#1e293b', '#94a3b8'],
						borderColor: 'white',
						borderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const total = dirSplit.total;
								const value = context.parsed;
								const percentage = Math.round((value / total) * 100);
								return `${context.label}: ${value} (${percentage}%)`;
							}
						}
					}
				}
			}
		});
	});

	$effect(() => {
		if (chartInstance && dirSplit.total > 0) {
			chartInstance.data.datasets[0].data = [dirSplit.northbound, dirSplit.southbound];
			chartInstance.update();
		}
	});
</script>

<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
	<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Direction Split</h2>
	{#if dirSplit.total === 0}
		<div class="flex items-center justify-center h-28 text-sm text-slate-300">No rides today</div>
	{:else}
		<div class="flex items-center gap-6">
			<!-- Doughnut Chart -->
			<div class="w-24 h-24 shrink-0">
				<canvas bind:this={canvasElement}></canvas>
			</div>
			<!-- Legend -->
			<div class="space-y-3 flex-1">
				{#each directions as dir (dir.label)}
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{dir.color}"></div>
							<span class="text-xs text-slate-500">{dir.label}</span>
						</div>
						<div class="text-right">
							<span class="text-sm font-semibold text-slate-900 tabular-nums">{dir.value}</span>
							<span class="text-xs text-slate-400 ml-1">
								({dirSplit.total > 0 ? Math.round((dir.value / dirSplit.total) * 100) : 0}%)
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
