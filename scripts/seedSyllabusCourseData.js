import { existsSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getSyllabusTopics } from './syllabusTopicLibrary.js';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getCredential() {
  const explicitPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const localPath = './serviceAccountKey.json';
  if (explicitPath && existsSync(explicitPath)) return cert(readJson(explicitPath));
  if (existsSync(localPath)) return cert(readJson(localPath));
  throw new Error('Missing service account. Add serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
}

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const academicYear = getArgValue('--academic-year', '2025-2026');
const dryRun = process.argv.includes('--dry-run');
const createdAtText = '07 Jul 2026';
const seedSource = 'Syllabus document import';

initializeApp({ credential: getCredential() });
const db = getFirestore();

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function totalHours(subject) {
  return subject.totalHours ?? (
    Number(subject.theoryHours || 0) +
    Number(subject.practicalHours || 0) +
    Number(subject.clinicalHours || 0)
  );
}

function subject(name, options = {}) {
  return {
    name,
    code: options.code || slugify(name).toUpperCase().replace(/-/g, '').slice(0, 12),
    category: options.category || 'Main',
    theoryHours: options.theoryHours ?? 0,
    practicalHours: options.practicalHours ?? 0,
    clinicalHours: options.clinicalHours ?? 0,
    totalHours: options.totalHours,
    credits: options.credits,
    examMaxMarks: options.examMaxMarks,
    internalMarks: options.internalMarks,
    examType: options.examType,
    sourcePage: options.sourcePage,
    topics: options.topics || [],
    note: options.note || '',
    examEligible: options.examEligible !== false,
  };
}

function exam(subjectName, maxMarks, options = {}) {
  return {
    subjectName,
    maxMarks,
    internalMarks: options.internalMarks,
    examType: options.examType || 'Written',
    durationMinutes: options.durationMinutes || 180,
    sourcePage: options.sourcePage,
    note: options.note || '',
  };
}

function yearPeriod(key, label, className, subjects, exams = []) {
  return { key, label, className, subjects, exams };
}

function semesterPeriod(number, subjects, exams = []) {
  const className = number <= 2 ? '1 St Year' : number <= 4 ? '2nd Year' : number <= 6 ? '3rd Year' : '4th Year';
  return {
    key: `sem${number}`,
    label: `Semester ${number}`,
    className,
    subjects,
    exams,
  };
}

const alliedFirstYearSubjects = [
  subject('Human Anatomy', { code: 'ANAT-Y1', theoryHours: 70, practicalHours: 20, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
  subject('Physiology', { code: 'PHYS-Y1', theoryHours: 70, practicalHours: 20, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
  subject('Biochemistry I', { code: 'BIOC-Y1', theoryHours: 70, practicalHours: 20, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
  subject('Pathology I (Clinical Pathology, Haematology and Blood Banking)', { code: 'PATH-Y1', theoryHours: 70, practicalHours: 20, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
  subject('Microbiology', { code: 'MICR-Y1', theoryHours: 70, practicalHours: 20, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
  subject('English', { code: 'ENG-Y1', category: 'Subsidiary', theoryHours: 25, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
  subject('Kannada', { code: 'KAN-Y1', category: 'Subsidiary', theoryHours: 25, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
  subject('Health Care', { code: 'HC-Y1', category: 'Subsidiary', theoryHours: 40, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
];

const alliedSecondYearSubsidiaries = [
  subject('Sociology', { code: 'SOC-Y2', category: 'Subsidiary', theoryHours: 20, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
  subject('Constitution of India', { code: 'COI-Y2', category: 'Subsidiary', theoryHours: 10, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
  subject('Environmental Science and Health', { code: 'ENV-Y2', category: 'Subsidiary', theoryHours: 10, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
];

const alliedThirdYearSubsidiaries = [
  subject('Ethics, Database Management', { code: 'EDM-Y3', category: 'Subsidiary', theoryHours: 50, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
  subject('Research and Biostatistics', { code: 'RBS-Y3', category: 'Subsidiary', theoryHours: 20, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
  subject('Computer Application', { code: 'COMP-Y3', category: 'Subsidiary', theoryHours: 10, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
];

const curricula = {
  AOTT: {
    title: 'B.Sc Anaesthesia and Operation Theatre Technology',
    code: 'AOTT',
    sourceFile: 'B.Sc A & OTT SYLLABUS (1).pdf',
    duration: 'Three academic years plus one year internship',
    notes: [
      'First-year university examination has theory papers only.',
      'Second year uses combined Applied Pathology and Applied Microbiology sections.',
      'Third year has Clinical, Applied, and Advanced AOTT papers plus one shared practical component.',
    ],
    periods: [
      yearPeriod('year1', '1st Year', '1 St Year', alliedFirstYearSubjects),
      yearPeriod('year2', '2nd Year', '2nd Year', [
        subject('Medicine Relevant to OT and Anaesthesia Technology', { code: 'MED-AOTT-Y2', theoryHours: 50, examMaxMarks: 120, internalMarks: 20, sourcePage: 7 }),
        subject('Applied Pathology and Applied Microbiology', { code: 'APPMIC-Y2', theoryHours: 60, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 7 }),
        subject('Pharmacology', { code: 'PHAR-Y2', theoryHours: 50, examMaxMarks: 120, internalMarks: 20, sourcePage: 7 }),
        subject('Introduction to Anaesthesia and Operation Theatre Technology', { code: 'IAOTT-Y2', theoryHours: 80, practicalHours: 100, clinicalHours: 650, examMaxMarks: 200, internalMarks: 30, sourcePage: 7 }),
        ...alliedSecondYearSubsidiaries,
      ]),
      yearPeriod('year3', '3rd Year', '3rd Year', [
        subject('Anaesthesia and Operation Theatre Technology - Clinical', { code: 'AOTT-CL-Y3', theoryHours: 50, practicalHours: 50, clinicalHours: 250, examMaxMarks: 150, internalMarks: 20, sourcePage: 8 }),
        subject('Anaesthesia and Operation Theatre Technology - Applied', { code: 'AOTT-AP-Y3', theoryHours: 50, practicalHours: 50, clinicalHours: 250, examMaxMarks: 150, internalMarks: 20, sourcePage: 8 }),
        subject('Anaesthesia and Operation Theatre Technology - Advanced', { code: 'AOTT-ADV-Y3', theoryHours: 50, practicalHours: 50, clinicalHours: 250, examMaxMarks: 150, internalMarks: 20, sourcePage: 8 }),
        ...alliedThirdYearSubsidiaries,
      ], [
        exam('Anaesthesia and Operation Theatre Technology Practical', 150, { internalMarks: 30, examType: 'Practical', sourcePage: 10 }),
      ]),
    ],
  },
  MIT: {
    title: 'B.Sc Medical Imaging Technology',
    code: 'MIT',
    sourceFile: 'B.Sc MEDICAL IMAGING TECHNOLOGY SYLLABUS 1 (2).pdf',
    duration: 'Three academic years plus one year internship',
    notes: [
      'Second year introduces radiation physics, dark room techniques, and radiographic positioning.',
      'Third year focuses on diagnostic imaging modalities and radiographic special procedures.',
    ],
    periods: [
      yearPeriod('year1', '1st Year', '1 St Year', alliedFirstYearSubjects.map((item) => (
        item.code === 'BIOC-Y1' ? { ...item, name: 'Biochemistry' } : item
      ))),
      yearPeriod('year2', '2nd Year', '2nd Year', [
        subject('Radiation Physics: Medical Physics and Radiation Safety in Radio Diagnosis', { code: 'RADPHY-Y2', theoryHours: 100, examMaxMarks: 120, internalMarks: 20, sourcePage: 6 }),
        subject('Imaging Physics and Dark Room Techniques', { code: 'IMGDR-Y2', theoryHours: 80, practicalHours: 80, examMaxMarks: 200, internalMarks: 20, sourcePage: 6 }),
        subject('Radiographic Positioning and Techniques', { code: 'RADPOS-Y2', theoryHours: 100, practicalHours: 300, examMaxMarks: 100, sourcePage: 7 }),
        ...alliedSecondYearSubsidiaries,
      ]),
      yearPeriod('year3', '3rd Year', '3rd Year', [
        subject('Diagnostic Imaging Techniques and Modalities', { code: 'DIAGIMG-Y3', theoryHours: 200, practicalHours: 300, examMaxMarks: 220, internalMarks: 40, sourcePage: 7 }),
        subject('Radiographic Special Procedures and Patient Care', { code: 'RADSPC-Y3', theoryHours: 100, practicalHours: 300, examMaxMarks: 120, internalMarks: 20, sourcePage: 7 }),
        subject('Radiographic Positioning and Special Procedures', { code: 'RADPRA-Y3', practicalHours: 80, examMaxMarks: 100, internalMarks: 20, examType: 'Practical', sourcePage: 9 }),
        ...alliedThirdYearSubsidiaries,
      ]),
    ],
  },
  MLT: {
    title: 'B.Sc Medical Laboratory Technology',
    code: 'MLT',
    sourceFile: 'B.Sc MLT SYLLABUS (1).pdf',
    duration: 'Three academic years plus one year internship',
    notes: [
      'Second and third years are split across Biochemistry, Microbiology, and Pathology with theory, practical, and clinical postings.',
    ],
    periods: [
      yearPeriod('year1', '1st Year', '1 St Year', alliedFirstYearSubjects),
      yearPeriod('year2', '2nd Year', '2nd Year', [
        subject('Biochemistry II', { code: 'BIOC-Y2', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 6 }),
        subject('Microbiology II', { code: 'MICR-Y2', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 6 }),
        subject('Pathology II', { code: 'PATH-Y2', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 6 }),
        ...alliedSecondYearSubsidiaries,
      ]),
      yearPeriod('year3', '3rd Year', '3rd Year', [
        subject('Biochemistry III', { code: 'BIOC-Y3', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 7 }),
        subject('Microbiology III', { code: 'MICR-Y3', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 7 }),
        subject('Pathology III', { code: 'PATH-Y3', theoryHours: 100, practicalHours: 80, clinicalHours: 170, examMaxMarks: 220, internalMarks: 40, sourcePage: 7 }),
        ...alliedThirdYearSubsidiaries,
      ]),
    ],
  },
  BPT: {
    title: 'Bachelor of Physiotherapy',
    code: 'BPT',
    sourceFile: 'BPT_2015_Syllabus_copy.pdf',
    duration: 'Four academic years plus internship as prescribed',
    notes: [
      'First year has Anatomy, Physiology, Biochemistry, Biomechanics, and a combined Psychology/Sociology examination.',
      'Second year has a combined Pathology/Microbiology paper plus Pharmacology, Exercise Therapy, and Electrotherapy.',
      'Third and fourth years add supervised rotatory clinical training.',
    ],
    periods: [
      yearPeriod('year1', '1st Year', '1 St Year', [
        subject('Anatomy', { code: 'ANAT-Y1', theoryHours: 150, practicalHours: 90, examMaxMarks: 200, internalMarks: 30, sourcePage: 9 }),
        subject('Physiology', { code: 'PHYS-Y1', theoryHours: 150, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 9 }),
        subject('Biochemistry', { code: 'BIOC-Y1', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 9 }),
        subject('Biomechanics', { code: 'BIOM-Y1', theoryHours: 90, practicalHours: 90, examMaxMarks: 200, internalMarks: 30, sourcePage: 9 }),
        subject('Psychology', { code: 'PSYC-Y1', theoryHours: 60, sourcePage: 9, examEligible: false }),
        subject('Sociology', { code: 'SOC-Y1', theoryHours: 60, sourcePage: 9, examEligible: false }),
        subject('English', { code: 'ENG-Y1', category: 'Subsidiary', theoryHours: 60, sourcePage: 9, examEligible: false }),
        subject('Kannada', { code: 'KAN-Y1', category: 'Subsidiary', theoryHours: 60, sourcePage: 9, examEligible: false }),
        subject('Basic Nursing', { code: 'BASN-Y1', category: 'Subsidiary', theoryHours: 20, practicalHours: 10, sourcePage: 9, examEligible: false }),
        subject('Orientation to Physiotherapy', { code: 'ORPT-Y1', category: 'Subsidiary', theoryHours: 30, sourcePage: 9, examEligible: false }),
        subject('Integrated Seminars and PBL Sessions', { code: 'PBL-Y1', category: 'Subsidiary', theoryHours: 90, sourcePage: 9, examEligible: false }),
      ], [
        exam('Psychology and Sociology', 100, { internalMarks: 20, sourcePage: 13 }),
      ]),
      yearPeriod('year2', '2nd Year', '2nd Year', [
        subject('Pathology', { code: 'PATH-Y2', theoryHours: 45, practicalHours: 15, sourcePage: 10, examEligible: false }),
        subject('Microbiology', { code: 'MICR-Y2', theoryHours: 45, practicalHours: 15, sourcePage: 10, examEligible: false }),
        subject('Pharmacology', { code: 'PHAR-Y2', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
        subject('Exercise Therapy', { code: 'EXTH-Y2', theoryHours: 120, practicalHours: 150, examMaxMarks: 200, internalMarks: 30, sourcePage: 10 }),
        subject('Electrotherapy', { code: 'ELTH-Y2', theoryHours: 90, practicalHours: 150, examMaxMarks: 200, internalMarks: 30, sourcePage: 10 }),
        subject('Ethics and Admin', { code: 'ETHA-Y2', category: 'Subsidiary', theoryHours: 30, sourcePage: 10, examEligible: false }),
        subject('First Aid and CPR', { code: 'FACP-Y2', category: 'Subsidiary', theoryHours: 10, practicalHours: 20, sourcePage: 10, examEligible: false }),
        subject('Constitution of India', { code: 'COI-Y2', category: 'Subsidiary', theoryHours: 30, sourcePage: 10, examEligible: false }),
        subject('Introduction to Treatment', { code: 'INTT-Y2', category: 'Subsidiary', theoryHours: 30, sourcePage: 10, examEligible: false }),
        subject('Clinical Observation Posting', { code: 'CLOP-Y2', category: 'Clinical Posting', clinicalHours: 270, sourcePage: 10, examEligible: false }),
      ], [
        exam('Pathology and Microbiology', 100, { internalMarks: 20, sourcePage: 14 }),
      ]),
      yearPeriod('year3', '3rd Year', '3rd Year', [
        subject('General Medicine', { code: 'GMED-Y3', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
        subject('General Surgery', { code: 'GSUR-Y3', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
        subject('Orthopedics and Traumatology', { code: 'ORTH-Y3', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 10 }),
        subject('Musculoskeletal and Sports Physiotherapy', { code: 'MSPT-Y3', theoryHours: 90, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 10 }),
        subject('Cardio-Respiratory and General Physiotherapy', { code: 'CRGP-Y3', theoryHours: 90, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 10 }),
        subject('Supervised Rotatory Clinical Training I', { code: 'SRCT1-Y3', category: 'Clinical Posting', clinicalHours: 540, sourcePage: 11, examEligible: false }),
        subject('Allied Therapies', { code: 'ALLT-Y3', category: 'Subsidiary', theoryHours: 60, sourcePage: 11, examEligible: false }),
      ]),
      yearPeriod('year4', '4th Year', '4th Year', [
        subject('Neurology and Neurosurgery', { code: 'NEUR-Y4', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 11 }),
        subject('Community Medicine', { code: 'CMED-Y4', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 11 }),
        subject('Neuro-Physiotherapy', { code: 'NPHY-Y4', theoryHours: 90, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 11 }),
        subject('Community Based Rehabilitation', { code: 'CBR-Y4', theoryHours: 90, practicalHours: 60, examMaxMarks: 200, internalMarks: 30, sourcePage: 15 }),
        subject('Research Methodology and Biostatistics', { code: 'RMB-Y4', theoryHours: 60, examMaxMarks: 100, internalMarks: 20, sourcePage: 11 }),
        subject('Supervised Rotatory Clinical Training II', { code: 'SRCT2-Y4', category: 'Clinical Posting', clinicalHours: 540, sourcePage: 11, examEligible: false }),
        subject('Evidence Based Physiotherapy Practice', { code: 'EBPP-Y4', category: 'Subsidiary', theoryHours: 20, sourcePage: 11, examEligible: false }),
        subject('Project', { code: 'PROJ-Y4', category: 'Project', practicalHours: 20, sourcePage: 11, examEligible: false }),
      ]),
    ],
  },
  BOT: {
    title: 'Bachelor of Occupational Therapy',
    code: 'BOT',
    sourceFile: 'BOT syllabus Revision 2.docx',
    duration: 'Eight semesters plus internship/clinical training as prescribed',
    notes: [
      'BOT is semester based and includes 120 clinical posting hours in each semester.',
      'Main subject papers generally carry 220 marks when both theory and practical are present, and 120 marks when theory-only.',
      'Subsidiary theory subjects carry 100 marks with 80 theory and 20 internal assessment.',
    ],
    periods: [
      semesterPeriod(1, [
        subject('Human Anatomy I', { code: 'HA1', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Human Physiology I', { code: 'HP1', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Introduction to Occupational Therapy', { code: 'IOT1', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Biochemistry', { code: 'BIOC1', theoryHours: 100, examMaxMarks: 120, internalMarks: 20 }),
        subject('English', { code: 'ENG1', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Kannada', { code: 'KAN1', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - OT OPD', { code: 'CLIN1', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(2, [
        subject('Human Anatomy II', { code: 'HA2', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Human Physiology II', { code: 'HP2', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Occupational Therapy I', { code: 'BOT1', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of First Aid', { code: 'BFA2', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Constitution of India', { code: 'COI2', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Sociology', { code: 'SOC2', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - General Surgery, General and Neuro Medicine, Orthopaedics', { code: 'CLIN2', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(3, [
        subject('Basics of Occupational Therapy II', { code: 'BOT2', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Biomechanics (General and UE) and Ergotherapeutics', { code: 'BIOER3', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Pathology and Microbiology', { code: 'PATHMIC3', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Pharmacology', { code: 'PHAR3', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Computer Fundamentals', { code: 'COMP3', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Health Care', { code: 'HC3', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - OT OPD, General and Neuro Medicine, Orthopaedics', { code: 'CLIN3', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(4, [
        subject('Biomechanics (LE) and Ergotherapeutics', { code: 'BIOER4', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Medical Disorders', { code: 'BMD4', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Surgical Disorders', { code: 'BSD4', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Psychology', { code: 'PSYC4', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Environment Science and Health', { code: 'ENV4', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - General/Neuro Medicine, General/Plastic Surgery, Orthopaedics', { code: 'CLIN4', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(5, [
        subject('Occupational Therapy in Medical Conditions', { code: 'OTMC5', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Occupational Therapy in Surgical Conditions', { code: 'OTSC5', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Orthopaedics', { code: 'BORTH5', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Paediatrics', { code: 'BPED5', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Medical Ethics', { code: 'METH5', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - OT OPD, Plastic Surgery, General Medicine and CTVS', { code: 'CLIN5', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(6, [
        subject('Occupational Therapy in Orthopaedic Conditions', { code: 'OTORTH6', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Occupational Therapy in Paediatric Conditions', { code: 'OTPED6', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Psychiatry', { code: 'BPSY6', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Neurology', { code: 'BNEU6', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Radiodiagnosis', { code: 'RADI6', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - Orthopaedics, Paediatrics/NICU, Psychiatry', { code: 'CLIN6', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(7, [
        subject('Occupational Therapy in Mental Health Conditions', { code: 'OTMH7', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Occupational Therapy in Neurological Conditions', { code: 'OTNEU7', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Basics of Orthotics and Assistive Technology', { code: 'BOAT7', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Preventive and Social Medicine', { code: 'PSM7', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Disability Assessment and Certification', { code: 'DAC7', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - OT OPD, Psychiatry, Neuro Medicine and Neurosurgery', { code: 'CLIN7', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
      semesterPeriod(8, [
        subject('Community Based Rehabilitation', { code: 'CBR8', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Practice Issues in Occupational Therapy', { code: 'PIOT8', theoryHours: 70, practicalHours: 30, examMaxMarks: 220, internalMarks: 40 }),
        subject('Biostatistics and Research Methodology', { code: 'BRM8', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Ergonomics', { code: 'ERGO8', theoryHours: 70, practicalHours: 30, examMaxMarks: 120, internalMarks: 20 }),
        subject('Basics of SPSS Software', { code: 'SPSS8', category: 'Subsidiary', theoryHours: 30, examMaxMarks: 100, internalMarks: 20 }),
        subject('Clinical Posting - OT OPD, CBR, Orthopaedics/Plastic Surgery, General/Neuro Medicine', { code: 'CLIN8', category: 'Clinical Posting', clinicalHours: 120, examEligible: false }),
      ]),
    ],
  },
  BSCN: {
    title: 'B.Sc Nursing',
    code: 'BSCN',
    sourceFile: 'B.Sc Nursing - semester INC BSc Nursing Syllabus and Logbook merged doc (1).pdf',
    duration: 'Four years, eight semesters, credit and semester system',
    notes: [
      'The program has 8 semesters with 156 curriculum credits and 6396 listed hours, plus self-study/co-curricular hours.',
      'Several nursing examinations combine subjects across semesters, so combined exam groups are seeded where the source combines them.',
      'Semester 8 is internship/residency posting with competency assessment.',
    ],
    periods: [
      semesterPeriod(1, [
        subject('Communicative English', { code: 'ENGL101', credits: 2, theoryHours: 40 }),
        subject('Applied Anatomy', { code: 'ANAT105', credits: 3, theoryHours: 60 }),
        subject('Applied Physiology', { code: 'PHYS110', credits: 3, theoryHours: 60 }),
        subject('Applied Sociology', { code: 'SOCI115', credits: 3, theoryHours: 60 }),
        subject('Applied Psychology', { code: 'PSYC120', credits: 3, theoryHours: 60 }),
        subject('Nursing Foundation I including First Aid module', { code: 'NNF125-I', credits: 10, theoryHours: 120, practicalHours: 80, clinicalHours: 160 }),
        subject('Self-study and Co-curricular I', { code: 'SSCC130-I', category: 'Self-study', totalHours: 80, examEligible: false }),
      ], [
        exam('Communicative English', 50, { internalMarks: 25, durationMinutes: 120, sourcePage: 27 }),
        exam('Applied Anatomy and Applied Physiology', 100, { internalMarks: 25, sourcePage: 27 }),
        exam('Applied Sociology and Applied Psychology', 100, { internalMarks: 25, sourcePage: 27 }),
        exam('Nursing Foundation I Internal Theory', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 27 }),
        exam('Nursing Foundation I Internal Practical', 25, { internalMarks: 25, examType: 'Practical', sourcePage: 27 }),
      ]),
      semesterPeriod(2, [
        subject('Applied Biochemistry', { code: 'BIOC135', credits: 2, theoryHours: 40 }),
        subject('Applied Nutrition and Dietetics', { code: 'NUTR140', credits: 3, theoryHours: 60 }),
        subject('Nursing Foundation II including Health Assessment module', { code: 'NNF125-II', credits: 13, theoryHours: 120, practicalHours: 120, clinicalHours: 320 }),
        subject('Health/Nursing Informatics and Technology', { code: 'HNIT145', credits: 3, theoryHours: 40, practicalHours: 40 }),
        subject('Self-study and Co-curricular II', { code: 'SSCC130-II', category: 'Self-study', totalHours: 60, examEligible: false }),
      ], [
        exam('Applied Biochemistry and Applied Nutrition and Dietetics', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Nursing Foundation I and II Theory', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Health/Nursing Informatics and Technology', 50, { internalMarks: 25, durationMinutes: 120, sourcePage: 28 }),
        exam('Nursing Foundation I and II Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 28 }),
      ]),
      semesterPeriod(3, [
        subject('Applied Microbiology and Infection Control including Safety', { code: 'MICR201', credits: 3, theoryHours: 40, practicalHours: 40 }),
        subject('Pharmacology I', { code: 'PHAR205-I', credits: 1, theoryHours: 20 }),
        subject('Pathology I', { code: 'PATH210-I', credits: 1, theoryHours: 20 }),
        subject('Adult Health Nursing I with integrated pathophysiology including BCLS module', { code: 'NAHN215-I', credits: 14, theoryHours: 140, practicalHours: 40, clinicalHours: 480 }),
        subject('Self-study and Co-curricular III', { code: 'SSCC220-I', category: 'Self-study', totalHours: 20, examEligible: false }),
      ], [
        exam('Applied Microbiology and Infection Control including Safety', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Pharmacology I and Pathology I Internal', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 28 }),
        exam('Adult Health Nursing I Theory', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Adult Health Nursing I Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 28 }),
      ]),
      semesterPeriod(4, [
        subject('Pharmacology II including Fundamentals of Prescribing module', { code: 'PHAR205-II', credits: 3, theoryHours: 60 }),
        subject('Pathology II and Genetics', { code: 'PATH210-II', credits: 1, theoryHours: 20 }),
        subject('Adult Health Nursing II with integrated pathophysiology including Geriatric Nursing and Palliative Care module', { code: 'NAHN225-II', credits: 14, theoryHours: 140, practicalHours: 40, clinicalHours: 480 }),
        subject('Professionalism, Professional Values and Ethics including Bioethics', { code: 'PROF230', credits: 1, theoryHours: 20 }),
        subject('Self-study and Co-curricular IV', { code: 'SSCC220-II', category: 'Self-study', totalHours: 40, examEligible: false }),
      ], [
        exam('Pharmacology and Pathology I and II and Genetics', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Adult Health Nursing II Theory', 100, { internalMarks: 25, sourcePage: 28 }),
        exam('Adult Health Nursing II Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 28 }),
        exam('Professionalism, Professional Values and Ethics', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 28 }),
      ]),
      semesterPeriod(5, [
        subject('Child Health Nursing I including Essential Newborn Care modules', { code: 'NCHN301-I', credits: 6, theoryHours: 60, practicalHours: 40, clinicalHours: 160 }),
        subject('Mental Health Nursing I', { code: 'NMHN305-I', credits: 4, theoryHours: 60, clinicalHours: 80 }),
        subject('Community Health Nursing I including Environmental Science and Epidemiology', { code: 'NCOMH310-I', credits: 7, theoryHours: 100, clinicalHours: 160 }),
        subject('Educational Technology/Nursing Education', { code: 'EDUC315', credits: 3, theoryHours: 40, practicalHours: 40 }),
        subject('Introduction to Forensic Nursing and Indian Laws', { code: 'NFORN320', credits: 1, theoryHours: 20 }),
        subject('Self-study and Co-curricular V', { code: 'SSCC325-I', category: 'Self-study', totalHours: 40, examEligible: false }),
      ], [
        exam('Child Health Nursing I Internal', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 29 }),
        exam('Mental Health Nursing I Internal', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 29 }),
        exam('Community Health Nursing I Theory', 100, { internalMarks: 25, sourcePage: 29 }),
        exam('Educational Technology/Nursing Education', 100, { internalMarks: 25, sourcePage: 29 }),
        exam('Introduction to Forensic Nursing and Indian Laws', 50, { internalMarks: 25, durationMinutes: 120, sourcePage: 29 }),
        exam('Community Health Nursing I Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 29 }),
      ]),
      semesterPeriod(6, [
        subject('Child Health Nursing II', { code: 'NCHN301-II', credits: 3, theoryHours: 40, clinicalHours: 80 }),
        subject('Mental Health Nursing II', { code: 'NMHN305-II', credits: 4, theoryHours: 40, clinicalHours: 160 }),
        subject('Nursing Management and Leadership', { code: 'NMLE330', credits: 4, theoryHours: 60, clinicalHours: 80 }),
        subject('Midwifery/Obstetrics and Gynecology Nursing I including SBA module', { code: 'NMIDW335-I', credits: 7, theoryHours: 60, practicalHours: 40, clinicalHours: 240 }),
      ], [
        exam('Child Health Nursing I and II Theory', 100, { internalMarks: 25, sourcePage: 29 }),
        exam('Mental Health Nursing I and II Theory', 100, { internalMarks: 25, sourcePage: 29 }),
        exam('Child Health Nursing I and II Practical', 50, { internalMarks: 25, examType: 'Practical', sourcePage: 213 }),
        exam('Mental Health Nursing I and II Practical', 50, { internalMarks: 25, examType: 'Practical', sourcePage: 213 }),
        exam('Nursing Management and Leadership Internal', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 213 }),
        exam('Midwifery/OBG Nursing I Internal', 25, { internalMarks: 25, examType: 'Internal', sourcePage: 213 }),
      ]),
      semesterPeriod(7, [
        subject('Community Health Nursing II', { code: 'NCOMH401-II', credits: 7, theoryHours: 100, clinicalHours: 160 }),
        subject('Nursing Research and Statistics', { code: 'NRST405', credits: 4, theoryHours: 40, practicalHours: 80 }),
        subject('Midwifery/Obstetrics and Gynecology Nursing II including Safe Delivery App module', { code: 'NMIDW410-II', credits: 8, theoryHours: 60, practicalHours: 40, clinicalHours: 320 }),
      ], [
        exam('Community Health Nursing II Theory', 100, { internalMarks: 25, sourcePage: 30 }),
        exam('Nursing Research and Statistics', 100, { internalMarks: 25, sourcePage: 30 }),
        exam('Midwifery/OBG Nursing I and II Theory', 100, { internalMarks: 25, sourcePage: 30 }),
        exam('Community Health Nursing II Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 30 }),
        exam('Midwifery/OBG Nursing I and II Practical', 100, { internalMarks: 50, examType: 'Practical', sourcePage: 30 }),
      ]),
      semesterPeriod(8, [
        subject('Internship - Community Health Nursing (4 weeks)', { code: 'INTE415', category: 'Internship', clinicalHours: 192, examEligible: false }),
        subject('Internship - Adult Health Nursing (6 weeks)', { code: 'INTE420', category: 'Internship', clinicalHours: 288, examEligible: false }),
        subject('Internship - Child Health Nursing (4 weeks)', { code: 'INTE425', category: 'Internship', clinicalHours: 192, examEligible: false }),
        subject('Internship - Mental Health Nursing (4 weeks)', { code: 'INTE430', category: 'Internship', clinicalHours: 192, examEligible: false }),
        subject('Internship - Midwifery (4 weeks)', { code: 'INTE435', category: 'Internship', clinicalHours: 192, examEligible: false }),
      ], [
        exam('Competency Assessment - 5 Specialties', 200, { internalMarks: 100, examType: 'Practical', sourcePage: 30 }),
      ]),
    ],
  },
};

const courseVariants = [
  {
    curriculumKey: 'AOTT',
    courseCode: 'ATOTREG',
    courseName: 'I B Sc Anaesthesia and Operation Theater Technology',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['year1', 'year2', 'year3'],
  },
  {
    curriculumKey: 'AOTT',
    courseCode: 'ATOTLAT',
    courseName: 'II B Sc Anaesthesia and Operation Theater Technology',
    admissionType: 'Lateral',
    section: 'Lateral',
    periodKeys: ['year2', 'year3'],
  },
  {
    curriculumKey: 'MIT',
    courseCode: 'MITREG',
    courseName: 'I B Sc Imaging Technology',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['year1', 'year2', 'year3'],
  },
  {
    curriculumKey: 'MIT',
    courseCode: 'MITLAT',
    courseName: 'II B Sc Medical Imaging Technology',
    admissionType: 'Lateral',
    section: 'Lateral',
    periodKeys: ['year2', 'year3'],
  },
  {
    curriculumKey: 'MLT',
    courseCode: 'MLTREG',
    courseName: 'I B Sc MLT',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['year1', 'year2', 'year3'],
  },
  {
    curriculumKey: 'MLT',
    courseCode: 'MLTLAT',
    courseName: 'II B Sc MLT',
    admissionType: 'Lateral',
    section: 'Lateral',
    periodKeys: ['year2', 'year3'],
  },
  {
    curriculumKey: 'BPT',
    courseCode: 'BPT',
    courseName: 'BPT',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['year1', 'year2', 'year3', 'year4'],
  },
  {
    curriculumKey: 'BOT',
    courseCode: 'BOT',
    courseName: 'I B.Sc (Occupational Therapy)',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8'],
  },
  {
    curriculumKey: 'BSCN',
    courseCode: 'BSCN',
    courseName: 'BSC Nursing',
    admissionType: 'Regular',
    section: 'Regular',
    periodKeys: ['sem1', 'sem2', 'sem3', 'sem4', 'sem5', 'sem6', 'sem7', 'sem8'],
  },
];

function buildSeedDocs() {
  const docs = {
    academicPrograms: {},
    academicBatches: {},
    academicSubjects: {},
    examSchedules: {},
    internalAssessments: {},
  };
  let examIndex = 0;

  for (const variant of courseVariants) {
    const curriculum = curricula[variant.curriculumKey];
    const programId = `syllabus-program-${academicYear}-${slugify(variant.courseCode)}`;
    docs.academicPrograms[programId] = {
      name: variant.courseName,
      code: variant.courseCode,
      programName: curriculum.title,
      courseCode: variant.courseCode,
      courseName: variant.courseName,
      academicYear,
      status: 'Active',
      createdAtText,
      updatedAtText: createdAtText,
      admissionType: variant.admissionType,
      syllabusCourseCode: curriculum.code,
      syllabusCourseTitle: curriculum.title,
      duration: curriculum.duration,
      sourceFile: curriculum.sourceFile,
      sourceNotes: curriculum.notes,
      seedSource,
    };

    for (const period of curriculum.periods.filter((item) => variant.periodKeys.includes(item.key))) {
      const classKey = `${period.className} - ${variant.section}`;
      const batchId = `syllabus-batch-${academicYear}-${slugify(variant.courseCode)}-${period.key}`;
      docs.academicBatches[batchId] = {
        className: period.className,
        section: variant.section,
        programName: variant.courseName,
        classTeacher: '',
        capacity: '',
        academicYear,
        status: 'Active',
        createdAtText,
        updatedAtText: createdAtText,
        courseCode: variant.courseCode,
        courseName: variant.courseName,
        classKey,
        curriculumPeriod: period.label,
        syllabusCourseCode: curriculum.code,
        syllabusCourseTitle: curriculum.title,
        sourceFile: curriculum.sourceFile,
        seedSource,
      };

      for (const item of period.subjects) {
        const subjectCode = `${variant.courseCode}-${item.code}`;
        const subjectId = `syllabus-subject-${academicYear}-${slugify(variant.courseCode)}-${period.key}-${slugify(item.code)}`;
        const subjectTotalHours = totalHours(item);
        const topics = getSyllabusTopics(curriculum.code, item);
        docs.academicSubjects[subjectId] = {
          subjectName: item.name,
          subjectCode,
          programName: variant.courseName,
          creditHours: item.credits ?? subjectTotalHours,
          academicYear,
          status: 'Active',
          createdAtText,
          updatedAtText: createdAtText,
          courseCode: variant.courseCode,
          courseName: variant.courseName,
          classKey,
          curriculumPeriod: period.label,
          syllabusCourseCode: curriculum.code,
          syllabusCourseTitle: curriculum.title,
          category: item.category,
          theoryHours: item.theoryHours,
          practicalHours: item.practicalHours,
          clinicalHours: item.clinicalHours,
          totalHours: subjectTotalHours,
          examMaxMarks: item.examMaxMarks ?? '',
          internalMarks: item.internalMarks ?? '',
          topics,
          topicCount: topics.length,
          topicSource: topics.length ? seedSource : '',
          sourceFile: curriculum.sourceFile,
          sourcePage: item.sourcePage ?? '',
          note: item.note,
          seedSource,
        };

        if (item.examEligible && item.examMaxMarks) {
          const examId = `syllabus-exam-${academicYear}-${slugify(variant.courseCode)}-${period.key}-${slugify(item.code)}`;
          docs.examSchedules[examId] = {
            examName: `${period.label} University Examination`,
            classKey,
            subject: item.name,
            examType: item.examType || (item.practicalHours && !item.theoryHours ? 'Practical' : 'Written'),
            academicYear,
            examDate: addDays(new Date(Date.UTC(2026, 6, 26)), examIndex),
            startTime: '09:30',
            durationMinutes: 180,
            roomNo: '',
            maxMarks: item.examMaxMarks,
            facultyId: '',
            facultyName: '',
            status: 'Scheduled',
            createdAtText,
            updatedAtText: createdAtText,
            courseCode: variant.courseCode,
            courseName: variant.courseName,
            curriculumPeriod: period.label,
            subjectCode,
            syllabusCourseCode: curriculum.code,
            syllabusCourseTitle: curriculum.title,
            sourceFile: curriculum.sourceFile,
            sourcePage: item.sourcePage ?? '',
            seedSource,
          };
          examIndex += 1;
        }

        if (item.internalMarks) {
          const assessmentId = `syllabus-assessment-${academicYear}-${slugify(variant.courseCode)}-${period.key}-${slugify(item.code)}`;
          docs.internalAssessments[assessmentId] = {
            title: `${item.name} Internal Assessment`,
            classKey,
            subject: item.name,
            academicYear,
            maxMarks: item.internalMarks,
            status: 'Active',
            createdAtText,
            courseCode: variant.courseCode,
            courseName: variant.courseName,
            curriculumPeriod: period.label,
            subjectCode,
            syllabusCourseCode: curriculum.code,
            syllabusCourseTitle: curriculum.title,
            sourceFile: curriculum.sourceFile,
            sourcePage: item.sourcePage ?? '',
            seedSource,
          };
        }
      }

      for (const item of period.exams || []) {
        const examCode = slugify(item.subjectName);
        const examId = `syllabus-exam-${academicYear}-${slugify(variant.courseCode)}-${period.key}-${examCode}`;
        docs.examSchedules[examId] = {
          examName: `${period.label} University Examination`,
          classKey,
          subject: item.subjectName,
          examType: item.examType,
          academicYear,
          examDate: addDays(new Date(Date.UTC(2026, 6, 26)), examIndex),
          startTime: '09:30',
          durationMinutes: item.durationMinutes,
          roomNo: '',
          maxMarks: item.maxMarks,
          facultyId: '',
          facultyName: '',
          status: 'Scheduled',
          createdAtText,
          updatedAtText: createdAtText,
          courseCode: variant.courseCode,
          courseName: variant.courseName,
          curriculumPeriod: period.label,
          syllabusCourseCode: curriculum.code,
          syllabusCourseTitle: curriculum.title,
          sourceFile: curriculum.sourceFile,
          sourcePage: item.sourcePage ?? '',
          note: item.note,
          seedSource,
        };
        examIndex += 1;

        if (item.internalMarks) {
          const assessmentId = `syllabus-assessment-${academicYear}-${slugify(variant.courseCode)}-${period.key}-${examCode}`;
          docs.internalAssessments[assessmentId] = {
            title: `${item.subjectName} Internal Assessment`,
            classKey,
            subject: item.subjectName,
            academicYear,
            maxMarks: item.internalMarks,
            status: 'Active',
            createdAtText,
            courseCode: variant.courseCode,
            courseName: variant.courseName,
            curriculumPeriod: period.label,
            syllabusCourseCode: curriculum.code,
            syllabusCourseTitle: curriculum.title,
            sourceFile: curriculum.sourceFile,
            sourcePage: item.sourcePage ?? '',
            note: item.note,
            seedSource,
          };
        }
      }
    }
  }

  return docs;
}

async function writeDocs(docs) {
  let batch = db.batch();
  let count = 0;

  for (const [collectionName, collectionDocs] of Object.entries(docs)) {
    for (const [id, data] of Object.entries(collectionDocs)) {
      batch.set(db.collection(collectionName).doc(id), {
        ...data,
        seededAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      count += 1;
      if (count % 400 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }

  return count;
}

const docs = buildSeedDocs();
const counts = Object.fromEntries(Object.entries(docs).map(([collectionName, collectionDocs]) => [
  collectionName,
  Object.keys(collectionDocs).length,
]));

console.log(`Syllabus seed target academic year: ${academicYear}`);
for (const [collectionName, count] of Object.entries(counts)) {
  console.log(`${collectionName}: ${count}`);
}

if (dryRun) {
  console.log('Dry run complete. No Firestore writes were made.');
} else {
  const total = await writeDocs(docs);
  console.log(`Syllabus seed complete. ${total} records written or merged.`);
}
