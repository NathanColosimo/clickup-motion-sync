import type {
	SyncMapping,
	ClickUpTask,
	MotionTask,
	ClickUpUpdatePayload,
	UserMapping,
} from './types';
import { ClickUpClient } from './clickupClient';
import { MotionClient } from './motionClient';
import {
	getTaskLinkByClickupId,
	getTaskLinkByMotionId,
	createTaskLink,
	// deleteTaskLinkByClickupId, // Optional: Only if handling deletions
	// deleteTaskLinkByMotionId,
} from './dbClient';
import {
	transformClickUpToMotion,
	transformMotionToClickUp,
} from './dataTransformer';

/**
 * Processes synchronization for a single mapping between a ClickUp list and a Motion workspace.
 * Handles one-way syncs: ClickUp -> Motion (Creations) and Motion -> ClickUp (Updates).
 *
 * @param mapping - The SyncMapping object from D1.
 * @param lastSyncTimestamp - ISO 8601 timestamp of the last successful sync.
 * @param db - The D1 Database instance.
 * @param clickupClient - Instance of ClickUpClient.
 * @param motionClient - Instance of MotionClient.
 * @param userMap - Map of ClickUp user IDs to Motion user IDs.
 */
export async function processSyncPair(
	mapping: SyncMapping,
	lastSyncTimestamp: string,
	db: D1Database,
	clickupClient: ClickUpClient,
	motionClient: MotionClient,
	userMap: Map<number, string>,
): Promise<void> {
	const { clickup_list_id: clickupListId, motion_workspace_id: motionWorkspaceId } = mapping;

	// --- 1. Fetch Updated Tasks --- //
	// Get tasks updated since the last successful sync from both platforms
	const [updatedClickUpTasks, updatedMotionTasks] = await Promise.all([
		clickupClient.getTasksUpdatedSince(clickupListId, lastSyncTimestamp),
		motionClient.getTasksUpdatedSince(motionWorkspaceId, lastSyncTimestamp),
	]);

	console.log(`Fetched ${updatedClickUpTasks.length} updated ClickUp tasks.`);
	console.log(`Fetched ${updatedMotionTasks.length} updated Motion tasks.`);

	// --- 2. Process ClickUp Task Changes (Sync Creations to Motion) --- //
	for (const clkTask of updatedClickUpTasks) {
		// Skip tasks potentially closed *before* the last sync run started
		// ClickUp date_updated might not change for some webhook-triggered status changes?
		// It's safer to rely on finding existing links.

		// Check if this ClickUp task is already linked to a Motion task
		const existingLink = await getTaskLinkByClickupId(db, clkTask.id);

		if (!existingLink) {
			// New ClickUp task detected (or hasn't been linked yet)
			console.log(` -> New/Unlinked ClickUp Task ${clkTask.id} (${clkTask.name}). Creating in Motion...`);
			try {
				// Transform data for Motion (Name, Description, Initial Due Date)
				const motionPayload = transformClickUpToMotion(
					clkTask,
					motionWorkspaceId,
					userMap,
				);

				// Create the task in Motion
				const newMotionTask = await motionClient.createTask(motionPayload);
				console.log(`    - Created Motion Task: ${newMotionTask.id}`);

				// Create the link in the D1 database
				await createTaskLink(db, clkTask.id, newMotionTask.id);
				console.log(`    - Created Task Link in DB.`);

			} catch (error) {
				console.error(`    - Failed to create Motion task or DB link for ClickUp task ${clkTask.id}:`, error);
				// Continue to the next ClickUp task
			}
		} else {
			// Task already exists and is linked. No action needed for ClickUp -> Motion updates in this simplified flow.
			console.log(` -> ClickUp Task ${clkTask.id} already linked to Motion Task ${existingLink.motion_task_id}. Skipping C->M update.`);
		}
	}

	// --- 3. Process Motion Task Changes (Sync Updates to ClickUp) --- //
	for (const motTask of updatedMotionTasks) {
		// Check if this Motion task is linked to a ClickUp task
		const existingLink = await getTaskLinkByMotionId(db, motTask.id);

		if (existingLink) {
			// Linked task exists, process potential updates (Completion, Due Date)
			console.log(` -> Linked Motion Task ${motTask.id} (${motTask.name}) updated. Checking for ClickUp update...`);
			try {
				// Transform Motion data to ClickUp update payload (Completion Status, Due Date)
				const clickupPayload = transformMotionToClickUp(motTask);

				// Check if there's anything actually to update
				if (Object.keys(clickupPayload).length > 0) {
					console.log(`    - Updating ClickUp Task ${existingLink.clickup_task_id} with payload:`, clickupPayload);
					await clickupClient.updateTask(existingLink.clickup_task_id, clickupPayload);
					console.log(`    - Successfully updated ClickUp Task ${existingLink.clickup_task_id}.`);
				} else {
					console.log(`    - No relevant changes found to sync to ClickUp Task ${existingLink.clickup_task_id}.`);
				}
			} catch (error) {
				console.error(`    - Failed to update ClickUp task ${existingLink.clickup_task_id} from Motion task ${motTask.id}:`, error);
				// Continue to the next Motion task
			}
		} else {
			// Motion task is not linked to any known ClickUp task. Ignore it.
			// This could be a task created directly in Motion, or one whose ClickUp counterpart was deleted.
			console.log(` -> Motion Task ${motTask.id} is not linked to ClickUp. Skipping M->C update.`);
		}
	}

	console.log('Finished processing pair.');
} 