import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { verifyQrToken } from "@/app/lib/session";

interface ScanRequest {
    token: string;
}

interface ScanResponse {
    status: "ok" | "duplicate" | "error";
    message: string;
    user?: {
        discordUserId: string;
        globalName: string | null;
        avatarUrl: string | null;
        attribute: string;
        guilds: Array<{
            guildId: string;
            guildName: string;
            guildIconUrl: string | null;
            defaultColor: string;
            nickname: string | null;
        }>;
    };
}

export async function POST(request: NextRequest): Promise<NextResponse<ScanResponse>> {
    try {
        const body: ScanRequest = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { status: "error", message: "Token is required" },
                { status: 400 }
            );
        }

        // Verify the QR token
        const verification = verifyQrToken(token);
        if (!verification.valid || !verification.userId) {
            return NextResponse.json(
                { status: "error", message: "Invalid token" },
                { status: 403 }
            );
        }

        const userId = verification.userId;

        // Fetch user with guild memberships
        const user = await prisma.user.findUnique({
            where: { discordUserId: userId },
            include: {
                guildMemberships: {
                    include: {
                        guild: true,
                    },
                    where: {
                        guild: {
                            isTargetGuild: true,
                        },
                    },
                },
            },
        });

        if (!user) {
            return NextResponse.json(
                { status: "error", message: "User not found" },
                { status: 403 }
            );
        }

        // Get today's date in JST (UTC+9)
        const now = new Date();
        const jstOffset = 9 * 60 * 60 * 1000;
        const jstDate = new Date(now.getTime() + jstOffset);
        const today = jstDate.toISOString().split("T")[0];

        // Check for existing attendance log today
        const existingLog = await prisma.attendanceLog.findUnique({
            where: {
                discordUserId_checkInDate: {
                    discordUserId: userId,
                    checkInDate: today,
                },
            },
        });

        const primaryGuildId =
            user.guildMemberships[0]?.guildId || null;

        // Build response user data
        const responseUser = {
            discordUserId: user.discordUserId,
            globalName: user.globalName,
            avatarUrl: user.defaultAvatarUrl,
            attribute: user.primaryAttribute,
            guilds: user.guildMemberships.map((m) => ({
                guildId: m.guild.guildId,
                guildName: m.guild.guildName,
                guildIconUrl: m.guild.guildIconUrl,
                defaultColor: m.guild.defaultColor,
                nickname: m.nickname,
            })),
        };

        if (existingLog) {
            // Already checked in today
            return NextResponse.json({
                status: "duplicate",
                message: "本日入場済み",
                user: responseUser,
            });
        }

        // Create new attendance log
        await prisma.attendanceLog.create({
            data: {
                discordUserId: userId,
                primaryGuildId: primaryGuildId,
                attribute: user.primaryAttribute,
                checkInDate: today,
            },
        });

        return NextResponse.json({
            status: "ok",
            message: "入場成功",
            user: responseUser,
        });
    } catch (error) {
        console.error("Scan error:", error);
        return NextResponse.json(
            { status: "error", message: "Internal server error" },
            { status: 500 }
        );
    }
}
