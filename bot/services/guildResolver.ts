/**
 * Guild Resolver Service
 *
 * Re-exports the shared guild resolver.
 * This file exists for backward compatibility.
 */

export {
    resolvePrimaryGuild,
    toGuildMembershipInfo,
    type GuildMembershipInfo,
    type PrimaryGuildResult,
} from "../../lib/shared/guildResolver";
