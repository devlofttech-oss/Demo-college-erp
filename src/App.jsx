import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Building2, GraduationCap } from 'lucide-react';
import AuthPage from './pages/AuthPage';
import StudentInformationManagement from './modules/students/StudentInformationManagement';
import { logoutUser, subscribeToAuthState } from './firebase/auth';
import { getSettingsData, getUserProfile } from './firebase/db';
import ParticleBackground from './components/ParticleBackground';
import { demoInstituteSettings } from './modules/settings/demoSettings';


function buildCollegeFromInstitute(institute = demoInstituteSettings) {
  return {
    id: 'main-campus',
    name: institute.name || 'College',
    code: institute.instituteId || institute.code || 'COL-097',
    location: institute.city || institute.address || 'Main Campus',
  };
}

function CollegeSelection({ colleges, onSelect }) {
  return (
    <main className="relative z-[1] min-h-screen bg-[#f1f2f4] flex items-center justify-center p-6">
      <section className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.12)] overflow-hidden">
        <div className="bg-[#1b1f21] text-white p-7 flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-white text-emerald-700 flex items-center justify-center shrink-0">
            <GraduationCap size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Select College</h1>
            <p className="text-sm text-slate-300 mt-1">Choose a college to open the ERP workspace.</p>
          </div>
        </div>
        <div className="p-7 grid md:grid-cols-2 gap-4">
          {colleges.map((college) => (
            <button
              key={college.id}
              onClick={() => onSelect(college)}
              className="text-left rounded-xl border border-slate-200 bg-[#f5f5f6] p-5 hover:border-[#fb9a5b] hover:bg-white transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-white text-[#33373e] flex items-center justify-center shadow-sm">
                  <Building2 size={24} />
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">{college.name}</div>
                  <div className="text-sm text-slate-500 mt-1">{college.location}</div>
                  <div className="text-xs font-semibold text-[#fb8d49] mt-3">{college.code}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function AccessPending({ user, onLogout }) {
  const status = user?.status || 'Pending Approval';
  return (
    <main className="relative z-[1] min-h-screen bg-[#f1f2f4] flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.12)] p-7 text-center">
        <div className="h-14 w-14 rounded-full bg-[#33373e] text-white flex items-center justify-center mx-auto mb-5">
          <GraduationCap size={30} />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Access pending</h1>
        <p className="text-sm text-slate-500 mt-2">
          This login does not have an active ERP profile yet. Ask an administrator to activate the account.
        </p>
        <div className="mt-4 rounded-lg bg-[#f5f5f6] px-4 py-3 text-sm text-slate-600">
          {user?.email || 'Signed-in user'} - {status}
        </div>
        <button
          onClick={onLogout}
          className="mt-5 h-10 px-5 rounded-lg bg-[#33373e] text-white font-semibold text-sm"
        >
          Logout
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [institute, setInstitute] = useState(demoInstituteSettings);
  const [selectedCollege, setSelectedCollege] = useState(() => {
    const stored = sessionStorage.getItem('selectedCollege');
    return stored ? JSON.parse(stored) : null;
  });
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setSelectedCollege(null);
        sessionStorage.removeItem('selectedCollege');
        setAuthLoading(false);
        return;
      }

      const profile = await getUserProfile(nextUser.uid).catch(() => null);
      setUser({
        ...nextUser,
        roleId: profile?.roleId || 'pending',
        status: profile?.status || 'Pending Approval',
        permissions: profile?.permissions || [],
        displayId: profile?.displayId || profile?.adminId || profile?.employeeId || '',
        collegeIds: profile?.collegeIds || ['main-campus'],
        linkedStudentIds: profile?.linkedStudentIds || [],
        linkedStudentRecordIds: profile?.linkedStudentRecordIds || [],
      });
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadInstitute = async () => {
      try {
        const data = await getSettingsData();
        if (data.institute) setInstitute(data.institute);
      } catch (error) {
        console.warn('Using demo institute for college selection.', error);
      }
    };
    loadInstitute();
  }, []);

  const logout = async () => {
    setSelectedCollege(null);
    sessionStorage.removeItem('selectedCollege');
    await logoutUser();
  };

  const selectCollege = (college) => {
    setSelectedCollege(college);
    sessionStorage.setItem('selectedCollege', JSON.stringify(college));
  };

  if (authLoading) {
    return (
      <div className="app-background">
        <ParticleBackground />
        <main className="relative z-[1] min-h-screen bg-transparent flex items-center justify-center text-sm font-semibold text-[#00ff88]">
          Loading ERP...
        </main>
      </div>
    );
  }

  const hasActiveProfile = user?.status === 'Active' && user?.roleId && user.roleId !== 'pending';
  const needsCollegeSelection = hasActiveProfile && user?.roleId === 'super-admin' && !selectedCollege;
  const colleges = [buildCollegeFromInstitute(institute)];

  return (
    <div className="app-background">
      <ParticleBackground />
      <Routes>
      <Route path="/" element={<Navigate to={user ? '/students' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/students" replace /> : <AuthPage />} />
      <Route path="/register" element={<Navigate to={user ? '/students' : '/login'} replace />} />
      <Route
        path="/students"
        element={user ? (
          !hasActiveProfile ? (
            <AccessPending user={user} onLogout={logout} />
          ) : needsCollegeSelection ? (
            <CollegeSelection colleges={colleges} onSelect={selectCollege} />
          ) : (
            <StudentInformationManagement user={{ ...user, selectedCollege }} onLogout={logout} />
          )
        ) : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/students' : '/login'} replace />} />
      </Routes>
    </div>
  );
}
