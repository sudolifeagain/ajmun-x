import { GuildMember } from "discord.js";
import { prisma, generateDefaultColor } from "../utils";
import { getAttributeConfig, determineAttribute, isOperationServer, isTargetGuild } from "../services";

/**
 * Handle guildMemberAdd event
 */
export async function handleMemberAdd(member: GuildMember): Promise<void> {
    if (member.user.bot) return;

    const config = await getAttributeConfig();
    const isOpServer = isOperationServer(member.guild.id, config);
    const isTarget = isTargetGuild(member.guild.id, config);

    // Upsert Guild
    await prisma.guild.upsert({
        where: { guildId: member.guild.id },
        update: {
            guildName: member.guild.name,
            guildIconUrl: member.guild.iconURL(),
            isOperationServer: isOpServer,
            isTargetGuild: isTarget,
        },
        create: {
            guildId: member.guild.id,
            guildName: member.guild.name,
            guildIconUrl: member.guild.iconURL(),
            defaultColor: generateDefaultColor(member.guild.id),
            isTargetGuild: isTarget,
            isOperationServer: isOpServer,
        },
    });

    const guild = await prisma.guild.findUnique({
        where: { guildId: member.guild.id },
    });

    if (!guild?.isTargetGuild) return;

    const roleIds = member.roles.cache.map((r) => r.id);
    const avatarUrl = member.displayAvatarURL();
    const placeholderToken = `bot-sync-${member.id}-${Date.now()}`;

    // Calculate attribute
    let newAttribute: "staff" | "organizer" | "participant" | undefined = undefined;
    if (isOpServer) {
        newAttribute = determineAttribute(roleIds, config);
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
        globalName: member.user.globalName || member.user.username,
        defaultAvatarUrl: avatarUrl,
    };
    if (newAttribute) {
        updateData.primaryAttribute = newAttribute;
    }

    await prisma.user.upsert({
        where: { discordUserId: member.id },
        update: updateData,
        create: {
            discordUserId: member.id,
            qrToken: placeholderToken,
            globalName: member.user.globalName || member.user.username,
            defaultAvatarUrl: avatarUrl,
            primaryAttribute: newAttribute || "participant",
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

    console.log(`Member added: ${member.user.tag} in ${member.guild.name}`);
}
