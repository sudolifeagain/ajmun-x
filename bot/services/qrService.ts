/**
 * QR Code Service
 *
 * Provides QR code generation and DM sending functionality for the Discord bot.
 */

import { AttachmentBuilder, Client, User } from "discord.js";
import QRCode from "qrcode";
import { prisma } from "../utils";
import { generateQrToken, isValidQrTokenFormat } from "../../app/lib/qrToken";

// Rate limiting configuration
const RATE_LIMIT = {
    batchSize: 10,      // Number of DMs to send per batch
    delayMs: 1100,      // Delay between batches (slightly over 1s to be safe)
};

export interface SendResult {
    success: boolean;
    userId: string;
    error?: string;
}

export interface BatchResult {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    failedUsers: Array<{ userId: string; error: string }>;
}

/**
 * Generate QR code as PNG buffer
 */
export async function generateQRCodeBuffer(token: string): Promise<Buffer> {
    return QRCode.toBuffer(token, {
        width: 512,
        margin: 2,
        color: {
            dark: "#1e1b4b",
            light: "#ffffff",
        },
        errorCorrectionLevel: "M",
    });
}

/**
 * Ensure user has a valid QR token (not a placeholder)
 * If placeholder, generate a proper token and update DB
 * Returns the valid token
 */
export async function ensureValidQrToken(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
        where: { discordUserId: userId },
    });

    if (!user) {
        return null;
    }

    // If token is already valid, return it
    if (isValidQrTokenFormat(user.qrToken)) {
        return user.qrToken;
    }

    // Generate new valid token
    const newToken = generateQrToken(userId);

    // Update DB
    await prisma.user.update({
        where: { discordUserId: userId },
        data: { qrToken: newToken },
    });

    return newToken;
}

/**
 * Send QR code DM to a single user
 */
export async function sendQRCodeDM(
    userId: string,
    client: Client
): Promise<SendResult> {
    try {
        // Get valid QR token (generate if needed)
        const token = await ensureValidQrToken(userId);
        if (!token) {
            return { success: false, userId, error: "User not found in database" };
        }

        // Get user from Discord
        let discordUser: User;
        try {
            discordUser = await client.users.fetch(userId);
        } catch {
            return { success: false, userId, error: "Could not fetch Discord user" };
        }

        // Generate QR code image
        const qrBuffer = await generateQRCodeBuffer(token);
        const attachment = new AttachmentBuilder(qrBuffer, {
            name: "ticket-qrcode.png",
        });

        // Get user info for personalization
        const dbUser = await prisma.user.findUnique({
            where: { discordUserId: userId },
            include: {
                guildMemberships: {
                    include: { guild: true },
                    where: { guild: { isTargetGuild: true } },
                    take: 1,
                },
            },
        });

        const displayName = dbUser?.globalName || discordUser.username;
        const guildName = dbUser?.guildMemberships[0]?.guild.guildName || "";

        // Send DM
        try {
            await discordUser.send({
                content: [
                    `🎫 **入場チケット**`,
                    ``,
                    `${displayName} さん`,
                    guildName ? `会議: ${guildName}` : "",
                    ``,
                    `下の QR コードを受付でスキャンしてください。`,
                    `スクリーンショットを撮っておくと便利です！`,
                    ``,
                    `⚠️ **ご注意**`,
                    `このDMは送信専用です。返信には対応できません。`,
                    `ご質問等はサーバー内で事務局（@事務局員 等）へメンションにてお願いします。`,
                ].filter(Boolean).join("\n"),
                files: [attachment],
            });
        } catch (dmError) {
            const error = dmError as { code?: number; message?: string };
            if (error.code === 50007) {
                return { success: false, userId, error: "Cannot send DM to this user (DM disabled)" };
            }
            return { success: false, userId, error: error.message || "Failed to send DM" };
        }

        return { success: true, userId };
    } catch (error) {
        const err = error as Error;
        return { success: false, userId, error: err.message };
    }
}

/**
 * Record DM send attempt to database
 */
