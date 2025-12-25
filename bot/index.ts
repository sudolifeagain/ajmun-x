/**
 * Discord Bot Entry Point
 *
 * This is the main entry point for the Discord bot.
 * All functionality is organized into separate modules:
 * - commands/           - Slash command handlers
 * - commandDefinitions  - Slash command definitions
 * - events/             - Discord event handlers
 * - services/           - Business logic
 * - utils/              - Shared utilities
 */

import { Client, GatewayIntentBits, REST, Routes } from "discord.js";
import { config } from "dotenv";
import { commands } from "./commandDefinitions";
import { handleAttendance, handleSystem, handleSystemButton, handleSetup, handleHelp, handleHelpSelect } from "./commands";
import { handleMemberAdd, handleMemberRemove, handleMemberUpdate } from "./events";
import { syncAllGuilds } from "./services";
import logger from "./utils/discordLogger";

config();

const TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;

// Initialize Discord client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

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

    // Log bot startup
    await logger.info("Bot started", {
        source: "Bot",
        details: `${result.guilds} guilds, ${result.members} members synced`,
    });
});

// Event: Slash command interaction
client.on("interactionCreate", async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        try {
            const handled = await handleSystemButton(interaction);
            if (handled) return;
        } catch (error) {
            console.error("Button error:", error);
        }
        return;
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
        try {
            if (interaction.customId === "help_category_select") {
                await handleHelpSelect(interaction);
                return;
            }
        } catch (error) {
            console.error("Select menu error:", error);
            await interaction.reply({ content: "❌ エラーが発生しました。", ephemeral: true });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case "attendance":
                await handleAttendance(interaction);
                break;
            case "system":
                await handleSystem(interaction, client);
                break;
            case "setup":
                await handleSetup(interaction);
                break;
            case "help":
                await handleHelp(interaction);
                break;
        }
    } catch (error) {
        console.error("Command error:", error);
        await logger.error("コマンドエラー", {
            discordUser: {
                id: interaction.user.id,
                name: interaction.user.username,
            },
            source: "Bot",
            details: `コマンド: /${interaction.commandName}`,
            error,
        });
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
