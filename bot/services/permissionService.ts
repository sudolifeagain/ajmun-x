import { prisma } from "../utils";

export type PermissionLevel = "none" | "staff" | "admin";

interface PermissionConfig {
    staffRoleIds: string[];
    adminRoleIds: string[];
}

/**
 * Fetch permission configuration from database
 */
export async function getPermissionConfig(): Promise<PermissionConfig> {
    const [staffConfig, adminConfig] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { key: "staff_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "admin_role_ids" } }),
    ]);

    return {
        staffRoleIds: staffConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
        adminRoleIds: adminConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
    };
}

/**
 * Get user's permission level based on all guild memberships
 * Supports both role IDs and user IDs in the same config
 * Priority: admin > staff > none
 */
export async function getUserPermissionLevel(userId: string): Promise<PermissionLevel> {
    const config = await getPermissionConfig();

    // No IDs configured means no permissions for anyone
    if (config.staffRoleIds.length === 0 && config.adminRoleIds.length === 0) {
        return "none";
    }

    // First, check if user ID is directly in the admin/staff lists
    if (config.adminRoleIds.includes(userId)) {
        return "admin";
    }
    if (config.staffRoleIds.includes(userId)) {
        return "staff";
    }

    // Then check role-based permissions
    const memberships = await prisma.userGuildMembership.findMany({
        where: { discordUserId: userId },
    });

    let hasStaff = false;
    let hasAdmin = false;

    for (const membership of memberships) {
        const userRoles: string[] = JSON.parse(membership.roleIds || "[]");

        if (userRoles.some((roleId) => config.adminRoleIds.includes(roleId))) {
            hasAdmin = true;
            break; // Admin is highest, no need to check further
        }

        if (userRoles.some((roleId) => config.staffRoleIds.includes(roleId))) {
            hasStaff = true;
        }
    }

    if (hasAdmin) return "admin";
    if (hasStaff) return "staff";
    return "none";
}

/**
 * Check if user has at least staff permission
 */
export async function hasStaffPermission(userId: string): Promise<boolean> {
    const level = await getUserPermissionLevel(userId);
    return level === "staff" || level === "admin";
}

/**
 * Check if user has admin permission
 */
export async function hasAdminPermission(userId: string): Promise<boolean> {
    const level = await getUserPermissionLevel(userId);
    return level === "admin";
}

/**
 * Check if any permissions are configured
 * Returns false if no staff or admin roles are set (initial setup mode)
 */
export async function arePermissionsConfigured(): Promise<boolean> {
    const config = await getPermissionConfig();
    return config.staffRoleIds.length > 0 || config.adminRoleIds.length > 0;
}
