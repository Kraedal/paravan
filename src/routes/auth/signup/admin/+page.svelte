<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { cooperativeSignUp } from '$lib/api/auth.remote';
	import logo from '$lib/assets/paralogo.png';
	import stop from '$lib/assets/building.svg'
</script>

<div class="flex min-h-screen items-center justify-around bg-[#f7fcfe] px-4">

	<div class=" hidden lg:block" >
		<img src={stop} alt="Para logo" class="w-lg h-full" />
	</div>
	<div class="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow">


		<div class="mb-6 flex justify-center">
			<div class="flex h-12 w-12 items-center justify-center rounded-xl">
				<img src={logo} alt="Para logo" class="h-12 w-12" />
			</div>
		</div>

		<h1 class="mb-1 text-center text-2xl font-semibold">Join PARA</h1>
		<p class="mb-6 text-center text-sm text-gray-500">Register your cooperative</p>

		<form {...cooperativeSignUp} class="space-y-4">
			<div>
				<label class="mb-1 block text-sm font-medium"
					>Full name
					<input
						{...cooperativeSignUp.fields.name.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.name.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Cooperative Name
					<input
						{...cooperativeSignUp.fields.cooperativeName.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.cooperativeName.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Address
					<input
						{...cooperativeSignUp.fields.address.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.address.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Email address
					<input
						{...cooperativeSignUp.fields.email.as('text')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.email.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Password
					<input
						{...cooperativeSignUp.fields.password.as('password')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.password.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			<div>
				<label class="mb-1 block text-sm font-medium"
					>Confirm password
					<input
						{...cooperativeSignUp.fields.confirmPassword.as('password')}
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-blue-600 focus:outline-none"
					/>
				</label>
				{#each cooperativeSignUp.fields.confirmPassword.issues() ?? [] as issue, index (index)}
					<p class="text-sm text-red-600">{issue.message}</p>
				{/each}
			</div>

			{#if cooperativeSignUp.result?.error}
				<p class="text-sm text-red-600">{cooperativeSignUp.result.error}</p>
			{/if}
			<button
				type="submit"
				disabled={cooperativeSignUp.pending > 0}
				class="w-full rounded-xl bg-blue-900 py-3 font-medium text-white transition hover:bg-blue-950 disabled:opacity-60"
			>
				{cooperativeSignUp.pending > 0 ? 'Creating account…' : 'Create account'}
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
	</div>
</div>