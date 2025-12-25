/**
 * Simple in-memory rate limiter
 * 
 * For production with multiple instances, use Redis-based rate limiting.
 * This implementation is suitable for single-server deployments.
 */

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

// Store rate limit data by key (IP address or API key)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
}

/**
 * Check if a request is allowed under rate limiting
 * 
 * @param key - Unique identifier for the client (IP, API key, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = rateLimitStore.get(key);

    // If no entry or window expired, create a new one
    if (!entry || entry.resetTime < now) {
        entry = {
            count: 0,
            resetTime: now + windowMs,
        };
        rateLimitStore.set(key, entry);
    }

    // Increment count
    entry.count++;

    const remaining = Math.max(0, config.maxRequests - entry.count);
    const allowed = entry.count <= config.maxRequests;

    return {
        allowed,
        remaining,
        resetTime: entry.resetTime,
    };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(result: RateLimitResult, config: RateLimitConfig): Record<string, string> {
    return {
        "X-RateLimit-Limit": config.maxRequests.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": Math.ceil(result.resetTime / 1000).toString(),
    };
}

/**
 * Preset rate limit configurations
 */
export const RATE_LIMITS = {
    // For GAS sync (1 minute intervals) - allow 5 per minute for safety margin
    EXPORT_API: { maxRequests: 5, windowSeconds: 60 } as RateLimitConfig,

    // For scan API - allow 100 per minute (frequent scanning at reception)
    SCAN_API: { maxRequests: 100, windowSeconds: 60 } as RateLimitConfig,

    // For auth API - allow 10 per minute per IP
    AUTH_API: { maxRequests: 10, windowSeconds: 60 } as RateLimitConfig,

    // Default - allow 60 per minute
    DEFAULT: { maxRequests: 60, windowSeconds: 60 } as RateLimitConfig,
};
