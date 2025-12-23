import prisma from "../app/lib/prisma";
import path from "path";

async function main() {
    console.log("=== Database Debug Info ===");
    console.log("CWD:", process.cwd());
    console.log("DATABASE_URL (env):", process.env.DATABASE_URL);

    try {
        // Attempt to connect and query
        console.log("Querying users...");
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
