import { AT_A_GLANCE, RIGHTS, WITHDRAWAL_EMAILS, PROJECT_LEAD_EMAIL } from "@/lib/consent";

function H({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <h3 className="font-display text-base font-semibold text-brand-ink">
      {n}. {children}
    </h3>
  );
}

/** Read-only copy of the KABUSlotIn participation consent form (sections 1–5 and the withdrawal note). */
export function ConsentText() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-foreground">
      <header className="text-center">
        <p className="font-display text-lg font-semibold tracking-wide text-brand-ink">
          KABARAK UNIVERSITY
        </p>
        <p className="text-sm text-muted-foreground">School of Law</p>
        <h2 className="mt-2 font-display text-xl font-semibold text-primary">
          Participation Consent Form — August 2026
        </h2>
        <p className="text-sm text-muted-foreground">
          KABUSlotIn student and staff scheduling and consultation application
        </p>
      </header>

      <section className="space-y-2">
        <H n="1">About this app</H>
        <p>
          KABUSlotIn is a student developed application designed as a practical academic project to
          explore how technology can improve communication and scheduling between students and staff
          within the school of law. The application is intended to help students identify relevant
          staff members, view their professional profiles and availability. They can also request or
          schedule consultations, classes or other approved academic engagements.
        </p>
        <p>
          The project is intended for academic demonstration, evaluation and testing. Your
          participation supports a learning exercise and a proof of concept only. Unless expressly
          adopted or authorized by Kabarak university, KABUSlotIn is not intended to replace any
          official university timetable, student information system, attendance system or any other
          official university record.
        </p>
      </section>

      <section className="space-y-2">
        <H n="2">Key information at a glance</H>
        <dl className="divide-y divide-border rounded-xl border border-border bg-background">
          {AT_A_GLANCE.map((row) => (
            <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
              <dt className="font-medium text-brand-ink">{row.label}</dt>
              <dd className="text-muted-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <H n="3">Your rights</H>
        <p>
          Under applicable Kenyan data protection law, participants have rights to the processing of
          their personal data. These include:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {RIGHTS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <p>
          To exercise any of these rights, contact or email the project leader using the details in
          section 2 ({PROJECT_LEAD_EMAIL}). Requests will be handled accordingly.
        </p>
      </section>

      <section className="space-y-2">
        <H n="4">Voluntary participation and withdrawal</H>
        <p>
          Participation in this project is voluntary. Whether you participate or not it will not
          have any bearing on you. A participant may decline to provide consent or may withdraw
          consent without giving a reason and without academic, employment or disciplinary
          disadvantage. Where a participant does not consent, they should not be required to provide
          the proposed personal data for the KABUSlotIn project. Withdrawal will not affect the
          lawfulness of processing carried out before withdrawal.
        </p>
        <p>
          Consent is given inside the app: after you sign in the form opens before the booking
          area, you tick each of the four statements, type your full name as your signature and
          choose <b>I CONSENT</b> or <b>I DO NOT CONSENT</b>. Your decision is recorded with the
          date and this form's version, and you may withdraw it at any time from My consent.
        </p>
      </section>

      <section className="space-y-2">
        <H n="5">Potential risks and benefits</H>
        <p>
          The main foreseeable risk is the unauthorized disclosure, alteration and misuse of
          personal information. The team project will take reasonable measure to minimize this risk.
          Participants will benefit from this application which is intended to make academic
          scheduling and student staff communication more efficient.
        </p>
        <p>
          KABUSlotIn does not guarantee that every booking, consultation or scheduling request will
          be accepted and the application should not be treated as an official university decision –
          making system unless formally authorized.
        </p>
      </section>

      <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-muted-foreground">
        If you no longer wish your data to be used and would like to withdraw your consent, kindly
        contact {WITHDRAWAL_EMAILS.join(" or ")}. Thank you.
      </p>
    </div>
  );
}
