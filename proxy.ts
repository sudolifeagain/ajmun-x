import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Protected routes that require authentication
const protectedPaths = ["/ticket"];

// Get the secret key for JWT signing
function getJwtSecret(): Uint8Array {
    const secret = process.env.SESSION_SECRET || process.env.QR_SECRET;
    if (!secret) {
        throw new Error("SESSION_SECRET or QR_SECRET environment variable is required");
    }
    return new TextEncoder().encode(secret);
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the path requires authentication
    const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));

    if (!isProtectedPath) {
        return NextResponse.next();
    }

    // Get session cookie
    const sessionCookie = request.cookies.get("session");

    console.log("[MIDDLEWARE] Path:", pathname, "Cookie present:", !!sessionCookie?.value);

    if (!sessionCookie?.value) {
        console.log("[MIDDLEWARE] No session cookie, redirecting to /");
        return NextResponse.redirect(new URL("/", request.url));
    }

    const token = sessionCookie.value;

    // Try JWT verification (new format)
    if (token.includes(".") && token.startsWith("ey")) {
        try {
            await jwtVerify(token, getJwtSecret());
            console.log("[MIDDLEWARE] JWT verified, allowing access");
            return NextResponse.next();
        } catch (error) {
            console.log("[MIDDLEWARE] JWT verification failed:", error);
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    // Try legacy Base64 token
    try {
        const payload = JSON.parse(Buffer.from(token, "base64url").toString());
        if (Date.now() > payload.exp) {
            console.log("[MIDDLEWARE] Legacy token expired");
            return NextResponse.redirect(new URL("/", request.url));
        }
        console.log("[MIDDLEWARE] Legacy token valid, allowing access");
        return NextResponse.next();
    } catch {
        console.log("[MIDDLEWARE] Failed to parse token");
        return NextResponse.redirect(new URL("/", request.url));
    }
}

export const config = {
    matcher: ["/ticket/:path*"],
};
