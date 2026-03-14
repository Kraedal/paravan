import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from '$lib/server/db'; // your drizzle instance
import * as schema from '$lib/server/db/schema'; // your drizzle schema

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg', // or "mysql", "sqlite"
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification
		}
	}),
	user: {
		additionalFields: {
			role: {
				type: 'string',
				required: true,
				defaultValue: 'user'
			}
		}
	},
	// Configure the authentication providers you want to use
	emailAndPassword: {
		enabled: true
	},

	secret: process.env.BETTER_AUTH_SECRET!,
	baseUrl: process.env.BETTER_AUTH_URL! || 'http://localhost:5173',
	plugins: [sveltekitCookies(getRequestEvent)]
});
