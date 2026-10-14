import { jwtVerify, SignJWT } from "jose";

function getJwtSecret(): Uint8Array {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("SESSION_SECRET must be at least 32 characters");
    }
    return new TextEncoder().encode(secret);
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
