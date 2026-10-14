import { NextRequest, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_COOKIE_OPTIONS } from "@/app/lib/oauth";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/app/lib/rateLimit";
import { getClientIp } from "@/app/lib/clientIp";

export async function GET(request: NextRequest) {
    const limit = checkRateLimit(`auth-start:${getClientIp(request)}`, RATE_LIMITS.AUTH_API);
    if (!limit.allowed) {
        return NextResponse.json({ error: "Rate limit exceeded" }, {
            status: 429, headers: getRateLimitHeaders(limit, RATE_LIMITS.AUTH_API),
        });
    }
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const mode = request.nextUrl.searchParams.get("mode");

    if (!clientId || !redirectUri) {
        return NextResponse.json({ error: "Missing Discord configuration" }, { status: 500 });
    }

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify",
        state: state,
    });

    const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

    if (mode === "url") {
        const response = NextResponse.json({ url });

        // Store state in cookie for CSRF protection
        // Note: For JSON response we still need to set the cookie on the response
        response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, OAUTH_STATE_COOKIE_OPTIONS);

        return response;
    }

    const response = NextResponse.redirect(url);

    // Store state in cookie for CSRF protection
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, state, OAUTH_STATE_COOKIE_OPTIONS);

    return response;
}
