<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ChevronLeft } from '@lucide/svelte';

	let { children } = $props();
</script>

<div class="min-h-screen bg-[#f7fcfe] p-4">
	<button
		onclick={() => goto(resolve('/auth/login'))}
		class="text-sm text-gray-500 transition hover:text-gray-700"
	>
		<ChevronLeft class="inline-block h-4 w-4" />
		Back to Login
	</button>

	{@render children()}
</div>
