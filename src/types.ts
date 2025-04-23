/**
 * Represents the structure of the environment variables and bindings
 * available to the Cloudflare Worker.
 */
export interface Env {
	DB: D1Database;
	CLICKUP_API_KEY: string;
	MOTION_API_KEY: string;
}

/**
 * Represents a row in the SyncMappings D1 table.
 */
export interface SyncMapping {
	id: number;
	clickup_list_id: string;
	motion_workspace_id: string;
	description?: string | null;
	last_sync_timestamp?: string | null;
	is_active: number; // 0 or 1
}

/**
 * Represents a row in the TaskLinks D1 table.
 */
export interface TaskLink {
	clickup_task_id: string;
	motion_task_id: string;
	created_at?: string | null;
	last_updated?: string | null;
}

/**
 * Represents a row in the UserMappings D1 table (NEW)
 */
export interface UserMapping {
	clickup_user_id: number;
	motion_user_id: string;
	description?: string | null;
}

// --- ClickUp Specific Types (Simplified) ---

export interface ClickUpTask {
	id: string;
	name: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	status: { status: string; type: string; [key: string]: any };
	date_created: string;
	date_updated: string;
	date_closed: string | null;
	// Use specific type for assignees now
	assignees: { id: number; /* include other fields like email/username if needed */ }[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	custom_fields: { id: string; value?: any; [key: string]: any }[];
	text_content?: string | null; // Plain text description
	description?: string | null; // Older description field
	due_date?: string | null; // Timestamp string
	time_estimate?: number | null; // Milliseconds
	list: { id: string };
	project: { id: string };
	folder: { id: string };
	space: { id: string };
	url: string;
}

export interface ClickUpUser {
	id: number;
	username: string;
	email: string;
	// other fields if needed
}

// --- Motion Specific Types (Simplified) ---

export interface MotionTask {
	id: string;
	name: string;
	description?: string | null; // HTML description
	duration?: number | null; // In minutes
	dueDate?: string | null; // ISO 8601 format
	completed: boolean;
	completedTime?: string | null; // ISO 8601 format
	updatedTime: string; // ISO 8601 format
	createdTime: string; // ISO 8601 format
	creator?: { id: string; name: string; email: string };
	project?: { id: string; name: string; workspaceId: string };
	workspace: { id: string; name: string; teamId: string; type: string };
	priority: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
	assignees: { id: string; name: string; email: string }[];
	status?: { name: string; isDefaultStatus: boolean; isResolvedStatus: boolean };
	// other fields as needed from API docs (e.g., customFieldValues, labels)
}

export interface MotionUser {
	id: string;
	name: string;
	email: string;
	// other fields if needed
}

// --- Common Sync Payloads ---

/**
 * Structure for Motion's autoSchedule parameter (NEW)
 */
export interface MotionAutoSchedulePayload {
	startDate: string; // YYYY-MM-DD
	deadlineType: 'HARD' | 'SOFT' | 'NONE';
	schedule: 'Work Hours' | string; // 'Work Hours' is common, but other schedule names might exist
}

export interface MotionCreatePayload {
	name: string;
	description?: string;
	dueDate?: string; // ISO 8601 format YYYY-MM-DD
	priority?: 'ASAP' | 'High' | 'Medium' | 'Low';
	projectId?: string;
	workspaceId: string;
	assigneeId?: string; // Assignee ID (singular)
	duration?: number; // Duration in minutes
	autoScheduled?: MotionAutoSchedulePayload | null; // Add optional autoScheduled field (NEW)
}

export interface MotionUpdatePayload {
	name?: string;
	description?: string; // HTML?
	dueDate?: string | null; // ISO 8601 format, use null to clear?
	completed?: boolean;
	statusId?: string; // Can update status this way
	assigneeIds?: string[];
	//priority?: 'ASAP' | 'HIGH' | 'MEDIUM' | 'LOW';
	//duration?: number; // In minutes
	// other fields?
}

export interface ClickUpCreatePayload {
	name: string;
	markdown_description?: string;
	assignees?: number[]; // Array of user IDs
	due_date?: number; // Unix timestamp ms
	// due_date_time?: boolean; // Set to true if due_date includes time
	// time_estimate?: number; // Milliseconds
	// status?: string; // Status name
	// notify_all?: boolean;
	// parent?: string | null; // Task ID for subtask
	// links_to?: string | null; // Task ID for dependency
}

export interface ClickUpUpdatePayload {
	name?: string;
	description?: string;
	due_date?: number | null; // Unix timestamp in milliseconds
	status?: string;
	time_estimate?: number | null; // Time estimate in milliseconds
	// Note: ClickUp API uses boolean for due_date_time, handle separately if needed.
	// Note: Assignees require adding/removing, not direct setting in update.
} 