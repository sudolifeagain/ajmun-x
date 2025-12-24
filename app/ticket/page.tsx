import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import prisma from "@/app/lib/prisma";
import TicketCard from "./TicketCard";

export default async function TicketPage() {
    const user = await getSession();

    if (!user) {
        redirect("/");
    }

    // Fetch user with guild memberships (target guilds or operation server only)
    const userWithGuilds = await prisma.user.findUnique({
        where: { discordUserId: user.discordUserId },
        include: {
            guildMemberships: {
                include: {
                    guild: true,
                },
                where: {
                    guild: {
                        OR: [
                            { isTargetGuild: true },
                            { isOperationServer: true },
                        ],
                    },
                },
            },
        },
    });

    const guilds = userWithGuilds?.guildMemberships.map((m) => ({
        guildId: m.guild.guildId,
        guildName: m.guild.guildName,
        guildIconUrl: m.guild.guildIconUrl,
        defaultColor: m.guild.defaultColor,
        nickname: m.nickname,
    })) || [];

    const userData = {
        discordUserId: user.discordUserId,
        globalName: user.globalName,
        defaultAvatarUrl: user.defaultAvatarUrl,
        qrToken: user.qrToken,
        primaryAttribute: user.primaryAttribute || "participant",
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
            <TicketCard user={userData} guilds={guilds} />
        </div>
    );
}
