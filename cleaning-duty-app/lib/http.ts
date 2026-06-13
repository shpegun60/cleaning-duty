import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function badRequest(message: string) {
  return new HttpError(400, message);
}

export function unauthorized(message = "Unauthorized") {
  return new HttpError(401, message);
}

export function forbidden(message = "Forbidden") {
  return new HttpError(403, message);
}

export function notFound(message = "Not found") {
  return new HttpError(404, message);
}

export function conflict(message: string) {
  return new HttpError(409, message);
}

export function handleRouteError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected error";

  if (message === "Unauthorized") {
    return Response.json({ error: message }, { status: 401 });
  }

  if (message === "Forbidden") {
    return Response.json({ error: message }, { status: 403 });
  }

  return Response.json({ error: message }, { status: 500 });
}
