import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getSession } from "@/app/lib/session";
import { verifyQrToken } from "@/app/lib/qrToken";
import logger from "@/app/lib/discordLogger";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/app/lib/rateLimit";
import { getTodayJST } from "@/app/lib/date";
import { findAttendanceLog, checkInUser } from "@/app/lib/repositories/attendanceRepository";
import { resolvePrimaryGuild, type GuildMembershipInfo } from "@/lib/shared/guildResolver";
import { getClientIp } from "@/app/lib/clientIp";

interface ScanRequest {
    token: string;
}

interface ScanResponse {
    status: "ok" | "duplicate" | "error";
    message: string;
    user?: {
        discordUserId: string;
        globalName: string | null;
        avatarUrl: string | null;
        attribute: string;
        guilds: Array<{
            guildId: string;
            guildName: string;
            guildIconUrl: string | null;
            defaultColor: string;
            nickname: string | null;
        }>;
    };
}

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
    // Staff authentication check
    // Note: proxy.ts provides a fast cookie-existence check (no DB call),
    // but does not verify JWT signature or staff role. This route handler
    // performs the full authorization: JWT verification + staff attribute check.
    const session = await getSession();
    if (!session || session.primaryAttribute !== "staff") {
        return NextResponse.json(
            { status: "error", message: "Unauthorized" },
            { status: 401 }
        );
    }

    // Rate limiting by IP
    const ip = getClientIp(request);
    const rateLimitResult = checkRateLimit(`scan:${ip}`, RATE_LIMITS.SCAN_API);

    if (!rateLimitResult.allowed) {
        const headers = getRateLimitHeaders(rateLimitResult, RATE_LIMITS.SCAN_API);
        return NextResponse.json(
            { status: "error", message: "Rate limit exceeded" },
            { status: 429, headers }
        );
    }

    try {
        let body: ScanRequest;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { status: "error", message: "Invalid JSON body" },
                { status: 400 }
            );
        }

        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { status: "error", message: "Token is required" },
                { status: 400 }
            );
        }

        if (typeof token !== "string" || token.length > 512) {
            return NextResponse.json(
                { status: "error", message: "Invalid token format" },
                { status: 400 }
            );
        }

        // Verify the QR token
        const verification = verifyQrToken(token);
        if (!verification.valid || !verification.userId) {
            await logger.warn("スキャンエラー（無効なトークン）", {
                source: "Web (Scan)",
                details: "トークン検証に失敗",
            });
            return NextResponse.json(
                { status: "error", message: "Invalid token" },
                { status: 403 }
            );
        }

        const userId = verification.userId;

        // Fetch user with guild memberships
        const user = await prisma.user.findUnique({
            where: { discordUserId: userId },
            include: {
                guildMemberships: {
                    include: {
                        guild: true,
                    },
                },
            },
        });

        if (!user) {
            await logger.warn("スキャンエラー（ユーザー不明）", {
                source: "Web (Scan)",
                details: `User ID: ${userId} が見つかりません`,
            });
            return NextResponse.json(
                { status: "error", message: "User not found" },
                { status: 403 }
            );
        }

        // Reject tokens that don't match the current DB token, so that
        // regenerating a user's qrToken revokes previously issued QR codes
        if (user.qrToken !== token) {
            await logger.warn("スキャンエラー（失効済みトークン）", {
                discordUser: { id: userId, name: user.globalName || userId },
                source: "Web (Scan)",
                details: "DBに保存されたトークンと一致しません（再発行により失効）",
            });
            return NextResponse.json(
                { status: "error", message: "Invalid token" },
                { status: 403 }
            );
        }

        // Require current membership in a tracked guild: users who left
        // (or were removed from) all servers keep a signed token but must not check in
        const trackedMemberships = user.guildMemberships.filter(
            (m) => m.guild.isTargetGuild || m.guild.isOperationServer
        );
        if (trackedMemberships.length === 0) {
            await logger.warn("スキャンエラー（サーバー未参加）", {
                discordUser: { id: userId, name: user.globalName || userId },
                source: "Web (Scan)",
                details: "対象サーバーに所属していないため入場拒否",
            });
            return NextResponse.json(
                { status: "error", message: "User is not a member of any target guild" },
                { status: 403 }
            );
        }

        const displayName = user.globalName || userId;

        // Get today's date in JST
        const today = getTodayJST();

        // Check for existing attendance log today
        const { exists: alreadyCheckedIn } = await findAttendanceLog(userId, today);

        // Determine primary guild based on user's attribute
        // (response payload keeps the previous behavior: target guilds only)
        const memberships = user.guildMemberships.filter((m) => m.guild.isTargetGuild);
        const attribute = user.primaryAttribute;

        // Convert to GuildMembershipInfo format
        const membershipInfos: GuildMembershipInfo[] = memberships.map((m) => ({
            guildId: m.guildId,
            guildName: m.guild.guildName,
            isTargetGuild: m.guild.isTargetGuild,
            isOperationServer: m.guild.isOperationServer,
            roleIds: m.roleIds,
        }));

        const { guildId: primaryGuildId, guildName: primaryGuildName } = await resolvePrimaryGuild(
            membershipInfos,
            attribute
        );

        // Find the matching membership for response
        const primaryGuildMembership = primaryGuildId
            ? memberships.find((m) => m.guildId === primaryGuildId)
            : memberships[0];

        // Build response user data with single guild
        const responseUser = {
            discordUserId: user.discordUserId,
            globalName: user.globalName,
            avatarUrl: user.defaultAvatarUrl,
            attribute: user.primaryAttribute,
            guilds: primaryGuildMembership ? [{
                guildId: primaryGuildMembership.guild.guildId,
                guildName: primaryGuildMembership.guild.guildName,
                guildIconUrl: primaryGuildMembership.guild.guildIconUrl,
                defaultColor: primaryGuildMembership.guild.defaultColor,
                nickname: primaryGuildMembership.nickname,
            }] : [],
        };

        if (alreadyCheckedIn) {
            // Already checked in today - log but don't send notification (it's not an error)
            await logger.debug("スキャン（本日入場済み）", {
                discordUser: { id: userId, name: displayName },
                source: "Web (Scan)",
                details: `サーバー: ${primaryGuildName}`,
            });
            return NextResponse.json({
                status: "duplicate",
                message: "本日入場済み",
                user: responseUser,
            });
        }

        // Create new attendance log using repository
        await checkInUser(userId, primaryGuildId, user.primaryAttribute, "scan");

        // Log successful scan
        await logger.info("スキャン成功（入場記録）", {
            discordUser: { id: userId, name: displayName },
            source: "Web (Scan)",
            details: `属性: ${user.primaryAttribute}, サーバー: ${primaryGuildName}`,
        });

        return NextResponse.json({
            status: "ok",
            message: "入場成功",
            user: responseUser,
        });
    } catch (error) {
        console.error("Scan error:", error);
        await logger.error("スキャンエラー（内部エラー）", {
            source: "Web (Scan)",
            error,
        });
        return NextResponse.json(
            { status: "error", message: "Internal server error" },
            { status: 500 }
        );
    }
}
