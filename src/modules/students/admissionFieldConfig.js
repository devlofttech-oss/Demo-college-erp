export const commonAdmissionFields = [
  ['name', 'Student Name'],
  ['nameAsInAadhaar', 'Name as in Aadhaar'],
  ['fatherName', 'Father Name'],
  ['motherName', 'Mother Name'],
  ['dob', 'Date of Birth'],
  ['gender', 'Gender'],
  ['bloodGroup', 'Blood Group'],
  ['mobileNo', 'Mobile No'],
  ['alternatePhoneNo', 'Phone No'],
  ['email', 'Email'],
  ['address', 'Address'],
  ['nationality', 'Nationality'],
  ['state', 'State'],
  ['ruralUrban', 'Rural / Urban'],
  ['religion', 'Religion'],
  ['seatType', 'Admission Seat Type'],
  ['govtSeatType', 'Govt Seat Type'],
  ['actualCategory', 'Actual Category'],
  ['seatSelectCategory', 'Seat Select Category'],
  ['admissionDate', 'Date of Admission'],
];

export const examAdmissionFields = [
  ['keaCetNumber', 'KEA CET Number'],
  ['sspId', 'SSP ID'],
  ['neetRegNo', 'NEET Reg No'],
  ['neetRank', 'NEET Rank'],
  ['cetRegNo', 'CET Reg No'],
  ['cetRank', 'CET Rank'],
  ['qualifyingExamName', 'Qualifying Exam'],
  ['qualifyingExamRegNo', 'Qualifying Exam Reg No'],
  ['qualifyingMaxMarks', 'Qualifying Max Marks'],
  ['qualifyingSecuredMarks', 'Qualifying Secured Marks'],
  ['qualifyingPassDate', 'Qualifying Pass Date'],
  ['qualifyingBoard', 'University / Board'],
  ['optionalSubject', 'Optional Subject'],
  ['optionalMaxMarks', 'Optional Max Marks'],
  ['optionalSecuredMarks', 'Optional Secured Marks'],
];

export const lateralAdmissionFields = [
  ['diplomaCourse', 'Diploma Course'],
  ['diplomaCourseDuration', 'Diploma Duration'],
  ['diplomaPassedDate', 'Diploma Passed Date'],
  ['diplomaBoard', 'Diploma University / Board'],
  ['diplomaMaxMarks', 'Diploma Max Marks'],
  ['diplomaSecuredMarks', 'Diploma Secured Marks'],
];

export const certificateAdmissionFields = [
  ['casteRdNumber', 'Caste RD Number'],
  ['casteCategory', 'Caste Category'],
  ['casteName', 'Caste Name'],
  ['casteCertificateStudentName', 'Student Name in Caste Certificate'],
  ['casteCertificateFatherName', 'Father Name in Caste Certificate'],
  ['incomeRdNumber', 'Income RD Number'],
  ['incomeCategory', 'Income Category'],
  ['incomeCasteName', 'Caste Name in Income Certificate'],
  ['annualIncome', 'Annual Income'],
  ['incomeCertificateStudentName', 'Student Name in Income Certificate'],
  ['incomeCertificateFatherName', 'Father Name in Income Certificate'],
];

export function getAdmissionFieldsForCourse(course = {}) {
  const fields = [
    ...commonAdmissionFields,
    ...examAdmissionFields,
  ];
  if (course.admissionType === 'Lateral' || course.courseYear === '2nd Year') {
    fields.push(...lateralAdmissionFields);
  }
  fields.push(...certificateAdmissionFields);
  return fields;
}

export function courseLabel(course) {
  if (!course) return 'All Courses';
  return `${course.courseName} (${course.admissionType || course.courseYear})`;
}
