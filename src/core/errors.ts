export const EXIT_USAGE = 1;
export const EXIT_VALIDATION = 2;
export const EXIT_CONFLICT = 3;
export const EXIT_NOT_FOUND = 4;
export const EXIT_IO = 5;

export type AiwErrorCode =
  | "USAGE"
  | "NOT_FOUND"
  | "VALIDATION"
  | "MISSING_PARENT"
  | "CYCLE"
  | "IO"
  | "UNSUPPORTED"
  | "CONFLICT";

export class AiwError extends Error {
  readonly code: AiwErrorCode;
  readonly exitCode: number;
  readonly details: Record<string, unknown>;
  readonly suggestion: string | undefined;

  constructor(
    code: AiwErrorCode,
    message: string,
    options?: {
      exitCode?: number;
      details?: Record<string, unknown>;
      suggestion?: string;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AiwError";
    this.code = code;
    this.exitCode = options?.exitCode ?? exitCodeFor(code);
    this.details = options?.details ?? {};
    this.suggestion = options?.suggestion;
  }
}

function exitCodeFor(code: AiwErrorCode): number {
  switch (code) {
    case "USAGE":
      return EXIT_USAGE;
    case "NOT_FOUND":
      return EXIT_NOT_FOUND;
    case "VALIDATION":
    case "MISSING_PARENT":
    case "CYCLE":
    case "UNSUPPORTED":
      return EXIT_VALIDATION;
    case "CONFLICT":
      return EXIT_CONFLICT;
    case "IO":
      return EXIT_IO;
  }
}

export function isAiwError(error: unknown): error is AiwError {
  return error instanceof AiwError;
}
