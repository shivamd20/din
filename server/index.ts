import { UserTimelineDO } from "./UserTimelineDO";

export { UserTimelineDO };

export interface Env {
	USER_TIMELINE_DO: DurableObjectNamespace<UserTimelineDO>;
	AI: any;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Simple Auth Stub
		const userId = "default-user";

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
