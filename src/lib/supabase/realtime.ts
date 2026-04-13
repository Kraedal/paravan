import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

type RealtimeTable = 'driver' | 'ride' | 'booking';

let realtimeClient: SupabaseClient | null = null;

function getRealtimeClient(): SupabaseClient | null {
	if (!browser) return null;

	const url = env.PUBLIC_SUPABASE_URL;
	const anonKey = env.PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) return null;

	if (realtimeClient) return realtimeClient;

	realtimeClient = createClient(url, anonKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false
		}
	});

	return realtimeClient;
}

export function subscribeToRealtimeTables(params: {
	channelName: string;
	tables: RealtimeTable[];
	onChange: () => void;
	onStatus?: (status: string) => void;
}): (() => void) | null {
	const client = getRealtimeClient();
	if (!client) return null;

	const channel = params.tables.reduce((acc, table) => {
		return acc.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table },
			() => params.onChange()
		);
	}, client.channel(params.channelName));

	channel.subscribe((status) => params.onStatus?.(status));

	return () => {
		void client.removeChannel(channel);
	};
}

export function hasRealtimeConfig(): boolean {
	if (!browser) return false;
	return Boolean(env.PUBLIC_SUPABASE_URL && env.PUBLIC_SUPABASE_ANON_KEY);
}

export type { RealtimeChannel };
