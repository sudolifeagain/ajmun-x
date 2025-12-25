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
    // 大会日程（4日間）
    EVENT_DATES: ["2025-12-27", "2025-12-28", "2025-12-29", "2025-12-30"],
};

// ==========================
// メイン関数
// ==========================

/**
 * 全会議の出席状況を同期（4日間分を列で表示）
 * メニューから実行、またはトリガーで定期実行
 */
function syncAllAttendance() {
    console.log("syncAllAttendance started");
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();

        console.log(`Fetching data for ${CONFIG.EVENT_DATES.join(", ")}...`);

        // APIからデータ取得（全日程分）
        const data = fetchAttendanceData(CONFIG.EVENT_DATES);
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

        // ヘッダー（4日分の列を追加）
        const dateLabels = CONFIG.EVENT_DATES.map(d => {
            const [, month, day] = d.split("-");
            return `${parseInt(month)}/${parseInt(day)}`;
        });

        const headers = [
            "Discord ID",
            "グローバル名",
            "ニックネーム",
            "所属会議",
            "属性",
            ...dateLabels,  // 12/27, 12/28, 12/29, 12/30
            "出席日数"
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
                // ニックネームを追加（空でなく、重複しないように）
                if (m.nickname && !existing.nicknames.includes(m.nickname)) {
                    existing.nicknames.push(m.nickname);
                }
                // 各日の出席状況をマージ
                if (m.attendanceByDate) {
                    for (const [date, info] of Object.entries(m.attendanceByDate)) {
                        if (info.attended) {
                            existing.attendanceByDate[date] = info;
                        }
                    }
                }
            } else {
                userMap.set(m.discordUserId, {
                    discordUserId: m.discordUserId,
                    globalName: m.globalName,
                    nicknames: m.nickname ? [m.nickname] : [],
                    guilds: [m.guildName],
                    attribute: m.attribute,
                    attendanceByDate: m.attendanceByDate || {},
                });
            }
        }

        // Map → 配列に変換してソート（出席日数が多い順）
        const aggregatedUsers = Array.from(userMap.values()).sort((a, b) => {
            const aCount = countAttendedDays(a.attendanceByDate);
            const bCount = countAttendedDays(b.attendanceByDate);
            return bCount - aCount;
        });

        console.log(`Unique users: ${aggregatedUsers.length}`);

        const rows = aggregatedUsers.map(u => {
            // 各日の出席状況
            const dailyAttendance = CONFIG.EVENT_DATES.map(date => {
                const info = u.attendanceByDate[date];
                if (info && info.attended) {
                    return "✅";
                }
                return "";
            });

            const attendedDays = countAttendedDays(u.attendanceByDate);

            return [
                u.discordUserId,
                u.globalName,
                u.nicknames.join(", "),
                u.guilds.join(", "),
                getAttributeLabel(u.attribute),
                ...dailyAttendance,
                attendedDays > 0 ? attendedDays : ""
            ];
        });

        console.log("Writing to sheet...");
        // シートをクリアして書き込み
        sheet.clear();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

        if (rows.length > 0) {
            sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        }

        // 最終更新日時をシートに表示
        const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm");
        sheet.getRange(1, headers.length + 1).setValue(`最終更新: ${now}`);

        // サマリー表示
        const totalUsers = aggregatedUsers.length;
        const todayDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
        const todayAttended = aggregatedUsers.filter(u =>
            u.attendanceByDate[todayDate] && u.attendanceByDate[todayDate].attended
        ).length;

        console.log(`Sync completed: Today ${todayAttended}/${totalUsers}`);
        ss.toast(`同期完了: 本日 ${todayAttended}/${totalUsers}人 出席済み`, "完了");

    } catch (e) {
        console.error("Sync Error:", e);
        if (e.stack) console.error(e.stack);
        SpreadsheetApp.getUi().alert("処理エラー: " + e.message);
    }
}

/**
 * 出席日数をカウント
 */
function countAttendedDays(attendanceByDate) {
    if (!attendanceByDate) return 0;
    return Object.values(attendanceByDate).filter(info => info && info.attended).length;
}

/**
 * APIからデータを取得（複数日対応）
 * Authorizationヘッダーで認証
 */
function fetchAttendanceData(dates) {
    const datesParam = dates.join(",");
    const url = `${CONFIG.API_URL}?dates=${datesParam}`;
    console.log(`Connecting to: ${url}`);

    try {
        const response = UrlFetchApp.fetch(url, {
            muteHttpExceptions: true,
            validateHttpsCertificates: false,
            headers: {
                "Authorization": `Bearer ${CONFIG.API_KEY}`
            }
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
