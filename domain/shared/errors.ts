export type ApplicationErrorCode =
  | 'candidate_not_found'
  | 'forbidden'
  | 'invalid_request'
  | 'unauthorized'
  | 'unexpected';

export class ApplicationError extends Error {
  public constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApplicationError';
  }
}
