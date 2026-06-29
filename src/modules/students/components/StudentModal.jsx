import { useState } from 'react';
import { Upload, UserRound } from 'lucide-react';
import { admissionCourses } from '../admissionSeedData';
import { getAdmissionFieldsForCourse } from '../admissionFieldConfig';

const defaultForm = {
  name: '',
  className: '1 St Year',
  section: 'Regular',
  program: 'BSC Nursing',
  courseCode: 'BSCN',
  courseName: 'BSC Nursing',
  courseYear: '1 St Year',
  admissionType: 'Regular',
  academicYear: '2025-2026',
  guardianName: '',
  idHolder: '',
  phone: '',
  email: '',
  profilePhotoUrl: '',
  profilePhotoName: '',
  status: 'Admission Review',
};

export default function StudentModal({
  academicYearOptions = ['2025-2026'],
  courses = admissionCourses,
  initialAcademicYear = '2025-2026',
  initialCourseCode = 'BSCN',
  initialStudent = null,
  mode = 'create',
  onClose,
  onSave,
}) {
  const initialCourse = courses.find((course) => course.courseCode === (initialStudent?.courseCode || initialCourseCode)) || courses[0];
  const [form, setForm] = useState({
    ...defaultForm,
    academicYear: initialStudent?.academicYear || initialAcademicYear,
    className: initialCourse?.courseYear || defaultForm.className,
    section: initialCourse?.admissionType || defaultForm.section,
    program: initialCourse?.courseName || defaultForm.program,
    courseCode: initialCourse?.courseCode || defaultForm.courseCode,
    courseName: initialCourse?.courseName || defaultForm.courseName,
    courseYear: initialCourse?.courseYear || defaultForm.courseYear,
    admissionType: initialCourse?.admissionType || defaultForm.admissionType,
    collegeName: initialCourse?.collegeName || '',
    collegeCode: initialCourse?.collegeCode || '',
    ...initialStudent,
  });
  const isEdit = mode === 'edit';
  const selectedCourse = courses.find((course) => course.courseCode === form.courseCode) || initialCourse || {};
  const admissionFields = getAdmissionFieldsForCourse(selectedCourse);

  const uploadProfilePhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        profilePhotoUrl: reader.result,
        profilePhotoName: file.name,
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateCourse = (courseCode) => {
    const course = courses.find((item) => item.courseCode === courseCode);
    setForm((prev) => ({
      ...prev,
      courseCode,
      courseName: course?.courseName || prev.courseName,
      program: course?.courseName || prev.program,
      courseYear: course?.courseYear || prev.courseYear,
      className: course?.courseYear || prev.className,
      admissionType: course?.admissionType || prev.admissionType,
      section: course?.admissionType || prev.section,
      collegeName: course?.collegeName || prev.collegeName,
      collegeCode: course?.collegeCode || prev.collegeCode,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      name: form.name.trim(),
      nameAsInAadhaar: (form.nameAsInAadhaar || '').trim(),
      fatherName: (form.fatherName || '').trim(),
      motherName: (form.motherName || '').trim(),
      guardianName: (form.fatherName || form.guardianName || '').trim(),
      idHolder: (form.nameAsInAadhaar || form.idHolder || form.name || '').trim(),
      className: (form.courseYear || form.className || '').trim(),
      section: (form.admissionType || form.section || '').trim(),
      program: (form.courseName || form.program || '').trim(),
      academicYear: form.academicYear,
      phone: (form.mobileNo || form.phone || '').trim(),
      email: (form.email || '').trim(),
      status: form.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{isEdit ? 'Edit Student Profile' : 'New Student Admission'}</h2>
            <p className="text-sm text-slate-500">
              {isEdit ? 'Updates student profile and academic details.' : 'Creates profile, admission number, and student ID.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-9 w-9 rounded-full hover:bg-slate-100 text-slate-500">x</button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 rounded-lg bg-[#f5f5f6] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-[#30343c] text-emerald-300 flex items-center justify-center overflow-hidden shrink-0">
              {form.profilePhotoUrl ? (
                <img src={form.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={34} />
              )}
            </div>
            <label className="inline-flex h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm font-semibold items-center justify-center gap-2 cursor-pointer w-fit">
              <Upload size={16} /> Profile Photo
              <input type="file" accept="image/*" className="sr-only" onChange={(event) => uploadProfilePhoto(event.target.files?.[0])} />
            </label>
            <span className="text-xs text-slate-500">{form.profilePhotoName || 'Optional student profile picture'}</span>
          </div>
          <label className="sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Course</span>
            <select
              required
              value={form.courseCode}
              onChange={(event) => updateCourse(event.target.value)}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {courses.map((course) => (
                <option key={course.courseCode} value={course.courseCode}>
                  {course.courseName} - {course.admissionType || course.courseYear}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="block text-xs font-semibold text-slate-500 mb-1.5">Academic Year</span>
            <select
              required
              value={form.academicYear}
              onChange={(event) => setForm((prev) => ({ ...prev, academicYear: event.target.value }))}
              className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
            >
              {academicYearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          {admissionFields.map(([key, label]) => (
            <label key={key} className={key === 'address' ? 'sm:col-span-2' : ''}>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">{label}</span>
              <input
                required={['name', 'fatherName', 'mobileNo'].includes(key)}
                value={form[key] || ''}
                onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              />
            </label>
          ))}
          {isEdit && (
            <label>
              <span className="block text-xs font-semibold text-slate-500 mb-1.5">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#fb9a5b] focus:ring-2 focus:ring-orange-100"
              >
                <option>Active</option>
                <option>Admission Review</option>
                <option>Archived</option>
              </select>
            </label>
          )}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg bg-slate-100 text-slate-700 font-semibold text-sm">
            Cancel
          </button>
          <button type="submit" className="h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm">
            {isEdit ? 'Save Changes' : 'Save Admission'}
          </button>
        </div>
      </form>
    </div>
  );
}
