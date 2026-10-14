import { NextRequest } from "next/server";
import { isIP } from "node:net";

/**
 * Extract client IP from request headers.
 * Uses the rightmost IP from x-forwarded-for (added by the trusted proxy).
 *
 * The AOP-protected nginx vhost overwrites these headers with Cloudflare's
 * authoritative CF-Connecting-IP. Never expose the application port publicly.
 */
export function getClientIp(request: NextRequest): string {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
        const ips = xff.split(",").map((ip) => ip.trim());
        const ip = ips[ips.length - 1];
        return isIP(ip || "") ? ip : "unknown";
    }
    // Fallback for proxies that set x-real-ip instead of x-forwarded-for.
    // Without either header all clients share the "unknown" rate-limit bucket,
    // so the proxy MUST be configured to set one of them in production.
    const ip = request.headers.get("x-real-ip") || "";
    return isIP(ip) ? ip : "unknown";
}
