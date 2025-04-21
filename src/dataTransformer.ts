import type {
	ClickUpCreatePayload,
	ClickUpTask,
	ClickUpUpdatePayload,
	MotionAutoSchedulePayload,
	MotionCreatePayload,
	MotionTask,
	MotionUpdatePayload,
	UserMapping,
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

/**
 * Formats a Date object into YYYY-MM-DD format.
 */
function formatDateYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- Transformation Functions ---

/**
 * Transforms a ClickUp task into a Motion task creation payload.
 * Focuses on name, description, initial due date, assignees, and auto-scheduling.
 * @param clickUpTask The source ClickUp task.
 * @param motionWorkspaceId The target Motion workspace ID.
 * @param userMap A map where keys are ClickUp user IDs and values are Motion user IDs.
 * @returns MotionCreatePayload
 */
export function transformClickUpToMotion(
	clickUpTask: ClickUpTask,
	motionWorkspaceId: string,
	userMap: Map<number, string>,
): MotionCreatePayload {
	const motionPayload: MotionCreatePayload = {
		workspaceId: motionWorkspaceId,
		name: clickUpTask.name,
	};

	// Description
	const description = clickUpTask.text_content ?? clickUpTask.description;
	if (description) {
		motionPayload.description = description;
	}

	// Due Date
	const dueDateISO = clickUpDateToMotionISO(clickUpTask.due_date);
	if (dueDateISO) {
		motionPayload.dueDate = dueDateISO;
	}

	// Time Estimate (ClickUp -> Motion)
	if (clickUpTask.time_estimate && clickUpTask.time_estimate > 0) {
		try {
			const durationMinutes = Math.round(clickUpTask.time_estimate / 60000); // Convert ms to minutes
			if (durationMinutes > 0) {
				motionPayload.duration = durationMinutes;
			}
		} catch (e) {
			console.warn(`ClickUp Task ${clickUpTask.id}: Failed to parse time_estimate: ${clickUpTask.time_estimate}`, e);
		}
	}

	// Assignees
	if (clickUpTask.assignees && clickUpTask.assignees.length > 0) {
		motionPayload.assigneeIds = clickUpTask.assignees
			.map((assignee) => userMap.get(assignee.id))
			.filter((motionId): motionId is string => !!motionId); // Filter out undefined/null results
		
		if (motionPayload.assigneeIds.length !== clickUpTask.assignees.length) {
			console.warn(`ClickUp Task ${clickUpTask.id}: Not all assignees could be mapped to Motion users.`);
		}
	}

	// Auto-Scheduling (NEW)
	try {
		const today = new Date();
		const startDate = formatDateYYYYMMDD(today);
		motionPayload.autoScheduled = {
			startDate: startDate,
			deadlineType: 'SOFT', // As requested
			schedule: 'Work Hours', // As requested
		};
	} catch (e) {
		console.error(`ClickUp Task ${clickUpTask.id}: Failed to generate autoSchedule block`, e);
		// Decide if you want to clear it or let the API call potentially fail
		motionPayload.autoScheduled = null;
	}

	return motionPayload;
}

/**
 * Transforms a Motion task into a ClickUp task update payload.
 * Focuses on completion status and due date updates.
 * @param motionTask The source Motion task.
 * @returns ClickUpUpdatePayload Returns an empty object if no updates are needed.
 */
export function transformMotionToClickUp(motionTask: MotionTask): ClickUpUpdatePayload {
	const clickupPayload: ClickUpUpdatePayload = {};

	// --- Due Date Update ---
	const dueDateTimestamp = motionISOToClickUpTimestamp(motionTask.dueDate);
	clickupPayload.due_date = dueDateTimestamp;

	// --- Completion Status Update ---
	if (motionTask.completed) {
		clickupPayload.status = CLICKUP_DONE_STATUS_NAME;
	} else {
		// No change to ClickUp status if Motion task is not complete
	}

	// --- Duration Update (Motion -> ClickUp) ---
	if (motionTask.duration && motionTask.duration > 0) {
		try {
			const estimateMs = Math.round(motionTask.duration * 60000); // Convert minutes to ms
			if (estimateMs > 0) {
				clickupPayload.time_estimate = estimateMs;
			}
		} catch (e) {
			console.warn(`Motion Task ${motionTask.id}: Failed to parse duration: ${motionTask.duration}`, e);
		}
	} else if (motionTask.duration === 0) {
		// Optionally handle setting estimate to 0 or clearing it
		// clickupPayload.time_estimate = 0; // Set to 0
		clickupPayload.time_estimate = null; // Set to null to potentially clear it in ClickUp
	}

	// Return payload only if there's something to update
	if (Object.keys(clickupPayload).length > 0) {
		return clickupPayload;
	} else {
		return {};
	}
} 