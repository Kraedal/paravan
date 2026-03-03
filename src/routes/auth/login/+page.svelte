<script>
	import { login } from "$lib/api/auth.remote";

</script>



<div class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8">
  <div class="sm:mx-auto sm:w-full sm:max-w-md">
    <div class="flex justify-center mb-4">
      <div class="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
        P
      </div>
    </div>
    <h2 class="text-center text-2xl font-bold tracking-tight text-gray-900">
      Sign in to your account
    </h2>
  </div>

  <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
    <div class="bg-white py-8 px-6 shadow sm:rounded-xl sm:px-10 border border-gray-100">
      
      <form class="space-y-6" {...login}>
        
        <label>
          Email
          <input {...login.fields.email.as('email')} />
          {#each login.fields.email.issues() ?? [] as issue}
            <p class="issue">{issue.message}</p>
          {/each}
        </label>

        <label>
          Password
          <input {...login.fields.password.as('password')} />
          {#each login.fields.password.issues() ?? [] as issue}
            <p class="issue">{issue.message}</p>
          {/each}
        </label>


		<p>
			Don't have an account?
			<a href="/auth/signup">Sign up</a>
		</p>

		<button type="submit" >Login</button>

      </form>

    </div>
  </div>
</div>