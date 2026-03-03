import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
	baseURL: process.env.BETTER_AUTH_URL! || 'http://localhost:5173' // Fallback to localhost for development
});

export const { signIn, signOut, useSession } = authClient;
