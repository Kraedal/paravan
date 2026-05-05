<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { passengerSignUp } from '$lib/api/auth.remote';
	import logo from '$lib/assets/paralogo.png';
	import stop from '$lib/assets/paraa.svg'
	import titleLogo from '$lib/assets/para-title-logo.png';
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-around bg-[#f7fcfe] px-4">
	<div class=" hidden lg:block" >
		<img src={stop} alt="Para logo" class="w-lg h-full" />
	</div>
	<div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow">
<div class="mb-4 flex justify-center">
	<div class="flex h-20 w-20 items-center justify-center rounded-xl">
		<img src={logo} alt="Para logo" class="h-20 w-20" />
	</div>
</div>

<h1 class="text-center text-3xl font-semibold flex items-center justify-center gap-2 ml-8 -mt-2 mb-0">
	Join 
	<img src={titleLogo} alt="Para logo" class="h-18 w-auto -ml-4" />
</h1>
<p class="text-center text-sm text-gray-500 -mt-3 mb-4">Create your passenger account</p>

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
				class="w-full rounded-xl bg-blue-900 py-3 font-medium text-white transition hover:bg-blue-950 disabled:opacity-60"
			>
				{passengerSignUp.pending > 0 ? 'Creating account…' : 'Create account'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-600">
			Already have an account?
			<button
				onclick={() => goto(resolve('/auth/login'))}
				class="font-medium text-blue-900 hover:underline"
			>
				Sign in
			</button>
		</p>
		<p class="mt-2 text-center text-sm text-gray-600">
			Part of the cooperative?
			<button
				onclick={() => goto(resolve('/auth/signup/admin'))}
				class="font-medium text-blue-900 hover:underline"
			>
				Register here
			</button>
		</p>
	</div>
</div>
