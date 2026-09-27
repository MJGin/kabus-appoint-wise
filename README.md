# Kabarak Law Appointments

Build “KABUSLotIn”, an appointment-booking system for the Kabarak University School of Law, using React for the interface and Supabase for the login system and database. Every access rule below must be enforced inside the database itself, not only hidden in the interface. Assume a user could bypass the interface entirely, so the database must refuse anything they aren't allowed to do on its own.
The five kinds of users
There are five kinds of accounts: Student, Lecturer, Dean, School Administrator, and IT Support. Every table in the database must be locked down by default, so that a kind of user only sees what's explicitly listed below for them, nothing more.
1.	Students sign up and log in using their registration number and a password they choose. A registration number must start with "LAW/" followed by other characters. Reject any registration number that doesn't look like that, since other schools use different prefixes and this system is for the School of Law only.
2.	Lecturers log in with their university email and a password. Only someone whose email has already been added to an approved staff list by the Administrator is allowed to create a lecturer account. Anyone else trying to sign up as a lecturer should be rejected, even if they use a real-looking university email. That ends with: @kabarak.ac.ke
3.	The Dean logs in with a university email and password the same way a lecturer does, but is treated as a separate, more senior kind of account. Only one email (or a small approved list) may sign up as Dean, set the same way as the lecturer allow list.
4.	The School Administrator logs in with a separate, elevated username and password of their own. This account is not something anyone can sign up for through the normal registration screen. Set it up once, directly, before the app goes live, and never expose a way to create another Administrator account from inside the running app.
5.	IT Support logs in with a university email and password, and like lecturers, only an email the Administrator has preapproved may become an IT Support account.
What each kind of user can see and do
1.	A Student can see only their own appointments (past, pending, and upcoming), and nobody else's. They can see the published profile and availability of any lecturer, choose an open time slot, and submit a booking request together with a short written reason for the appointment. They can cancel their own pending request. They can never see another student's appointments, another student's reason for booking, or anything in the IT support or audit systems.

2.	A Lecturer signing in lands on their own dashboard. They can update their own profile, including uploading their own photo, never anyone else's. They see a calendar built from the timetable the Administrator uploaded, showing only their own teaching days and times. They see incoming appointment requests addressed specifically to them, including the student's name and the reason for the appointment, and they can accept, decline, or reschedule each one. They can also add one off "make up session" times when they'll be in school outside their normal timetable. A lecturer must never see another lecturer's calendar, requests, or appointment reasons.

3.	The Dean can see how the whole School of Law is running: every lecturer's schedule, every make up session, and a live view of appointment activity across the school, but only to look, not to act. The Dean can see that a lecturer will be in school on a given day and could take an appointment slot then, which is useful for spotting who's available to run a make up lecture, but the Dean cannot see the actual written reason behind any student's appointment, and cannot accept, decline, reschedule, or create appointments on anyone else's behalf. The Dean may look through a log of what's happened in the system (who accepted what, who rescheduled what, when timetables were uploaded), but not a log of who reset whose password, which stays private to IT and the Administrator.

4.	The School Administrator uploads the semester timetable at the start of each semester: which lecturer teaches which unit, to which year group, on which day, and during which of the day's three time blocks. The Administrator sets when the semester starts, and no appointment can be booked for any date before that start date. The Administrator can also set or change exam dates, times, and venues for any unit from week eleven of the semester onward. The Administrator can see how much the system is being used and how effective it is (response times, acceptance rates, that kind of summary), but never an individual student's written reason for an appointment, and never anyone's raw appointment content beyond what's needed for that summary.

5.	IT Support can see whether the system is healthy, read error reports, look through the technical activity log, and see basic account details for every user so they can help someone who's locked out or needs their email or password reset. IT Support must never be able to read the reason a student gave for booking any appointment. That stays visible only to the student who wrote it and the staff member it was sent to, and to absolutely no one else in the system, including IT, the Dean, and the Administrator.
How booking actually works
The teaching day is split into three three-hour blocks: eight to eleven, eleven to two, and two to five. Every Wednesday from eleven to two is Chapel. Nobody (student, lecturer, Dean, or Administrator) may create an appointment, a make-up session, or an exam slot inside that Wednesday window, and the system must refuse the attempt outright rather than simply warn about it. A student can only book a time that falls inside a slot the system already knows the lecturer is available for: either their normal timetabled teaching block for that day, a make-up session that lecturer created, or, once the exam period begins in week eleven, that lecturer's exam period availability instead of their usual teaching block. If a lecturer already has an appointment booked for a day they later find out they won't be in school, they, and only they, can move that appointment to a day they will be in school. The system should not let them move it to a day it has no record of them being available.
SECURITY
Every action that changes something important (a booking accepted, declined, rescheduled, or cancelled; a timetable uploaded; an exam date set; someone's login details reset) must be written to an activity log recording who did it and exactly when, and that log itself can only be read by the Administrator, IT Support, and the Dean's limited operational view described above.
Nothing in this application should be reachable by someone who hasn't logged in. No booking data, no timetable data, no account data should ever be returned to a request that isn't authenticated. There must be no "demo," "test," "seed," or "reset" feature left reachable in the live version of the app, including any hidden way to create another Administrator account. That account is set up once, outside the normal app, and never again through it.
Limit how often someone can try to log in, create a booking, or reschedule one, both by their network address and by their account, so the system can't be hammered with repeated attempts. If someone fails to log in several times in a row, temporarily lock that attempt path rather than letting it continue indefinitely, and never reveal through an error message whether a given registration number or email actually belongs to an account.
Require the two most sensitive accounts, the Administrator and IT Support, to confirm their identity with a second step at login, beyond just a password, since they're the two roles that can touch other people's accounts or the timetable everyone depends on.
Set the application's security headers so that it can't be embedded in someone else's page, won't leak which site referred a visitor, and won't let a browser guess at a file's type incorrectly. Serve everything over a secure, encrypted connection, and only allow this application's own web address to make requests to it, not just any website.
BRANDING
1.	Let the dominant colors be teal, warm white for the background, and burnt orange for icons, secondary buttons, and highlights: Primary: Teal #159A9C, Secondary: Burnt orange #CC5500, Background: Soft White #F7F9FC, Text Slate: #334155, Success/Available Green: #22A06B, Attention/Pending Amber: #F2B84B, Error/Unavailable Muted: Red #D95C5C.
2.	Make a modern SaaS style landing page design. One that has all the available details in an advanced login system; do not forget the "forgot password?"
3.	Create a logo for our system: clean, modern, professional, suitable for a system that is meant to solve a problem. Use the colors as prescribed. It should feel trustworthy…let it have a trademark. It should appear at the landing page hearder.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/83e7886f-4e22-46d2-9958-317510415961).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
