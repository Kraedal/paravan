<script lang="ts">
	import { login } from '$lib/api/auth.remote';
	import logo from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { ChevronLeft } from '@lucide/svelte';
	import stop from '$lib/assets/paraa.svg'
</script>



<div class="min-h-screen bg-[#f7fcfe] px-4 ">
	<button
		onclick={() => goto(resolve('/'))}
		class="text-sm text-gray-500 transition mt-4 hover:text-gray-700"
	>
		<ChevronLeft class="inline-block h-4 w-4" />
		Back to Home
	</button>
	<div class="flex min-h-[calc(100vh-4rem)] items-center justify-around " >
	<div class=" hidden lg:block" > 
		<img src={stop} alt="Para logo" class="w-lg h-full"/>
	</div>
	<div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow">
		<div class="mb-6 flex justify-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl">
				<img src={logo} alt="Para logo" class="h-12 w-12" />
			</div>
		</div>

		<h1 class="mb-1 text-center text-2xl font-semibold">Welcome back</h1>
		<p class="mb-6 text-center text-sm text-gray-500">Sign in to your account</p>

		<form {...login} class="space-y-4">
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Email address
					<input
						{...login.fields.email.as('email')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each login.fields.email.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Password
					<input
						{...login.fields.password.as('password')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each login.fields.password.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			{#if login.result?.error}
				<p class="text-sm text-red-600">{login.result.error}</p>
			{/if}

			<button
				type="submit"
				disabled={login.pending > 0}
				class="w-full rounded-xl bg-blue-900 py-3 font-medium text-white
                 transition hover:bg-blue-950 disabled:opacity-60"
			>
				{login.pending > 0 ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-600">
			Don't have an account?
			<a href={resolve('/auth/signup')} class="font-medium text-blue-900 hover:underline">
				Sign up
			</a>
		</p>
	</div>
</div>
</div>
