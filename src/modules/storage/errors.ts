/**
 * Typed errors raised by the storage layer.
 *
 * Repositories throw these instead of generic `Error` so callers (stores,
 * UI) can distinguish "the user violated a rule" from "the record doesn't
 * exist" from "concurrent edit conflict". Future Supabase migration will
 * map server-side constraint violations to the same shapes.
 */

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export class InvariantError extends StorageError {
  constructor(message: string) {
    super(message, "INVARIANT");
    this.name = "InvariantError";
  }
}

export class NotFoundError extends StorageError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends StorageError {
  constructor(message: string) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}
