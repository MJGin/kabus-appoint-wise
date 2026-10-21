# KABU SlotIn — Requirements

KLS 126: Data Science for Lawyers — Group 4.
A scheduling and consultation application for the (fictionalised) School of Law, built with
React + Vite (frontend), Supabase (authentication, database, row-level security) and Lovable
(prompt-driven development with GitHub version control).
**All data in this project is synthetic.** No real personal data is processed or stored.

## 1. Use case

Students need to find staff members, see when they are available and request consultation
slots; staff need to accept or decline those requests and manage their own availability; the
school needs a single, auditable record that every participant consented to taking part.
Before any booking feature may be used, every participant must answer a versioned consent
form, and their decision must be stored as a permanent, non-editable record.

## 2. Users

| Role | Signs in with | MFA (6-digit authenticator) | Can see / do |
|------|---------------|------------------------------|--------------|
| Guest | — | — | Sign-in, sign-up, forgot-password pages |
| Student | email + password (self sign-up) | no | Own profile, consent record, lecturers' published profiles and availability, request/cancel own bookings |
| Lecturer / staff | email + password (must be pre-approved by the administrator) | no | Own profile and availability, incoming requests, accept / decline, own consent record |
| Dean | email + password (seeded account) | yes | Oversight panels in addition to staff abilities |
| School Administrator | email + password (seeded account) | yes | Approve staff/student emails, create logins, reset authenticators, **Consent records**, usage summary, teacher applications |
| IT Support | email + password (seeded account) | yes | Account and user maintenance |

The role of an email address is decided by the database, not by anything the user picks on the
sign-in page. Every table is protected by database row-level security, so the rules hold even
if the interface is bypassed.

## 3. Inputs

- **Account creation:** full name, email address, password + confirmation (students);
  teachers additionally pass through an approval flow.
- **Consent:** four declaration checkboxes (age/understanding, personal information, voluntary
  participation and withdrawal, no sensitive data), a typed full-name signature, and the
  decision *I CONSENT* / *I DO NOT CONSENT*; one-click *Withdraw my consent* afterwards.
- **Booking:** staff member, day/time block, and a short written reason.
- **Staff:** profile fields, availability slots, accept/decline decisions.
- **Administrator:** approved staff/student email lists, create-login entries, authenticator
  resets, teacher application review.

## 4. Outputs

- **Consent record:** participant name, account email, category, decision, typed signature
  name, timestamp and consent form version (`2026-10`); immutable — the panel states that
  records cannot be edited or deleted.
- **My consent page:** status ("You consented"), signed name, date/time, form version and the
  withdrawal button.
- **Booking requests** with status (waiting / accepted / declined) and notifications.
- **Usage summary:** counts and timings only — never anyone's words.

## 5. Acceptance tests

1. A newly created student lands on the consent gate and cannot reach the booking area before
   answering.
2. The gate shows the full form text, including who collects the data (Group 4, via the School
   Administrator, `miriam.atieno@office.kabu.test` — fictional contact).
3. Ticking all four statements and typing the signature enables *I CONSENT*; the decision then
   appears in the administrator's Consent records with name, email, category, timestamp and
   form version.
4. *I DO NOT CONSENT* also records the decision and keeps the booking area closed.
5. *Withdraw my consent* marks the record withdrawn and the gate returns at the next sign-in.
6. When the consent form version changes, earlier answers are shown as not-current and the
   participant is asked again.
7. Only administrator, dean and IT support accounts are asked for the authenticator code;
   students and lecturers never are.
8. The Consent records panel offers no edit or delete control and says records are permanent.
9. The usage summary shows aggregates only.
10. Nothing in the application, the repository or the submitted documents contains a real
    email domain, a password, an API key or real personal data.

## 6. Constraints

- **Synthetic data only** — invented names on the `@kabu.test` family of domains; the real
  university domain appears nowhere.
- **Authentication by email address only** (no usernames, no registration-number login).
- **Secrets never committed** — passwords and API keys live in Supabase/Lovable environment
  variables; the repository contains no `.env` file.
- **Database changes are made by hand in the Supabase SQL editor** (migration files in
  `supabase/migrations/`), never by the AI builder, to avoid unintended drift.
- **Deployment is always explicit:** a team member clicks *Sync from GitHub* and then
  *Publish* in Lovable; nothing auto-deploys.
- **No AI-driven slot finder** — students browse availability and request slots themselves.
- The consent wording is single-sourced in the app code (`src/lib/consent.ts`) and mirrored
  in the submitted consent document; version bumps update both together.
- Every AI-generated change is reviewed by a team member and tested in the published
  application with synthetic users before it counts as done.
