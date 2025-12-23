import { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../utils";
import { getAttributeConfig, determineAttribute, isOperationServer } from "../services";

/**
 * Handle guildMemberUpdate event
 */
export async function handleMemberUpdate(
    _oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
): Promise<void> {
    if (newMember.user.bot) return;

    const config = await getAttributeConfig();
    const isOpServer = isOperationServer(newMember.guild.id, config);

    const guild = await prisma.guild.findUnique({
        where: { guildId: newMember.guild.id },
    });

    if (!guild?.isTargetGuild) return;

    const roleIds = newMember.roles.cache.map((r) => r.id);
    const avatarUrl = newMember.displayAvatarURL();

    // Attribute recalculation on role update
    if (isOpServer) {
        const newAttribute = determineAttribute(roleIds, config);

        await prisma.user.update({
            where: { discordUserId: newMember.id },
            data: { primaryAttribute: newAttribute },
        });
    }

    await prisma.userGuildMembership.upsert({
        where: {
            discordUserId_guildId: {
                discordUserId: newMember.id,
                guildId: newMember.guild.id,
            },
        },
        update: {
            nickname: newMember.nickname,
            avatarUrl: avatarUrl,
            roleIds: JSON.stringify(roleIds),
        },
        create: {
            discordUserId: newMember.id,
            guildId: newMember.guild.id,
            nickname: newMember.nickname,
            avatarUrl: avatarUrl,
            roleIds: JSON.stringify(roleIds),
        },
    });
}
