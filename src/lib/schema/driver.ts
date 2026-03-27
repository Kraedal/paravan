import z from 'zod';

// ─── Start ride ───────────────────────────────────────────────────────────────
export const startRideSchema = z.object({
	vehicleId: z.string().min(1, 'Vehicle is required'),
	routeId: z.string().min(1, 'Route is required')
});

// ─── End ride ─────────────────────────────────────────────────────────────────
export const endRideSchema = z.object({
	rideId: z.string().min(1, 'Ride ID is required')
});

// ─── Booking actions (accept / complete / reject all use same shape) ──────────
export const bookingActionSchema = z.object({
	bookingId: z.string().min(1, 'Booking ID is required')
});

// ─── Location update ──────────────────────────────────────────────────────────
// latitude/longitude come from a hidden form as strings — coerce to number
export const updateLocationSchema = z.object({
	latitude: z.string().pipe(z.coerce.number()),
	longitude: z.string().pipe(z.coerce.number())
});

// ─── Toggle availability ──────────────────────────────────────────────────────
// No body needed — server flips the current value
export const toggleAvailabilitySchema = z.object({});

// ─── Inferred types (useful for driver.remote.ts) ─────────────────────────────
export type StartRideInput = z.infer<typeof startRideSchema>;
export type EndRideInput = z.infer<typeof endRideSchema>;
export type BookingActionInput = z.infer<typeof bookingActionSchema>;
export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;
