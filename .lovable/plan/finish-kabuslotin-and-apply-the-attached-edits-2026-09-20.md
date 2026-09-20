# Finish KABUSLotIn and apply the attached edits

## Outcome
Complete the secure appointment system from the existing database foundation, connect real accounts, add the five role-specific work areas, and apply every wording/photo change from the attached document.

## Landing page edits
- Replace the current campus image with the supplied real Kabarak University aerial photograph.
- Change the opening message to: “Make appointments with your lecturers; make it easier to interact.”
- Use the revised supporting sentence from the document.
- Rename “Today’s blocks” to “Normal teaching time in a day”.
- Rename the roles section to “Users” and use the revised safety sentence.
- Keep the Chapel warning, with the document’s emphasis and wording.
- Rename the final section to “Security precautions” while preserving its existing security details.
- Use sans-serif typography throughout.

## Accounts and protected access
- Connect student registration-number sign-in, approved staff email sign-in, account creation, sign-out, and non-revealing password recovery to live accounts.
- Route signed-in users to the correct work area based on their database-held role.
- Protect all work areas from signed-out users and prevent users opening another role’s view.
- Add the required second identity step for Administrator and IT Support accounts.
- Add server-enforced account and network throttling for sign-in and sensitive appointment actions.

## Role work areas
- **Student:** browse lecturer profiles and real availability, request appointments with a private reason, view only personal appointments, cancel pending requests.
- **Lecturer:** maintain own profile/photo, see own timetable and appointment requests, accept/decline/reschedule within recorded availability, add make-up sessions.
- **Dean:** view all lecturer schedules, make-up sessions, appointment activity, and the permitted operational log without private reasons or actions.
- **Administrator:** manage approved staff emails, semester dates, timetable rows/uploads, exam slots, and aggregate usage summaries without private reasons.
- **IT Support:** view system health, error reports, technical logs, and limited account details; support password resets without appointment reasons.

## Database and security hardening
- Add any missing database functions and constraints needed for atomic booking-with-reason, safe status transitions, rescheduling, exact role permissions, exam week rules, and activity logging.
- Ensure privileged roles cannot read appointment reasons and that IT Support cannot read appointment records.
- Add request security headers: no embedding, no referrer leakage, no MIME sniffing, same-origin restrictions, and HTTPS enforcement for live traffic.
- Keep Administrator creation unavailable inside the running app; no demo, seed, reset, or hidden Administrator creation path will be added.

## Verification
- Apply database changes through a migration and confirm database health/security checks.
- Test account flows and each role’s allowed/denied actions.
- Check the revised landing page and primary work areas on desktop and mobile, including the supplied photograph, text fit, and empty/error states.
- Verify every content page has unique sharing and search metadata.

## Required user data after completion
The timetable and approved staff email list remain intentionally empty until you upload the real data.
