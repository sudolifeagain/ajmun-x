import { jwtVerify, SignJWT } from "jose";
import { hkdfSync } from "node:crypto";

function getJwtSecret(): Uint8Array {
    // Keep explicitly configured session keys compatible with existing JWTs.
    // The default needs only the existing QR_SECRET; derive a separate JWT key
    // with a fixed application salt and purpose/version context (RFC 5869).
    const explicitSessionSecret = process.env.SESSION_SECRET;
    const secret = explicitSessionSecret || process.env.QR_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(`${explicitSessionSecret ? "SESSION_SECRET" : "QR_SECRET"} must be at least 32 characters`);
    }
    if (explicitSessionSecret) return new TextEncoder().encode(secret);
    return new Uint8Array(hkdfSync("sha256", secret, "ajmun-x", "session-jwt:v1", 32));
}

export async function createSessionToken(userId: string): Promise<string> {
    if (!/^\d{17,20}$/.test(userId)) throw new Error("Invalid Discord user ID");
    return new SignJWT({ userId })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("7d")
        .setIssuedAt()
        .setIssuer("ajmun-x")
        .setAudience("ajmun-x-web")
        .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecret(), {
            issuer: "ajmun-x",
            audience: "ajmun-x-web",
            algorithms: ["HS256"],
            maxTokenAge: "7d",
        });
        return typeof payload.userId === "string" && /^\d{17,20}$/.test(payload.userId) ? payload.userId : null;
    } catch {
        return null;
    }
}
