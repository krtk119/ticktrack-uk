import { NextResponse } from "next/server";
import { SyncServiceUnavailableError } from "./sync";

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

  // Generic fallback without leaking internal details or stack traces
  const message =
    error instanceof Error ? error.message : "An unexpected server error occurred";
  return jsonError("INTERNAL_ERROR", message, 500);
}
