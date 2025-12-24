import { prisma } from "../utils";

interface AttributeConfig {
    staffRoleIds: string[];
    organizerRoleIds: string[];
    operationGuildId: string | null;
    targetGuildIds: string[];
}

/**
 * Fetch attribute configuration from database
 */
export async function getAttributeConfig(): Promise<AttributeConfig> {
    const [staffConfig, organizerConfig, operationGuildConfig, targetGuildConfig] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { key: "staff_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "organizer_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "operation_guild_id" } }),
        prisma.systemConfig.findUnique({ where: { key: "target_guild_ids" } }),
    ]);

    return {
        staffRoleIds: staffConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
        organizerRoleIds: organizerConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
        operationGuildId: operationGuildConfig?.value || null,
        targetGuildIds: targetGuildConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
    };
}

/**
 * Determine user attribute based on roles
 * Priority: staff > organizer > participant
 */
export function determineAttribute(
    roleIds: string[],
    config: AttributeConfig
): "staff" | "organizer" | "participant" {
    const isStaff = roleIds.some((id) => config.staffRoleIds.includes(id));
    const isOrganizer = roleIds.some((id) => config.organizerRoleIds.includes(id));

    if (isStaff) return "staff";
    if (isOrganizer) return "organizer";
    return "participant";
}

/**
 * Check if a guild is the operation server
 */
export function isOperationServer(guildId: string, config: AttributeConfig): boolean {
    return config.operationGuildId === guildId;
}

/**
 * Check if a guild is a target guild for attendance tracking
 * If targetGuildIds is not configured, all guilds are considered targets
 * If configured, only guilds in the list are targets
 */
export function isTargetGuild(guildId: string, config: AttributeConfig): boolean {
    // If no target_guild_ids configured, all guilds are targets (backward compatible)
    if (config.targetGuildIds.length === 0) {
        return true;
    }
    // Otherwise, check if this guild is in the list
    return config.targetGuildIds.includes(guildId);
}

