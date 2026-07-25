import collegesoftLogo from '../../assets/collegesoft.png';

const effectiveDate = 'July 18, 2026';
const supportEmail = 'devlofttech@gmail.com';
const companyName = 'Collegesoft';

const privacySections = [
  {
    title: 'Overview',
    body: [
      'Collegesoft is a college management application for institutions, staff, students, and parents. This Privacy Policy explains how information is handled when you use the Collegesoft mobile app and web portal.',
      'The app is intended for authorized users connected to a college, school, or educational institution. Access is controlled by the institution through assigned ERP roles.',
    ],
  },
  {
    title: 'Information We Process',
    body: [
      'Account information such as name, email address, phone number, role, login identifiers, and account status.',
      'Student and academic records such as admission details, class/course details, attendance, marks, results, fee records, documents, notices, and parent-linked student records.',
      'Operational records entered by authorized staff, including timetable, examinations, reports, payment status, and document verification data.',
      'Technical information needed for authentication, security, app performance, and Firebase services.',
    ],
  },
  {
    title: 'How Information Is Used',
    body: [
      'To authenticate users and show role-based ERP screens.',
      'To let authorized staff manage college operations and let parents view linked student information.',
      'To display notices, fee status, attendance, academic progress, documents, and reports.',
      'To protect accounts, troubleshoot issues, maintain app reliability, and comply with applicable rules.',
    ],
  },
  {
    title: 'Sharing And Service Providers',
    body: [
      'Information is shared only with authorized users inside the institution according to their ERP role permissions.',
      'Collegesoft uses Firebase and Google Cloud services for authentication, database storage, file storage, and app infrastructure.',
      'We do not sell student, parent, or staff personal information.',
    ],
  },
  {
    title: 'Children And Student Data',
    body: [
      'Student data is processed for educational administration and parent/guardian access. Parent users can only view students linked to their account.',
      'The app is not designed for advertising, behavioral tracking, or unrelated commercial profiling of children or students.',
    ],
  },
  {
    title: 'Retention And Deletion',
    body: [
      "Records are retained according to the institution's academic, administrative, and legal requirements.",
      'Users may request correction, export, or deletion through their institution administrator or by contacting support. Some records may need to be retained for compliance, audit, or academic history.',
    ],
  },
  {
    title: 'Security',
    body: [
      'Collegesoft uses role-based access, Firebase Authentication, and database security rules to restrict access to authorized users.',
      'No system is perfectly secure, so users should protect their login credentials and report suspected unauthorized access immediately.',
    ],
  },
  {
    title: 'Contact',
    body: [
      `For privacy questions, account help, or data requests, contact ${companyName} support at ${supportEmail}.`,
    ],
  },
];

const termsSections = [
  {
    title: 'Acceptance Of Terms',
    body: [
      'By using Collegesoft, you agree to these Terms and Conditions. If you are using the app on behalf of an institution, you confirm that you are authorized to do so.',
    ],
  },
  {
    title: 'Authorized Use',
    body: [
      'Collegesoft is for college, school, and ERP administration. Users may access only the modules and records permitted by their assigned role.',
      'Parents and guardians may view only student records linked to their account.',
    ],
  },
  {
    title: 'Account Responsibility',
    body: [
      'You are responsible for keeping your login credentials secure and for all activity under your account.',
      'Do not share credentials, attempt to bypass role permissions, or access records that do not belong to you.',
    ],
  },
  {
    title: 'Data Accuracy',
    body: [
      'Institutions and authorized staff are responsible for entering accurate academic, fee, attendance, document, and profile information.',
      'Users should report incorrect information to the institution administrator for correction.',
    ],
  },
  {
    title: 'Acceptable Use',
    body: [
      'Do not misuse the service, upload harmful files, interfere with app operation, attempt unauthorized access, or use the app for unlawful activity.',
    ],
  },
  {
    title: 'Service Availability',
    body: [
      'Collegesoft depends on internet connectivity and third-party cloud services. We may update, suspend, or modify features to improve reliability, security, or compliance.',
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'The Collegesoft app, logo, interface, and software are owned by their respective rights holders. Institution data remains controlled by the institution according to applicable agreements and policies.',
    ],
  },
  {
    title: 'Contact',
    body: [
      `For support, questions, or account issues, contact ${companyName} support at ${supportEmail}.`,
    ],
  },
];

