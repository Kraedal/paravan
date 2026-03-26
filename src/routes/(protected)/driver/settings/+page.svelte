<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="min-h-screen bg-slate-50 p-4 sm:p-6">
	<div class="mx-auto max-w-2xl">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-extrabold tracking-tight text-slate-900">Driver Settings</h1>
			<a
				href={resolve('/driver')}
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
				>Back to Driver</a
			>
		</div>

		<div class="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<section>
				<h2 class="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Profile</h2>
				<div class="space-y-3">
					<input
						type="text"
						placeholder="Full name"
						class="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none"
					/>
					<input
						type="tel"
						placeholder="Phone number"
						class="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none"
					/>
				</div>
			</section>

			<section>
				<h2 class="mb-3 text-sm font-bold tracking-wide text-slate-500 uppercase">Preferences</h2>
				<div class="space-y-2 text-sm text-slate-700">
					<label
						class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
					>
						<span>Enable trip reminders</span>
						<input type="checkbox" checked />
					</label>
					<label
						class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
					>
						<span>Enable sound alerts</span>
						<input type="checkbox" checked />
					</label>
				</div>
			</section>

			<button
				type="button"
				class="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
				>Save Changes</button
			>
		</div>
	</div>
</div>
