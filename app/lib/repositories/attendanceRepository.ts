/**
 * AttendanceLog Repository
 *
 * Centralizes all CRUD operations for attendance logs.
 * Provides a consistent interface for check-in operations across the application.
 */

import prisma from "../prisma";
import { getTodayJST } from "../date";

// ============================================================================
// Types
// ============================================================================

export type CheckInMethod = "scan" | "manual";

export interface CheckInResult {
    success: boolean;
    isNewCheckIn: boolean;
    existingMethod?: CheckInMethod;
}

export interface AttendanceFilter {
    date?: string;
    attribute?: string;
    guildIds?: string[];
}

export interface AttendanceSummary {
    present: number;
    absent: number;
    total: number;
}

export interface AttendanceLogWithUser {
    discordUserId: string;
    checkInDate: string;
    checkInTimestamp: Date;
    checkInMethod: string;
    attribute: string;
    primaryGuildId: string | null;
    user: {
        globalName: string | null;
        discordUserId: string;
        guildMemberships: Array<{
            guildId: string;
            nickname: string | null;
        }>;
    };
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Find existing attendance log for a user on a specific date
 */
export async function findAttendanceLog(
    userId: string,
    date?: string
): Promise<{ exists: boolean; method?: CheckInMethod }> {
    const checkDate = date || getTodayJST();

    const log = await prisma.attendanceLog.findUnique({
        where: {
            discordUserId_checkInDate: {
                discordUserId: userId,
                checkInDate: checkDate,
            },
        },
    });

    if (!log) {
        return { exists: false };
    }

    return {
        exists: true,
        method: ((log as any).checkInMethod || "scan") as CheckInMethod,
    };
}

/**
 * Count attendance for a specific date with optional filters
 */
export async function countAttendance(
    filter: AttendanceFilter = {}
): Promise<number> {
    const { date = getTodayJST(), attribute, guildIds } = filter;

    return prisma.attendanceLog.count({
        where: {
            checkInDate: date,
            ...(attribute && { attribute }),
            ...(guildIds && { primaryGuildId: { in: guildIds } }),
        },
    });
}

/**
 * Get attendance summary (present/absent/total) for a date
 */
export async function getAttendanceSummary(
    filter: AttendanceFilter = {}
): Promise<AttendanceSummary> {
    const { date = getTodayJST(), attribute, guildIds } = filter;

    const presentCount = await countAttendance(filter);

    // Count total users matching the filter
    const totalUsers = guildIds
        ? await prisma.userGuildMembership.count({
            where: {
                guildId: { in: guildIds },
                ...(attribute && { user: { primaryAttribute: attribute } }),
            },
        })
        : await prisma.user.count(
            attribute ? { where: { primaryAttribute: attribute } } : undefined
        );

    return {
        present: presentCount,
        absent: totalUsers - presentCount,
        total: totalUsers,
    };
}

/**
 * Get list of present users for a date
 */
export async function getPresentUsers(
    filter: AttendanceFilter = {}
): Promise<AttendanceLogWithUser[]> {
    const { date = getTodayJST(), attribute, guildIds } = filter;

    const logs = await prisma.attendanceLog.findMany({
        where: {
            checkInDate: date,
            ...(attribute && { attribute }),
            ...(guildIds && { primaryGuildId: { in: guildIds } }),
        },
        include: {
            user: { include: { guildMemberships: true } },
        },
    });

    return logs.map((log) => ({
        discordUserId: log.discordUserId,
        checkInDate: log.checkInDate,
        checkInTimestamp: log.checkInTimestamp,
        checkInMethod: (log as any).checkInMethod || "scan",
        attribute: log.attribute,
        primaryGuildId: log.primaryGuildId,
        user: {
            globalName: log.user.globalName,
            discordUserId: log.user.discordUserId,
            guildMemberships: log.user.guildMemberships.map((m) => ({
                guildId: m.guildId,
                nickname: m.nickname,
            })),
        },
    }));
}

/**
 * Get list of absent user IDs for a date
 */
export async function getAbsentUserIds(
    filter: AttendanceFilter = {}
): Promise<string[]> {
    const { date = getTodayJST() } = filter;

    const presentUserIds = (
        await prisma.attendanceLog.findMany({
            where: { checkInDate: date },
            select: { discordUserId: true },
        })
    ).map((log) => log.discordUserId);

    return presentUserIds;
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Check in a user (create attendance log)
 * Returns success status and whether this is a new check-in
 */
export async function checkInUser(
    userId: string,
    guildId: string | null,
    attribute: string,
    method: CheckInMethod = "scan"
): Promise<CheckInResult> {
    const today = getTodayJST();

    // Check for existing log
    const existing = await findAttendanceLog(userId, today);
    if (existing.exists) {
        return {
            success: false,
            isNewCheckIn: false,
            existingMethod: existing.method,
        };
    }

    // Create new attendance log
    await prisma.attendanceLog.create({
        data: {
            discordUserId: userId,
            primaryGuildId: guildId,
            attribute,
            checkInDate: today,
            checkInMethod: method,
        } as any, // Type assertion for checkInMethod until prisma regenerated
    });

    return {
        success: true,
        isNewCheckIn: true,
    };
}

// ============================================================================
// Aggregation Operations
// ============================================================================

/**
 * Get attendance logs grouped by date for export
 */
export async function getAttendanceByDateRange(
    startDate: string,
    endDate: string
): Promise<Map<string, Map<string, { timestamp: Date | null; method: string }>>> {
    const logs = await prisma.attendanceLog.findMany({
        where: {
            checkInDate: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { checkInDate: "asc" },
    });

    const attendanceMap = new Map<string, Map<string, { timestamp: Date | null; method: string }>>();

    for (const log of logs) {
        if (!attendanceMap.has(log.discordUserId)) {
            attendanceMap.set(log.discordUserId, new Map());
        }
        attendanceMap.get(log.discordUserId)!.set(log.checkInDate, {
            timestamp: log.checkInTimestamp,
            method: (log as any).checkInMethod || "scan",
        });
    }

    return attendanceMap;
}
