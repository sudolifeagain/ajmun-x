import { Guild } from "discord.js";
import { prisma, generateDefaultColor } from "../utils";
import { getAttributeConfig, determineAttribute, isOperationServer, isTargetGuild } from "./attributeService";

/**
 * Sync a single guild's members to the database
 */
export async function syncGuildMembers(guild: Guild): Promise<number> {
    const guildIconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : null;

    const config = await getAttributeConfig();
    const isOpServer = await isOperationServer(guild.id);
    const isTarget = isTargetGuild(guild.id, config);

    // Upsert guild (preserve existing isOperationServer flag, don't overwrite from config)
    await prisma.guild.upsert({
        where: { guildId: guild.id },
        update: {
            guildName: guild.name,
            guildIconUrl: guildIconUrl,
            isTargetGuild: isTarget,
            // Note: We don't overwrite isOperationServer here - it's set by /setup command
        },
        create: {
            guildId: guild.id,
            guildName: guild.name,
            guildIconUrl: guildIconUrl,
            defaultColor: generateDefaultColor(guild.id),
            isTargetGuild: isTarget,
            isOperationServer: false,
        },
    });


    // Fetch all members
    const members = await guild.members.fetch();
    let syncedCount = 0;

    for (const [, member] of members) {
        if (member.user.bot) continue;

        const roleIds = member.roles.cache.map((r) => r.id);
        const avatarUrl = member.displayAvatarURL();
        const placeholderToken = `bot-sync-${member.id}-${Date.now()}`;

        // 1. Ensure User exists (Upsert)
        // We don't verify attribute here, just ensure record exists
        const user = await prisma.user.upsert({
            where: { discordUserId: member.id },
            update: {
                globalName: member.user.globalName || member.user.username,
                defaultAvatarUrl: avatarUrl,
            },
            create: {
                discordUserId: member.id,
                qrToken: placeholderToken,
                globalName: member.user.globalName || member.user.username,
                defaultAvatarUrl: avatarUrl,
                primaryAttribute: "participant", // Default, will be recalculated
            },
        });

        // 2. Upsert Membership (store current roles)
        await prisma.userGuildMembership.upsert({
            where: {
                discordUserId_guildId: {
                    discordUserId: member.id,
                    guildId: guild.id,
                },
            },
            update: {
                nickname: member.nickname,
                avatarUrl: avatarUrl,
                roleIds: JSON.stringify(roleIds),
            },
            create: {
                discordUserId: member.id,
                guildId: guild.id,
                nickname: member.nickname,
                avatarUrl: avatarUrl,
                roleIds: JSON.stringify(roleIds),
            },
        });

        // 3. Recalculate Attribute based on ALL guild memberships
        // This ensures that having an Organizer role in ANY server promotes the user
        const allMemberships = await prisma.userGuildMembership.findMany({
            where: { discordUserId: member.id },
            select: { roleIds: true },
        });

        const allRoleIds = allMemberships.flatMap((m) => {
            try {
                return JSON.parse(m.roleIds) as string[];
            } catch {
                return [];
            }
        });

        const newAttribute = determineAttribute(allRoleIds, config);

        // 4. Update User if attribute changed
        if (user.primaryAttribute !== newAttribute) {
            await prisma.user.update({
                where: { discordUserId: member.id },
                data: { primaryAttribute: newAttribute },
            });
        }

        syncedCount++;
    }

    return syncedCount;
}
/**
 * Sync all guilds the bot is in
 */
export async function syncAllGuilds(
    guilds: Map<string, Guild>
): Promise<{ guilds: number; members: number; uniqueUsers: number }> {
    let totalGuilds = 0;
    let totalMembers = 0;

    for (const [, guild] of guilds) {
        try {
            const count = await syncGuildMembers(guild);
            totalGuilds++;
            totalMembers += count;
            console.log(`Synced ${count} members from ${guild.name}`);
        } catch (error) {
            console.error(`Failed to sync ${guild.name}:`, error);
        }
    }

    // Get unique user count
    const uniqueUsers = await prisma.user.count();

    return { guilds: totalGuilds, members: totalMembers, uniqueUsers };
}
