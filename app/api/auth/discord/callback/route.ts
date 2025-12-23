import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import prisma from "@/app/lib/prisma";

interface DiscordUser {
    id: string;
    username: string;
    global_name: string | null;
    avatar: string | null;
}

function generateQrToken(userId: string): string {
    const secret = process.env.QR_SECRET || "default-secret-change-me";
    const timestamp = Date.now().toString();
    const randomPart = randomBytes(16).toString("hex");
    const payload = `${userId}:${timestamp}:${randomPart}`;
    const signature = createHash("sha256")
        .update(`${payload}:${secret}`)
        .digest("hex")
        .slice(0, 16);
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const storedState = request.cookies.get("discord_oauth_state")?.value;

    // CSRF check
    if (!state || state !== storedState) {
        return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    if (!code) {
        return NextResponse.redirect(new URL("/?error=no_code", request.url));
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        return NextResponse.redirect(new URL("/?error=config", request.url));
    }

    try {
        // Exchange code for access token
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            console.error("Token exchange failed:", await tokenResponse.text());
            return NextResponse.redirect(new URL("/?error=token_failed", request.url));
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Fetch user info
        const userResponse = await fetch("https://discord.com/api/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userResponse.ok) {
            return NextResponse.redirect(new URL("/?error=user_failed", request.url));
        }

        const discordUser: DiscordUser = await userResponse.json();

        // Build avatar URL
        const avatarUrl = discordUser.avatar
            ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.id) % 5}.png`;

        // Check if user exists in any target guild (pre-synced by bot)
        const membership = await prisma.userGuildMembership.findFirst({
            where: {
                discordUserId: discordUser.id,
                guild: {
                    isTargetGuild: true,
                },
            },
            include: {
                guild: true,
            },
        });

        // Determine primary attribute based on pre-synced data
        let primaryAttribute = "participant";
        if (membership) {
            // Check for admin/staff roles if configured
            const staffConfig = await prisma.systemConfig.findUnique({
                where: { key: "staff_role_ids" },
            });
            if (staffConfig) {
                const staffRoleIds = staffConfig.value.split(",").map((id) => id.trim());
                const userRoles = JSON.parse(membership.roleIds || "[]");
                if (userRoles.some((roleId: string) => staffRoleIds.includes(roleId))) {
                    primaryAttribute = "staff";
                }
            }
        }

        // Create or update user in database
        let user = await prisma.user.findUnique({
            where: { discordUserId: discordUser.id },
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    discordUserId: discordUser.id,
                    qrToken: generateQrToken(discordUser.id),
                    globalName: discordUser.global_name || discordUser.username,
                    defaultAvatarUrl: avatarUrl,
                    primaryAttribute: primaryAttribute,
                },
            });
        } else {
            // Regenerate qrToken if it's in the old bot-sync format
            const needsNewToken = user.qrToken.startsWith("bot-sync-") || !user.qrToken.includes(".");

            user = await prisma.user.update({
                where: { discordUserId: discordUser.id },
                data: {
                    globalName: discordUser.global_name || discordUser.username,
                    defaultAvatarUrl: avatarUrl,
                    primaryAttribute: primaryAttribute,
                    ...(needsNewToken && { qrToken: generateQrToken(discordUser.id) }),
                },
            });
        }

        // Create session cookie
        const sessionToken = Buffer.from(
            JSON.stringify({
                userId: discordUser.id,
                exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            })
        ).toString("base64url");

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0];
        const response = NextResponse.redirect(new URL("/ticket", baseUrl));

        response.cookies.set("session", sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60, // 7 days
        });

        response.cookies.delete("discord_oauth_state");

        return response;
    } catch (error) {
        console.error("OAuth callback error:", error);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0];
        return NextResponse.redirect(new URL("/?error=unknown", baseUrl));
    }
}
