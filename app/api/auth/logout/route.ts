import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/app/lib/session";
import { isSameOrigin } from "@/app/lib/requestSecurity";

export async function POST(request: NextRequest) {
    // CSRF protection: validate Origin header
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const response = NextResponse.redirect(
        new URL("/", baseUrl || "http://localhost:3000"),
        { status: 303 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        secure: true,
        sameSite: "lax",
    });

    return response;
}
