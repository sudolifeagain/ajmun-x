/**
 * Discord Webhook Logger for Bot
 * 
 * Sends log messages to a Discord channel via webhook.
 * If DISCORD_LOG_WEBHOOK_URL is not set, this module does nothing.
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";

interface LogContext {
    /** Discord user who triggered the action */
    discordUser?: {
        id: string;
        name: string;
    };
    /** Additional details */
    details?: string;
    /** Error object if applicable */
    error?: Error | unknown;
    /** Source of the log (e.g., "Web", "Bot") */
    source?: string;
}

const LOG_COLORS: Record<LogLevel, number> = {
    DEBUG: 0x6B7280,    // Gray
    INFO: 0x3B82F6,     // Blue
    WARN: 0xF59E0B,     // Yellow
    ERROR: 0xEF4444,    // Red
    CRITICAL: 0x1F2937, // Dark
};

const LOG_EMOJIS: Record<LogLevel, string> = {
    DEBUG: "🔍",
    INFO: "🔵",
    WARN: "⚠️",
    ERROR: "🔴",
    CRITICAL: "🚨",
};

/**
 * Get webhook URL from environment
 */
function getWebhookUrl(): string | null {
    return process.env.DISCORD_LOG_WEBHOOK_URL || null;
}

/**
 * Get mention user ID from environment
 */
function getMentionUserId(): string | null {
    return process.env.DISCORD_LOG_MENTION_USER_ID || null;
}

/**
 * Format error for display
 */
function formatError(error: unknown): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}\n${error.stack?.split("\n").slice(0, 3).join("\n") || ""}`;
    }
    return String(error);
}

/**
 * Get JST timestamp
 */
function getJSTTimestamp(): string {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + jstOffset);
    return jstDate.toISOString().replace("T", " ").slice(0, 19) + " JST";
}

/**
 * Send a log message to Discord
 */
export async function log(
    level: LogLevel,
    title: string,
    context?: LogContext
): Promise<void> {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl) {
        return;
    }

    try {
        const mentionUserId = getMentionUserId();
        const shouldMention = (level === "ERROR" || level === "CRITICAL") && mentionUserId;

        const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

        if (context?.discordUser) {
            fields.push({
                name: "👤 ユーザー",
                value: `${context.discordUser.name} (${context.discordUser.id})`,
                inline: true,
            });
        }

        if (context?.source) {
            fields.push({
                name: "🖥️ ソース",
                value: context.source,
                inline: true,
            });
        }

        if (context?.details) {
            fields.push({
                name: "📋 詳細",
                value: context.details.slice(0, 1000),
                inline: false,
            });
        }

        if (context?.error) {
            fields.push({
                name: "❌ エラー",
                value: `\`\`\`\n${formatError(context.error).slice(0, 900)}\n\`\`\``,
                inline: false,
            });
        }

        fields.push({
            name: "⏰ 時刻",
            value: getJSTTimestamp(),
            inline: true,
        });

        const embed = {
            title: `${LOG_EMOJIS[level]} ${level}: ${title}`,
            color: LOG_COLORS[level],
            fields,
            footer: {
                text: "AJMUN Entry System",
            },
        };

        const payload: { content?: string; embeds: typeof embed[]; flags: number } = {
            embeds: [embed],
            flags: 4096, // SUPPRESS_NOTIFICATIONS - Silent message
        };

        if (shouldMention) {
            payload.content = `<@${mentionUserId}>`;
        }

        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error("Failed to send Discord log:", error);
    }
}

export const logger = {
    debug: (title: string, context?: LogContext) => log("DEBUG", title, context),
    info: (title: string, context?: LogContext) => log("INFO", title, context),
    warn: (title: string, context?: LogContext) => log("WARN", title, context),
    error: (title: string, context?: LogContext) => log("ERROR", title, context),
    critical: (title: string, context?: LogContext) => log("CRITICAL", title, context),
};

export default logger;
