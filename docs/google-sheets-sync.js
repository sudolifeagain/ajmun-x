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
    MASTER_SHEET_NAME: "Discord ID マスタ",  // 既存のマスタシート名（任意）
};

// ==========================
// メイン関数
// ==========================

/**
 * 全会議の出席状況を同期
 * メニューから実行、またはトリガーで定期実行
 */
function syncAllAttendance() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");

    // APIからデータ取得
    const data = fetchAttendanceData(today);
    if (!data) return;

    // 会議ごとにシートを作成/更新
    data.guilds.forEach(guild => {
        const guildMembers = data.members.filter(m => m.guildId === guild.guildId);
        updateGuildSheet(ss, guild.guildName, guildMembers, today);
    });

    SpreadsheetApp.getUi().alert(`同期完了: ${data.summary.attended}/${data.summary.total}人 出席済み`);
}

/**
 * APIからデータを取得
 */
function fetchAttendanceData(date) {
    const url = `${CONFIG.API_URL}?apiKey=${CONFIG.API_KEY}&date=${date}`;

    try {
        const response = UrlFetchApp.fetch(url);
        return JSON.parse(response.getContentText());
    } catch (e) {
        SpreadsheetApp.getUi().alert("APIエラー: " + e.message);
        return null;
    }
}

/**
 * 会議シートを更新
 */
function updateGuildSheet(ss, guildName, members, date) {
    // シート取得または作成
    let sheet = ss.getSheetByName(guildName);
    if (!sheet) {
        sheet = ss.insertSheet(guildName);
    }

    // ヘッダー
    const headers = ["Discord ID", "グローバル名", "ニックネーム", "属性", "出席状況", "スキャン日時"];

    // データ整形（出席済み → 未出席の順）
    const attended = members.filter(m => m.attended);
    const absent = members.filter(m => !m.attended);
    const sorted = [...attended, ...absent];

    const rows = sorted.map(m => [
        m.discordUserId,
        m.globalName,
        m.nickname,
        getAttributeLabel(m.attribute),
        m.attended ? "✅ 済" : "❌ 未",
        m.checkInTimestamp ? formatTimestamp(m.checkInTimestamp) : "",
    ]);

    // シートをクリアして書き込み
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

    if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    // 日付をシート説明に
    sheet.getRange("H1").setValue(`最終更新: ${date}`);
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
