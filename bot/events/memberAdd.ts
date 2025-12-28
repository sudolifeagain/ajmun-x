import { GuildMember } from "discord.js";
import { prisma, generateDefaultColor } from "../utils";
import { getAttributeConfig, determineAttribute, isTargetGuild } from "../services";

/**
 * Handle guildMemberAdd event
 */
export async function handleMemberAdd(member: GuildMember): Promise<void> {
    if (member.user.bot) return;

    const config = await getAttributeConfig();
    const isTarget = isTargetGuild(member.guild.id, config);

    // Upsert Guild (preserve isOperationServer flag)
    await prisma.guild.upsert({
        where: { guildId: member.guild.id },
        update: {
            guildName: member.guild.name,
            guildIconUrl: member.guild.iconURL(),
        },
        create: {
            guildId: member.guild.id,
            guildName: member.guild.name,
            guildIconUrl: member.guild.iconURL(),
            defaultColor: generateDefaultColor(member.guild.id),
            isTargetGuild: isTarget,
            isOperationServer: false,
        },
    });

    const guild = await prisma.guild.findUnique({
        where: { guildId: member.guild.id },
    });

    if (!guild?.isTargetGuild) return;

    const roleIds = member.roles.cache.map((r) => r.id);
    const avatarUrl = member.displayAvatarURL();
    const placeholderToken = `bot-sync-${member.id}-${Date.now()}`;

    // Upsert user (attribute will be recalculated after membership is saved)
    await prisma.user.upsert({
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
            primaryAttribute: "participant",
        },
    });

    await prisma.userGuildMembership.upsert({
        where: {
            discordUserId_guildId: {
                discordUserId: member.id,
                guildId: member.guild.id,
            },
        },
        update: {
            nickname: member.nickname,
            avatarUrl: avatarUrl,
            roleIds: JSON.stringify(roleIds),
        },
        create: {
            discordUserId: member.id,
            guildId: member.guild.id,
            nickname: member.nickname,
            avatarUrl: avatarUrl,
            roleIds: JSON.stringify(roleIds),
        },
    });

    // Recalculate attribute from ALL guild memberships
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

    const finalAttribute = determineAttribute(allRoleIds, config);
    await prisma.user.update({
        where: { discordUserId: member.id },
        data: { primaryAttribute: finalAttribute },
    });

    console.log(`Member added: ${member.user.tag} in ${member.guild.name}`);
}
