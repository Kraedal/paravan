<script lang="ts">
	import { page } from '$app/state';

	let user = page.data.user;
</script>

<h1>Hello, {user.name}!</h1>
