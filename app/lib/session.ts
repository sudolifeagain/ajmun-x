import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
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

/** Maximum QR token age in milliseconds (30 days) */
const QR_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function verifyQrToken(token: string): { valid: boolean; userId?: string } {
    try {
        const secret = process.env.QR_SECRET;
        if (!secret) {
            throw new Error("QR_SECRET environment variable is required");
        }

        const [payloadBase64, signature] = token.split(".");

        if (!payloadBase64 || !signature) {
            return { valid: false };
        }

        const payload = Buffer.from(payloadBase64, "base64url").toString();
        const [userId, timestamp] = payload.split(":");

        // Check token expiry (30 days)
        const tokenTime = parseInt(timestamp, 10);
        if (isNaN(tokenTime) || Date.now() - tokenTime > QR_TOKEN_MAX_AGE_MS) {
            return { valid: false };
        }

        // Verify signature using HMAC
        const expectedSignature = createHmac("sha256", secret)
            .update(payload)
            .digest("hex")
            .slice(0, 32);

        // Timing-safe comparison
        const sigBuf = Buffer.from(signature, "utf8");
        const expectedBuf = Buffer.from(expectedSignature, "utf8");
        if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
            return { valid: false };
        }

        return { valid: true, userId };
    } catch {
        return { valid: false };
    }
}
