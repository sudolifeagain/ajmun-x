/**
 * Guild Resolver (Shared)
 *
 * Resolves the primary guild for a user based on their attribute.
 * This logic is shared between QR code DM sending and scan check-in.
 *
 * Note: This module uses dynamic prisma import to avoid circular dependencies.
 */

// ============================================================================
// Types
// ============================================================================

export interface GuildMembershipInfo {
    guildId: string;
    guildName: string;
    isTargetGuild: boolean;
    isOperationServer: boolean;
    roleIds: string;
}

export interface PrimaryGuildResult {
    guildId: string | null;
    guildName: string;
}

// ============================================================================
// Prisma Access
// ============================================================================

/**
 * Get Prisma client dynamically to avoid circular dependencies
 */
async function getPrisma() {
    // Dynamic import to avoid circular dependency issues
    const { default: prisma } = await import("../../app/lib/prisma");
    return prisma;
}

// ============================================================================
// Guild Resolution Strategies
// ============================================================================

/**
 * Resolve primary guild for staff members
 * Staff prioritize the operation server
 */
function resolveStaffGuild(memberships: GuildMembershipInfo[]): PrimaryGuildResult {
    const opServer = memberships.find((m) => m.isOperationServer);
    if (opServer) {
        return { guildId: opServer.guildId, guildName: opServer.guildName };
    }

    // Fallback to any target guild
    const targetGuild = memberships.find((m) => m.isTargetGuild);
    return {
        guildId: targetGuild?.guildId || null,
        guildName: targetGuild?.guildName || "",
    };
}

/**
 * Resolve primary guild for organizers
 * Organizers prioritize their mapped conference from OrganizerRoleMapping
 */
async function resolveOrganizerGuild(memberships: GuildMembershipInfo[]): Promise<PrimaryGuildResult> {
    // Get all role IDs from their memberships
    const allRoleIds = memberships.flatMap((m) => {
        try {
            return JSON.parse(m.roleIds) as string[];
        } catch {
            return [];
        }
    });

    // Find OrganizerRoleMapping for any of their roles
    const prisma = await getPrisma();
    const roleMapping = await (prisma as any).organizerRoleMapping?.findFirst({
        where: {
            roleId: { in: allRoleIds },
        },
    });

    if (roleMapping) {
        const targetGuildIds = roleMapping.targetGuildIds.split(",").map((id: string) => id.trim());
        const targetMembership = memberships.find((m) => targetGuildIds.includes(m.guildId));
        if (targetMembership) {
            return {
                guildId: targetMembership.guildId,
                guildName: targetMembership.guildName,
            };
        }
    }

    // Fallback: use any target guild they're in
    const targetGuild = memberships.find((m) => m.isTargetGuild);
    return {
        guildId: targetGuild?.guildId || null,
        guildName: targetGuild?.guildName || "",
    };
}

/**
 * Resolve primary guild for participants
 * Participants should only be in one target guild
 */
function resolveParticipantGuild(memberships: GuildMembershipInfo[]): PrimaryGuildResult {
    const targetGuild = memberships.find((m) => m.isTargetGuild);
    return {
        guildId: targetGuild?.guildId || null,
        guildName: targetGuild?.guildName || "",
    };
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Resolve the primary guild for a user based on their attribute
 *
 * @param memberships - User's guild memberships with guild info
 * @param attribute - User's primary attribute (staff, organizer, participant)
 * @returns Primary guild ID and name
 */
export async function resolvePrimaryGuild(
    memberships: GuildMembershipInfo[],
    attribute: string
): Promise<PrimaryGuildResult> {
    switch (attribute) {
        case "staff":
            return resolveStaffGuild(memberships);
        case "organizer":
            return resolveOrganizerGuild(memberships);
        default:
            return resolveParticipantGuild(memberships);
    }
}

/**
 * Helper to convert Prisma membership results to GuildMembershipInfo
 */
export function toGuildMembershipInfo(membership: {
    guildId: string;
    roleIds: string;
    guild: {
        guildName: string;
        isTargetGuild: boolean;
        isOperationServer: boolean;
    };
}): GuildMembershipInfo {
    return {
        guildId: membership.guildId,
        guildName: membership.guild.guildName,
        isTargetGuild: membership.guild.isTargetGuild,
        isOperationServer: membership.guild.isOperationServer,
        roleIds: membership.roleIds,
    };
}
