import z from 'zod';

export const setReadySchema = z.object({
	latitude: z.string().pipe(z.coerce.number()),
	longitude: z.string().pipe(z.coerce.number()),
	targetRouteId: z.string().optional()
});

export const requestBookingSchema = z.object({
	rideId: z.string()
});

export const cancelBookingSchema = z.object({
	bookingId: z.string()
});
