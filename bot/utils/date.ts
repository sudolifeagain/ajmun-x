/**
 * Get today's date in JST (Japan Standard Time) format YYYY-MM-DD
 */
export function getTodayJST(): string {
    const now = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstDate = new Date(now.getTime() + jstOffset);
    return jstDate.toISOString().split("T")[0];
}
