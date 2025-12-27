import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { verifyQrToken } from "@/app/lib/session";
import logger from "@/app/lib/discordLogger";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/app/lib/rateLimit";
import { getTodayJST } from "@/app/lib/date";
import { findAttendanceLog, checkInUser } from "@/app/lib/repositories/attendanceRepository";
import { resolvePrimaryGuild, type GuildMembershipInfo } from "@/lib/shared/guildResolver";

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
    // Rate limiting by IP
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateLimitResult = checkRateLimit(`scan:${ip}`, RATE_LIMITS.SCAN_API);

    if (!rateLimitResult.allowed) {
        const headers = getRateLimitHeaders(rateLimitResult, RATE_LIMITS.SCAN_API);
        return NextResponse.json(
            { status: "error", message: "Rate limit exceeded" },
            { status: 429, headers }
        );
    }

    try {
        const body: ScanRequest = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { status: "error", message: "Token is required" },
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
                    where: {
                        guild: {
                            isTargetGuild: true,
                        },
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

        const displayName = user.globalName || userId;

        // Get today's date in JST
        const today = getTodayJST();

        // Check for existing attendance log today
        const { exists: alreadyCheckedIn, method: existingMethod } = await findAttendanceLog(userId, today);

        // Determine primary guild based on user's attribute
        const memberships = user.guildMemberships;
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
