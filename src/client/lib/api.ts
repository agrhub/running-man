import type { ErrorResponse } from '../../shared/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const isError = (body: unknown): body is ErrorResponse =>
  typeof body === 'object' &&
  body !== null &&
  'status' in body &&
  body.status === 'error';

export const request = async <T>(path: string, body?: unknown): Promise<T> => {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok || isError(json)) {
    const message = isError(json)
      ? json.message
      : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return json as T;
};
