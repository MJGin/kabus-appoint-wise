# KABU SlotIn — Prompt Log

Every prompt given to an AI tool during this project, with the date it was given and a note on
how the result was checked. Times are East Africa Time.

## A. Prompts given to Lovable (the team)

> **Team action:** open the Lovable project — the chat panel keeps every prompt that was sent —
> and paste them into the table below in order (shortening a prompt is fine, changing its
> meaning is not). Add the "how checked" note for each one (preview walkthrough, created test
> account, code review before Publish, screenshot, …).

| # | Date | Prompt (abridged) | How the result was checked |
|---|------|-------------------|----------------------------|
| 1 | early Oct 2026 *(confirm exact date from the Lovable chat)* | The full build prompt for "KABUSLotIn" — an appointment-booking system for the School of Law with five user kinds, database-enforced access rules, approved staff lists and time blocks. **It is preserved verbatim in [`README.md`](../README.md).** | Reviewed the generated UI in the Lovable preview; created test accounts; checked each access rule against the database |
| 2…n | *(team to complete from the Lovable chat)* | e.g. profile pages, availability, booking requests, notifications, consent form, admin panels, sign-up flows | *(how you verified each one)* |

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
