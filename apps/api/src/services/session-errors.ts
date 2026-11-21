import { SessionLockedError, InvalidStateTransitionError } from "@ai-copilot/contracts";

export { SessionLockedError, InvalidStateTransitionError };

export class SessionNotFoundError extends Error {
  constructor(message = "Assessment session not found") {
    super(message);
    this.name = "SessionNotFoundError";
    Object.setPrototypeOf(this, SessionNotFoundError.prototype);
  }
}

export class SessionExpiredError extends Error {
  constructor(message = "Assessment session has expired. Modifications and AI calls are blocked.") {
    super(message);
    this.name = "SessionExpiredError";
    Object.setPrototypeOf(this, SessionExpiredError.prototype);
  }
}

export class SessionInvalidStateError extends Error {
  constructor(message = "Assessment session is not in a valid state for this operation") {
    super(message);
    this.name = "SessionInvalidStateError";
    Object.setPrototypeOf(this, SessionInvalidStateError.prototype);
  }
}

export class SessionStaleRevisionError extends Error {
  constructor(message = "Stale workspace revision rejected: incoming revision is older than currently persisted revision") {
    super(message);
    this.name = "SessionStaleRevisionError";
    Object.setPrototypeOf(this, SessionStaleRevisionError.prototype);
  }
}

export class MutationIdConflictError extends Error {
  constructor(message = "Mutation ID was already committed with different content") {
    super(message);
    this.name = "MutationIdConflictError";
    Object.setPrototypeOf(this, MutationIdConflictError.prototype);
  }
}
