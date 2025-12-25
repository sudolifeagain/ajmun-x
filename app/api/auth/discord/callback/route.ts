import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import prisma from "@/app/lib/prisma";
import logger from "@/app/lib/discordLogger";

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
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    // CSRF check
    if (!state || state !== storedState) {
        await logger.warn("ログイン失敗（CSRF検証エラー）", {
            source: "Web (OAuth)",
            details: `IP: ${clientIp}, state不一致またはstate欠落`,
        });
        return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    if (!code) {
        await logger.warn("ログイン失敗（認可コード欠落）", {
            source: "Web (OAuth)",
            details: `IP: ${clientIp}`,
        });
        return NextResponse.redirect(new URL("/?error=no_code", request.url));
    }

    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        await logger.error("ログイン失敗（サーバー設定エラー）", {
            source: "Web (OAuth)",
            details: "Discord認証情報が設定されていません",
        });
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
        const displayName = discordUser.global_name || discordUser.username;

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

        // REJECT if not a member of any target guild
        if (!membership) {
            await logger.warn("ログイン拒否（サーバー未参加）", {
                discordUser: { id: discordUser.id, name: displayName },
                source: "Web (OAuth)",
                details: "対象サーバーに未参加のためアクセス拒否",
            });
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0];
            return NextResponse.redirect(new URL("/?error=access_denied", baseUrl));
        }

        // Determine primary attribute based on ALL guild memberships
        let primaryAttribute = "participant";

        // Fetch all memberships for this user
        const allMemberships = await prisma.userGuildMembership.findMany({
            where: { discordUserId: discordUser.id },
        });

        // Check for staff roles across all guilds
        const staffConfig = await prisma.systemConfig.findUnique({
            where: { key: "staff_role_ids" },
        });

        if (staffConfig && allMemberships.length > 0) {
            const staffRoleIds = staffConfig.value.split(",").map((id) => id.trim());

            for (const m of allMemberships) {
                const userRoles: string[] = JSON.parse(m.roleIds || "[]");
                if (userRoles.some((roleId) => staffRoleIds.includes(roleId))) {
                    primaryAttribute = "staff";
                    break;
                }
            }
        }

        // Create or update user in database
        let user = await prisma.user.findUnique({
            where: { discordUserId: discordUser.id },
        });

        const isNewUser = !user;

        if (!user) {
            user = await prisma.user.create({
                data: {
                    discordUserId: discordUser.id,
                    qrToken: generateQrToken(discordUser.id),
                    globalName: displayName,
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
                    globalName: displayName,
                    defaultAvatarUrl: avatarUrl,
                    primaryAttribute: primaryAttribute,
                    ...(needsNewToken && { qrToken: generateQrToken(discordUser.id) }),
                },
            });
        }

        // Log successful login
        await logger.info(isNewUser ? "新規ログイン（QR発行）" : "ログイン成功", {
            discordUser: { id: discordUser.id, name: displayName },
            source: "Web (OAuth)",
            details: `属性: ${primaryAttribute}, サーバー: ${membership.guild.guildName}`,
        });

        // Create session cookie (JWT signed)
        const { createSessionToken } = await import("@/app/lib/session");
        const sessionToken = await createSessionToken(discordUser.id);

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0];
        const redirectUrl = new URL("/ticket", baseUrl).toString();

        // Use HTML response with meta refresh to ensure cookie is set before redirect
        // This works around browser issues with cookies on 307 redirects
        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="refresh" content="0;url=${redirectUrl}">
    <script>window.location.href="${redirectUrl}";</script>
</head>
<body>
    <p>Redirecting...</p>
</body>
</html>`;

        const response = new NextResponse(html, {
            status: 200,
            headers: {
                "Content-Type": "text/html",
            },
        });

        // Set cookie
        const cookieValue = `session=${sessionToken}; Path=/; Max-Age=604800; HttpOnly; Secure; SameSite=Lax`;
        response.headers.append("Set-Cookie", cookieValue);

        // Delete oauth state cookie
        response.headers.append("Set-Cookie", "discord_oauth_state=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");

        return response;
    } catch (error) {
        console.error("OAuth callback error:", error);
        await logger.error("ログインエラー", {
            source: "Web (OAuth)",
            error,
        });
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.url.split('/api')[0];
        return NextResponse.redirect(new URL("/?error=unknown", baseUrl));
    }
}
