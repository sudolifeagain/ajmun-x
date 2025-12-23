import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
        scope: "identify guilds", // Request guilds scope as well if needed, though previously it was just identify. Let's stick to what was there or what's needed.
        // Wait, looking at previous code, it was scope: "identify".
        // The requirements said: "識別情報のみを取得します（サーバー一覧は取得しません）。"
        // So I should keep it as "identify".
        state: state,
    });

    // Ensure scope is correct based on original file.
    // Original file had: scope: "identify".
    // I will write it explicitly below.
    params.set("scope", "identify");

    const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;

    if (mode === "url") {
        const response = NextResponse.json({ url });

        // Store state in cookie for CSRF protection
        // Note: For JSON response we still need to set the cookie on the response
        response.cookies.set("discord_oauth_state", state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 10, // 10 minutes
        });

        return response;
    }

    const response = NextResponse.redirect(url);

    // Store state in cookie for CSRF protection
    response.cookies.set("discord_oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
    });

    return response;
}
