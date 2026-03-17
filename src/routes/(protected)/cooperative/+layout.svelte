<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	let { children } = $props();

	const navItems = [
		{
			label: 'Dashboard',
			href: '/cooperative',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`
		},
		{
			label: 'Drivers',
			href: '/cooperative/drivers',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>`
		},
		{
			label: 'Vehicles',
			href: '/cooperative/vehicles',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/><rect width="13" height="9" x="9" y="11" rx="1"/><circle cx="11.5" cy="20" r="1.5"/><circle cx="19.5" cy="20" r="1.5"/></svg>`
		},
		{
			label: 'Routes',
			href: '/cooperative/routes',
			icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`
		}
	] as const satisfies ReadonlyArray<{ label: string; href: Pathname; icon: string }>;

	let currentPath = $derived(page.url.pathname);
</script>

<div class="flex h-[calc(100vh-4rem)]">
	<!-- Sidebar -->
	<aside class="flex w-16 flex-col border-r border-gray-200 bg-white lg:w-56">
		<nav class="flex flex-1 flex-col gap-0.5 p-2 lg:p-3">
			{#each navItems as item (item.href)}
				{@const isActive = currentPath === item.href}
				<a
					title={item.label}
					href={resolve(item.href)}
					class="flex items-center justify-center gap-3 rounded-md px-0 py-2 text-sm font-medium transition-colors lg:justify-start lg:px-3
						{isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}"
				>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html item.icon}
					<span class="hidden lg:inline">{item.label}</span>
					<span class="sr-only lg:hidden">{item.label}</span>
				</a>
			{/each}
		</nav>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto bg-gray-50 p-6">
		{@render children()}
	</main>
</div>
