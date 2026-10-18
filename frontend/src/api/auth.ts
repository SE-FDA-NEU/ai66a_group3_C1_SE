import { fallbackErrorMessage, NETWORK_FAILURE_MESSAGE } from "./requestFailure.ts";

export type User = {
  id: string;
  email: string;
};

type AuthResponse = {
  data: {
    user: User;
  };
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    fields?: Record<string, string>;
  };
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<ApiError> {
  let body: ApiErrorResponse | null = null;

  try {
    body = (await response.json()) as ApiErrorResponse;
  } catch {
    // Keep a safe generic fallback if the server returned a non-JSON body.
  }

  return new ApiError(
    body?.error?.message ?? fallbackErrorMessage(response.status),
    response.status,
    body?.error?.code,
  );
}

export async function login(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as AuthResponse;
  return body.data.user;
}

export async function register(email: string, password: string): Promise<User> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (response.status !== 201) {
    throw await readError(response);
  }

  const body = (await response.json()) as AuthResponse;
  return body.data.user;
}

export async function getCurrentUser(): Promise<User> {
  let response: Response;

  try {
    response = await fetch("/api/auth/me", {
      credentials: "include",
    });
  } catch {
    // The session check gates every protected page, so an unreachable API
    // needs a message the viewer can act on rather than the browser's own.
    throw new ApiError(NETWORK_FAILURE_MESSAGE, 0);
  }

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as AuthResponse;
  if (!body?.data?.user || typeof body.data.user.id !== "string" ||
      typeof body.data.user.email !== "string") {
    throw new ApiError("Unable to check your session", 0);
  }
  return body.data.user;
}

export async function logout(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw await readError(response);
  }
}
