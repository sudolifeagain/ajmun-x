/**
 * QR Token Generation and Validation
 *
 * Shared utility for generating and validating QR tokens.
 * Used by both the OAuth callback and the bot service.
 */

import { createHash, randomBytes } from "crypto";

/**
 * Generate a signed QR token for a user
 * Format: base64url(payload).signature16
 * Payload: userId:timestamp:randomPart
 */
export function generateQrToken(userId: string): string {
    const secret = process.env.QR_SECRET || "default-secret-change-me";
    const timestamp = Date.now().toString();
    const randomPart = randomBytes(16).toString("hex");
    const payload = `${userId}:${timestamp}:${randomPart}`;
    const signature = createHash("sha256")
        .update(`${payload}:${secret}`)
        .digest("hex")
        .slice(0, 16);
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

/**
 * Check if a token is a valid format (not a placeholder token)
 * Placeholder tokens start with "bot-sync-" and lack a signature
 */
export function isValidQrTokenFormat(token: string): boolean {
    return token.includes(".") && !token.startsWith("bot-sync-");
}
