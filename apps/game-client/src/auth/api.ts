import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from "@terrativa/protocol";

const { VITE_API_ORIGIN: configuredApiOrigin } = import.meta.env;
const apiOrigin = configuredApiOrigin ?? "http://localhost:2567";
let accessToken: string | null = null;
let restoreSessionRequest: Promise<AuthResponse | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function getApiOrigin(): string {
  return apiOrigin;
}

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  return authenticate("/api/v1/auth/register", input);
}

export async function login(input: LoginRequest): Promise<AuthResponse> {
  return authenticate("/api/v1/auth/login", input);
}

export function restoreSession(): Promise<AuthResponse | null> {
  if (restoreSessionRequest) {
    return restoreSessionRequest;
  }

  restoreSessionRequest = refreshSession().finally(() => {
    restoreSessionRequest = null;
  });
  return restoreSessionRequest;
}

async function refreshSession(): Promise<AuthResponse | null> {
  const csrfToken = readCookie("terrativa_csrf");
  if (!csrfToken) {
    return null;
  }

  const response = await fetch(`${apiOrigin}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
    body: "{}",
  });
  if (!response.ok) {
    accessToken = null;
    return null;
  }
  const auth = (await response.json()) as AuthResponse;
  accessToken = auth.accessToken;
  return auth;
}

export async function logout(): Promise<void> {
  const csrfToken = readCookie("terrativa_csrf");
  if (!accessToken || !csrfToken) {
    accessToken = null;
    return;
  }
  await fetch(`${apiOrigin}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "x-csrf-token": csrfToken,
    },
  });
  accessToken = null;
}

export async function loadProfile(): Promise<UserProfile | null> {
  if (!accessToken) {
    return null;
  }
  const response = await fetch(`${apiOrigin}/api/v1/me`, {
    credentials: "include",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return response.ok ? ((await response.json()) as UserProfile) : null;
}

export async function authenticatedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = accessToken;
  if (!token) {
    token = (await restoreSession())?.accessToken ?? null;
  }
  if (!token) {
    throw new Error("auth.sessionExpired");
  }

  let response = await sendAuthenticated(path, token, init);
  if (response.status === 401) {
    token = (await restoreSession())?.accessToken ?? null;
    if (!token) {
      throw new Error("auth.sessionExpired");
    }
    response = await sendAuthenticated(path, token, init);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { messageKey?: string };
    } | null;
    throw new Error(body?.error?.messageKey ?? "server.internalError");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function authenticate(
  path: string,
  input: LoginRequest | RegisterRequest,
): Promise<AuthResponse> {
  const response = await fetch(`${apiOrigin}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = (await response.json()) as {
      error?: { messageKey?: string };
    };
    throw new Error(body.error?.messageKey ?? "server.internalError");
  }
  const auth = (await response.json()) as AuthResponse;
  accessToken = auth.accessToken;
  return auth;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function sendAuthenticated(path: string, token: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${apiOrigin}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
}
