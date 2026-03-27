<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, BarController, LinearScale, CategoryScale, Legend, Tooltip, Title } from 'chart.js';

	// Register Chart.js components
	Chart.register(BarController, LinearScale, CategoryScale, Legend, Tooltip, Title);

	interface FillRatioItem {
		route: string;
		fullRoute: string;
		historic: number;
		forecast: number | null;
	}

	interface Props {
		data?: FillRatioItem[];
	}

	let { data = [] }: Props = $props();
	let canvasElement: HTMLCanvasElement | undefined = $state();
	let chartInstance: Chart | null = $state(null);

	const chartH = $derived(Math.max(180, data.length * 44));

	onMount(() => {
		if (!canvasElement || data.length === 0) return;

		const ctx = canvasElement.getContext('2d');
		if (!ctx) return;

		if (chartInstance) {
			chartInstance.destroy();
		}

		const historicData = data.map(d => d.historic * 100);
		const forecastData = data.map(d => (d.forecast !== null ? d.forecast * 100 : null));
		const labels = data.map(d => d.route);

		chartInstance = new Chart(ctx, {
			type: 'bar',
			data: {
				labels,
				datasets: [
					{
						label: 'Historic',
						data: historicData,
						backgroundColor: '#6366f1',
						borderRadius: 3,
						borderSkipped: false
					},
					{
						label: 'Forecast',
						data: forecastData,
						backgroundColor: '#f59e0b',
						borderRadius: 3,
						borderSkipped: false
					}
				]
			},
			options: {
				indexAxis: 'y',
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed.x ?? 0;
								return `${context.dataset.label}: ${Math.round(value)}%`;
							}
						}
					}
				},
				scales: {
					x: {
						min: 0,
						max: 100,
						ticks: {
							color: '#cbd5e1',
							font: {
								size: 11,
								family: 'Outfit, sans-serif'
							},
							callback: (value) => `${value}%`
						},
						grid: {
							color: '#f1f5f9'
						}
					},
					y: {
						ticks: {
							color: '#475569',
							font: {
								size: 11,
								family: 'Outfit, sans-serif'
							}
						},
						grid: {
							display: false
						}
					}
				}
			}
		});
	});

	$effect(() => {
		if (chartInstance && data.length > 0) {
			const historicData = data.map(d => d.historic * 100);
			const forecastData = data.map(d => (d.forecast !== null ? d.forecast * 100 : null));
			const labels = data.map(d => d.route);

			chartInstance.data.labels = labels;
			chartInstance.data.datasets[0].data = historicData as (number | null)[];
			chartInstance.data.datasets[1].data = forecastData as (number | null)[];
			chartInstance.update();
		}
	});
</script>

{#if data.length > 0}
	<div class="bg-white rounded-xl border border-slate-100 p-4 lg:p-5">
		<div class="flex items-start justify-between mb-5">
			<div>
				<h2 class="text-xs font-semibold text-slate-400 uppercase tracking-widest">Average Fill Ratio by Route</h2>
				<p class="text-xs text-slate-400 mt-1">Historic avg vs WMA forecast — last 28 days</p>
			</div>
			<div class="flex items-center gap-4 text-xs text-slate-400">
				<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-indigo-500 inline-block"></span>Historic</span>
				<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm bg-amber-400 inline-block"></span>Forecast</span>
			</div>
		</div>

		<div style="height: {chartH}px">
			<canvas bind:this={canvasElement}></canvas>
		</div>
	</div>
{/if}
