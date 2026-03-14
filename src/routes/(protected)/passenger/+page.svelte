<script lang="ts">
	import MapView from '$lib/components/mapView.svelte';
	import Greetings from '$lib/components/greetings.svelte';
	import { setReady, setNotReady } from '$lib/api/passenger.remote';

	type LatLng = [number, number];

	let isReady = $state(false);
	let isLocating = $state(false);
	let locationError = $state('');
	let passengerLocation = $state<LatLng | null>(null);
	let formEl: HTMLFormElement;
	let notReadyFormEl: HTMLFormElement;

	type ReadyResult = { success?: boolean; error?: string };

	$effect(() => {
		if ((setReady.result as ReadyResult | null)?.success) {
			isReady = true;
		}
	});

	$effect(() => {
		if ((setNotReady.result as ReadyResult | null)?.success) {
			isReady = false;
			passengerLocation = null;
		}
	});

	const onToggleReady = () => {
		if (isReady) {
			// Set not ready
			locationError = '';
			notReadyFormEl.requestSubmit();
		} else {
			// Set ready
			locationError = '';

			if (!navigator.geolocation) {
				locationError = 'Geolocation is not supported in this browser.';
				return;
			}

			isLocating = true;

			navigator.geolocation.getCurrentPosition(
				(position) => {
					isLocating = false;
					passengerLocation = [position.coords.latitude, position.coords.longitude];

					// Set values directly — reactive bindings haven't flushed yet at this point
					(formEl.querySelector('input[name="latitude"]') as HTMLInputElement).value = String(
						position.coords.latitude
					);
					(formEl.querySelector('input[name="longitude"]') as HTMLInputElement).value = String(
						position.coords.longitude
					);
					formEl.requestSubmit();
				},
				() => {
					isLocating = false;
					locationError = 'Location permission is required to continue.';
				},
				{
					enableHighAccuracy: true,
					timeout: 10000,
					maximumAge: 0
				}
			);
		}
	};
</script>

<!-- Hidden form: submitted programmatically after geolocation resolves -->
<form bind:this={formEl} {...setReady} style="display:none">
	<input type="hidden" name="latitude" value={passengerLocation?.[0] ?? ''} />
	<input type="hidden" name="longitude" value={passengerLocation?.[1] ?? ''} />
</form>

{#if locationError || (setReady.result as { error?: string } | null)?.error || (setNotReady.result as { error?: string } | null)?.error}
	<p>
		{locationError ||
			(setReady.result as { error?: string } | null)?.error ||
			(setNotReady.result as { error?: string } | null)?.error}
	</p>
{/if}

<Greetings />

{#if !isReady}
	<div class="map-skeleton-wrapper mt-2" aria-hidden="true">
		<div
			class="map-skeleton flex animate-pulse flex-col items-center justify-center p-4 text-center"
		>
			<p class="text-small text-gray-400">
				If you are ready to find a van <br /> Just press ready!
			</p>
		</div>
	</div>
{/if}

{#if isReady && passengerLocation}
	<MapView
		center={passengerLocation}
		marker={passengerLocation}
		markerLabel="Your current location"
	/>
{/if}
<div class="flex flex-col items-center gap-y-4">
	<!-- Hidden form: submitted programmatically when setting not ready -->
	<form bind:this={notReadyFormEl} {...setNotReady} style="display:none"></form>

	<button
		type="button"
		class="my-12 rounded-3xl border-2 border-blue-300 bg-blue-200 px-4 py-2 transition hover:bg-blue-300 disabled:border-gray-400 disabled:bg-gray-300"
		onclick={onToggleReady}
		disabled={isLocating || setReady.pending > 0 || setNotReady.pending > 0}
	>
		{#if isLocating}
			Getting location...
		{:else if setReady.pending > 0}
			Loading map and finding drivers...
		{:else if setNotReady.pending > 0}
			Setting not ready...
		{:else if isReady}
			Not Ready
		{:else}
			Ready
		{/if}
	</button>
</div>

<style>
	.map-skeleton-wrapper {
		width: 80%;
		margin: 2rem auto 0;
	}

	.map-skeleton {
		height: 420px;
		width: 100%;
		border-radius: 0.75rem;
		background: linear-gradient(110deg, #f1f5f9 30%, #e2e8f0 45%, #f1f5f9 60%);
		background-size: 200% 100%;
		animation: shimmer 1.5s linear infinite;
	}

	@keyframes shimmer {
		to {
			background-position-x: -200%;
		}
	}
</style>
