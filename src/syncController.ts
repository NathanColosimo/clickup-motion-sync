import type { AppConfig } from './config';
import { ClickUpClient } from './clickupClient';
import { MotionClient } from './motionClient';
import { processSyncPair } from './syncPairProcessor';
import { updateSyncTimestamp } from './dbClient';

/**
 * Orchestrates the synchronization process for all active mappings.
 * Iterates through each mapping, processes it, and updates the sync timestamp on success.
 *
 * @param config - The application configuration containing API keys and mappings.
 * @param db - The D1 Database instance.
 */
export async function runSync(config: AppConfig, db: D1Database): Promise<void> {
	console.log('Starting sync run...');
	const clickupClient = new ClickUpClient(config.clickupApiKey);
	const motionClient = new MotionClient(config.motionApiKey);

	const syncPromises = config.mappings.map(async (mapping) => {
		const { id: mappingId, clickup_list_id, motion_workspace_id, last_sync_timestamp, description } = mapping;
		const syncPairLabel = description || `CLK:${clickup_list_id} <-> MOT:${motion_workspace_id}`;

		// Use epoch if no previous timestamp exists
		const lastSync = last_sync_timestamp || '1970-01-01T00:00:00Z';
		const currentSyncStartTimeISO = new Date().toISOString(); // Use a consistent time for this run

		console.log(`
Processing Pair: ${syncPairLabel}
Mapping ID: ${mappingId}
Last Sync: ${lastSync}
--------------------------------`);

		try {
			await processSyncPair(mapping, lastSync, db, clickupClient, motionClient);

			// Update the timestamp in D1 only if processing was successful
			await updateSyncTimestamp(db, mappingId, currentSyncStartTimeISO);
			console.log(`Successfully processed pair: ${syncPairLabel}. Updated last sync to ${currentSyncStartTimeISO}.`);

		} catch (error) {
			// Log the error but allow other pairs to continue processing
			console.error(`Error processing sync pair ${syncPairLabel} (Mapping ID: ${mappingId}):`, error);
			// Consider adding more robust error reporting/alerting here
		}
	});

	// Wait for all sync operations to settle (complete or fail)
	await Promise.allSettled(syncPromises);

	console.log('Sync run finished.');
} 