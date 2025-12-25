import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/app/lib/rateLimit";

/**
 * Attendance Export API for Google Sheets integration
 * 
 * Authentication:
 *   - Authorization: Bearer <API_KEY> (recommended)
 *   - Or apiKey query param (deprecated, for backward compatibility)
 * 
 * Query params:
 *   - date: YYYY-MM-DD (default: today) - for single day mode
 *   - dates: comma-separated dates (e.g., "2025-12-27,2025-12-28,2025-12-29,2025-12-30") - for multi-day mode
 *   - guildId: specific guild ID (optional)
 * 
 * Returns:
 *   - members: all members with attendance status (includes attendanceByDate for multi-day)
 *   - guilds: list of guilds
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const singleDate = searchParams.get("date");
    const multiDates = searchParams.get("dates");
    const guildId = searchParams.get("guildId");

    // Get API key from Authorization header (preferred) or query param (deprecated)
    const authHeader = request.headers.get("Authorization");
    let apiKey: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
        apiKey = authHeader.slice(7);
    } else {
        // Fallback to query param for backward compatibility
        apiKey = searchParams.get("apiKey");
    }

    // API key authentication
    const expectedKey = process.env.EXPORT_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting by API key
    const rateLimitResult = checkRateLimit(`export:${apiKey}`, RATE_LIMITS.EXPORT_API);

    if (!rateLimitResult.allowed) {
        const headers = getRateLimitHeaders(rateLimitResult, RATE_LIMITS.EXPORT_API);
        return NextResponse.json(
            { error: "Rate limit exceeded" },
            { status: 429, headers }
        );
    }

    try {
        // Determine which dates to query
        const dates = multiDates
            ? multiDates.split(",").map(d => d.trim())
            : [singleDate || getTodayJST()];

        // Get attendance logs for all requested dates
        const attendanceLogs = await prisma.attendanceLog.findMany({
            where: {
                checkInDate: { in: dates },
                ...(guildId && { primaryGuildId: guildId }),
            },
            include: {
                user: true,
            },
        });

        // Group attendance by user and date
        const attendanceMap = new Map<string, Map<string, Date | null>>();
        for (const log of attendanceLogs) {
            if (!attendanceMap.has(log.discordUserId)) {
                attendanceMap.set(log.discordUserId, new Map());
            }
            attendanceMap.get(log.discordUserId)!.set(log.checkInDate, log.checkInTimestamp);
        }

        // Get all members with their guild memberships
        const whereClause = guildId
            ? { guildId, guild: { isTargetGuild: true } }
            : { guild: { isTargetGuild: true } };

        const memberships = await prisma.userGuildMembership.findMany({
            where: whereClause,
            include: {
                user: {
                    include: {
                        dmSendLogs: {
                            where: { sendType: "qrcode" },
                            orderBy: { createdAt: "desc" },
                            // take: 1, // Remove limit to get all logs
                        },
                    },
                },
                guild: true,
            },
        });

        // Build response data
        const members = memberships.map((m) => {
            const userAttendance = attendanceMap.get(m.discordUserId);
            const latestDmLog = m.user.dmSendLogs[0];

            // Collect all sent timestamps
            const sentTimestamps = m.user.dmSendLogs
                .filter(log => log.status === "sent" && log.sentAt)
                .map(log => log.sentAt!.toISOString());

            // Build attendance by date object
            const attendanceByDate: Record<string, { attended: boolean; checkInTimestamp: string | null }> = {};
            for (const date of dates) {
                const timestamp = userAttendance?.get(date);
                attendanceByDate[date] = {
                    attended: !!timestamp,
                    checkInTimestamp: timestamp?.toISOString() || null,
                };
            }

            // For backward compatibility: attended = true if attended on any of the dates
            const attended = dates.some(date => attendanceByDate[date].attended);

            return {
                discordUserId: m.discordUserId,
                globalName: m.user.globalName || "",
                nickname: m.nickname || "",
                guildId: m.guildId,
                guildName: m.guild.guildName,
                attribute: m.user.primaryAttribute,
                dmStatus: latestDmLog?.status || "none",
                dmSentAt: sentTimestamps.length > 0 ? sentTimestamps.join(",") : null, // Comma separated
                dmErrorMessage: latestDmLog?.errorMessage || null,
                attended,
                attendanceByDate,
                // For backward compatibility with single date mode
                checkInTimestamp: attendanceByDate[dates[0]]?.checkInTimestamp || null,
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
            dates,
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
