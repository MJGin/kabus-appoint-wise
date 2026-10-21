# KABU SlotIn — Sign-In Details (synthetic dataset)

> All accounts are **fictional test users** on the `@kabu.test` / `@students.kabu.test` /
> `@office.kabu.test` domains. No real student or staff data is used anywhere in this project.
> The shared demo password is **not stored in this repository**; the group provides it to the
> lecturer privately with the submission.

## How accounts are created (current app)

| Kind | How the account comes to exist |
|------|-------------------------------|
| Student | Self sign-up on the **Create account** page (instant; any `@students.kabu.test` address) |
| Lecturer / staff | Applies on **Create account** (Teacher); the School Administrator approves the email first |
| Dean / IT Support / Administrator | Seeded in the database (fictional dataset below); cannot self-sign-up |

The **role of an email is decided by the database**, not by anything chosen on the sign-in page.
The administrator, dean and IT support accounts must additionally enter a 6-digit
authenticator-app code after the password (MFA). Students and lecturers sign in with
email + password only.

## Seeded staff accounts (fictional)

| Name | Email | Role |
|------|-------|------|
| Miriam Atieno | miriam.atieno@office.kabu.test | School Administrator (MFA) |
| Peter Wafula | peter.wafula@office.kabu.test | Dean (MFA) |
| Sharon Chelimo | sharon.chelimo@office.kabu.test | IT Support (MFA) |

## Seeded lecturers (fictional)

| Name | Email |
|------|-------|
| Aisha Njeri | aisha.njeri@kabu.test |
| Duncan Kiprop | duncan.kiprop@kabu.test |
| Esther Wambui | esther.wambui@kabu.test |
| Frank Mutiso | frank.mutiso@kabu.test |
| Grace Achieng | grace.achieng@kabu.test |

## Seeded students (fictional)

| Name | Email |
|------|-------|
| Hillary Otieno | hillary.otieno@students.kabu.test |
| Joy Mwikali | joy.mwikali@students.kabu.test |
| Kevin Rotich | kevin.rotich@students.kabu.test |
| Leah Cheptoo | leah.cheptoo@students.kabu.test |
| Martin Kinuthia | martin.kinuthia@students.kabu.test |

Any student can also create a fresh account on the Create account page
(e.g. `firstname.lastname@students.kabu.test`).

## Login instructions

1. Open the published application and click **Sign in**.
2. Sign in with email + password (password supplied privately by the group).
3. The administrator, dean and IT support accounts are asked for a 6-digit authenticator code
   (Second step). For the administrator test account the authenticator setup key is provided
   privately as well.
4. Every participant must answer the **Participation Consent Form** once before the booking
   area opens; their decision is stored as a permanent record in the administrator's
   **Consent records** panel.

## Time blocks

| Block | Time |
|-------|------|
| 1 | 08:00 – 11:00 |
| 2 | 11:00 – 14:00 (Chapel on Wednesdays) |
| 3 | 14:00 – 17:00 |

Days: 1 = Monday … 5 = Friday.
