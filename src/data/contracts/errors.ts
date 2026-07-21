/**
 * Erros de domínio, independentes do data provider.
 *
 * Toda a comunicação com backend deve normalizar erros para estas classes,
 * garantindo que a UI e os serviços não dependem do formato do Supabase (ou
 * de qualquer outro provider futuro).
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "AuthError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, cause?: unknown) {
    super(`${resource} not found`, cause);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "ValidationError";
  }
}
