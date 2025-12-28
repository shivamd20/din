import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { UserTimelineDO } from "./UserTimelineDO";
import { UserSignalsDO } from "./UserSignalsDO";
import { UserCommitmentsDO } from "./UserCommitmentsDO";
import { UserTasksDO } from "./UserTasksDO";
import { UserFeedDO } from "./UserFeedDO";
import { SignalsWorkflow } from "./SignalsWorkflow";
import { FeedWorkflow } from "./FeedWorkflow";
import { createAuth } from "./auth";
import { appRouter, type Context } from "./trpc";

export { UserTimelineDO, UserSignalsDO, UserCommitmentsDO, UserTasksDO, UserFeedDO, SignalsWorkflow, FeedWorkflow };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		const auth = createAuth(env);

		if (url.pathname.startsWith("/api/auth")) {
			return auth.handler(request);
		}

		// File Serve
		if (url.pathname.startsWith("/api/files/")) {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session?.user) return new Response("Unauthorized", { status: 401 });

			const key = url.pathname.replace("/api/files/", "");
			if (!key) return new Response("Missing Key", { status: 400 });

			const object = await env.files.get(key);
			if (!object) return new Response("Not Found", { status: 404 });

			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set("etag", object.httpEtag);

			return new Response(object.body, { headers });
		}

		// File Upload
		if (url.pathname === "/api/upload") {
			const session = await auth.api.getSession({ headers: request.headers });
			if (!session?.user) return new Response("Unauthorized", { status: 401 });

			if (request.method !== "POST" && request.method !== "PUT") return new Response("Method not Allowed", { status: 405 });

			const type = url.searchParams.get("type") || "application/octet-stream";
			const key = url.searchParams.get("key") || crypto.randomUUID();

			await env.files.put(key, request.body, {
				httpMetadata: { contentType: type }
			});

			return new Response(JSON.stringify({ key, url: `/api/files/${key}` }), { headers: { "Content-Type": "application/json" } });
		}


		// Chat Handler
		if (url.pathname === "/api/chat") {
			return import("./chat").then(m => m.handleChatRequest(request, env));
		}

		// tRPC Handler
		if (url.pathname.startsWith("/api/trpc")) {
			// Support test mode auth bypass
			const testUserId = request.headers.get('X-Test-User-Id');
			const isTestMode = request.headers.get('X-Test-Mode') === 'true';
			
			let userId: string | undefined;
			
			if (isTestMode && testUserId) {
				// Bypass auth for testing
				userId = testUserId;
			} else {
				// Normal auth flow
				const session = await auth.api.getSession({ headers: request.headers });
				userId = session?.user?.id;
			}

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const userTimeline = env.USER_TIMELINE_DO.get(
				env.USER_TIMELINE_DO.idFromName(userId)
			);
			const userSignals = env.USER_SIGNALS_DO.get(
				env.USER_SIGNALS_DO.idFromName(userId)
			);
			const userCommitments = env.USER_COMMITMENTS_DO.get(
				env.USER_COMMITMENTS_DO.idFromName(userId)
			);
			const userTasks = env.USER_TASKS_DO.get(
				env.USER_TASKS_DO.idFromName(userId)
			);
			const userFeed = env.USER_FEED_DO.get(
				env.USER_FEED_DO.idFromName(userId)
			);

			return fetchRequestHandler({
				endpoint: '/api/trpc',
				req: request,
				router: appRouter,
				createContext: (): Context => ({
					userId,
					userTimeline,
					userSignals,
					userCommitments,
					userTasks,
					userFeed,
					signalsWorkflow: env.SIGNALS_WORKFLOW,
					feedWorkflow: env.FEED_WORKFLOW,
				}),
			});
		}

		return new Response("Din Backend Running", { status: 200 });
	},
} satisfies ExportedHandler<Env>;
