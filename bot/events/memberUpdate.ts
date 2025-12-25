import { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../utils";
import { getAttributeConfig, determineAttribute } from "../services";

/**
 * Handle guildMemberUpdate event
 */
export async function handleMemberUpdate(
    _oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember
): Promise<void> {
    if (newMember.user.bot) return;

    const guild = await prisma.guild.findUnique({
        where: { guildId: newMember.guild.id },
    });

    if (!guild?.isTargetGuild) return;

    const roleIds = newMember.roles.cache.map((r) => r.id);
    const avatarUrl = newMember.displayAvatarURL();

    // Update membership first
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

    // Recalculate attribute from ALL guild memberships
    const config = await getAttributeConfig();
    const allMemberships = await prisma.userGuildMembership.findMany({
        where: { discordUserId: newMember.id },
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
    await prisma.user.update({
        where: { discordUserId: newMember.id },
        data: { primaryAttribute: newAttribute },
    });
}
