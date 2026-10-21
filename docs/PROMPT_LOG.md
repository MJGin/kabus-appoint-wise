# KABU SlotIn — Prompt Log

Every prompt given to an AI tool during this project, with the date it was given and a note on
how the result was checked. Times are East Africa Time.

## A. Prompts given to Lovable (the team)

The initial build prompt (row 1) is preserved verbatim in [`README.md`](../README.md).
Dates are approximate windows — Lovable's chat panel shows the exact order of every message.

| # | Date | Prompt (abridged) | How the result was checked |
|---|------|-------------------|----------------------------|
| 1 | mid-Sept 2026 | Build "KABUSLotIn", an appointment-booking system for the School of Law: React interface + Supabase login/database, every access rule enforced **inside the database** (assume the interface can be bypassed); five user kinds (Student, Lecturer, Dean, School Administrator, IT Support) each seeing only what is listed for them; students book lecturer slots with a written reason and can cancel their own requests; lecturers manage their own profile, timetable-based calendar and incoming requests (accept/decline/reschedule, make-up sessions); the Dean gets a school-wide read-only view (never the written reasons); the Administrator uploads the semester timetable, sets the semester start and exam dates and sees usage summaries; IT Support sees system health and account details but never booking reasons; three daily time blocks with Wednesday 11:00–14:00 Chapel blocked outright; an activity log for every important action, readable only by Administrator/IT/the Dean's limited view; nothing reachable without login, no demo/seed/reset feature in the live app; rate-limited login/booking attempts that never reveal whether an account exists; a mandatory second login step for Administrator and IT Support; security headers (anti-framing, referrer policy, MIME sniffing, HTTPS, own-origin-only requests); teal/burnt-orange/soft-white branding, modern SaaS landing page with "forgot password?" and a professional logo with trademark. **Full text: [`README.md`](../README.md).** | Generated UI reviewed in the Lovable preview; one test account per role created; each access rule checked against the database, not just the interface |
| 2 | late Sept 2026 | Restate the system roles as a credential/capability matrix: Student signs in with the LAW/M registration number, Lecturer with a pre-approved university email, Dean with a pre-approved institutional email, School Admin with master credentials + mandatory 2-factor (AAL2), IT Support likewise with mandatory 2-factor | Role matrix implemented as the account system; sign-in tested for every role, second-step codes tested for the two 2-factor roles |
| 3 | late Sept 2026 | A modern SaaS-style landing page in the prescribed colours (teal primary, burnt-orange accents, soft-white background), including a visible "forgot password?" flow, plus a clean, modern, professional logo carrying a trademark, shown in the landing-page header | Landing page reviewed in the preview at desktop and mobile sizes; forgot-password flow tested end to end (reset message arrives at the account email) |
| 4 | late Sept 2026 | Note: the semester timetable and the approved staff email list will be uploaded once the build reaches that point | Timetable upload and approved-emails panel tested by the administrator account after the upload |
| 5 | late Sept 2026 | Pick up exactly where you left off, apply the suggested edits from the attached documents, and replace the in-app photo with the university photo taken from the university website (cropped wide, fitting the screen left-to-right); restyle the "KABARAK UNIVERSITY" lettering so it is not an exact copy, for copyright reasons | Hero image checked in the preview full-width; lettering change confirmed visually |
| 6 | early Oct 2026 | Full visual-identity redesign: Midnight Navy (#0B1F33) as the anchor for nav/hero/headings, Electric Teal (#18B7B0) for interactive and availability elements, Coral (#FF6B5B) for calls to action and notifications, Mist (#F3F7F8) backgrounds with white card surfaces and Ink (#17202A) text; the whole language built around "slotting in" — rounded schedule blocks, modular cards, subtle grids, connected lines, dark hero sections, layered dashboard previews, soft shadows and controlled gradients; avoid a generic university-portal look. Also: update the wide restyled hero image, replace the logo with the attached one, remove the trademark, and finish the outstanding items | Every page reviewed in the preview after the redesign; design screenshots kept in the group's records (older ones remain in the repository's history as walkthrough images) |
| 7 | early Oct 2026 | Add a scroll-linked text reveal: a large paragraph whose words start dim (~25% opacity) and light up one by one as the user scrolls, dimming again when scrolling back up; section tall with the text sticky in the centre; respect prefers-reduced-motion | Tried and reviewed in the preview; later replaced by the fade-in animation (row 9) at the team's decision |
| 8 | early Oct 2026 | Add a light/dark mode toggle: small sun/moon button in the top-right corner, smooth colour transition driven by CSS variables so every surface (including animated text) updates correctly; default to the system preference and remember the choice after a refresh | Toggle tested in both modes; persistence verified by reloading the page |
| 9 | early Oct 2026 | Replace the scroll-linked text reveal with a fade-in-on-scroll animation: elements start invisible and shifted ~30px down, fade and slide up over ~500ms with an ease-out curve when entering the viewport, via the Intersection Observer API, triggered once per element, with a ~100ms stagger within a group; respect prefers-reduced-motion | Scroll animations verified on the published landing page |
| 10 | mid-Oct 2026 | The system should work like an app (discoverable by search engines, installable) and should not strictly require an internet connection — support lecturers' actions offline | SEO/manifest settings checked; offline behaviour reviewed honestly: pages can load from cache, but bookings and approvals still need the server, so offline support is best-effort |

## B. Prompts given to the OpenCode AI coding agent (CLI), 21 Oct 2026

The agent worked on the GitHub-synced repository and the published site; every change was
committed, pushed, published by a team member and then re-verified in the live application.

| # | Date | Request to the AI agent | How the result was checked |
|---|------|-------------------------|----------------------------|
| 1 | 21 Oct 2026 | Make the consent form wording match the new sign-up flow, bump the consent form version (`2026-10`), fix the "alteration" typo | Code diff reviewed; PDF of the consent document re-extracted and grepped; the new wording verified on the live consent gate after Publish |
| 2 | 21 Oct 2026 | Replace every remaining real/legacy contact address in the app with the fictional dataset (`@kabu.test` family) | Repository greps for the old addresses and the real university domain returned zero hits; after *Sync from GitHub* + *Publish*, the live consent form and admin panel were re-checked in the browser |
| 2b | 21 Oct 2026 | Same hygiene pass for the whole repository (root docs, e2e specs, seed and migration files), and remove files that stored a password or real sign-in data | Full-tree grep for real names, real domain and the test password — zero hits before commit; `user-accounts.txt` and a stale `combined-migrations.sql` deleted |
| 3 | 21 Oct 2026 | Draft the database migrations for instant student sign-up, teacher approvals and consent records — to be **run by hand in the Supabase SQL editor** | SQL reviewed line by line by the team before execution; `pg_get_functiondef` used to re-read the live functions afterwards; instant student sign-up tested on the published site |
| 4 | 21 Oct 2026 | Produce the Group 4 consent PDF: keep the CAT2 document to two pages of consent plus the cover, and embed live screenshots of the consent steps taken with synthetic users | PDF rendered headless and verified programmatically (4 pages, text extraction, zero forbidden strings); every page inspected as an image; screenshots re-taken on the freshly published build until no real address was visible anywhere |
| 5 | 21 Oct 2026 | Test the administrator MFA flow (reset authenticator, re-enrol, sign in with a generated TOTP code) and capture the Consent records panel | Successful sign-in to the School Administrator area; the records panel screenshot shows the synthetic users only |
| 6 | 21 Oct 2026 | Write the assignment documentation (`docs/REQUIREMENTS.md`, `docs/PROMPT_LOG.md`, `docs/AI_DISCLOSURE.md`) and scan the repository for secrets before submission | Repository scans for keys, passwords and real data (zero matches); the three documents reviewed by the team |

## C. Rules that applied to every AI tool use

- Schema changes were **drafted** by the AI but **executed only by a team member** in the
  Supabase SQL editor; the AI never held database credentials.
- Publishing is always manual: a team member clicks *Sync from GitHub*, reviews the change,
  then *Publish*.
- All test accounts, names and email addresses are synthetic; no real personal data was ever
  pasted into an AI tool for this project.
- Anything an AI produced was treated as a draft: reviewed, tested in the published app with
  synthetic users, and only then accepted.
