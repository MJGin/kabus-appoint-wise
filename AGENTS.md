<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Security headers

## Presentation architecture

Keep the light/dark choice on the document root and persist explicit choices in localStorage; shared semantic CSS variables style every route, while the landing reveal reads scroll position without a motion library to honor reduced-motion preferences.

`src/server.ts` builds the security headers per request. The Content Security Policy's `connect-src` must be
derived from the backend URL environment variable rather than a hardcoded vendor domain: the browser makes its
auth and data calls to whatever host the backend configuration names, so a fixed allow-list silently breaks
sign-in (the protected route gate fails and users are bounced back to the sign-in page). Keep any
local-preview relaxations (development websocket hosts, skipping the forced HTTPS upgrade) gated on the
request hostname being localhost, so the policy served to real visitors stays strict.

