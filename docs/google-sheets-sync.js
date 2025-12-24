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
function syncAllAttendance() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");

    // APIからデータ取得
    const data = fetchAttendanceData(today);
    if (!data) return;

    // シート取得または作成
    let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
        sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    }

    // ヘッダー
    const headers = [
        "Discord ID",
        "グローバル名",
        "ニックネーム",
        "会議名",
        "属性",
        "出席状況",
        "スキャン日時"
    ];

    // データ整形（出席済み → 未出席の順、会議名でソート）
    const sortedMembers = data.members.sort((a, b) => {
        // まず会議名でソート
        if (a.guildName < b.guildName) return -1;
        if (a.guildName > b.guildName) return 1;
        // 次に出席状況（出席済みが先）
        if (a.attended && !b.attended) return -1;
        if (!a.attended && b.attended) return 1;
        return 0;
    });

    const rows = sortedMembers.map(m => [
        m.discordUserId,
        m.globalName,
        m.nickname,
        m.guildName,
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

    // 最終更新日時をシートに表示
    sheet.getRange("I1").setValue(`最終更新: ${today} ${Utilities.formatDate(new Date(), "Asia/Tokyo", "HH:mm")}`);

    // サマリー表示
    const attended = data.members.filter(m => m.attended).length;
    const total = data.members.length;
    SpreadsheetApp.getUi().alert(`同期完了: ${attended}/${total}人 出席済み`);
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
