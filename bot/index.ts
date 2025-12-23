/**
 * Discord Bot Entry Point
 * 
 * This is the main entry point for the Discord bot.
 * All functionality is organized into separate modules:
 * - commands/ - Slash command handlers
 * - events/   - Discord event handlers
 * - services/ - Business logic
 * - utils/    - Shared utilities
 */

import {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
} from "discord.js";
import { config } from "dotenv";
import { handleAttendance, handleSystem } from "./commands";
import { handleMemberAdd, handleMemberRemove, handleMemberUpdate } from "./events";
import { syncAllGuilds } from "./services";

config();

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName("attendance")
        .setDescription("出席状況を確認")
        .addSubcommand((sub) =>
            sub
                .setName("status")
                .setDescription("出席状況サマリーを表示")
                .addStringOption((opt) =>
                    opt
                        .setName("conference")
                        .setDescription("会議名 (all で全会議)")
                        .setRequired(false)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("attribute")
                        .setDescription("属性で絞り込み")
                        .setRequired(false)
                        .addChoices(
                            { name: "参加者", value: "participant" },
                            { name: "会議運営者", value: "organizer" },
                            { name: "スタッフ", value: "staff" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("present")
                .setDescription("本日出席済みユーザー一覧")
                .addStringOption((opt) =>
                    opt
                        .setName("conference")
                        .setDescription("会議名 (all で全会議)")
                        .setRequired(false)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("attribute")
                        .setDescription("属性で絞り込み")
                        .setRequired(false)
                        .addChoices(
                            { name: "参加者", value: "participant" },
                            { name: "会議運営者", value: "organizer" },
                            { name: "スタッフ", value: "staff" }
                        )
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName("absent")
                .setDescription("本日未出席ユーザー一覧")
                .addStringOption((opt) =>
                    opt
                        .setName("conference")
                        .setDescription("会議名 (all で全会議)")
                        .setRequired(false)
                )
                .addStringOption((opt) =>
                    opt
                        .setName("attribute")
                        .setDescription("属性で絞り込み")
                        .setRequired(false)
                        .addChoices(
                            { name: "参加者", value: "participant" },
                            { name: "会議運営者", value: "organizer" },
                            { name: "スタッフ", value: "staff" }
                        )
                )
        ),
    new SlashCommandBuilder()
        .setName("system")
        .setDescription("システム設定 (管理者のみ)")
        .addSubcommand((sub) =>
            sub
                .setName("config")
                .setDescription("設定を変更")
                .addStringOption((opt) =>
                    opt
                        .setName("key")
                        .setDescription("設定キー")
                        .setRequired(true)
                        .addChoices(
                            { name: "スタッフロールID", value: "staff_role_ids" },
                            { name: "会議運営者ロールID", value: "organizer_role_ids" },
                            { name: "管理者ロールID", value: "admin_role_ids" },
                            { name: "運営サーバーID", value: "operation_guild_id" },
                            { name: "会議サーバーID", value: "target_guild_ids" }
                        )
                )
                .addStringOption((opt) =>
                    opt
                        .setName("value")
                        .setDescription("設定値 (カンマ区切りで複数指定可)")
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub.setName("show").setDescription("現在の設定を表示")
        )
        .addSubcommand((sub) =>
            sub.setName("sync").setDescription("全サーバーのメンバーを同期")
        ),
];

// Register slash commands
async function registerCommands(): Promise<void> {
    const rest = new REST().setToken(TOKEN);

    try {
        console.log("Registering slash commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands.map((c) => c.toJSON()),
        });
        console.log("Slash commands registered.");
    } catch (error) {
        console.error("Failed to register commands:", error);
    }
}

// Event: Bot ready
client.once("ready", async () => {
    console.log(`Bot logged in as ${client.user?.tag}`);
    await registerCommands();

    console.log("Starting initial member sync...");
    const result = await syncAllGuilds(client.guilds.cache);
    console.log(`Initial sync complete: ${result.guilds} guilds, ${result.members} members`);
});

// Event: Slash command interaction
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case "attendance":
                await handleAttendance(interaction);
                break;
            case "system":
                await handleSystem(interaction, client);
                break;
        }
    } catch (error) {
        console.error("Command error:", error);
        const reply = { content: "❌ コマンド実行中にエラーが発生しました。", ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
        }
    }
});

// Event: Member join/leave/update
client.on("guildMemberAdd", handleMemberAdd);
client.on("guildMemberRemove", handleMemberRemove);
client.on("guildMemberUpdate", handleMemberUpdate);

// Start the bot
client.login(TOKEN);
