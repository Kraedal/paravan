<script lang="ts">
	import { page } from '$app/state';

	let fullName = page.data.user.name;

	const hour = new Date().getHours();

	const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

	const firstName = fullName.trim().split(/\s+/)[0];
</script>

<div class="mx-auto max-w-7xl">
	<h2 class="m-8 text-2xl text-black">{greeting}, {firstName} 👋</h2>
</div>
