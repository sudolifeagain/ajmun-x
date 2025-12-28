/**
 * Generate a default color based on guild ID for guilds without icons
 */
export function generateDefaultColor(guildId: string): string {
    const colors = [
        "#3B82F6", // blue
        "#10B981", // green
        "#F59E0B", // amber
        "#EF4444", // red
        "#8B5CF6", // purple
        "#EC4899", // pink
        "#06B6D4", // cyan
    ];
    const index = parseInt(guildId.slice(-4), 16) % colors.length;
    return colors[index];
}

/**
 * Get attribute label in Japanese
 */
export function getAttributeLabel(attr: string): string {
    return attr === "staff" ? "事務局員" :
        attr === "organizer" ? "会議フロント" : "参加者";
}
