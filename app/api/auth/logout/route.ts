import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/app/lib/session";

export async function POST(request: NextRequest) {
    // CSRF protection: validate Origin header
    const origin = request.headers.get("origin");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

    if (baseUrl && origin) {
        const expectedOrigin = new URL(baseUrl).origin;
        if (origin !== expectedOrigin) {
            return NextResponse.json(
                { error: "Invalid origin" },
                { status: 403 }
            );
        }
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
