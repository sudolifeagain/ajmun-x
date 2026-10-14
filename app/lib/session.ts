import { cookies } from "next/headers";
import prisma from "./prisma";
import { verifySessionToken } from "./sessionTokens";
export { createSessionToken } from "./sessionTokens";

// Use inferred type from Prisma
type User = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

export const SESSION_COOKIE_NAME = "__Host-session";

/**
 * Verify and get session from cookie
 */
export async function getSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie?.value) {
        return null;
    }

    const token = sessionCookie.value;
    const userId = await verifySessionToken(token);
    if (!userId) return null;

    try {
        const user = await prisma.user.findUnique({
            where: { discordUserId: userId },
        });

        return user;
    } catch {
        return null;
    }
}
