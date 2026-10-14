export const OAUTH_STATE_COOKIE_NAME = "__Host-discord_oauth_state";
export const OAUTH_STATE_COOKIE_OPTIONS = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: 60 * 10,
};
