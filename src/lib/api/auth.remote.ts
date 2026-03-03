import { redirect } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { auth } from '$lib/better-auth/auth';
import { passengerSignUpSchema, cooperativeSignUpSchema, loginSchema } from '$lib/schema/auth';
import { db } from '$lib/server/db';
import { cooperative, passenger } from '$lib/server/db/schema';
import { generateId } from 'better-auth';

export const passengerSignUp = form(passengerSignUpSchema, async (data) => {
	// Implementation for passenger sign-up
	try {
		const newPassenger = await auth.api.signUpEmail({
			body: {
				email: data.email,
				password: data.password,
				name: data.name,
				role: 'passenger'
			}
		});

		if (!newPassenger || !newPassenger.user) {
			throw new Error('Failed to create passenger account');
		}

		await db.insert(passenger).values({
			id: generateId(),
			userId: newPassenger.user.id,
			name: data.name,
		});

		console.log('Passenger signed up successfully:', newPassenger);
		throw redirect(303, '/auth/login');
	} catch (error) {
		console.error('Error during passenger sign-up:', error);
		throw error;
	}
});

export const cooperativeSignUp = form(cooperativeSignUpSchema, async (data) => {
	try {
		// 1. Sign up the admin user for this cooperative
		const newAdmin = await auth.api.signUpEmail({
			body: {
				email: data.email,
				password: data.password,
				name: data.name, // The name of the manager
				role: 'admin' // Assigning the admin role
			}
		});

		if (!newAdmin || !newAdmin.user) {
			throw new Error('Failed to create admin account');
		}

		// 2. Create the cooperative record in the database, linking it to the new admin user
		await db.insert(cooperative).values({
			id: generateId(), // Generate a unique ID for the coop
			userId: newAdmin.user.id, // Link this business to the admin we just created!
			name: data.cooperativeName, // The official transport line name
			address: data.address
		});

		console.log(`Cooperative [${data.cooperativeName}] signed up successfully!`);
		throw redirect(303, '/auth/login');
	} catch (error) {
		// Let SvelteKit's redirect throw naturally, catch everything else
		if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
			throw error;
		}
		console.error(
			'SERVER CRASH DETAILS:',
			JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
		);
		throw error;
	}
});

export const login = form(loginSchema, async (data) => {
	const { request } = getRequestEvent();
	try {
		await auth.api.signInEmail({
			body: {
				email: data.email,
				password: data.password
			},
			headers: request.headers
		});
		throw redirect(303, '/passenger'); // Redirect to homepage after successful login
	} catch (error) {
		// Let SvelteKit's redirect throw naturally, catch everything else
		if (error && typeof error === 'object' && 'status' in error && error.status === 303) {
			throw error;
		}
		console.error('Error during login:', error);
		throw error;
	}
});

export const signout = form(async () => {
	const { request } = getRequestEvent()
	await auth.api.signOut({ headers: request.headers })
	throw redirect(303, '/')
})
