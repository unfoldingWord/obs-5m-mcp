export const ErrorCode = {
  INVALID_PARAMS: "INVALID_PARAMS",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  UPSTREAM_DCS_ERROR: "UPSTREAM_DCS_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const ERROR_STATUS: Record<ErrorCodeValue, number> = {
  [ErrorCode.INVALID_PARAMS]: 400,
  [ErrorCode.RESOURCE_NOT_FOUND]: 404,
  [ErrorCode.UPSTREAM_DCS_ERROR]: 502,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
};

export class Obs5mError extends Error {
  readonly code: ErrorCodeValue;
  readonly statusCode: number;
  readonly retryable: boolean;
  readonly context?: Record<string, unknown>;

  constructor(options: {
    code: ErrorCodeValue;
    message: string;
    retryable?: boolean;
    context?: Record<string, unknown>;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "Obs5mError";
    this.code = options.code;
    this.statusCode = ERROR_STATUS[options.code] ?? 500;
    this.retryable = options.retryable ?? false;
    this.context = options.context;
  }

  toMcpError(): { code: string; message: string } {
    return { code: this.code, message: this.message };
  }
}

export function isObs5mError(err: unknown): err is Obs5mError {
  return err instanceof Obs5mError;
}
