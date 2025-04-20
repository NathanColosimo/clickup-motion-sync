# ClickUp <> Motion Sync Worker

## Project Goal

This Cloudflare Worker aims to synchronize tasks between specified ClickUp lists and Motion workspaces. The primary motivation is to leverage ClickUp for task creation and management while using Motion for AI-powered calendar scheduling and time blocking.

This version implements the following synchronization logic:

1.  **ClickUp to Motion:**
    *   **Creations:** When a new task is created in a monitored ClickUp list, a corresponding task is created in the mapped Motion workspace.
    *   **Synced Fields:** Task Name, Description, Initial Due Date, **Assignee(s)** (Requires user mapping setup).
2.  **Motion to ClickUp:**
    *   **Updates:** When a task *already linked* by this worker is updated in Motion, its corresponding ClickUp task is updated.
    *   **Synced Fields:** Task Completion Status (if marked complete in Motion, ClickUp status is set to the configured 'done' status), Due Date.

**Note:** Updates to name/description/assignees in ClickUp *after* creation are NOT synced to Motion in this version. Updates originating in ClickUp (other than creation) are not synced. Tasks created directly in Motion are NOT synced to ClickUp.

## Setup

1.  **Clone/Setup Project:** Get the code and install dependencies (`pnpm install`).
2.  **Cloudflare Account:** Ensure you have a Cloudflare account with Workers and D1 enabled.
3.  **Create D1 Database:**
    *   Use `npx wrangler d1 create <your-db-name>` (e.g., `clickup-motion-sync-db`).
    *   Note the `database_id` provided.
4.  **Configure `wrangler.jsonc`:**
    *   Update `d1_databases[0].database_name` with your chosen DB name.
    *   Update `d1_databases[0].database_id` with the ID from the previous step.
5.  **Create D1 Tables:** Execute the following SQL commands using `npx wrangler d1 execute <your-db-name> --command "...SQL..."`:
    ```sql
    -- SyncMappings Table
    CREATE TABLE SyncMappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clickup_list_id TEXT NOT NULL UNIQUE,
        motion_workspace_id TEXT NOT NULL,
        description TEXT,
        last_sync_timestamp TEXT,
        is_active INTEGER DEFAULT 1
    );

    -- TaskLinks Table
    CREATE TABLE TaskLinks (
        clickup_task_id TEXT NOT NULL PRIMARY KEY,
        motion_task_id TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_updated TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- UserMappings Table (NEW)
    CREATE TABLE UserMappings (
        clickup_user_id INTEGER NOT NULL PRIMARY KEY,
        motion_user_id TEXT NOT NULL UNIQUE,
        description TEXT
    );

    -- Optional Index
    CREATE INDEX idx_motion_task_id ON TaskLinks(motion_task_id);
    ```
6.  **Set API Key Secrets:** Store your API keys securely using Wrangler:
    ```bash
    npx wrangler secret put CLICKUP_API_KEY
    # Paste ClickUp key

    npx wrangler secret put MOTION_API_KEY
    # Paste Motion key
    ```
7.  **Configure ClickUp Done Status:**
    *   Open `src/dataTransformer.ts`.
    *   Find the line `const CLICKUP_DONE_STATUS_NAME = 'complete';`.
    *   **Replace `'complete'`** with the exact, case-sensitive name of the status you use in ClickUp to mark tasks as finished (e.g., `'Closed'`, `'Done'`).
8.  **Populate `SyncMappings` Table:** Insert rows into the D1 `SyncMappings` table for each ClickUp List ID and Motion Workspace ID pair you want to sync. Find the IDs from the respective app interfaces or APIs.
    ```sql
    -- Example Insert (run via wrangler d1 execute or dashboard)
    INSERT INTO SyncMappings (clickup_list_id, motion_workspace_id, description, is_active)
    VALUES ('CLICKUP_LIST_ID_1', 'MOTION_WORKSPACE_ID_1', 'Description for Pair 1', 1);
    ```
9.  **Populate `UserMappings` Table (NEW & CRUCIAL):** Insert rows mapping ClickUp User IDs to Motion User IDs for *all users* whose assignments you want to sync. Find IDs via APIs (see curl example below for Motion) or app interfaces.
    ```sql
    -- Example Insert (run via wrangler d1 execute or dashboard)
    INSERT INTO UserMappings (clickup_user_id, motion_user_id, description)
    VALUES (123456, 'usr_motion_abc', 'Alice Example ([email protected])');
    INSERT INTO UserMappings (clickup_user_id, motion_user_id, description)
    VALUES (789012, 'usr_motion_def', 'Bob Example ([email protected])');
    ```
10. **Deploy:** Run `npx wrangler deploy`.

## How it Works

*   **Cron Trigger:** The worker is triggered every 5 minutes (configurable in `wrangler.jsonc`).
*   **Configuration Load:** It fetches API keys from secrets, active list/workspace mappings from `SyncMappings`, and **user mappings** from `UserMappings`.
*   **Iterate Mappings:** For each active list/workspace mapping:
    *   It retrieves the timestamp of the last successful sync for that pair from D1.
    *   It fetches tasks updated since that timestamp from both ClickUp (using `date_updated_gt`) and Motion (fetching all and filtering locally).
*   **Process ClickUp Updates:**
    *   For each updated ClickUp task, it checks the `TaskLinks` table in D1.
    *   If no link exists, it assumes the task is new, transforms its name/description/due date/**assignees** (using the loaded user map), creates it in the corresponding Motion workspace, and adds a link record to the `TaskLinks` table.
*   **Process Motion Updates:**
    *   For each updated Motion task, it checks the `TaskLinks` table.
    *   If a link exists, it transforms the Motion task's completion status and due date into a ClickUp update payload.
    *   If the payload is not empty (i.e., relevant fields changed), it updates the linked ClickUp task.
*   **Timestamp Update:** If a pair is processed without errors, the `last_sync_timestamp` for that mapping in the `SyncMappings` table is updated to the time the current sync cycle started.

## Limitations & Future Improvements

*   **Motion API Filter:** Motion's API lacks an `updated_since` filter, requiring fetching all tasks for a workspace, which can be slow and hit rate limits for large workspaces.
*   **One-Way Assignee Sync:** Assignees are only synced from ClickUp to Motion on task creation.
*   **HTML vs Markdown:** Description sync is basic (ClickUp text/markdown -> Motion plain text). Needs improvement for rich text.
*   **Deletion Handling:** Deleting a task in one system does not affect the other.
*   **Error Handling:** Basic error logging exists; could be enhanced with alerting or retries.
*   **Status Mapping:** Only handles Motion `completed` -> specific ClickUp 'done' status. Does not handle other status changes.
