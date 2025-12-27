/**
 * Discord Webhook Logger
 *
 * Re-exports the shared logger implementation.
 * This file exists for backward compatibility.
 */

export { log, logger, type LogLevel, type LogContext } from "../../lib/shared/logger";
export { default } from "../../lib/shared/logger";
