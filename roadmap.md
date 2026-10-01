# KABUSLotIn roadmap

- [x] Branding, landing page, logo, auth UI
- [x] Database: tables, roles, RLS, Chapel + availability rules, audit log, sign-up gate
- [x] Email/password sign-in enabled
- [x] Wire auth (student reg number / staff email), protected routes
- [x] Student dashboard: lecturer list, booking, own appointments
- [x] Lecturer dashboard: profile, calendar, requests, make-up sessions
- [x] Dean view-only dashboard
- [x] Administrator: timetable upload, semester dates, exam slots, approved staff emails, usage summaries
- [x] IT Support: health, error reports, technical log
- [x] Second step at sign-in for Administrator and IT Support
- [x] Rate limits for appointment actions + security headers
- [x] Let lecturers read the names of students who booked with them
- [x] Full-width Kabarak University School of Law hero (no cropping on phones)
- [x] Logo rebuilt as crisp vector art: three-block "K", "KABU SlotIn", tagline, no trademark
- [x] Landing wording edits from the attached document
- [x] Fixed: the page security policy was blocking the app's own backend, so signed-in
      users were bounced back to sign-in. The allowed address is now read from the
      backend configuration instead of being hardcoded.
- [x] Checked in the live preview: signed-in student work area renders with correct
      empty states, signed-out visits to the work area redirect to sign-in,
      desktop and mobile layouts clean, no console errors
- [x] Every content page carries its own title, description and sharing metadata
- [ ] Remove the four leftover test student accounts from the live database
      (LAW/1001/2024, LAW/1002/2024, LAW/M/1001/2024/25, LAW/M/1002/2024/25)
      — accounts can only be deleted from the backend user list
- [ ] Lecturer / Dean / Administrator / IT Support work areas checked with real accounts
      (needs approved staff emails on the allow list first)

Waiting on user: real timetable data and the approved staff email list (user will upload once the app is ready).
