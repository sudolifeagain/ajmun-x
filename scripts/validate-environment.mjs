import { fileURLToPath } from "node:url";

/** @param {Record<string, string | undefined>} env */
export function environmentErrors(env = process.env) {
    const errors = [];
    if (!env.QR_SECRET || env.QR_SECRET.length < 32) errors.push("QR_SECRET must contain at least 32 characters");
    if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) errors.push("SESSION_SECRET must contain at least 32 characters when configured");
    if (env.SESSION_SECRET && env.SESSION_SECRET === env.QR_SECRET) errors.push("SESSION_SECRET and QR_SECRET must be different");
    for (const name of ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_BOT_TOKEN", "EXPORT_API_KEY", "DATABASE_URL"]) {
        if (!env[name]) errors.push(`${name} is required`);
    }
    for (const name of ["NEXT_PUBLIC_BASE_URL", "DISCORD_REDIRECT_URI"]) {
        try {
            if (new URL(env[name]).protocol !== "https:") errors.push(`${name} must use HTTPS in production`);
        } catch {
            errors.push(`${name} must be a valid HTTPS URL`);
        }
    }
    return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const errors = environmentErrors();
    if (errors.length) {
        console.error("Invalid production configuration:\n" + errors.join("\n"));
        process.exitCode = 1;
    }
}
