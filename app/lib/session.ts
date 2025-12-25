import { cookies } from "next/headers";
import { createHash } from "crypto";
import { jwtVerify, SignJWT } from "jose";
import prisma from "./prisma";

interface SessionPayload {
    userId: string;
    exp: number;
}

// Use inferred type from Prisma
type User = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

// Get the secret key for JWT signing
function getJwtSecret(): Uint8Array {
    const secret = process.env.SESSION_SECRET || process.env.QR_SECRET;
    if (!secret) {
        throw new Error("SESSION_SECRET or QR_SECRET environment variable is required");
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
 * Supports both new JWT tokens and legacy Base64 tokens for backward compatibility
 */
export async function getSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) {
        return null;
    }

    const token = sessionCookie.value;

    // Try JWT verification first (new format contains dots and starts with "ey")
    if (token.includes(".") && token.startsWith("ey")) {
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

    // Fallback: Legacy Base64 token (for existing sessions during migration)
    try {
        const payload: SessionPayload = JSON.parse(
            Buffer.from(token, "base64url").toString()
        );

        // Check expiration
        if (Date.now() > payload.exp) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { discordUserId: payload.userId },
        });

        return user;
    } catch {
        return null;
    }
}

export function verifyQrToken(token: string): { valid: boolean; userId?: string } {
    try {
        const secret = process.env.QR_SECRET || "default-secret-change-me";
        const [payloadBase64, signature] = token.split(".");

        if (!payloadBase64 || !signature) {
            return { valid: false };
        }

        const payload = Buffer.from(payloadBase64, "base64url").toString();
        const [userId] = payload.split(":");

        // Verify signature
        const expectedSignature = createHash("sha256")
            .update(`${payload}:${secret}`)
            .digest("hex")
            .slice(0, 16);

        if (signature !== expectedSignature) {
            return { valid: false };
        }

        return { valid: true, userId };
    } catch {
        return { valid: false };
    }
}
