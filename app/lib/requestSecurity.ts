import type { NextRequest } from "next/server";

/** Cookie-authenticated writes must come from the configured application origin. */
export function isSameOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!origin || (!baseUrl && process.env.NODE_ENV === "production")) return false;
    try {
        return origin === new URL(baseUrl || request.url).origin;
    } catch {
        return false;
    }
}

export class RequestBodyError extends Error {
    constructor(message: string, public readonly status: number) {
        super(message);
    }
}

/** Bound the bytes read even when Content-Length is absent or dishonest. */
export async function readJsonBody(request: NextRequest, maxBytes = 2048): Promise<unknown> {
    const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json") {
        throw new RequestBodyError("Content-Type must be application/json", 415);
    }
    const reader = request.body?.getReader();
    if (!reader) throw new RequestBodyError("Invalid JSON body", 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            length += value.byteLength;
            if (length > maxBytes) {
                await reader.cancel();
                throw new RequestBodyError("Request body too large", 413);
            }
            chunks.push(value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
        if (error instanceof RequestBodyError) throw error;
        throw new RequestBodyError("Invalid JSON body", 400);
    } finally {
        reader.releaseLock();
    }
}
