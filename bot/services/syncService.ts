import { Guild } from "discord.js";
import { prisma, generateDefaultColor } from "../utils";
import { getAttributeConfig, determineAttribute, isOperationServer } from "./attributeService";

/**
 * Sync a single guild's members to the database
 */
export async function syncGuildMembers(guild: Guild): Promise<number> {
    const guildIconUrl = guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
        : null;

    const config = await getAttributeConfig();
    const isOpServer = isOperationServer(guild.id, config);

    // Upsert guild
    await prisma.guild.upsert({
        where: { guildId: guild.id },
        update: {
            guildName: guild.name,
            guildIconUrl: guildIconUrl,
            isOperationServer: isOpServer,
        },
        create: {
            guildId: guild.id,
            guildName: guild.name,
            guildIconUrl: guildIconUrl,
            defaultColor: generateDefaultColor(guild.id),
            isTargetGuild: true,
            isOperationServer: isOpServer,
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

        // Determine attribute
        let newAttribute: "staff" | "organizer" | "participant" | undefined = undefined;
        if (isOpServer) {
            newAttribute = determineAttribute(roleIds, config);
        }

        // Fetch existing user
        const existingUser = await prisma.user.findUnique({
            where: { discordUserId: member.id },
        });

        // Determine what to save
        let attributeToSave = existingUser?.primaryAttribute || "participant";
        if (isOpServer && newAttribute) {
            attributeToSave = newAttribute;
        } else if (!existingUser) {
            attributeToSave = "participant";
        }

        // Upsert user
        await prisma.user.upsert({
            where: { discordUserId: member.id },
            update: {
                globalName: member.user.globalName || member.user.username,
                defaultAvatarUrl: avatarUrl,
                primaryAttribute: attributeToSave,
            },
            create: {
                discordUserId: member.id,
                qrToken: placeholderToken,
                globalName: member.user.globalName || member.user.username,
                defaultAvatarUrl: avatarUrl,
                primaryAttribute: attributeToSave,
            },
        });

        // Upsert membership
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

        syncedCount++;
    }

    return syncedCount;
}

/**
 * Sync all guilds the bot is in
 */
export async function syncAllGuilds(
    guilds: Map<string, Guild>
): Promise<{ guilds: number; members: number }> {
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

    return { guilds: totalGuilds, members: totalMembers };
}
