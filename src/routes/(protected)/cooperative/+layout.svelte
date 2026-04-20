<script lang="ts">
	import { signout } from '$lib/api/auth.remote';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import logo from '$lib/assets/paralogo.png';

	let { children } = $props();

	let isOpen = $state(false);

	const closeDialog = () => {
		isOpen = false;
	};

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
		},
		{
			label: 'Trips',
			href: '/cooperative/trips' as Pathname,
			icon: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>`
		}
	] as const satisfies ReadonlyArray<{ label: string; href: Pathname; icon: string }>;

	let currentPath = $derived(page.url.pathname);
</script>

<div class="z-1000 border-b border-gray-200 bg-white shadow-sm">
	<div class="px-4 sm:px-6 md:mx-auto">
		<div class="flex h-16 items-center justify-between">
			<div class="flex items-center gap-4">
			<img src={logo} alt="Para logo" class="h-8 w-8">
			<h1 class="text-2xl font-bold text-blue-900">PARAVAN</h1>
			</div>
			<button
				type="button"
				onclick={() => (isOpen = true)}
				class="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-950 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
			>
				Logout
			</button>
		</div>
	</div>
</div>

{#if isOpen}
	<button
		type="button"
		aria-label="Close logout dialog"
		class="fixed inset-0 z-1000 bg-black/70 backdrop-blur-sm transition-opacity"
		onclick={closeDialog}
	></button>
	<div
		role="dialog"
		aria-modal="true"
		aria-labelledby="logout-dialog-title"
		aria-describedby="logout-dialog-description"
		class="fixed top-1/2 left-1/2 z-1001 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
	>
		<div class="mb-6">
			<h2 id="logout-dialog-title" class="text-xl font-semibold text-gray-900">Confirm logout</h2>
			<p id="logout-dialog-description" class="mt-2 text-sm text-gray-600">
				You will be signed out of your account.
			</p>
		</div>
		<form {...signout}>
			<div class="flex gap-3">
				<button
					type="button"
					onclick={closeDialog}
					class="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Cancel
				</button>
				<button
					type="submit"
					class="flex-1 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-950 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Continue
				</button>
			</div>
		</form>
	</div>
{/if}

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
