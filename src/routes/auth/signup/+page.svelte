<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { passengerSignUp } from '$lib/api/auth.remote';
	import logo from '$lib/assets/favicon.svg';
	import van from '$lib/assets/van.png';
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#f7fcfe] px-4">
	<div class="hidden w-full max-w-sm md:block">
		<img src={van} alt="A beautiful van" />
	</div>

	<div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow">
		<div class="mb-6 flex justify-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl">
				<img src={logo} alt="Para logo" class="h-12 w-12" />
			</div>
		</div>

		<h1 class="mb-1 text-center text-2xl font-semibold">Join Paravan</h1>
		<p class="mb-6 text-center text-sm text-gray-500">Create your passenger account</p>

		<form {...passengerSignUp} class="space-y-4">
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Full name
					<input
						{...passengerSignUp.fields.name.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each passengerSignUp.fields.name.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Email address
					<input
						{...passengerSignUp.fields.email.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each passengerSignUp.fields.name.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Password
					<input
						{...passengerSignUp.fields.password.as('password')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each passengerSignUp.fields.password.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Confirm password
					<input
						{...passengerSignUp.fields.confirmPassword.as('password')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each passengerSignUp.fields.confirmPassword.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			{#if passengerSignUp.result?.error}
				<p class="text-sm text-red-600">{passengerSignUp.result.error}</p>
			{/if}
			<button
				type="submit"
				disabled={passengerSignUp.pending > 0}
				class="w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
			>
				{passengerSignUp.pending > 0 ? 'Creating account…' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-600">
			Already have an account?
			<button
				onclick={() => goto(resolve('/auth/login'))}
				class="font-medium text-blue-600 hover:underline"
			>
				Sign in
			</button>
		</p>
		<p class="mt-2 text-center text-sm text-gray-600">
			Part of the cooperative?
			<button
				onclick={() => goto(resolve('/auth/signup/admin'))}
				class="font-medium text-blue-600 hover:underline"
			>
				Register here
			</button>
		</p>
	</div>
</div>
