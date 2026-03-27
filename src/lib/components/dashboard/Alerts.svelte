<script lang="ts">
	interface Props {
		unassignedDrivers?: number;
		expiringLicenses?: number;
		stalledRides?: number;
	}

	let { unassignedDrivers = 0, expiringLicenses = 0, stalledRides = 0 }: Props = $props();

	const hasAlerts = $derived(unassignedDrivers > 0 || expiringLicenses > 0 || stalledRides > 0);
</script>

{#if hasAlerts}
	<div class="bg-amber-50 border border-amber-100 rounded-xl p-4 lg:p-5">
		<div class="flex items-center gap-2 mb-3">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
			<h2 class="text-xs font-semibold text-amber-700 uppercase tracking-widest">Attention Required</h2>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if unassignedDrivers > 0}
				<span class="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
					{unassignedDrivers} driver{unassignedDrivers !== 1 ? 's' : ''} unassigned
				</span>
			{/if}
			{#if expiringLicenses > 0}
				<span class="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
					{expiringLicenses} license{expiringLicenses !== 1 ? 's' : ''} expiring
				</span>
			{/if}
			{#if stalledRides > 0}
				<span class="text-xs font-medium text-red-700 bg-red-100 px-2.5 py-1 rounded-full">
					{stalledRides} stalled ride{stalledRides !== 1 ? 's' : ''}
				</span>
			{/if}
		</div>
	</div>
{/if}
