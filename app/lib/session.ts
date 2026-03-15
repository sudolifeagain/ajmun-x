import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import prisma from "./prisma";

// Use inferred type from Prisma
type User = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

// Get the secret key for JWT signing
function getJwtSecret(): Uint8Array {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
        throw new Error("SESSION_SECRET environment variable is required");
    }
    return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT session token
 */
export async function createSessionToken(userId: string): Promise<string> {
    const token = await new SignJWT({ userId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .setIssuedAt()
        .sign(getJwtSecret());
    return token;
}

/**
 * Verify and get session from cookie
 */
export async function getSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) {
        return null;
    }

    const token = sessionCookie.value;

    try {
        const { payload } = await jwtVerify(token, getJwtSecret());
        const userId = payload.userId as string;

        if (!userId) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { discordUserId: userId },
        });

        return user;
    } catch {
        return null;
    }
}
