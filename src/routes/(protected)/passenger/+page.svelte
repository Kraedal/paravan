<script lang='ts'>
import { signout } from "$lib/api/auth.remote"; 
import { page } from "$app/state";

let user = page.data.user;
let role = page.data.role;
</script>


<h1>Hello {user.name} | {role}</h1>
<form {...signout}>
  <button type="submit" class="text-black">Sign out</button>
</form>