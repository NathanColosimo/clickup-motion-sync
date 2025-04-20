/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import type { Env } from './types';
import { getConfig } from './config';
import { runSync } from './syncController';

export default {
	async fetch(req) {
		const url = new URL(req.url);
		url.pathname = '/__scheduled';
		url.searchParams.append('cron', '* * * * *');
		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	/**
	 * Handles the scheduled event triggered by the cron definition.
	 * Fetches configuration and initiates the synchronization process.
	 *
	 * @param controller - The scheduled controller object (not directly used here but part of the signature).
	 * @param env - The environment bindings (API keys, D1 database).
	 * @param ctx - The execution context, used to extend the worker's lifetime.
	 */
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`Cron trigger fired: ${new Date().toISOString()}`);

		try {
			// Load configuration (API keys, D1 mappings)
			const config = await getConfig(env);

			// If no active mappings, don't proceed
			if (!config.mappings || config.mappings.length === 0) {
				console.log('No active sync mappings found. Exiting sync cycle.');
				return;
			}

			// Run the main sync process
			// Use waitUntil to ensure the sync process completes even if the main function returns early
			ctx.waitUntil(runSync(config, env.DB));

			console.log(`Sync process initiated for ${config.mappings.length} mapping(s).`);
		} catch (error) {
			console.error('Error during scheduled execution setup:', error);
			// Depending on the error (e.g., config failure), might want to notify
		}
	},
} satisfies ExportedHandler<Env>;
