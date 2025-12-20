import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export const createAuth = (env: Env) => {
    const db = drizzle(env.liva_db, { schema });
    return betterAuth({
        database: drizzleAdapter(db, {
            provider: "sqlite",
            schema: {
                ...schema
            }
        }),
        plugins: [
            anonymous()
        ],
        secret: env.BETTER_AUTH_SECRET,
        socialProviders: {
            google: {
                clientId: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
            }
        },
        baseURL: env.AUTH_BASE_URL,
        trustedOrigins: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:8787",
            env.AUTH_BASE_URL
        ]
    });
};
