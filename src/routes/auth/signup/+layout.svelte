<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { children } = $props();
</script>

<div class="min-h-screen bg-[#f7fcfe] p-4">
	<button
		onclick={() => goto(resolve('/auth/login'))}
		class="text-sm text-gray-500 transition hover:text-gray-700"
	>
		← Back to login
	</button>

	{@render children()}
</div>
