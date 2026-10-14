import { redirect } from "next/navigation";
import { getSession } from "@/app/lib/session";
import prisma from "@/app/lib/prisma";
import type { Prisma } from "@prisma/client";
import TicketCard from "./TicketCard";
import { generateQrToken, verifyQrToken } from "@/app/lib/qrToken";

// Force dynamic rendering to ensure cookies are always available
export const dynamic = 'force-dynamic';

export default async function TicketPage() {
    const user = await getSession();

    if (!user) {
        redirect("/");
    }

    // Existing sessions can outlive a QR token. Refresh it before displaying it.
    if (!verifyQrToken(user.qrToken).valid) {
        const refreshed = await prisma.user.update({
            where: { discordUserId: user.discordUserId },
            data: { qrToken: generateQrToken(user.discordUserId) },
        });
        user.qrToken = refreshed.qrToken;
    }

    // Determine guild filter based on user role
    let guildWhere: Prisma.GuildWhereInput = {
        OR: [
            { isTargetGuild: true },
            { isOperationServer: true },
        ],
    };

    if (user.primaryAttribute === "staff") {
        guildWhere = { isOperationServer: true };
    } else if (user.primaryAttribute === "organizer") {
        guildWhere = { isTargetGuild: true };
    }

    // Fetch user with guild memberships
    const userWithGuilds = await prisma.user.findUnique({
        where: { discordUserId: user.discordUserId },
        include: {
            guildMemberships: {
                include: {
                    guild: true,
                },
                where: {
                    guild: guildWhere,
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
