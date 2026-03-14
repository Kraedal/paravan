import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/better-auth/auth';
import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const authHandler: Handle = async ({ event, resolve }) => {
	return svelteKitHandler({ auth, event, resolve, building });
};

const sessionHandler: Handle = async ({ event, resolve }) => {
	console.log(`[HOOKS] Processing request for path: ${event.url.pathname}`);

	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
		event.locals.role = session.user.role; // Default role
	}

	// Route protection
	const path = event.url.pathname;

	// Protect driver routes
	if (path.startsWith('/driver') && event.locals.role !== 'driver') {
		if (event.locals.role === 'passenger') throw redirect(303, '/passenger');
		if (event.locals.role === 'admin') throw redirect(303, '/cooperative');
		throw redirect(303, '/auth/login');
	}

	// Protect passenger routes
	if (path.startsWith('/passenger') && event.locals.role !== 'passenger') {
		if (event.locals.role === 'driver') throw redirect(303, '/driver');
		if (event.locals.role === 'admin') throw redirect(303, '/cooperative');
		throw redirect(303, '/auth/login');
	}

	// Protect cooperative routes
	if (path.startsWith('/cooperative') && event.locals.role !== 'admin') {
		if (event.locals.role === 'driver') throw redirect(303, '/driver');
		if (event.locals.role === 'passenger') throw redirect(303, '/passenger');
		throw redirect(303, '/auth/login');
	}

	if (path.startsWith('/auth/login') && session) {
		if (event.locals.role === 'driver') throw redirect(303, '/driver');
		if (event.locals.role === 'passenger') throw redirect(303, '/passenger');
		if (event.locals.role === 'admin') throw redirect(303, '/cooperative');
	}

	return resolve(event);
};

export const handle = sequence(authHandler, sessionHandler);
