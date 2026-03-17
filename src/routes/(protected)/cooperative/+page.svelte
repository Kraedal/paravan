<script lang="ts">
	import { getCooperativeDashboard } from '$lib/api/admin.remote';

	const dashboard = getCooperativeDashboard();
</script>

{#if dashboard.loading && !dashboard.ready}
	<p>Loading dashboard...</p>
{:else if dashboard.error}
	<p>Failed to load dashboard.</p>
{:else if dashboard.ready}
	<h1>Hello, {dashboard.current.user.name}!</h1>
	<h1>
		Welcome to the {dashboard.current.cooperative?.name ?? 'Cooperative'} Dashboard
	</h1>
{/if}
