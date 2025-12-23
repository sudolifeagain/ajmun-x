import { cookies } from "next/headers";
import prisma from "./prisma";

interface SessionPayload {
    userId: string;
    exp: number;
}

// Use inferred type from Prisma
type User = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

export async function getSession(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session");

    if (!sessionCookie?.value) {
        return null;
    }

    try {
        const payload: SessionPayload = JSON.parse(
            Buffer.from(sessionCookie.value, "base64url").toString()
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

        console.log("[DEBUG] verifyQrToken - token length:", token.length);
        console.log("[DEBUG] verifyQrToken - has payload:", !!payloadBase64);
        console.log("[DEBUG] verifyQrToken - has signature:", !!signature);

        if (!payloadBase64 || !signature) {
            console.log("[DEBUG] verifyQrToken - missing payload or signature");
            return { valid: false };
        }

        const payload = Buffer.from(payloadBase64, "base64url").toString();
        const [userId] = payload.split(":");

        console.log("[DEBUG] verifyQrToken - userId:", userId);

        // Verify signature
        const { createHash } = require("crypto");
        const expectedSignature = createHash("sha256")
            .update(`${payload}:${secret}`)
            .digest("hex")
            .slice(0, 16);

        console.log("[DEBUG] verifyQrToken - expected sig:", expectedSignature);
        console.log("[DEBUG] verifyQrToken - actual sig:", signature);

        if (signature !== expectedSignature) {
            console.log("[DEBUG] verifyQrToken - signature mismatch!");
            return { valid: false };
        }

        console.log("[DEBUG] verifyQrToken - SUCCESS");
        return { valid: true, userId };
    } catch (error) {
        console.log("[DEBUG] verifyQrToken - error:", error);
        return { valid: false };
    }
}
