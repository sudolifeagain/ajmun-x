/**
 * QR Token Generation and Validation
 *
 * Shared utility for generating and validating QR tokens.
 * Used by both the OAuth callback and the bot service.
 */

import { createHmac, randomBytes } from "crypto";

/**
 * Generate a signed QR token for a user
 * Format: base64url(payload).signature
 * Payload: userId:timestamp:randomPart
 */
export function generateQrToken(userId: string): string {
    const secret = process.env.QR_SECRET;
    if (!secret) {
        throw new Error("QR_SECRET environment variable is required");
    }
    if (secret.length < 32) {
        throw new Error("QR_SECRET must be at least 32 characters");
    }
    const timestamp = Date.now().toString();
    const randomPart = randomBytes(16).toString("hex");
    const payload = `${userId}:${timestamp}:${randomPart}`;
    const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Check if a token is a valid format (not a placeholder token)
 * Placeholder tokens start with "bot-sync-" and lack a signature
 */
export function isValidQrTokenFormat(token: string): boolean {
    return token.includes(".") && !token.startsWith("bot-sync-");
}
