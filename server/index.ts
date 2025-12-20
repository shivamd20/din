import { UserTimelineDO } from "./UserTimelineDO";
import { createAuth } from "./auth";

export { UserTimelineDO };



export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Simple Auth Stub
		// const userId = "default-user";
		const auth = createAuth(env);
		if (url.pathname.startsWith("/api/auth")) {
			return auth.handler(request);
		}

		const session = await auth.api.getSession({ headers: request.headers });
		const userId = session?.user?.id;

		if (!userId) {
			return new Response("Unauthorized", { status: 401 });
		}

		// Router
		if (url.pathname === "/api/log" && request.method === "POST") {
			const stub = env.USER_TIMELINE_DO.get(
				env.USER_TIMELINE_DO.idFromName(userId)
			);
			const data = (await request.json()) as { text: string };
			const result = await stub.log(data.text);
			return Response.json(result);
		}

		if (url.pathname === "/api/today" && request.method === "GET") {
			const stub = env.USER_TIMELINE_DO.get(
				env.USER_TIMELINE_DO.idFromName(userId)
			);
			const result = await stub.getToday();
			return Response.json(result);
		}

		return new Response("Din Backend Running", { status: 200 });
	},
} satisfies ExportedHandler<Env>;
