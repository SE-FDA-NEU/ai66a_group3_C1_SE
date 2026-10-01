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
    body?.error?.message ?? "Something went wrong",
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
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as AuthResponse;
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
