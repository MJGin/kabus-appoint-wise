import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Bump this when the wording of the form changes so people are asked again. */
export const CONSENT_FORM_VERSION = "2026-10";

export const PROJECT_LEAD_EMAIL = "miriam.atieno@office.kabu.test";
export const WITHDRAWAL_EMAILS = ["miriam.atieno@office.kabu.test", "peter.wafula@office.kabu.test"];

export const AT_A_GLANCE: { label: string; value: string }[] = [
  {
    label: "Who is collecting your data",
    value:
      "Group 4 members, first years second semester students of law school are responsible for this project. Group leader Alma Zawadi; data and consent requests go to the School Administrator, miriam.atieno@office.kabu.test",
  },
  {
    label: "What is collected",
    value:
      "Your account email address and the full name you type when creating your account; personal schedules such as timetables and professional profile descriptions; your consultation requests and bookings; and your consent decision (consent or decline, your typed signature name, the date and the form version). Student registration numbers are held only where an official school record already contains them. The application will not collect personal photographs, telephone number, identity card number, location or any other biometrics.",
  },
  {
    label: "How accounts are created",
    value:
      "Students create their own account on the Create account page with their email, full name and password and can sign in immediately. An applicant for a teaching login sends their name and email through the same page; the School Administrator approves the application before a login is made. Dean, IT Support and Administrator logins are created only by the School Administrator.",
  },
  {
    label: "How consent is given",
    value:
      "After you sign in, this consent form opens inside the app before the booking area. You read it, tick four statements, type your full name as your signature, then choose I CONSENT or I DO NOT CONSENT. Your decision, signature name, email, date and form version are recorded; you can view or withdraw it at any time from My consent.",
  },
  {
    label: "Why is it collected",
    value:
      "It will be solely for student and staff scheduling and consultation application and to serve as a proof for consent for the application built during the module.",
  },
  {
    label: "Application used",
    value:
      "Lovable.dev – free software development platform used to build the application; Supabase – cloud service that hosts the database, accounts and consent records",
  },
  {
    label: "Where is it processed",
    value:
      "These platforms store data on servers outside Kenya specifically Europe (Ireland). By consenting to this form, you agree to your name, university email address and scheduling data to be processed outside country for this project.",
  },
  {
    label: "Who can see it",
    value:
      "It will only be accessible to students and staff/faculty of law school. The data will not be shared with anyone else.",
  },
  {
    label: "How long it is kept",
    value:
      "Specific personal data will be kept for a period of 5 years, following the legal data retention requirement then deleted if no longer needed.",
  },
  {
    label: "Legal basis",
    value:
      "The data protection act no. 24 of 2019 and applicable guidelines as stated by the Office of the Data Protection Commissioner (ODPC)",
  },
  {
    label: "Excluded students",
    value: "Students under the age of eighteen years are excluded from the project.",
  },
];

export const RIGHTS: string[] = [
  "The right to be informed about how their personal data is being used.",
  "The right to request access to personal data held about them.",
  "The right to request correction of inaccurate or misleading personal data.",
  "The right to object certain processing of your personal data.",
  "Right to request decline to take part or the erasure of your data.",
  "The right to data portability where applicable.",
  "The right to withdraw consent at any time where the processing is based on consent. Withdrawal does not affect processing that was lawful before withdrawal.",
  "The right to lodge a complaint with the office of the Data Protection Commissioner (ODPC).",
];

/** The four acknowledgements a participant ticks before choosing. */
export const STATEMENTS: string[] = [
  "I confirm that I am 18 years old and I have read and understood this consent form and have had an opportunity to ask questions about the KABUSlotIn.",
  "I understand what personal information will be collected from me, why it will be collected, how it may be used, who may access it and how long it is expected to be retained.",
  "I understand that participation is voluntary and that I may withdraw my consent in accordance with this form.",
  "I understand that I should not enter confidential, sensitive or any unnecessary personal information.",
];

export type ConsentRow = {
  id: string;
  user_id: string;
  form_version: string;
  decision: "consent" | "decline" | "withdraw";
  participant_category: string;
  full_name: string;
  email: string;
  created_at: string;
};

/** The signed-in person's newest decision, or null if they have not answered yet. */
export function useMyConsent() {
  return useQuery({
    queryKey: ["my-consent"],
    queryFn: async (): Promise<ConsentRow | null> => {
      const { data, error } = await supabase
        .from("consent_records")
        .select(
          "id, user_id, form_version, decision, participant_category, full_name, email, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as ConsentRow | null) ?? null;
    },
  });
}

/** True only when the newest decision is a consent to the current wording of the form. */
export function hasCurrentConsent(row: ConsentRow | null | undefined) {
  return !!row && row.decision === "consent" && row.form_version === CONSENT_FORM_VERSION;
}
