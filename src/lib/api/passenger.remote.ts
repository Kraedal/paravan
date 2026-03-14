import { form, getRequestEvent } from '$app/server';
import { eq } from 'drizzle-orm';
import { setReadySchema } from '$lib/schema/passenger';
import { db } from '$lib/server/db';
import { passenger } from '$lib/server/db/schema';

function requireAuth() {
	const { locals } = getRequestEvent();

	if (!locals.user) {
		throw new Error('Not authenticated.');
	}

	return locals.user;
}

export const setReady = form(setReadySchema, async (data) => {
	const user = requireAuth();

	await db
		.update(passenger)
		.set({
			latitude: data.latitude,
			longitude: data.longitude,
			lastLocationUpdate: new Date(),
			isWaiting: true
		})
		.where(eq(passenger.userId, user.id));

	return { success: true };
});

export const setNotReady = form(async () => {
	const user = requireAuth();

	await db
		.update(passenger)
		.set({
			latitude: null,
			longitude: null,
			lastLocationUpdate: new Date(),
			isWaiting: false
		})
		.where(eq(passenger.userId, user.id));

	return { success: true };
});
