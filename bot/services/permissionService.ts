import { prisma } from "../utils";

export type PermissionLevel = "none" | "organizer" | "staff" | "admin";

interface PermissionConfig {
    staffRoleIds: string[];
    adminRoleIds: string[];
    organizerRoleIds: string[];
}

/**
 * Fetch permission configuration from database
 */
export async function getPermissionConfig(): Promise<PermissionConfig> {
    const [staffConfig, adminConfig, organizerConfig] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { key: "staff_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "admin_role_ids" } }),
        prisma.systemConfig.findUnique({ where: { key: "organizer_role_ids" } }),
    ]);

    return {
        staffRoleIds: staffConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
        adminRoleIds: adminConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
        organizerRoleIds: organizerConfig?.value.split(",").map((id) => id.trim()).filter(Boolean) || [],
    };
}

/**
 * Get user's permission level based on all guild memberships
 * Supports both role IDs and user IDs in the same config
 * Priority: admin > staff > organizer > none
 */
export async function getUserPermissionLevel(userId: string): Promise<PermissionLevel> {
    const config = await getPermissionConfig();

    // No IDs configured means no permissions for anyone
    if (config.staffRoleIds.length === 0 && config.adminRoleIds.length === 0 && config.organizerRoleIds.length === 0) {
        return "none";
    }

    // First, check if user ID is directly in the admin/staff/organizer lists
    if (config.adminRoleIds.includes(userId)) {
        return "admin";
    }
    if (config.staffRoleIds.includes(userId)) {
        return "staff";
    }
    if (config.organizerRoleIds.includes(userId)) {
        return "organizer";
    }

    // Then check role-based permissions
    const memberships = await prisma.userGuildMembership.findMany({
        where: { discordUserId: userId },
    });

    let hasStaff = false;
    let hasAdmin = false;
    let hasOrganizer = false;

    for (const membership of memberships) {
        const userRoles: string[] = JSON.parse(membership.roleIds || "[]");

        if (userRoles.some((roleId) => config.adminRoleIds.includes(roleId))) {
            hasAdmin = true;
            break; // Admin is highest, no need to check further
        }

        if (userRoles.some((roleId) => config.staffRoleIds.includes(roleId))) {
            hasStaff = true;
        }

        if (userRoles.some((roleId) => config.organizerRoleIds.includes(roleId))) {
            hasOrganizer = true;
        }
    }

    if (hasAdmin) return "admin";
    if (hasStaff) return "staff";
    if (hasOrganizer) return "organizer";
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
 * Check if user has at least organizer permission
 */
export async function hasOrganizerPermission(userId: string): Promise<boolean> {
    const level = await getUserPermissionLevel(userId);
    return level === "organizer" || level === "staff" || level === "admin";
}

/**
 * Get guild IDs where the user is an organizer (has organizer role)
 * Returns empty array if user is staff/admin (they can see all guilds)
 * Returns null if user has no organizer permission
 * 
 * Logic:
 * 1. Check operation server membership for organizer roles
 * 2. Look up OrganizerRoleMapping for target guild IDs
 * 3. Fall back to legacy behavior (check all guilds for organizer roles)
 */
export async function getOrganizerGuildIds(userId: string): Promise<string[] | null> {
    const level = await getUserPermissionLevel(userId);

    // Staff and admin can see all guilds
    if (level === "staff" || level === "admin") {
        return [];
    }

    // No permission at all
    if (level === "none") {
        return null;
    }

    // Organizer - check for role-guild mappings first
    const config = await getPermissionConfig();

    // Find operation server
    const operationServer = await prisma.guild.findFirst({
        where: { isOperationServer: true },
    });

    const organizerGuildIds = new Set<string>();

    if (operationServer) {
        // Get user's membership in operation server
        const opMembership = await prisma.userGuildMembership.findUnique({
            where: {
                discordUserId_guildId: {
                    discordUserId: userId,
                    guildId: operationServer.guildId,
                },
            },
        });

        if (opMembership) {
            const userRoles: string[] = JSON.parse(opMembership.roleIds || "[]");

            // Check for role-guild mappings
            for (const roleId of userRoles) {
                const mapping = await prisma.organizerRoleMapping.findUnique({
                    where: { roleId },
                });

                if (mapping) {
                    const targetIds = mapping.targetGuildIds.split(",").map((id: string) => id.trim());
                    targetIds.forEach((id: string) => organizerGuildIds.add(id));
                }
            }

            // If mappings found, return them
            if (organizerGuildIds.size > 0) {
                return [...organizerGuildIds];
            }
        }
    }

    // Legacy fallback: find which guilds they have organizer role in
    const memberships = await prisma.userGuildMembership.findMany({
        where: { discordUserId: userId },
    });

    for (const membership of memberships) {
        const userRoles: string[] = JSON.parse(membership.roleIds || "[]");
        if (userRoles.some((roleId) => config.organizerRoleIds.includes(roleId))) {
            organizerGuildIds.add(membership.guildId);
        }
    }

    return [...organizerGuildIds];
}

/**
 * Check if any permissions are configured
 * Returns false if no staff or admin roles are set (initial setup mode)
 */
export async function arePermissionsConfigured(): Promise<boolean> {
    const config = await getPermissionConfig();
    return config.staffRoleIds.length > 0 || config.adminRoleIds.length > 0;
}

