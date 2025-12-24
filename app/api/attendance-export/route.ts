import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

/**
 * Attendance Export API for Google Sheets integration
 * 
 * Query params:
 *   - date: YYYY-MM-DD (default: today)
 *   - guildId: specific guild ID (optional)
 *   - apiKey: authentication key
 * 
 * Returns:
 *   - members: all members with attendance status
 *   - guilds: list of guilds
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const apiKey = searchParams.get("apiKey");
    const date = searchParams.get("date") || getTodayJST();
    const guildId = searchParams.get("guildId");

    // Simple API key authentication
    const expectedKey = process.env.EXPORT_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get attendance logs for the date
        const attendanceLogs = await prisma.attendanceLog.findMany({
            where: {
                checkInDate: date,
                ...(guildId && { primaryGuildId: guildId }),
            },
            include: {
                user: true,
            },
        });

        const attendedUserIds = new Set(attendanceLogs.map((log) => log.discordUserId));

        // Get all members with their guild memberships
        const whereClause = guildId
            ? { guildId, guild: { isTargetGuild: true } }
            : { guild: { isTargetGuild: true } };

        const memberships = await prisma.userGuildMembership.findMany({
            where: whereClause,
            include: {
                user: true,
                guild: true,
            },
        });

        // Build response data
        const members = memberships.map((m) => {
            const attendanceLog = attendanceLogs.find(
                (log) => log.discordUserId === m.discordUserId && log.primaryGuildId === m.guildId
            );

            return {
                discordUserId: m.discordUserId,
                globalName: m.user.globalName || "",
                nickname: m.nickname || "",
                guildId: m.guildId,
                guildName: m.guild.guildName,
                attribute: m.user.primaryAttribute,
                attended: attendedUserIds.has(m.discordUserId),
                checkInTimestamp: attendanceLog?.checkInTimestamp?.toISOString() || null,
            };
        });

        // Get unique guilds
        const guilds = await prisma.guild.findMany({
            where: { isTargetGuild: true },
            select: {
                guildId: true,
                guildName: true,
            },
        });

        return NextResponse.json({
            date,
            members,
            guilds,
            summary: {
                total: members.length,
                attended: members.filter((m) => m.attended).length,
                absent: members.filter((m) => !m.attended).length,
            },
        });
    } catch (error) {
        console.error("Export API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * Get today's date in JST (YYYY-MM-DD)
 */
function getTodayJST(): string {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return jst.toISOString().split("T")[0];
}
