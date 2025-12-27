/**
 * Date Utilities (Shared)
 *
 * Centralized date formatting functions for JST timezone.
 * Used by both app and bot.
 */

/**
 * Get today's date in JST (YYYY-MM-DD format)
 */
export function getTodayJST(): string {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + jstOffset);
    return jstDate.toISOString().split("T")[0];
}

/**
 * Format a Date object to JST timestamp string
 * @param date - Date object to format
 * @param format - Output format: "datetime" | "date" | "time"
 */
export function formatJST(date: Date, format: "datetime" | "date" | "time" = "datetime"): string {
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(date.getTime() + jstOffset);
    const isoString = jstDate.toISOString();

    switch (format) {
        case "date":
            return isoString.split("T")[0];
        case "time":
            return isoString.split("T")[1].slice(0, 8);
        default:
            return isoString.replace("T", " ").slice(0, 19);
    }
}

/**
 * Parse a date string and check if it's valid
 */
export function isValidDateString(dateStr: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;

    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}
