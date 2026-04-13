import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const databaseUrl = env.DATABASE_URL?.trim();

if (!databaseUrl) throw new Error('DATABASE_URL is not set');

const isSupabaseDatabase = databaseUrl.includes('supabase.com');
const connectTimeoutSeconds = Number(env.DB_CONNECT_TIMEOUT_SECONDS ?? '10');

const client = postgres(databaseUrl, {
	connect_timeout: Number.isFinite(connectTimeoutSeconds) ? connectTimeoutSeconds : 10,
	ssl: isSupabaseDatabase ? 'require' : undefined
});

export const db = drizzle(client, { schema });
