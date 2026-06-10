import { NextRequest, NextResponse } from "next/server";

// Must match SESSION_COOKIE_NAME in app/lib/session.ts (set by PR security/auth-session-hardening)
const SESSION_COOKIE_NAME = "__Host-session";

/**
 * Build the Content-Security-Policy header value for a given nonce.
 *
 * script-src uses a per-request nonce plus 'strict-dynamic' so that Next.js's
 * own inline bootstrap/hydration scripts execute (they carry the matching
 * nonce), while any attacker-injected inline script is still blocked. This
 * replaces the previous `script-src 'self'`, which blocked Next.js's inline
 * scripts entirely and broke client-side hydration.
 *
 * In development React relies on `eval` for richer error overlays, so
 * 'unsafe-eval' is required there only (never in production).
 *
 * style-src intentionally keeps 'unsafe-inline': Next.js/next-font and
 * Tailwind emit inline styles that are not all nonce-tagged, and inline
 * styles are not an XSS execution vector the way scripts are.
 */
function buildCsp(nonce: string, isDev: boolean): string {
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https://cdn.discordapp.com data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
    ].join("; ");
}

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    const isDev = process.env.NODE_ENV === "development";

    // A fresh, unpredictable nonce per request. Next.js reads it back from the
    // Content-Security-Policy request header during SSR and applies it to the
    // scripts it generates.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const cspHeader = buildCsp(nonce, isDev);

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

    // Propagate the nonce (and the CSP it lives in) to the request so Next.js
    // can stamp the nonce onto its framework/inline scripts during rendering,
    // then mirror the same CSP onto the response.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", cspHeader);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", cspHeader);

    return response;
}

export const config = {
    matcher: [
        // Run on everything except static assets. Skip prefetch requests so a
        // per-request nonce is never baked into a cached prefetch payload
        // (recommended by the Next.js CSP guide).
        {
            source: "/((?!_next/static|_next/image|favicon.ico).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
