import { NextRequest } from "next/server";

/**
 * Extract client IP from request headers.
 * Uses the rightmost IP from x-forwarded-for (added by the trusted proxy).
 *
 * This assumes a single reverse proxy (e.g., Nginx, Cloudflare) in front of the app.
 * In multi-proxy setups, the rightmost IP may be an intermediate proxy rather than the client.
 * Adjust the index if your deployment uses multiple trusted proxies.
 */
export function getClientIp(request: NextRequest): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const ips = xff.split(",").map((ip) => ip.trim());
        return ips[ips.length - 1] || "unknown";
    }
    return "unknown";
}
