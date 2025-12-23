import { GuildMember, PartialGuildMember } from "discord.js";
import { prisma } from "../utils";

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

    console.log(`Member removed: ${member.user.tag} from ${member.guild.name}`);
}
