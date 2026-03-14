import z from 'zod';

export const setReadySchema = z.object({
	latitude: z.string().pipe(z.coerce.number()),
	longitude: z.string().pipe(z.coerce.number())
});
