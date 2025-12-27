import { ChatInputCommandInteraction, AutocompleteInteraction, EmbedBuilder, MessageFlags } from "discord.js";
import { prisma, getTodayJST, getAttributeLabel } from "../utils";
import { getOrganizerGuildIds } from "../services";
import logger from "../../app/lib/discordLogger";

// ============================================================================
// Constants
// ============================================================================

/** Maximum number of users to display in list commands */
const MAX_DISPLAY = 100;

/** Warning message when staff filter is ignored */
const STAFF_FILTER_WARNING = "⚠️ 会議を指定した場合、事務局員フィルタは無視されます。\n\n";

// ============================================================================
// Type Definitions
// ============================================================================

/** Result of resolving a conference name */
interface ConferenceResult {
    guildId: string | null;
    guildName: string | null;
    error?: string;
}

/** Parsed filter options from command */
interface FilterOptions {
    attribute: string | null;
    staffFilterWarning: boolean;
    guildFilter: string[] | null;
    guildName: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Resolve conference name to guild ID
 * @param conference - Conference name to search (partial match)
 * @param allowedGuildIds - Empty = all guilds, non-empty = only those guilds
 */
async function resolveConference(
    conference: string | null,
    allowedGuildIds: string[]
): Promise<ConferenceResult> {
    if (!conference || conference === "all") {
        return { guildId: null, guildName: null };
    }

    const guild = await prisma.guild.findFirst({
        where: {
            guildName: { contains: conference },
            isTargetGuild: true,
            ...(allowedGuildIds.length > 0 && { guildId: { in: allowedGuildIds } }),
        },
    });

    if (!guild) {
        return { guildId: null, guildName: null, error: `会議「${conference}」が見つかりません` };
    }

    return { guildId: guild.guildId, guildName: guild.guildName };
}

/**
 * Build filter description text for embed footer
 */
function buildFilterDescription(guildName: string | null, attribute: string | null): string | null {
    const filters: string[] = [];
    if (guildName) filters.push(`会議: ${guildName}`);
    if (attribute) filters.push(`属性: ${getAttributeLabel(attribute)}`);
    return filters.length > 0 ? `フィルタ: ${filters.join(" / ")}` : null;
}

/**
 * Parse command filter options and apply staff filter warning logic
 */
async function parseFilterOptions(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<{ options: FilterOptions; error?: string }> {
    const conference = interaction.options.getString("conference");
    let attribute = interaction.options.getString("attribute");

    // Warn and ignore staff filter when conference is specified
    let staffFilterWarning = false;
    if (conference && conference !== "all" && attribute === "staff") {
        staffFilterWarning = true;
        attribute = null;
    }

    const { guildId: targetGuildId, guildName, error } = await resolveConference(conference, allowedGuildIds);
    if (error) {
        return { options: { attribute: null, staffFilterWarning: false, guildFilter: null, guildName: null }, error };
    }

    // Build guild filter
    let guildFilter: string[] | null = null;
    if (targetGuildId) {
        guildFilter = [targetGuildId];
    } else if (allowedGuildIds.length > 0) {
        guildFilter = allowedGuildIds;
    }

    return { options: { attribute, staffFilterWarning, guildFilter, guildName } };
}

/**
 * Extract Discord user ID from autocomplete value or raw input
 * @returns User ID or null if invalid format
 */
function extractUserId(input: string): string | null {
    // Format: "displayName (discordUserId)" from autocomplete
    const idMatch = input.match(/\(([0-9]+)\)$/);
    if (idMatch) {
        return idMatch[1];
    }

    // Raw Discord ID
    if (/^[0-9]+$/.test(input)) {
        return input;
    }

    return null;
}

// ============================================================================
// Command Handlers
// ============================================================================

/**
 * Handle /attendance status command
 * Shows attendance summary (present/absent counts)
 */
async function handleStatus(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const today = getTodayJST();

    const { options, error } = await parseFilterOptions(interaction, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const { attribute, staffFilterWarning, guildFilter, guildName } = options;

    const presentCount = await prisma.attendanceLog.count({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(guildFilter && { primaryGuildId: { in: guildFilter } }),
        },
    });

    const totalUsers = guildFilter
        ? await prisma.userGuildMembership.count({
            where: {
                guildId: { in: guildFilter },
                ...(attribute && { user: { primaryAttribute: attribute } }),
            },
        })
        : await prisma.user.count(
            attribute ? { where: { primaryAttribute: attribute } } : undefined
        );

    const embed = new EmbedBuilder()
        .setTitle("📊 出席状況")
        .setColor(0x5865f2)
        .addFields(
            { name: "出席者数", value: `${presentCount}人`, inline: true },
            { name: "未出席者数", value: `${totalUsers - presentCount}人`, inline: true },
            { name: "対象日", value: today, inline: false }
        )
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setDescription(filterDesc);
    if (allowedGuildIds.length > 0 && !guildFilter?.length) {
        embed.setFooter({ text: `対象: ${allowedGuildIds.length}サーバー` });
    }

    const warningMessage = staffFilterWarning ? STAFF_FILTER_WARNING : "";

    await interaction.reply({ content: warningMessage || undefined, embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance present command
 * Shows list of users who checked in today
 */
async function handlePresent(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const today = getTodayJST();

    const { options, error } = await parseFilterOptions(interaction, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const { attribute, staffFilterWarning, guildFilter, guildName } = options;

    const logs = await prisma.attendanceLog.findMany({
        where: {
            checkInDate: today,
            ...(attribute && { attribute }),
            ...(guildFilter && { primaryGuildId: { in: guildFilter } }),
        },
        include: {
            user: { include: { guildMemberships: true } },
        },
    });

    const currentGuildId = interaction.guildId;
    const displayGuildId = guildFilter?.[0] || currentGuildId;

    const allUsers = logs.map((log) => {
        let membership = displayGuildId
            ? log.user.guildMemberships.find((m) => m.guildId === displayGuildId)
            : undefined;
        if (!membership && log.primaryGuildId) {
            membership = log.user.guildMemberships.find((m) => m.guildId === log.primaryGuildId);
        }
        return membership?.nickname || log.user.globalName || log.user.discordUserId;
    });

    const displayUsers = allUsers.slice(0, MAX_DISPLAY);
    const remaining = allUsers.length - displayUsers.length;
    const userList = displayUsers.map((name) => `• ${name.replace(/_/g, "\\_")}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("✅ 本日出席済み")
        .setColor(0x22c55e)
        .setDescription(userList || "まだ誰も出席していません")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    const warningMessage = staffFilterWarning ? STAFF_FILTER_WARNING : "";

    await interaction.reply({ content: warningMessage || undefined, embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance absent command
 * Shows list of users who have not checked in today
 */
async function handleAbsent(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const today = getTodayJST();

    const { options, error } = await parseFilterOptions(interaction, allowedGuildIds);
    if (error) {
        await interaction.reply({ content: `❌ ${error}`, ephemeral: true });
        return;
    }

    const { attribute, staffFilterWarning, guildFilter, guildName } = options;

    const presentUserIds = (
        await prisma.attendanceLog.findMany({
            where: { checkInDate: today },
            select: { discordUserId: true },
        })
    ).map((log) => log.discordUserId);

    const absentUsers = await prisma.user.findMany({
        where: {
            discordUserId: { notIn: presentUserIds },
            ...(attribute && { primaryAttribute: attribute }),
            ...(guildFilter && {
                guildMemberships: { some: { guildId: { in: guildFilter } } },
            }),
        },
        include: { guildMemberships: true },
    });

    const currentGuildId = interaction.guildId;
    const displayGuildId = guildFilter?.[0] || currentGuildId;

    const allUsers = absentUsers.map((user) => {
        const membership = displayGuildId
            ? user.guildMemberships.find((m) => m.guildId === displayGuildId)
            : undefined;
        return membership?.nickname || user.globalName || user.discordUserId;
    });

    const displayUsers = allUsers.slice(0, MAX_DISPLAY);
    const remaining = allUsers.length - displayUsers.length;
    const userList = displayUsers.map((name) => `• ${name.replace(/_/g, "\\_")}`).join("\n");

    const embed = new EmbedBuilder()
        .setTitle("❌ 本日未出席")
        .setColor(0xef4444)
        .setDescription(userList || "全員出席済みです")
        .addFields({ name: "対象日", value: today })
        .setTimestamp();

    const filterDesc = buildFilterDescription(guildName, attribute);
    if (filterDesc) embed.setFooter({ text: remaining > 0 ? `${filterDesc} | 他 ${remaining}人` : filterDesc });
    else if (remaining > 0) embed.setFooter({ text: `他 ${remaining}人` });

    const warningMessage = staffFilterWarning ? STAFF_FILTER_WARNING : "";

    await interaction.reply({ content: warningMessage || undefined, embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance checkin command
 * Manually check-in a specific user
 */
async function handleCheckin(
    interaction: ChatInputCommandInteraction,
    allowedGuildIds: string[]
): Promise<void> {
    const userInput = interaction.options.getString("user", true);
    const today = getTodayJST();

    const targetUserId = extractUserId(userInput);
    if (!targetUserId) {
        await interaction.reply({
            content: `❌ 無効なユーザー指定です。オートコンプリートから選択するか、Discord IDを入力してください。`,
            ephemeral: true,
        });
        return;
    }

    // Check if user exists in DB with all guild memberships
    const dbUser = await prisma.user.findUnique({
        where: { discordUserId: targetUserId },
        include: {
            guildMemberships: {
                include: { guild: true },
                where: { guild: { isTargetGuild: true } },
            },
        },
    });

    if (!dbUser) {
        await interaction.reply({
            content: `❌ 指定されたユーザー (${targetUserId}) はデータベースに登録されていません。\n先に \`/system sync\` を実行してください。`,
            ephemeral: true,
        });
        return;
    }

    // Check if organizer has permission for this user's guild
    if (allowedGuildIds.length > 0) {
        const userGuildIds = dbUser.guildMemberships.map((m) => m.guildId);
        const hasPermission = userGuildIds.some((guildId) => allowedGuildIds.includes(guildId));
        if (!hasPermission) {
            await interaction.reply({
                content: `❌ このユーザーの会議に対するチェックイン権限がありません。`,
                ephemeral: true,
            });
            return;
        }
    }

    // Check for existing attendance log today
    const existingLog = await prisma.attendanceLog.findUnique({
        where: {
            discordUserId_checkInDate: {
                discordUserId: targetUserId,
                checkInDate: today,
            },
        },
    });

    if (existingLog) {
        const methodLabel = (existingLog as any).checkInMethod === "manual" ? "手動" : "スキャン";
        await interaction.reply({
            content: `⚠️ <@${targetUserId}> は本日既に出席済みです（${methodLabel}受付）`,
            flags: MessageFlags.SuppressNotifications,
        });
        return;
    }

    const primaryGuildId = dbUser.guildMemberships[0]?.guildId || null;
    const primaryGuildName = dbUser.guildMemberships[0]?.guild.guildName || "未所属";

    // Create attendance log with manual method
    await prisma.attendanceLog.create({
        data: {
            discordUserId: targetUserId,
            primaryGuildId: primaryGuildId,
            attribute: dbUser.primaryAttribute,
            checkInDate: today,
            checkInMethod: "manual",
        } as any,
    });

    const displayName = dbUser.globalName || targetUserId;
    const attrLabel = getAttributeLabel(dbUser.primaryAttribute);

    // Log to webhook
    await logger.info("手動チェックイン", {
        discordUser: { id: targetUserId, name: displayName },
        source: "Bot (attendance checkin)",
        details: `属性: ${attrLabel}, サーバー: ${primaryGuildName}, 実行者: ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
        .setTitle("✅ 手動チェックイン完了")
        .setColor(0x22c55e)
        .addFields(
            { name: "ユーザー", value: `${displayName} (<@${targetUserId}>)`, inline: true },
            { name: "属性", value: attrLabel, inline: true },
            { name: "会議", value: primaryGuildName, inline: true }
        )
        .setFooter({ text: "手動受付" })
        .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.SuppressNotifications });
}

/**
 * Handle /attendance command
 */
export async function handleAttendance(interaction: ChatInputCommandInteraction): Promise<void> {
    // Check organizer permission (organizer, staff, or admin)
    const organizerGuildIds = await getOrganizerGuildIds(interaction.user.id);

    if (organizerGuildIds === null) {
        await interaction.reply({
            content: "❌ このコマンドを実行する権限がありません。",
            ephemeral: true,
        });
        return;
    }

    const subcommand = interaction.options.getSubcommand();

    // For organizers (not staff/admin), restrict to their guilds
    // organizerGuildIds is empty for staff/admin (meaning all guilds)
    // organizerGuildIds is an array for organizers (meaning only those guilds)
    switch (subcommand) {
        case "status":
            await handleStatus(interaction, organizerGuildIds);
            break;
        case "present":
            await handlePresent(interaction, organizerGuildIds);
            break;
        case "absent":
            await handleAbsent(interaction, organizerGuildIds);
            break;
        case "checkin":
            await handleCheckin(interaction, organizerGuildIds);
            break;
    }
}

/**
 * Handle autocomplete for attendance command
 */
export async function handleAttendanceAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === "conference") {
        const organizerGuildIds = await getOrganizerGuildIds(interaction.user.id);

        // If null, user has no permission at all
        if (organizerGuildIds === null) {
            await interaction.respond([]);
            return;
        }

        const searchText = focusedOption.value;
        const whereClause: any = {
            isTargetGuild: true,
            guildName: { contains: searchText },
        };

        // If not empty array (admin/staff), restrict to specific guilds
        if (organizerGuildIds.length > 0) {
            whereClause.guildId = { in: organizerGuildIds };
        }

        try {
            const guilds = await prisma.guild.findMany({
                where: whereClause,
                take: 25, // Discord limits to 25 choices
            });

            await interaction.respond(
                guilds.map((g) => ({ name: g.guildName, value: g.guildName }))
            );
        } catch (error) {
            console.error("Autocomplete error:", error);
            await interaction.respond([]);
        }
    } else if (focusedOption.name === "user") {
        // Autocomplete for checkin command - search users based on permission
        const organizerGuildIds = await getOrganizerGuildIds(interaction.user.id);

        if (organizerGuildIds === null) {
            await interaction.respond([]);
            return;
        }

        const searchText = focusedOption.value.toLowerCase();

        try {
            // Build where clause based on permissions
            const whereClause: any = {
                OR: [
                    { globalName: { contains: searchText } },
                    { discordUserId: { contains: searchText } },
                ],
            };

            // If organizer (not staff/admin), filter by allowed guilds
            if (organizerGuildIds.length > 0) {
                whereClause.guildMemberships = {
                    some: {
                        guildId: { in: organizerGuildIds },
                    },
                };
            }

            const users = await prisma.user.findMany({
                where: whereClause,
                include: {
                    guildMemberships: {
                        include: { guild: true },
                        where: { guild: { isTargetGuild: true } },
                        take: 1,
                    },
                },
                take: 25,
            });

            await interaction.respond(
                users.map((u) => {
                    const guildName = u.guildMemberships[0]?.guild.guildName || "未所属";
                    const displayName = u.globalName || u.discordUserId;
                    return {
                        name: `${displayName} - ${guildName}`,
                        value: `${displayName} (${u.discordUserId})`,
                    };
                })
            );
        } catch (error) {
            console.error("User autocomplete error:", error);
            await interaction.respond([]);
        }
    }
}
