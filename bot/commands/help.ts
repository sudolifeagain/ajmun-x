
import {
    ActionRowBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    StringSelectMenuOptionBuilder,
} from "discord.js";

type HelpCategory = "attendance" | "system" | "setup";

const helpDescriptions: Record<HelpCategory, { title: string; description: string; fields: { name: string; value: string }[] }> = {
    attendance: {
        title: "📋 出席管理コマンド (/attendance)",
        description: "会議の出席状況を確認するためのコマンドです。\n**対象**: 事務局員、会議フロント",
        fields: [
            {
                name: "/attendance status [conference] [attribute]",
                value: "現在の出席数・未出席数を表示します。\nオプションで会議名や属性（参加者/フロント/スタッフ）を絞り込めます。",
            },
            {
                name: "/attendance present [conference] [attribute]",
                value: "本日既に出席したユーザーの一覧を表示します。",
            },
            {
                name: "/attendance absent [conference] [attribute]",
                value: "まだ出席していない未出席ユーザーの一覧を表示します。",
            },
        ],
    },
    system: {
        title: "⚙️ システム管理コマンド (/system)",
        description: "Botの設定や全体管理を行うためのコマンドです。\n**対象**: Bot管理者",
        fields: [
            {
                name: "/system sync",
                value: "全サーバーのメンバー情報を最新の状態に同期します。\n（ロール変更などが即座に反映されない場合に実行してください）",
            },
            {
                name: "/system show",
                value: "現在のシステム設定（ロールIDや対象サーバーIDなど）を表示します。",
            },
            {
                name: "/system config <key> <value>",
                value: "システム設定を変更・追加します。",
            },
            {
                name: "/system send-qr",
                value: "QRコードをDMで一斉送信します。\n対象範囲（全員/属性別）やテスト送信も可能です。",
            },
            {
                name: "/system dm-status",
                value: "DM送信の進捗状況（送信済み数、失敗数など）を確認します。",
            },
        ],
    },
    setup: {
        title: "🛠️ 初期セットアップ (/setup)",
        description: "Bot導入時の初期設定用コマンドです。\n**対象**: Bot管理者（未設定時は誰でも実行可）",
        fields: [
            {
                name: "/setup target-guild enable:true",
                value: "このサーバーを「会議サーバー（出席管理対象）」として登録します。",
            },
            {
                name: "/setup operation-server enable:true",
                value: "このサーバーを「運営サーバー（スタッフ管理用）」として登録します。",
            },
            {
                name: "/setup admin-roles roles:<ID>",
                value: "Bot管理者ロールを設定します。\n※設定すると、以降は管理者ロールを持つ人しか `/setup` を実行できなくなります。",
            },
            {
                name: "/setup staff-roles roles:<ID>",
                value: "事務局員（全体スタッフ）ロールを設定します。",
            },
            {
                name: "/setup organizer-roles roles:<ID>",
                value: "会議フロントロールを追加します。",
            },
        ],
    },
};

export async function handleHelp(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("🤖 AJMUN Bot ヘルプ")
        .setDescription(
            "機能カテゴリを選択して、コマンドの詳細を確認してください。\n\n" +
            "**カテゴリ一覧**:\n" +
            "📋 **Attendance**: 出席状況の確認\n" +
            "⚙️ **System**: システム設定、同期、QR配布\n" +
            "🛠️ **Setup**: サーバーの初期登録"
        )
        .setColor("#0099ff");

    const select = new StringSelectMenuBuilder()
        .setCustomId("help_category_select")
        .setPlaceholder("カテゴリを選択してください")
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel("Attendance (出席管理)")
                .setDescription("出席確認、名簿表示など")
                .setValue("attendance")
                .setEmoji("📋"),
            new StringSelectMenuOptionBuilder()
                .setLabel("System (システム管理)")
                .setDescription("設定変更、同期、QR配布など")
                .setValue("system")
                .setEmoji("⚙️"),
            new StringSelectMenuOptionBuilder()
                .setLabel("Setup (初期設定)")
                .setDescription("サーバー登録、ロール設定")
                .setValue("setup")
                .setEmoji("🛠️")
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true, // Show only to the user
    });
}

export async function handleHelpSelect(interaction: StringSelectMenuInteraction) {
    const category = interaction.values[0] as HelpCategory;
    const data = helpDescriptions[category];

    if (!data) return;

    const embed = new EmbedBuilder()
        .setTitle(data.title)
        .setDescription(data.description)
        .addFields(data.fields)
        .setColor("#0099ff")
        .setFooter({ text: "メニューから他のカテゴリを選択できます" });

    // Update the message with new embed, keep the select menu
    await interaction.update({
        embeds: [embed],
    });
}
