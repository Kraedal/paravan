<script lang="ts">
	import { signout } from '$lib/api/auth.remote';

	let { children } = $props();
	let isOpen = $state(false);

	const closeDialog = () => {
		isOpen = false;
	};
</script>

<div class="z-1000 border-b border-gray-200 bg-white shadow-sm">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="flex h-16 items-center justify-between">
			<h1 class="text-2xl font-bold text-gray-900">PARAVAN</h1>
			<button
				type="button"
				onclick={() => (isOpen = true)}
				class="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
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
					class="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Continue
				</button>
			</div>
		</form>
	</div>
{/if}

{@render children()}
