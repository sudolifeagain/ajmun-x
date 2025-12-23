import { prisma } from "../utils";

interface AttributeConfig {
    staffRoleIds: string[];
    organizerRoleIds: string[];
    operationGuildId: string | null;
}

/**
 * Fetch attribute configuration from database
 */
export async function getAttributeConfig(): Promise<AttributeConfig> {
    const [staffConfig, organizerConfig, operationGuildConfig] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { key: "staff_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "organizer_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "operation_guild_id" } }),
    ]);

    return {
        staffRoleIds: staffConfig?.value.split(",").map((id) => id.trim()) || [],
        organizerRoleIds: organizerConfig?.value.split(",").map((id) => id.trim()) || [],
        operationGuildId: operationGuildConfig?.value || null,
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
