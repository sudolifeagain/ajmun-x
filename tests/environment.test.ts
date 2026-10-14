import assert from "node:assert/strict";
import test from "node:test";
import { environmentErrors } from "../scripts/validate-environment.mjs";

test("Production preflight needs one signing secret and validates optional legacy overrides", () => {
    const env = {
        QR_SECRET: "qr-test-only-".repeat(4),
        DISCORD_CLIENT_ID: "123456789012345678", DISCORD_CLIENT_SECRET: "test",
        DISCORD_BOT_TOKEN: "test", EXPORT_API_KEY: "test", DATABASE_URL: "file:/app/data/test.db",
        NEXT_PUBLIC_BASE_URL: "https://app.example", DISCORD_REDIRECT_URI: "https://app.example/api/auth/discord/callback",
    };
    assert.deepEqual(environmentErrors(env), []);
    assert.deepEqual(environmentErrors({ ...env, SESSION_SECRET: "" }), []);
    assert.equal(environmentErrors({ ...env, QR_SECRET: "" }).some(error => error.startsWith("QR_SECRET")), true);
    assert.equal(environmentErrors({ ...env, SESSION_SECRET: "short" }).some(error => error.startsWith("SESSION_SECRET")), true);
    assert.equal(environmentErrors({ ...env, SESSION_SECRET: env.QR_SECRET }).some(error => error.includes("must be different")), true);
    assert.equal(environmentErrors({ ...env, NEXT_PUBLIC_BASE_URL: "http://app.example" }).some(error => error.includes("HTTPS")), true);
});
