/**
 * Google Apps Script for AJMUN Attendance Sync
 * 
 * このスクリプトをスプレッドシートのApps Scriptに貼り付けてください
 * (拡張機能 → Apps Script)
 */

// ==========================
// 設定（変更必要）
// ==========================
const CONFIG = {
    API_URL: "https://ajmun37.re4lity.com/api/attendance-export",
    API_KEY: "ここにAPIキーを入力",  // .envのEXPORT_API_KEYと同じ値
    SHEET_NAME: "出席状況",  // 同期先のシート名
};

// ==========================
// メイン関数
// ==========================

/**
 * 全会議の出席状況を同期（1つのシートに統合）
 * メニューから実行、またはトリガーで定期実行
 */
/**
 * 全会議の出席状況を同期（1つのシートに統合）
 * メニューから実行、またはトリガーで定期実行
 */
function syncAllAttendance() {
    console.log("syncAllAttendance started");
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");

        console.log(`Fetching data for ${today}...`);

        // APIからデータ取得
        const data = fetchAttendanceData(today);
        if (!data) {
            console.error("No data returned from API");
            return;
        }

        console.log("Data fetched successfully.");
        if (!data.members) {
            console.error("Invalid data format: 'members' property missing");
            console.log("Data received:", JSON.stringify(data).substring(0, 200));
            return;
        }
        console.log(`Members count: ${data.members.length}`);

        // シート取得または作成
        let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
        if (!sheet) {
            console.log("Creating new sheet...");
            sheet = ss.insertSheet(CONFIG.SHEET_NAME);
        }

        // ヘッダー
        const headers = [
            "Discord ID",
            "グローバル名",
            "所属会議",
            "属性",
            "出席状況",
            "スキャン日時"
        ];

        console.log("Aggregating by user...");
        // ユーザーID単位で集約
        const userMap = new Map();
        for (const m of data.members) {
            if (userMap.has(m.discordUserId)) {
                const existing = userMap.get(m.discordUserId);
                // 会議名を追加（重複しないように）
                if (!existing.guilds.includes(m.guildName)) {
                    existing.guilds.push(m.guildName);
                }
                // 出席状況は1つでも出席ならtrue
                if (m.attended) {
                    existing.attended = true;
                    existing.checkInTimestamp = existing.checkInTimestamp || m.checkInTimestamp;
                }
            } else {
                userMap.set(m.discordUserId, {
                    discordUserId: m.discordUserId,
                    globalName: m.globalName,
                    guilds: [m.guildName],
                    attribute: m.attribute,
                    attended: m.attended,
                    checkInTimestamp: m.checkInTimestamp,
                });
            }
        }

        // Map → 配列に変換してソート（出席済み → 未出席）
        const aggregatedUsers = Array.from(userMap.values()).sort((a, b) => {
            if (a.attended && !b.attended) return -1;
            if (!a.attended && b.attended) return 1;
            return 0;
        });

        console.log(`Unique users: ${aggregatedUsers.length}`);

        const rows = aggregatedUsers.map(u => [
            u.discordUserId,
            u.globalName,
            u.guilds.join(", "),
            getAttributeLabel(u.attribute),
            u.attended ? "✅ 済" : "❌ 未",
            u.checkInTimestamp ? formatTimestamp(u.checkInTimestamp) : "",
        ]);

        console.log("Writing to sheet...");
        // シートをクリアして書き込み
        sheet.clear();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        }

        // 最終更新日時をシートに表示（ヘッダー列数に合わせて調整）
        sheet.getRange("H1").setValue(`最終更新: ${today} ${Utilities.formatDate(new Date(), "Asia/Tokyo", "HH:mm")}`);

        // サマリー表示（ユーザー単位で集計）
        const attended = aggregatedUsers.filter(u => u.attended).length;
        const total = aggregatedUsers.length;

        console.log(`Sync completed: ${attended}/${total}`);
        ss.toast(`同期完了: ${attended}/${total}人 出席済み`, "完了");

    } catch (e) {
        console.error("Sync Error:", e);
        if (e.stack) console.error(e.stack);
        SpreadsheetApp.getUi().alert("処理エラー: " + e.message);
    }
}

/**
 * APIからデータを取得
 */
function fetchAttendanceData(date) {
    const url = `${CONFIG.API_URL}?apiKey=${CONFIG.API_KEY}&date=${date}`;
    console.log(`Connecting to: ${url}`);

    try {
        const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
            validateHttpsCertificates: false // 自己証明書などの場合用（念の為）
        });

        const responseCode = response.getResponseCode();
        const contentText = response.getContentText();

        console.log(`Response Code: ${responseCode}`);

        if (responseCode !== 200) {
            console.error(`Error Response: ${contentText}`);
            SpreadsheetApp.getUi().alert(`APIエラー (${responseCode}): ${contentText.substring(0, 200)}`);
            return null;
        }

        return JSON.parse(contentText);
    } catch (e) {
        console.error("Fetch Error:", e);
        SpreadsheetApp.getUi().alert("接続エラー: " + e.message);
        return null;
    }
}

/**
 * 属性ラベル変換
 */
function getAttributeLabel(attr) {
    switch (attr) {
        case "staff": return "スタッフ";
        case "organizer": return "会議フロント";
        default: return "参加者";
    }
}

/**
 * タイムスタンプをJSTでフォーマット
 */
function formatTimestamp(isoString) {
    const date = new Date(isoString);
    return Utilities.formatDate(date, "Asia/Tokyo", "MM/dd HH:mm");
}

// ==========================
// メニュー追加
// ==========================
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu("出席同期")
        .addItem("今すぐ同期", "syncAllAttendance")
        .addToUi();
}
