import z from 'zod';

export const passengerSignUpSchema = z
	.object({
		email: z.email(),
		name: z.string().min(2).max(100),
		password: z.string().min(8, 'Password must be at least 8 characters long'),
		confirmPassword: z.string()
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export const cooperativeSignUpSchema = z
	.object({
		email: z.email(),
		name: z.string().min(2).max(100),
		cooperativeName: z.string().min(2).max(100),
		address: z.string().min(5).max(200),
		password: z.string().min(8, 'Password must be at least 8 characters long'),
		confirmPassword: z.string()
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: 'Passwords do not match',
		path: ['confirmPassword']
	});

export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(8, 'Password must be at least 8 characters long')
});
