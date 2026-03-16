/**
 * Validate a Discord snowflake ID
 */
export function isValidSnowflake(id: string): boolean {
    return /^\d{17,20}$/.test(id);
}

/**
 * Validate a comma-separated list of snowflake IDs
 */
export function validateSnowflakeList(input: string): {
    valid: boolean;
    ids: string[];
    invalid: string[];
} {
    const ids = input
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
    const invalid = ids.filter((id) => !isValidSnowflake(id));
    return {
        valid: invalid.length === 0,
        ids,
        invalid,
    };
}
