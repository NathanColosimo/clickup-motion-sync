import type { SyncMapping, TaskLink } from './types';

/**
 * Fetches all active sync mappings from the SyncMappings table.
 * @param db - The D1 Database instance.
 * @returns Promise<SyncMapping[]>
 */
export async function getActiveSyncMappings(db: D1Database): Promise<SyncMapping[]> {
	console.log('Fetching active sync mappings...');
	try {
		const stmt = db.prepare('SELECT * FROM SyncMappings WHERE is_active = 1');
		const result: D1Result<SyncMapping> = await stmt.all();
		if (result.error) {
			throw new Error(`D1 Error fetching mappings: ${result.error}`);
		}
		console.log(`Found ${result.results?.length ?? 0} active mappings.`);
		return result.results ?? [];
	} catch (error) {
		console.error('Error in getActiveSyncMappings:', error);
		throw error; // Re-throw to be handled upstream
	}
}

/**
 * Updates the last sync timestamp for a specific mapping.
 * @param db - The D1 Database instance.
 * @param mappingId - The ID of the SyncMapping row to update.
 * @param timestamp - The ISO 8601 timestamp string.
 */
export async function updateSyncTimestamp(db: D1Database, mappingId: number, timestamp: string): Promise<void> {
	console.log(`Updating last sync timestamp for mapping ID ${mappingId} to ${timestamp}`);
	try {
		const stmt = db.prepare('UPDATE SyncMappings SET last_sync_timestamp = ? WHERE id = ?').bind(timestamp, mappingId);
		await stmt.run();
	} catch (error) {
		console.error('Error in updateSyncTimestamp:', error);
		// Decide if we should throw here or just log
		throw error;
	}
}

/**
 * Retrieves a task link mapping by ClickUp Task ID.
 * @param db - The D1 Database instance.
 * @param clickupTaskId - The ClickUp task ID.
 * @returns Promise<TaskLink | null>
 */
export async function getTaskLinkByClickupId(db: D1Database, clickupTaskId: string): Promise<TaskLink | null> {
	try {
		const stmt = db.prepare('SELECT * FROM TaskLinks WHERE clickup_task_id = ?').bind(clickupTaskId);
		const taskLink: TaskLink | null = await stmt.first();
		return taskLink;
	} catch (error) {
		console.error(`Error in getTaskLinkByClickupId for ${clickupTaskId}:`, error);
		throw error;
	}
}

/**
 * Retrieves a task link mapping by Motion Task ID.
 * @param db - The D1 Database instance.
 * @param motionTaskId - The Motion task ID.
 * @returns Promise<TaskLink | null>
 */
export async function getTaskLinkByMotionId(db: D1Database, motionTaskId: string): Promise<TaskLink | null> {
	try {
		const stmt = db.prepare('SELECT * FROM TaskLinks WHERE motion_task_id = ?').bind(motionTaskId);
		const taskLink: TaskLink | null = await stmt.first();
		return taskLink;
	} catch (error) {
		console.error(`Error in getTaskLinkByMotionId for ${motionTaskId}:`, error);
		throw error;
	}
}

/**
 * Creates a new link between a ClickUp and Motion task.
 * @param db - The D1 Database instance.
 * @param clickupTaskId - The ClickUp task ID.
 * @param motionTaskId - The Motion task ID.
 */
export async function createTaskLink(db: D1Database, clickupTaskId: string, motionTaskId: string): Promise<void> {
	console.log(`Creating task link: ClickUp ${clickupTaskId} <-> Motion ${motionTaskId}`);
	try {
		const stmt = db
			.prepare('INSERT INTO TaskLinks (clickup_task_id, motion_task_id, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)')
			.bind(clickupTaskId, motionTaskId);
		await stmt.run();
	} catch (error) {
		console.error(`Error in createTaskLink for ClickUp ${clickupTaskId} / Motion ${motionTaskId}:`, error);
		// Consider handling potential unique constraint violations more gracefully if needed
		throw error;
	}
}

/**
 * Deletes a task link mapping by ClickUp Task ID.
 * Use this cautiously, e.g., if a task is definitively deleted in one system.
 * @param db - The D1 Database instance.
 * @param clickupTaskId - The ClickUp task ID.
 */
export async function deleteTaskLinkByClickupId(db: D1Database, clickupTaskId: string): Promise<void> {
	console.warn(`Deleting task link for ClickUp task ID: ${clickupTaskId}`);
	try {
		const stmt = db.prepare('DELETE FROM TaskLinks WHERE clickup_task_id = ?').bind(clickupTaskId);
		await stmt.run();
	} catch (error) {
		console.error(`Error in deleteTaskLinkByClickupId for ${clickupTaskId}:`, error);
		throw error;
	}
}

/**
 * Deletes a task link mapping by Motion Task ID.
 * Use this cautiously.
 * @param db - The D1 Database instance.
 * @param motionTaskId - The Motion task ID.
 */
export async function deleteTaskLinkByMotionId(db: D1Database, motionTaskId: string): Promise<void> {
	console.warn(`Deleting task link for Motion task ID: ${motionTaskId}`);
	try {
		const stmt = db.prepare('DELETE FROM TaskLinks WHERE motion_task_id = ?').bind(motionTaskId);
		await stmt.run();
	} catch (error) {
		console.error(`Error in deleteTaskLinkByMotionId for ${motionTaskId}:`, error);
		throw error;
	}
} 