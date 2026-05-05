let _sessionToken: string | null = null;

export function updateMobileSessionToken(token: string | null): void {
  _sessionToken = token;
}

export function getMobileSessionToken(): string | null {
  return _sessionToken;
}

/**
 * Installs a global fetch interceptor that automatically appends
 * an Authorization: Bearer header to all requests targeting /api/
 * paths. Call this once at app startup, before any API calls are made.
 *
 * Only intercepts relative paths (/api/...) or absolute URLs that
 * contain /api/ so external requests (S3 uploads, Expo services, etc.)
 * are never modified.
 */
export function installAuthInterceptor(): void {
  const originalFetch = globalThis.fetch as typeof fetch;

  // Avoid double-patching
  if ((globalThis.fetch as { __authPatched?: boolean }).__authPatched) return;

  globalThis.fetch = Object.assign(
    function patchedFetch(
      input: RequestInfo | URL,
      init: RequestInit = {}
    ): Promise<Response> {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;

      const isApiCall =
        url === "/api" ||
        url.startsWith("/api/") ||
        /\/api\//.test(url);

      if (_sessionToken && isApiCall) {
        const existingHeaders =
          init?.headers ??
          (typeof Request !== "undefined" && input instanceof Request
            ? input.headers
            : undefined);

        const headers = new Headers(existingHeaders as HeadersInit | undefined);
        if (!headers.has("authorization")) {
          headers.set("authorization", `Bearer ${_sessionToken}`);
        }
        return originalFetch(input, { ...init, headers });
      }

      return originalFetch(input, init);
    },
    { __authPatched: true }
  );
}
