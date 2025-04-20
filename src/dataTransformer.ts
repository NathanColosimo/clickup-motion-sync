import type {
	ClickUpCreatePayload,
	ClickUpTask,
	ClickUpUpdatePayload,
	MotionCreatePayload,
	MotionTask,
	MotionUpdatePayload,
} from './types';

// --- Configuration --- (These might need to be configurable via Env or DB later)
const CLICKUP_DONE_STATUS_NAME = 'complete'; // IMPORTANT: Replace with your actual status name for completed tasks in ClickUp

// --- Helper Functions ---

/**
 * Converts a ClickUp timestamp string (milliseconds) to an ISO 8601 string for Motion.
 * Returns null if the input dateString is null or invalid.
 */
function clickUpDateToMotionISO(dateString: string | null | undefined): string | null {
	if (!dateString) return null;
	try {
		const timestampMs = parseInt(dateString, 10);
		if (isNaN(timestampMs)) return null;
		return new Date(timestampMs).toISOString();
	} catch (e) {
		console.warn(`Failed to parse ClickUp date string: ${dateString}`, e);
		return null;
	}
}

/**
 * Converts a Motion ISO 8601 date string to a ClickUp Unix timestamp (milliseconds).
 * Returns null if the input isoString is null or invalid.
 */
function motionISOToClickUpTimestamp(isoString: string | null | undefined): number | null {
	if (!isoString) return null;
	try {
		const date = new Date(isoString);
		return date.getTime();
	} catch (e) {
		console.warn(`Failed to parse Motion ISO date string: ${isoString}`, e);
		return null;
	}
}

/**
 * Basic HTML stripping function.
 * Replace with a more robust library if complex HTML is expected.
 */
function stripHtml(html: string | null | undefined): string {
	if (!html) return '';
	// Very basic regex to remove HTML tags
	return html.replace(/<[^>]*>/g, '');
}

// --- Transformation Functions ---

/**
 * Transforms a ClickUp task into a Motion task creation payload.
 * Focuses on name, description, and initial due date.
 * @param clickUpTask The source ClickUp task.
 * @param motionWorkspaceId The target Motion workspace ID.
 * @returns MotionCreatePayload
 */
export function transformClickUpToMotion(clickUpTask: ClickUpTask, motionWorkspaceId: string): MotionCreatePayload {
	const motionPayload: MotionCreatePayload = {
		workspaceId: motionWorkspaceId,
		name: clickUpTask.name,
	};

	// Prefer text_content (newer field), fallback to description
	const description = clickUpTask.text_content ?? clickUpTask.description;
	if (description) {
		// Motion expects HTML. For simplicity, we send plain text.
		// If ClickUp uses Markdown, Motion might render it as plain text.
		// Consider converting Markdown to HTML if needed.
		motionPayload.description = description;
	}

	const dueDateISO = clickUpDateToMotionISO(clickUpTask.due_date);
	if (dueDateISO) {
		motionPayload.dueDate = dueDateISO;
	}

	// We are not syncing assignees from ClickUp to Motion in this simplified version
	// motionPayload.assigneeIds = mapClickUpToMotionUsers(clickUpTask.assignees);

	return motionPayload;
}

/**
 * Transforms a Motion task into a ClickUp task update payload.
 * Focuses on completion status and due date updates.
 * @param motionTask The source Motion task.
 * @returns ClickUpUpdatePayload
 */
export function transformMotionToClickUp(motionTask: MotionTask): ClickUpUpdatePayload {
	const clickupPayload: ClickUpUpdatePayload = {};

	// --- Due Date Update ---
	// We get the due date from Motion regardless of completion status
	const dueDateTimestamp = motionISOToClickUpTimestamp(motionTask.dueDate);
	// Setting due_date to null clears it in ClickUp
	clickupPayload.due_date = dueDateTimestamp;

	// --- Completion Status Update ---
	if (motionTask.completed) {
		// If Motion task is complete, set ClickUp status to the designated 'done' status
		clickupPayload.status = CLICKUP_DONE_STATUS_NAME;
	} else {
		// If Motion task is *not* complete, we *don't* update the ClickUp status here.
		// Re-opening a task in Motion shouldn't automatically change the ClickUp status
		// from 'In Progress' back to 'To Do', for example. Status changes other than
		// completion should originate from ClickUp in this model.
	}

	// We are not syncing name/description from Motion to ClickUp
	// We are not syncing assignees from Motion to ClickUp

	// Return payload only if there's something to update
	if (Object.keys(clickupPayload).length > 0) {
		return clickupPayload;
	} else {
		// Return an empty object or null to signify no update needed
		return {};
	}
} 