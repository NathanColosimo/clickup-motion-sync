import type {
	ClickUpCreatePayload,
	ClickUpTask,
	ClickUpUpdatePayload,
} from './types';

// Base URL for ClickUp API v2
const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';

/**
 * Basic ClickUp API Client.
 */
export class ClickUpClient {
	private apiKey: string;

	constructor(apiKey: string) {
		if (!apiKey) {
			throw new Error('ClickUpClient requires an API key.');
		}
		this.apiKey = apiKey;
	}

	/**
	 * Helper function to make authenticated requests to the ClickUp API.
	 */
	private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		const url = `${CLICKUP_API_BASE}${endpoint}`;
		const headers = {
			Authorization: this.apiKey,
			'Content-Type': 'application/json',
			...(options.headers || {}),
		};

		console.log(`ClickUp Request: ${options.method || 'GET'} ${url}`);

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorBody = await response.text();
			console.error(`ClickUp API Error (${response.status}): ${errorBody}`);
			throw new Error(
				`ClickUp API request failed with status ${response.status}: ${response.statusText} - ${errorBody}`,
			);
		}

		// Handle potential empty responses for methods like PUT/DELETE if necessary
		if (response.status === 204) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return null as any; // Or handle appropriately based on expected response
		}

		return await response.json<T>();
	}

	/**
	 * Fetches tasks from a specific list that have been updated since the given timestamp.
	 * @param listId The ID of the ClickUp list.
	 * @param updatedSinceISO ISO 8601 timestamp string.
	 * @returns Promise<ClickUpTask[]>
	 */
	async getTasksUpdatedSince(listId: string, updatedSinceISO: string): Promise<ClickUpTask[]> {
		// ClickUp API expects Unix timestamp in milliseconds for date filters
		const updatedSinceTimestampMs = new Date(updatedSinceISO).getTime();

		// Construct query parameters
		const params = new URLSearchParams({
			// date_updated_gt expects milliseconds timestamp
			date_updated_gt: updatedSinceTimestampMs.toString(),
			subtasks: 'true', // Include subtasks in the results
			include_closed: 'true', // Include closed/done tasks that were updated
		});

		const endpoint = `/list/${listId}/task?${params.toString()}`;
		console.log(`Fetching ClickUp tasks updated since ${updatedSinceISO} (${updatedSinceTimestampMs}) from list ${listId}`);

		try {
			const response = await this.request<{ tasks: ClickUpTask[] }>(endpoint, {
				method: 'GET',
			});
			return response.tasks || [];
		} catch (error) {
			console.error(`Failed to get updated tasks from ClickUp list ${listId}:`, error);
			throw error;
		}
	}

	/**
	 * Creates a new task in a specific ClickUp list.
	 * @param listId The ID of the ClickUp list.
	 * @param payload The task creation data.
	 * @returns Promise<ClickUpTask>
	 */
	async createTask(listId: string, payload: ClickUpCreatePayload): Promise<ClickUpTask> {
		const endpoint = `/list/${listId}/task`;
		console.log(`Creating ClickUp task in list ${listId}:`, payload.name);

		try {
			const newTask = await this.request<ClickUpTask>(endpoint, {
				method: 'POST',
				body: JSON.stringify(payload),
			});
			return newTask;
		} catch (error) {
			console.error(`Failed to create ClickUp task in list ${listId}:`, error);
			throw error;
		}
	}

	/**
	 * Updates an existing ClickUp task.
	 * @param taskId The ID of the task to update.
	 * @param payload The data to update.
	 * @returns Promise<ClickUpTask>
	 */
	async updateTask(taskId: string, payload: ClickUpUpdatePayload): Promise<ClickUpTask> {
		// NOTE: Updating custom fields might require a different endpoint/approach
		// Check ClickUp API docs for 'Set Custom Field Value' if needed.
		const endpoint = `/task/${taskId}`;
		console.log(`Updating ClickUp task ${taskId} with payload:`, payload);

		try {
			// ClickUp uses PUT for task updates
			const updatedTask = await this.request<ClickUpTask>(endpoint, {
				method: 'PUT',
				body: JSON.stringify(payload),
			});
			return updatedTask;
		} catch (error) {
			console.error(`Failed to update ClickUp task ${taskId}:`, error);
			throw error;
		}
	}

	// Add other methods as needed (e.g., getting users, getting list details)
} 