# KABU SlotIn — AI Disclosure

KLS 126: Data Science for Lawyers — Group 4.

## 1. AI tools used

| Tool | What it was used for |
|------|----------------------|
| **Lovable** (docs.lovable.dev) — prompt-driven AI application builder (models by Anthropic, Claude) | Generating and iteratively changing the application from natural-language prompts; GitHub integration for version control; hosting the preview and the published builds |
| **OpenCode** — open-source AI coding-agent CLI (model: `mimo-v2.6-flash-free`, provider: opencode) | Reviewing the generated codebase; multi-file code edits (consent form wording and version, replacing all real contact addresses with the fictional dataset, repository hygiene); drafting Supabase SQL migrations; writing this documentation; producing the submitted consent PDF (HTML → headless-Chrome PDF) and capturing/vetting the evidence screenshots; computing a one-time TOTP code during a controlled MFA test |

No other AI tools were used (no AI code plugins, no AI image or document services beyond the
two above).

AI was **not** used to process any real personal data — every name, email address and record
in this project is synthetic.

## 2. What AI did not do

- AI does not decide bookings or "find" slots for students — that feature intentionally does
  not exist; students browse availability and request slots themselves.
- AI never received database credentials and never executed SQL against the database; SQL was
  drafted by the AI and executed only by a team member in the Supabase SQL editor.
- AI never published the application; every deploy is a team member clicking
  *Sync from GitHub* and then *Publish* in Lovable.

## 3. How the output was verified

- **Human review of every change:** code diffs were read before committing; migrations were
  read line by line before being run.
- **Testing in the published application:** end-to-end journeys with synthetic users
  (create account → consent gate → tick statements → sign → dashboard; administrator sign-in
  with authenticator code → Consent records panel), each step captured as a screenshot and
  inspected.
- **Automated checks:** repository-wide greps confirming no real email domain, no password and
  no API key remain anywhere in the tree; PDF text extraction confirming page count and that
  forbidden strings are absent from the submitted document.
- **Database verification:** after each manual migration, function definitions were re-read
  with `pg_get_functiondef` to confirm the live database matches the intended change.
- **Regression checks:** after each *Publish*, the live site was re-checked in the browser —
  this caught, for example, a stale build still containing an old contact address, which was
  re-published and re-captured before submission.

## 4. Accountability

All AI output was treated as draft input, not as final work. The members of Group 4 reviewed,
tested and take full responsibility for every line of the submitted application and every
statement in the submitted documents.
