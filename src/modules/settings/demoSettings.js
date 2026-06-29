export function normalizeInstituteSettings(institute = {}) {
  return {
    ...demoInstituteSettings,
    ...institute,
    name: institute.name || demoInstituteSettings.name,
    instituteId: institute.instituteId || institute.code || demoInstituteSettings.instituteId,
    code: institute.code || institute.instituteId || demoInstituteSettings.code,
  };
}

export const demoInstituteSettings = {
  id: 'institute',
  name: '-',
  instituteId: '-',
  code: '-',
  logoUrl: '',
  logoFileName: '',
  email: '-',
  phone: '-',
  address: '-',
  city: '-',
  status: '-',
  updatedAtText: '-',
};

export const demoAcademicYearSettings = {
  id: 'academic-year',
  name: '2026-2027',
  startsOn: '2026-06-01',
  endsOn: '2027-03-31',
  status: 'Active',
  updatedAtText: '19 Jun 2026',
};

export const demoIdFormatSettings = {
  id: 'id-formats',
  student: 'STU-{number}',
  admission: 'ADM-{year}-{number}',
  employee: 'EMP-{number}',
  receipt: 'REC-{year}-{number}',
  updatedAtText: '19 Jun 2026',
};

export const demoModuleDefaultSettings = {
  id: 'module-defaults',
  studentAdmissions: true,
  staffLeave: true,
  timetablePublishing: true,
  parentPortal: true,
  onlinePayments: false,
  receiptGeneration: false,
  communicationModule: false,
  updatedAtText: '19 Jun 2026',
};
