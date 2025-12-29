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
    // 会議名の表示順（上から順に表示、リストにない会議は最後にアルファベット順）
    CONFERENCE_ORDER: [
        "AJMUN37 内政不干渉原則宣言",
        "AJMUN37 カルタヘナ議定書",
        "AJMUN37 NPT2005",
        "AJMUN37 欧州における移民及び庇護に関する新協定（PAM）",
        "平和への課題：補遺_AJMUN37",
        "Ajmun37th_南ローデシア情勢",  // 部分一致で判定
        "AJMUN37ワシントン会議",
        "AJMUN37th",
    ],
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
            "DM送信",
            "DM日時",
            "DMエラー",
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
                // DM情報を更新（最新のものがあれば）
                if (m.dmStatus && m.dmStatus !== "none") {
                    existing.dmStatus = m.dmStatus;
                    existing.dmSentAt = m.dmSentAt;
                    existing.dmErrorMessage = m.dmErrorMessage;
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
                    dmStatus: m.dmStatus,
                    dmSentAt: m.dmSentAt,
                    dmErrorMessage: m.dmErrorMessage,
                    attendanceByDate: m.attendanceByDate || {},
                });
            }
        }

        // Map → 配列に変換してソート（会議優先順 → 出席日数順）
        const aggregatedUsers = Array.from(userMap.values()).sort((a, b) => {
            // 1. 会議優先順でソート（最初の会議を基準に）
            const aConf = getConferencePriority(a.guilds[0]);
            const bConf = getConferencePriority(b.guilds[0]);
            if (aConf !== bConf) return aConf - bConf;

            // 2. 同じ会議内では出席日数が多い順
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
                    // 手動チェックインは📝、スキャンは✅
                    return info.checkInMethod === "manual" ? "📝" : "✅";
                }
                return "";
            });

            const attendedDays = countAttendedDays(u.attendanceByDate);

            // DM状態の整形
            let dmStatusLabel = "";
            switch (u.dmStatus) {
                case "sent": dmStatusLabel = "✅ 済"; break;
                case "failed": dmStatusLabel = "❌ 失敗"; break;
                case "pending": dmStatusLabel = "⏳ 処理中"; break;
                default: dmStatusLabel = "-";
            }

            return [
                u.discordUserId,
                u.globalName,
                u.nicknames.join(", "),
                // 会議名も優先順でソートして表示
                u.guilds.sort((a, b) => getConferencePriority(a) - getConferencePriority(b)).join(", "),
                getAttributeLabel(u.attribute),
                dmStatusLabel,
                u.dmSentAt ? formatTimestamp(u.dmSentAt) : "",
                u.dmErrorMessage || "",
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
 * 会議名の優先順位を取得（部分一致対応）
 * 優先順位リストにない会議は大きな数字を返す（最後にソート）
 */
function getConferencePriority(guildName) {
    if (!guildName) return 999;

    for (let i = 0; i < CONFIG.CONFERENCE_ORDER.length; i++) {
        const pattern = CONFIG.CONFERENCE_ORDER[i];
        // 完全一致または部分一致
        if (guildName === pattern || guildName.includes(pattern) || pattern.includes(guildName)) {
            return i;
        }
    }
    // リストにない会議は最後（999）
    return 999;
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
        case "secretary": return "当セク";
        default: return "参加者";
    }
}

/**
 * タイムスタンプをJSTでフォーマット
 */
function formatTimestamp(isoString) {
    if (!isoString || isoString === "null" || isoString === "undefined") return "";

    // カンマ区切りなどで複数来る場合に対応
    const timestamps = isoString.split(",").filter(ts => ts && ts.trim());
    if (timestamps.length === 0) return "";

    const formatted = timestamps.map(ts => {
        const trimmed = ts.trim();
        if (!trimmed) return null;

        const date = new Date(trimmed);
        // Invalid date or very old date (before 2024) is likely a bug
        if (isNaN(date.getTime()) || date.getFullYear() < 2024) {
            console.log(`Invalid date skipped: ${trimmed}`);
            return null;
        }
        return Utilities.formatDate(date, "Asia/Tokyo", "MM/dd HH:mm");
    }).filter(d => d !== null);

    return formatted.join("\n"); // 改行区切りで表示（セル内改行）
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
