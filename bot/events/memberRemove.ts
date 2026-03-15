import { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../utils";
import { getAttributeConfig, determineAttribute } from "../services";

/**
 * Handle guildMemberRemove event
 */
export async function handleMemberRemove(member: GuildMember | PartialGuildMember): Promise<void> {
    if (member.user.bot) return;

    await prisma.userGuildMembership.deleteMany({
        where: {
            discordUserId: member.id,
            guildId: member.guild.id,
        },
    });

    // Recalculate primaryAttribute from remaining memberships
    const config = await getAttributeConfig();
    const remainingMemberships = await prisma.userGuildMembership.findMany({
        where: { discordUserId: member.id },
        select: { roleIds: true },
    });

    if (remainingMemberships.length > 0) {
        const allRoleIds = remainingMemberships.flatMap((m) => {
            try {
                return JSON.parse(m.roleIds) as string[];
            } catch {
                return [];
            }
        });

        const newAttribute = determineAttribute(allRoleIds, config);
        await prisma.user.update({
            where: { discordUserId: member.id },
            data: { primaryAttribute: newAttribute },
        });
    } else {
        // No remaining memberships: reset to participant
        await prisma.user.update({
            where: { discordUserId: member.id },
            data: { primaryAttribute: "participant" },
        });
    }

    console.log(`Member removed: ${member.user.tag} from ${member.guild.name}`);
}