function LegalShell({ title, subtitle, children }) {
  return (
    <main className="min-h-screen bg-[#f7fbff] text-[#102033]">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-5 py-10 sm:px-8">
        <header className="rounded-2xl border border-[#d8e8ff] bg-white p-6 shadow-[0_18px_55px_rgba(30,99,242,0.10)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="h-20 w-20 overflow-hidden rounded-2xl border border-[#d8e8ff] bg-white p-1 shadow-sm">
              <img src={collegesoftLogo} alt="Collegesoft" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#1e63f2]">Collegesoft</p>
              <h1 className="mt-2 text-3xl font-extrabold text-[#102a5c] sm:text-4xl">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-[#72839a]">{subtitle}</p>
              <p className="mt-3 text-xs font-semibold text-[#72839a]">Effective date: {effectiveDate}</p>
            </div>
          </div>
        </header>
        <article className="rounded-2xl border border-[#d8e8ff] bg-white p-6 shadow-[0_18px_55px_rgba(30,99,242,0.08)]">
          {children}
        </article>
        <footer className="text-center text-xs font-semibold text-[#72839a]">
          Collegesoft legal information for app store publication.
        </footer>
      </section>
    </main>
  );
}

function LegalSections({ sections }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.title}>
          <h2 className="text-xl font-extrabold text-[#102a5c]">{section.title}</h2>
          <div className="mt-3 space-y-3 text-sm leading-7 text-[#334155]">
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SupportPage() {
  return (
    <LegalShell
      title="Support"
      subtitle="Help, account support, privacy requests, and app store review contact information."
    >
      <div className="space-y-6 text-sm leading-7 text-[#334155]">
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Contact Support</h2>
          <p className="mt-3">
            Email: <span className="font-bold">{supportEmail}</span>
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">What To Include</h2>
          <p className="mt-3">
            Include your name, role, institution name, registered email or phone, device model, and a short description
            of the issue. Do not include passwords.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Data Requests</h2>
          <p className="mt-3">
            For account deletion, correction, or privacy requests, contact support or your institution administrator.
            Some academic or administrative records may need to be retained by the institution.
          </p>
        </section>
      </div>
    </LegalShell>
  );
}

function AccountDeletionPage() {
  return (
    <LegalShell
      title="Account Deletion"
      subtitle="How Collegesoft users can request account deletion and related data handling."
    >
      <div className="space-y-8 text-sm leading-7 text-[#334155]">
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Request Account Deletion</h2>
          <p className="mt-3">
            To request deletion of your Collegesoft account, email <span className="font-bold">{supportEmail}</span> or
            contact your institution administrator.
          </p>
          <a
            href={`mailto:${supportEmail}?subject=Collegesoft account deletion request`}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1e63f2] px-5 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(30,99,242,0.22)] transition hover:bg-[#164fc7] focus:outline-none focus:ring-4 focus:ring-[#bfd4ff]"
          >
            Email deletion request
          </a>
          <p className="mt-3">
            Include your full name, role, institution name, and registered email address or phone number. Do not send
            your password.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">What Can Be Deleted</h2>
          <p className="mt-3">
            Eligible deletion may include your app login account, account profile, role access, parent portal link, and
            support request metadata that is no longer needed.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Records That May Be Retained</h2>
          <p className="mt-3">
            Some academic, attendance, fee, exam, document, audit, security, and administrative records may be retained
            by the institution when required for legal, compliance, accounting, academic history, or dispute-resolution
            purposes.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Processing Time</h2>
          <p className="mt-3">
            We aim to acknowledge deletion requests within 7 days and complete eligible deletion within 30 days after
            verifying the request and institution ownership requirements.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-extrabold text-[#102a5c]">Partial Data Requests</h2>
          <p className="mt-3">
            Users may also request correction, export, or deletion of specific data without deleting their account by
            contacting support or their institution administrator.
          </p>
        </section>
      </div>
    </LegalShell>
  );
}

export default function LegalPage({ type }) {
  if (type === 'terms') {
    return (
      <LegalShell
        title="Terms And Conditions"
        subtitle="Rules for authorized use of the Collegesoft college management app and web portal."
      >
        <LegalSections sections={termsSections} />
      </LegalShell>
    );
  }

  if (type === 'support') return <SupportPage />;
  if (type === 'account-deletion') return <AccountDeletionPage />;

  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="How Collegesoft handles account, student, parent, staff, academic, fee, document, and app data."
    >
      <LegalSections sections={privacySections} />
    </LegalShell>
  );
}
