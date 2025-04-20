import type { Env, SyncMapping } from './types';
import { getActiveSyncMappings } from './dbClient';

/**
 * Represents the application configuration derived from environment variables and D1.
 */
export interface AppConfig {
	clickupApiKey: string;
	motionApiKey: string;
	mappings: SyncMapping[];
}

/**
 * Loads the application configuration.
 * Retrieves API keys from environment secrets and active sync mappings from D1.
 * @param env - The worker environment object.
 * @returns Promise<AppConfig>
 * @throws Error if critical configuration is missing.
 */
export async function getConfig(env: Env): Promise<AppConfig> {
	const clickupApiKey = env.CLICKUP_API_KEY;
	const motionApiKey = env.MOTION_API_KEY;

	if (!clickupApiKey || clickupApiKey === 'dummy') {
		throw new Error('CLICKUP_API_KEY secret is not set or is still the dummy value.');
	}
	if (!motionApiKey || motionApiKey === 'dummy') {
		throw new Error('MOTION_API_KEY secret is not set or is still the dummy value.');
	}

	// Fetch active mappings from the D1 database
	const mappings = await getActiveSyncMappings(env.DB);

	if (!mappings || mappings.length === 0) {
		console.warn('No active sync mappings found in the database. Sync will not process any pairs.');
	}

	return {
		clickupApiKey,
		motionApiKey,
		mappings: mappings || [], // Ensure mappings is always an array
	};
} 