import prisma from "../app/lib/prisma";
import path from "path";

async function main() {
    console.log("=== Database Debug Info ===");
    console.log("CWD:", process.cwd());
    console.log("DATABASE_URL (env):", process.env.DATABASE_URL);

    try {
        // === Guild Overview ===
        console.log("\n=== Guild Configuration ===");
        const guilds = await prisma.guild.findMany({
            select: {
                guildId: true,
                guildName: true,
                isTargetGuild: true,
                isOperationServer: true,
                _count: { select: { userMemberships: true } },
            },
        });

        guilds.forEach(g => {
            const type = g.isOperationServer ? "運営" : g.isTargetGuild ? "会議" : "未設定";
            console.log(`- [${type}] ${g.guildName}: ${g._count.userMemberships}人`);
        });

        // === User Distribution ===
        console.log("\n=== User Distribution ===");

        // Users in target guilds or operation servers
        const usersInValidGuilds = await prisma.user.findMany({
            where: {
                guildMemberships: {
                    some: {
                        guild: {
                            OR: [
                                { isTargetGuild: true },
                                { isOperationServer: true },
                            ],
                        },
                    },
                },
            },
            select: { discordUserId: true, globalName: true },
        });
        console.log(`会議/運営サーバーに所属: ${usersInValidGuilds.length}人`);

        // Users NOT in any target/operation guilds
        const usersOutsideValidGuilds = await prisma.user.findMany({
            where: {
                NOT: {
                    guildMemberships: {
                        some: {
                            guild: {
                                OR: [
                                    { isTargetGuild: true },
                                    { isOperationServer: true },
                                ],
                            },
                        },
                    },
                },
            },
            select: { discordUserId: true, globalName: true },
        });
        console.log(`会議/運営サーバーに未所属: ${usersOutsideValidGuilds.length}人`);

        if (usersOutsideValidGuilds.length > 0) {
            console.log("  未所属ユーザー一覧:");
            usersOutsideValidGuilds.forEach(u => {
                console.log(`    - ${u.globalName} (${u.discordUserId})`);
            });
        }

        // Total users
        const totalUsers = await prisma.user.count();
        console.log(`\n合計ユーザー数: ${totalUsers}人`);

        // Attempt to connect and query
        console.log("\n=== All Users ===");
        const users = await prisma.user.findMany();
        console.log(`Found ${users.length} users.`);

        if (users.length > 0) {
            console.log("User list:");
            users.forEach(u => {
                console.log(`- ID: ${u.discordUserId}, Name: ${u.globalName}, Attr: ${u.primaryAttribute}`);
            });
        } else {
            console.log("No users found in this database.");
        }

        // Verify file existence if sqlite
        const url = process.env.DATABASE_URL || "";
        if (url.startsWith("file:")) {
            const fs = require("fs");
            let dbPath = url.replace("file:", "");
            if (dbPath.startsWith("./")) {
                // Assume relative to schema.prisma which is usually in prisma/ folder
                // BUT at runtime, it depends on how prisma client was generated.
                // Let's check common locations
                const candidates = [
                    dbPath,
                    path.join("prisma", dbPath.replace("./", "")),
                    path.join(process.cwd(), dbPath)
                ];

                console.log("\nChecking file system for DB files:");
                candidates.forEach(p => {
                    const exists = fs.existsSync(p);
                    console.log(`- ${p}: ${exists ? "EXISTS" : "NOT FOUND"}`);
                    if (exists) {
                        const stats = fs.statSync(p);
                        console.log(`  Size: ${stats.size} bytes, Modified: ${stats.mtime}`);
                    }
                });
            }
        }

    } catch (e) {
        console.error("Error accessing database:", e);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
