import { NextRequest } from "next/server";

/**
 * Extract client IP from request headers.
 * Uses the rightmost IP from x-forwarded-for (added by the trusted proxy).
 */
export function getClientIp(request: NextRequest): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const ips = xff.split(",").map((ip) => ip.trim());
        return ips[ips.length - 1] || "unknown";
    }
    return "unknown";
}
