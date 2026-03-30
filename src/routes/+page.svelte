<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import logo from '$lib/assets/favicon.svg';
	import herovan from '$lib/assets/herovan.png';

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	};

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let canInstall = $state(false);
	let isInstalled = $state(false);
	let isIOS = $state(false);
	let showIOSHint = $state(false);

	const isStandaloneMode = () => {
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as Navigator & { standalone?: boolean }).standalone === true
		);
	};

	const installApp = async () => {
		if (deferredPrompt) {
			await deferredPrompt.prompt();
			const choice = await deferredPrompt.userChoice;

			if (choice.outcome === 'accepted') {
				isInstalled = true;
			}

			deferredPrompt = null;
			canInstall = false;
			return;
		}

		if (isIOS && !isInstalled) {
			showIOSHint = true;
		}
	};

	onMount(() => {
		isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);
		isInstalled = isStandaloneMode();

		const handleBeforeInstallPrompt = (event: Event) => {
			event.preventDefault();
			deferredPrompt = event as BeforeInstallPromptEvent;
			canInstall = true;
		};

		const handleAppInstalled = () => {
			isInstalled = true;
			canInstall = false;
			deferredPrompt = null;
			showIOSHint = false;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});
</script>

<div class="flex min-h-screen flex-col bg-white text-gray-900">
	<header class="border-b border-gray-100">
		<div class="mx-auto flex flex-row justify-between max-w-7xl items-center gap-3 px-6 py-4">
		<div class="flex items-center gap-2">
			<img src={logo} alt="Para logo" class="h-8 w-8" />
			<span class="text-lg font-semibold text-blue-900 uppercase">Para</span>
			</div>
			<div>
			<button>
				<a
					href={resolve('/auth/login')}
					class="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
					>Login</a
				>
			</button>
			</div>
		</div>
	</header>

	<main style="background-image: url({herovan}); background-size: cover; background-position: center;" class="flex flex-1 items-center justify-center px-6">
		<section class=" max-w-7xl h-[calc(100vh-8rem)] flex flex-col items-start justify-center text-left gap-6 px-6 " >
			<h1 class="text-4xl font-bold md:text-5xl ">Welcome to <p class="inline-block text-blue-900">Para</p>van</h1>
			<p class="max-w-xl text-lg text-gray-600">Your reliable van transportation service across the Philippines. Book a ride in seconds and travel with confidence.</p>
			<div class="flex flex-row gap-4 ">
	
				<button
					onclick={() => goto(resolve('/auth/signup'))}
					class="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
				>
					Get Started 
				</button>

				{#if !isInstalled && (canInstall || isIOS)}
					<button
						onclick={installApp}
						class="inline-flex items-center gap-2 rounded-lg border border-blue-900 bg-white px-4 py-2 text-sm font-semibold text-blue-900 shadow-sm transition-all hover:bg-blue-50 focus:ring-2 focus:ring-blue-900 focus:ring-offset-2 focus:outline-none active:scale-[0.98]"
					>
						Install App
					</button>
				{/if}

				{#if showIOSHint}
					<p class="max-w-md rounded-lg border border-blue-100 bg-white/90 px-3 py-2 text-sm text-blue-900">
						On iPhone: tap the Share button in Safari, then choose Add to Home Screen.
					</p>
				{/if}

			</div>

		</section>
	</main>

	<!-- <main class="flex flex-1 flex-col items-center justify-center px-6">
		<div class="w-full max-w-4xl text-center">
			<h1 class="mb-6 text-4xl leading-tight font-bold md:text-5xl">
				Get there faster <br class="hidden md:block" />
				with Paravan
			</h1>

			<p class="mx-auto mb-12 max-w-2xl text-base text-gray-600 md:text-lg">
				Reliable van transportation across the Philippines. Book a ride in seconds and travel with
				confidence.
			</p>

			<div class="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
				<div
					class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
				>
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
						<p>🛡️</p>
					</div>
					<h3 class="mb-1 font-semibold">Verified Drivers</h3>
					<p class="text-sm text-gray-600">Every driver thoroughly vetted for your safety</p>
				</div>

				<div
					class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
				>
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
						⏱️
					</div>
					<h3 class="mb-1 font-semibold">Real-time Tracking</h3>
					<p class="text-sm text-gray-600">Know exactly when your ride arrives</p>
				</div>

				<div
					class="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
				>
					<div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
						👥
					</div>
					<h3 class="mb-1 font-semibold">Trusted Service</h3>
					<p class="text-sm text-gray-600">Join thousands of satisfied travelers</p>
				</div>
			</div>

			<button
				onclick={() => goto(resolve('/auth/login'))}
				class="
          inline-flex
          items-center
          gap-2
          rounded-full
          bg-blue-600
          px-8
          py-3
          font-medium
          text-white
          shadow-sm
          transition
          hover:bg-blue-700
        "
			>
				Get Started →
			</button>

			<p class="mt-8 text-sm text-gray-500">
				Trusted by <span class="font-medium text-gray-700">10,000+</span> passengers and drivers
			</p>
		</div>
	</main> -->

	<footer class="border-t border-gray-100">
		<div class="mx-auto max-w-7xl px-6 py-4 text-center text-sm text-gray-500">
			© 2026 Paravan. Modern van transportation services.
		</div>
	</footer>
</div>
