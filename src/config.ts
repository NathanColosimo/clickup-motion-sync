import type { Env, SyncMapping, UserMapping } from './types';
import { getActiveSyncMappings } from './dbClient';

/**
 * Helper function to get user mappings from D1.
 */
async function getUserMappings(db: D1Database): Promise<Map<number, string>> {
	console.log('Fetching user mappings...');
	const userMap = new Map<number, string>();
	try {
		const stmt = db.prepare('SELECT clickup_user_id, motion_user_id FROM UserMappings');
		const result: D1Result<UserMapping> = await stmt.all();
		if (result.error) {
			console.error(`D1 Error fetching user mappings: ${result.error}`);
			// Proceed without user mappings if there's an error?
			return userMap; // Return empty map
		}
		if (result.results) {
			for (const mapping of result.results) {
				if (mapping.clickup_user_id && mapping.motion_user_id) {
					userMap.set(mapping.clickup_user_id, mapping.motion_user_id);
				}
			}
		}
		console.log(`Loaded ${userMap.size} user mappings.`);
	} catch (error) {
		console.error('Error fetching user mappings from D1:', error);
		// Return empty map on error
	}
	return userMap;
}

/**
 * Represents the application configuration derived from environment variables and D1.
 */
export interface AppConfig {
	clickupApiKey: string;
	motionApiKey: string;
	mappings: SyncMapping[];
	userMap: Map<number, string>;
}

/**
 * Loads the application configuration.
 * Retrieves API keys from environment secrets, active sync mappings, and user mappings from D1.
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

	// Fetch active list/workspace mappings and user mappings concurrently
	const [mappings, userMap] = await Promise.all([
		getActiveSyncMappings(env.DB),
		getUserMappings(env.DB), // Fetch user mappings
	]);

	if (!mappings || mappings.length === 0) {
		console.warn('No active sync mappings found in the database. Sync will not process any pairs.');
	}

	return {
		clickupApiKey,
		motionApiKey,
		mappings: mappings || [], // Ensure mappings is always an array
		userMap: userMap, // Add the loaded user map
	};
} 