import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { UserTimelineDO } from "./UserTimelineDO";
import { createAuth } from "./auth";
import { appRouter, type Context } from "./trpc";

export { UserTimelineDO };

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		const auth = createAuth(env);
		if (url.pathname.startsWith("/api/auth")) {
			return auth.handler(request);
		}

		// tRPC Handler
		if (url.pathname.startsWith("/api/trpc")) {
			const session = await auth.api.getSession({ headers: request.headers });
			const userId = session?.user?.id;

			if (!userId) {
				return new Response("Unauthorized", { status: 401 });
			}

			const userTimeline = env.USER_TIMELINE_DO.get(
				env.USER_TIMELINE_DO.idFromName(userId)
			);

			return fetchRequestHandler({
				endpoint: '/api/trpc',
				req: request,
				router: appRouter,
				createContext: (): Context => ({
					userId,
					userTimeline
				}),
			});
		}

		return new Response("Din Backend Running", { status: 200 });
	},
} satisfies ExportedHandler<Env>;
