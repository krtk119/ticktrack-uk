/**
 * Global Vitest test setup file.
 * Explicitly sets timezone to Europe/London (UTC+1 during British Summer Time)
 * to verify UTC date handling is invariant to local machine timezones.
 */
process.env.TZ = "Europe/London";