async function recordDmSendLog(
    userId: string,
    status: "pending" | "sent" | "failed",
    errorMessage?: string
): Promise<void> {
    if (status === "pending") {
        await prisma.dmSendLog.create({
            data: {
                discordUserId: userId,
                sendType: "qrcode",
                status: "pending",
            },
        });
    } else {
        // Update existing pending log or create new one
        const existingLog = await prisma.dmSendLog.findFirst({
            where: {
                discordUserId: userId,
                sendType: "qrcode",
                status: "pending",
            },
            orderBy: { createdAt: "desc" },
        });

        if (existingLog) {
            await prisma.dmSendLog.update({
                where: { id: existingLog.id },
                data: {
                    status,
                    errorMessage,
                    sentAt: status === "sent" ? new Date() : null,
                },
            });
        } else {
            await prisma.dmSendLog.create({
                data: {
                    discordUserId: userId,
                    sendType: "qrcode",
                    status,
                    errorMessage,
                    sentAt: status === "sent" ? new Date() : null,
                },
            });
        }
    }
}

/**
 * Get target users based on filter criteria
 */
export async function getTargetUsers(options: {
    attribute?: "participant" | "organizer" | "staff" | "all";
    retryFailed?: boolean;
    specificUserIds?: string[];
}): Promise<string[]> {
    const { attribute, retryFailed, specificUserIds } = options;

    // Test mode: return specific user IDs
    if (specificUserIds && specificUserIds.length > 0) {
        return specificUserIds;
    }

    // Retry failed mode
    if (retryFailed) {
        const failedLogs = await prisma.dmSendLog.findMany({
            where: {
                sendType: "qrcode",
                status: "failed",
            },
            select: { discordUserId: true },
            distinct: ["discordUserId"],
        });
        return failedLogs.map((log) => log.discordUserId);
    }

    // Filter by attribute
    const whereClause: { primaryAttribute?: string } = {};
    if (attribute && attribute !== "all") {
        whereClause.primaryAttribute = attribute;
    }

    const users = await prisma.user.findMany({
        where: whereClause,
        select: { discordUserId: true },
    });

    return users.map((u) => u.discordUserId);
}

/**
 * Send QR codes to multiple users with rate limiting
 */
export async function sendQRCodesToUsers(
    userIds: string[],
    client: Client,
    progressCallback?: (current: number, total: number, result: SendResult) => void
): Promise<BatchResult> {
    const result: BatchResult = {
        total: userIds.length,
        sent: 0,
        failed: 0,
        skipped: 0,
        failedUsers: [],
    };

    // Deduplicate user IDs
    const uniqueUserIds = [...new Set(userIds)];
    result.total = uniqueUserIds.length;

    for (let i = 0; i < uniqueUserIds.length; i += RATE_LIMIT.batchSize) {
        const batch = uniqueUserIds.slice(i, i + RATE_LIMIT.batchSize);

        for (const userId of batch) {
            // Record pending status
            await recordDmSendLog(userId, "pending");

            // Send DM
            const sendResult = await sendQRCodeDM(userId, client);

            if (sendResult.success) {
                result.sent++;
                await recordDmSendLog(userId, "sent");
            } else {
                result.failed++;
                result.failedUsers.push({
                    userId,
                    error: sendResult.error || "Unknown error",
                });
                await recordDmSendLog(userId, "failed", sendResult.error);
            }

            // Progress callback
            if (progressCallback) {
                progressCallback(i + batch.indexOf(userId) + 1, result.total, sendResult);
            }
        }

        // Rate limit delay between batches
        if (i + RATE_LIMIT.batchSize < uniqueUserIds.length) {
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT.delayMs));
        }
    }

    return result;
}

/**
 * Get DM send status summary
 */
export async function getDmSendStatus(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
}> {
    const [sentCount, failedCount, pendingCount] = await Promise.all([
        prisma.dmSendLog.count({ where: { sendType: "qrcode", status: "sent" } }),
        prisma.dmSendLog.count({ where: { sendType: "qrcode", status: "failed" } }),
        prisma.dmSendLog.count({ where: { sendType: "qrcode", status: "pending" } }),
    ]);

    return {
        total: sentCount + failedCount + pendingCount,
        sent: sentCount,
        failed: failedCount,
        pending: pendingCount,
    };
}
