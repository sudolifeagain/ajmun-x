import assert from "node:assert/strict";
import test from "node:test";
import { environmentErrors } from "../scripts/validate-environment.mjs";

test("Production preflight rejects missing/weak/shared signing keys and non-HTTPS redirects", () => {
    const env = {
        SESSION_SECRET: "session-test-only-".repeat(3), QR_SECRET: "qr-test-only-".repeat(4),
        DISCORD_CLIENT_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "test",
        DISCORD_BOT_TOKEN: "test", EXPORT_API_KEY: "test", DATABASE_URL: "file:/app/data/test.db",
        NEXT_PUBLIC_BASE_URL: "https://app.example", DISCORD_REDIRECT_URI: "https://app.example/api/auth/discord/callback",
    };
    assert.deepEqual(environmentErrors(env), []);
    assert.equal(environmentErrors({ ...env, SESSION_SECRET: "" }).some(error => error.startsWith("SESSION_SECRET")), true);
    assert.equal(environmentErrors({ ...env, SESSION_SECRET: env.QR_SECRET }).some(error => error.includes("must be different")), true);
    assert.equal(environmentErrors({ ...env, NEXT_PUBLIC_BASE_URL: "http://app.example" }).some(error => error.includes("HTTPS")), true);
});
