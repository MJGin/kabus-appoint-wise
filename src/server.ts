import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

/**
 * The backend origin is read from the server environment so the Content
 * Security Policy always names the host the app actually talks to. Hardcoding
 * a vendor domain here would silently block sign-in whenever the backend lives
 * somewhere else.
 */
const backendOrigin = (() => {
  for (const raw of [process.env["SUPABASE_URL"], process.env["VITE_SUPABASE_URL"]]) {
    if (!raw) continue;
    try {
      return new URL(raw).origin;
    } catch {
      // fall through to the next candidate
    }
  }
  return "";
})();

const backendHost = backendOrigin.replace(/^[a-z]+:\/\//, "");
const devHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function securityHeadersFor(request: Request): Record<string, string> {
  let isDev = false;
  try {
    isDev = devHosts.has(new URL(request.url).hostname);
  } catch {
    isDev = false;
  }

  const connect = ["'self'", "https://*.supabase.co", "wss://*.supabase.co"];
  if (backendOrigin) connect.push(backendOrigin, `wss://${backendHost}`);
  if (isDev) connect.push("ws://localhost:*", "ws://127.0.0.1:*");

  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline'",
    `connect-src ${connect.join(" ")}`,
    // Only live traffic is forced to HTTPS; the local preview is served over http.
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function secure(response: Response, headers: Record<string, string>) {
  const merged = new Headers(response.headers);
  Object.entries(headers).forEach(([name, value]) => merged.set(name, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: merged,
  });
}

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
  headers: Record<string, string>,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return secure(new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  }), headers);
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const headers = securityHeadersFor(request);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return secure(await normalizeCatastrophicSsrResponse(response, headers), headers);
    } catch (error) {
      console.error(error);
      return secure(new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      }), headers);
    }
  },
};
