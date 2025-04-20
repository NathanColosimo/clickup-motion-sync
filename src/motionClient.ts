import type {
	MotionCreatePayload,
	MotionTask,
	MotionUpdatePayload,
} from './types';

// Base URL for Motion API v1
const MOTION_API_BASE = 'https://api.usemotion.com/v1';

/**
 * Basic Motion API Client.
 */
export class MotionClient {
	private apiKey: string;

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error('MotionClient requires an API key.');
		}
		this.apiKey = apiKey;
	}

	/**
	 * Helper function to make authenticated requests to the Motion API.
	 */
	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${MOTION_API_BASE}${endpoint}`;
		const headers = {
			Accept: 'application/json',
			'X-API-Key': this.apiKey,
			'Content-Type': 'application/json',
			...(options.headers || {}),
		};

		console.log(`Motion Request: ${options.method || 'GET'} ${url}`);

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error(`Motion API Error (${response.status}): ${errorBody}`);
			throw new Error(
				`Motion API request failed with status ${response.status}: ${response.statusText} - ${errorBody}`,
			);
		}

		if (response.status === 204) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return null as any;
		}

		return await response.json<T>();
	}

	/**
	 * Fetches ALL tasks for a workspace and filters them based on the updated timestamp.
	 * NOTE: This can be inefficient and hit rate limits for large workspaces, as Motion API
	 * currently lacks a server-side `updated_since` filter.
	 * @param workspaceId The ID of the Motion workspace.
	 * @param updatedSinceISO ISO 8601 timestamp string.
	 * @returns Promise<MotionTask[]>
	 */
	async getTasksUpdatedSince(workspaceId: string, updatedSinceISO: string): Promise<MotionTask[]> {
		console.log(`Fetching ALL Motion tasks for workspace ${workspaceId} to filter updated since ${updatedSinceISO}`);
		const updatedSinceTimestamp = new Date(updatedSinceISO).getTime();
		let allTasks: MotionTask[] = [];
		let cursor: string | undefined = undefined;
		let hasMore = true;
		let page = 1;

		try {
			while (hasMore) {
				console.log(`Fetching Motion tasks page ${page}...`);
				const params = new URLSearchParams({
					workspaceId: workspaceId,
				});
				if (cursor) {
					params.append('cursor', cursor);
				}

				const endpoint = `/tasks?${params.toString()}`;
				const response = await this.request<{ tasks: MotionTask[]; meta: { nextCursor?: string } }>(endpoint, {
					method: 'GET',
				});

				if (response.tasks && response.tasks.length > 0) {
					allTasks = allTasks.concat(response.tasks);
				}

				if (response.meta?.nextCursor) {
					cursor = response.meta.nextCursor;
					hasMore = true;
					page++;
				} else {
					hasMore = false;
				}
			}

			// Filter locally
			const filteredTasks = allTasks.filter((task) => {
				const taskUpdatedTimestamp = new Date(task.updatedTime).getTime();
				return taskUpdatedTimestamp > updatedSinceTimestamp;
			});

			console.log(`Fetched ${allTasks.length} total tasks, ${filteredTasks.length} updated since ${updatedSinceISO}.`);
			return filteredTasks;

		} catch (error) {
			console.error(`Failed to get and filter tasks from Motion workspace ${workspaceId}:`, error);
			throw error;
		}
	}

	/**
	 * Creates a new task in Motion.
	 * @param payload The task creation data.
	 * @returns Promise<MotionTask>
	 */
	async createTask(payload: MotionCreatePayload): Promise<MotionTask> {
		const endpoint = '/tasks';
		console.log(`Creating Motion task in workspace ${payload.workspaceId}:`, payload.name);
		try {
			// Motion API returns the created task directly in the response body
			const newTask = await this.request<MotionTask>(endpoint, {
				method: 'POST',
				body: JSON.stringify(payload),
			});
			return newTask;
		} catch (error) {
			console.error(`Failed to create Motion task in workspace ${payload.workspaceId}:`, error);
			throw error;
		}
	}

	/**
	 * Updates an existing Motion task.
	 * @param taskId The ID of the task to update.
	 * @param payload The data to update.
	 * @returns Promise<MotionTask>
	 */
	async updateTask(taskId: string, payload: MotionUpdatePayload): Promise<MotionTask> {
		const endpoint = `/tasks/${taskId}`;
		console.log(`Updating Motion task ${taskId} with payload:`, payload);
		try {
			// Motion uses PATCH for task updates
			// It seems Motion might return the updated task object on successful PATCH
			const updatedTask = await this.request<MotionTask>(endpoint, {
				method: 'PATCH',
				body: JSON.stringify(payload),
			});
			return updatedTask;
		} catch (error) {
			console.error(`Failed to update Motion task ${taskId}:`, error);
			throw error;
		}
	}

	// Add other methods as needed (e.g., getting users, getting workspaces)
} 