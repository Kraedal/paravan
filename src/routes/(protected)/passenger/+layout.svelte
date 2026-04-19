<script lang="ts">
	import { resolve } from '$app/paths';
	import { signout } from '$lib/api/auth.remote';
	import { History, Settings, Map } from '@lucide/svelte';
	import logo from '$lib/assets/paralogo.png';

	let { children } = $props();
	let showMenu = $state(false);
	let isOpen = $state(false);

	const closeMenu = () => {
		showMenu = false;
	};

	const closeDialog = () => {
		isOpen = false;
	};
</script>

<div class="relative min-h-screen">
	{@render children()}

	<header
		class="fixed top-0 right-0 left-0 z-60 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 backdrop-blur-xs"
	>
		<div class="flex items-center gap-2 text-black drop-shadow-sm">
	
			<img src={logo} alt="Para Logo" class="h-12 w-12">
		</div>

		<div class="relative">
			<button
				type="button"
				onclick={() => (showMenu = !showMenu)}
				class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/20 text-white backdrop-blur-md transition hover:bg-white/30 focus:ring-2 focus:ring-white focus:outline-none"
				aria-label="Open passenger menu"
				aria-expanded={showMenu}
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="black"
					stroke-width="2.25"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<line x1="4" y1="7" x2="20" y2="7"></line>
					<line x1="4" y1="12" x2="20" y2="12"></line>
					<line x1="4" y1="17" x2="20" y2="17"></line>
				</svg>
			</button>

			{#if showMenu}
				<button
					type="button"
					class="fixed inset-0 z-70 bg-transparent"
					onclick={closeMenu}
					aria-label="Close passenger menu"
				></button>
				<div
					class="absolute right-0 z-80 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white/85 shadow-xl"
				>
					<a
						href={resolve('/passenger')}
						class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						onclick={closeMenu}
					>
						<Map size="16" />
						Home
					</a>
					<a
						href={resolve('/passenger/history')}
						class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						onclick={closeMenu}
					>
						<History size="16" />
						Trip History
					</a>
					<a
						href={resolve('/passenger/settings')}
						class="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
						onclick={closeMenu}
					>
						<Settings size="16" />
						Settings
					</a>
					<button
						type="button"
						onclick={() => {
							closeMenu();
							isOpen = true;
						}}
						class="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
							><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline
								points="16 17 21 12 16 7"
							></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg
						>
						Logout
					</button>
				</div>
			{/if}
		</div>
	</header>

{#if isOpen}
		<button
			type="button"
			aria-label="Close logout dialog"
			class="fixed inset-0 z-90 bg-black/70 backdrop-blur-sm transition-opacity"
			onclick={closeDialog}
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="logout-dialog-title"
			aria-describedby="logout-dialog-description"
			class="fixed top-1/2 left-1/2 z-100 w-80 max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
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
						class="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
					>
						Continue
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
