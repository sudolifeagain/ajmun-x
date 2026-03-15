/**
 * QR Token Generation and Validation
 *
 * Shared utility for generating and validating QR tokens.
 * Used by both the OAuth callback and the bot service.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * Generate a signed QR token for a user
 * Format: base64url(payload).signature32
 * Payload: userId:timestamp:randomPart
 */
export function generateQrToken(userId: string): string {
    const secret = process.env.QR_SECRET;
    if (!secret) {
        throw new Error("QR_SECRET environment variable is required");
    }
    const timestamp = Date.now().toString();
    const randomPart = randomBytes(16).toString("hex");
    const payload = `${userId}:${timestamp}:${randomPart}`;
    const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("hex")
        .slice(0, 32);
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Check if a token is a valid format (not a placeholder token)
 * Placeholder tokens start with "bot-sync-" and lack a signature
 */
export function isValidQrTokenFormat(token: string): boolean {
    return token.includes(".") && !token.startsWith("bot-sync-");
}

/** Maximum QR token age in milliseconds (30 days) */
const QR_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Verify a QR token's signature and expiry
 */
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
