import { NextRequest, NextResponse } from "next/server";

// Must match SESSION_COOKIE_NAME in app/lib/session.ts (set by PR security/auth-session-hardening)
const SESSION_COOKIE_NAME = "__Host-session";

export function middleware(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const { pathname } = request.nextUrl;

    const cspHeader = [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https://cdn.discordapp.com data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
    ].join("; ");

    // Auth gate for protected web pages: redirect to login
    if (pathname.startsWith("/staff") || pathname.startsWith("/ticket")) {
        const session = request.cookies.get(SESSION_COOKIE_NAME);
        if (!session?.value) {
            const response = NextResponse.redirect(new URL("/", request.url));
            response.headers.set("Content-Security-Policy", cspHeader);
            return response;
        }
    }

    // Auth gate for protected API: return 401
    if (pathname.startsWith("/api/scan")) {
        const session = request.cookies.get(SESSION_COOKIE_NAME);
        if (!session?.value) {
            return NextResponse.json(
                { status: "error", message: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
