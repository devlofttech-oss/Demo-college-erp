import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AuthPage from './pages/AuthPage';
import StudentInformationManagement from './modules/students/StudentInformationManagement';
import { logoutUser, subscribeToAuthState } from './firebase/auth';
import { getUserProfile } from './firebase/db';
import ParticleBackground from './components/ParticleBackground';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      const profile = await getUserProfile(nextUser.uid).catch(() => null);
      setUser({
        ...nextUser,
        roleId: profile?.roleId || nextUser.roleId || 'admin',
        status: profile?.status || 'Active',
        permissions: profile?.permissions || [],
      });
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await logoutUser();
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

  return (
    <div className="app-background">
      <ParticleBackground />
      <Routes>
      <Route path="/" element={<Navigate to={user ? '/students' : '/login'} replace />} />
      <Route path="/login" element={user ? <Navigate to="/students" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/students" replace /> : <AuthPage mode="register" />} />
      <Route
        path="/students"
        element={user ? <StudentInformationManagement user={user} onLogout={logout} /> : <Navigate to="/login" replace />}
      />
      <Route path="*" element={<Navigate to={user ? '/students' : '/login'} replace />} />
      </Routes>
    </div>
  );
}
