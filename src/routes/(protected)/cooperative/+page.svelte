<script lang="ts">
	import { page } from '$app/state';

	let user = page.data.user;
</script>

<div class="p-4">
	<h1 class="mb-4 text-2xl font-bold">Cooperative Dashboard</h1>
	<p>
		Welcome to the cooperative dashboard! This is where you can manage your cooperative's
		operations, view reports, and access resources.
	</p>
	<p class="mt-2">Current page: {page.url.pathname}</p>
	<p>Hello {user.name}, welcome to your cooperative dashboard!</p>
</div>
