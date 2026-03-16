import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
    const session = request.cookies.get("session");
    const { pathname } = request.nextUrl;

    // Protected web pages: redirect to login
    if (pathname.startsWith("/staff") || pathname.startsWith("/ticket")) {
        if (!session?.value) {
            return NextResponse.redirect(new URL("/", request.url));
        }
    }

    // Protected API: return 401
    if (pathname.startsWith("/api/scan")) {
        if (!session?.value) {
            return NextResponse.json(
                { status: "error", message: "Unauthorized" },
                { status: 401 }
            );
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/staff/:path*", "/ticket/:path*", "/api/scan/:path*"],
};
