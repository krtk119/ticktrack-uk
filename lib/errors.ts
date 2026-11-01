import { NextResponse } from "next/server";
import { SyncServiceUnavailableError } from "./sync";
import { SetupError } from "./db";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Creates a standardized JSON error response without exposing internal stack traces.
 */
export function jsonError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status });
}

/**
 * Handles errors thrown inside Route Handlers safely.
 */
export function handleRouteError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof SyncServiceUnavailableError) {
    return jsonError(error.code, error.message, error.statusCode);
  }

  if (error instanceof SetupError) {
    console.error(`[setup] ${error.message}`);
    return jsonError("SETUP_ERROR", error.message, 500);
  }

  // Anything else is unexpected: log the details on the server, but send the client a
  // generic message so internal details (such as SQL errors) are never exposed.
  console.error("[api] Unexpected error:", error);
  return jsonError("INTERNAL_ERROR", "An unexpected server error occurred. Please try again.", 500);
}
