import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { loginWithEmail, logoutUser, sendResetPasswordEmail } from '../firebase/auth';
import { isFirebaseConfigured } from '../firebase/config';
import { getUserProfile } from '../firebase/db';
import devloftLogo from '../../assets/logo.png';

const roleOptions = [
  { id: 'parent', label: 'Parent', aliases: ['parent'] },
  { id: 'faculty', label: 'Staff', aliases: ['faculty'] },
  { id: 'admin', label: 'Admin', aliases: ['admin', 'super-admin'] },
];

function getAuthErrorMessage(error) {
  const code = error?.code || '';
  if (code.includes('invalid-credential')) return 'Invalid email or password.';
  if (code.includes('email-already-in-use')) return 'This email is already registered.';
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('network-request-failed')) return 'Network error while contacting Firebase.';
  if (code.includes('missing-email')) return 'Enter your email address first.';
  if (code.includes('user-not-found')) return 'No account exists for that email address.';
  return error?.message || 'Authentication failed. Please try again.';
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    roleId: 'parent',
    email: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const selectedRole = roleOptions.find((role) => role.id === form.roleId) || roleOptions[0];

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const signedInUser = await loginWithEmail(form.email.trim(), form.password);
      const profile = await getUserProfile(signedInUser.uid).catch(() => null);
      const profileRoleId = profile?.roleId || signedInUser.roleId;

      if (profileRoleId && profileRoleId !== 'pending' && !selectedRole.aliases.includes(profileRoleId)) {
        await logoutUser().catch(() => {});
        toast.error(`This account is registered as ${profileRoleId}. Choose the correct login type.`);
        return;
      }

      toast.success('Signed in');
      navigate('/dashboard');
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    const email = form.email.trim();
    if (!email) {
      toast.error('Enter your email address first.');
      return;
    }

    setResetting(true);
    try {
      await sendResetPasswordEmail(email);
      toast.success('Password reset email sent.');
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setResetting(false);
    }
  };

  return (
    <main className="auth-shell min-h-screen bg-[#f1f2f4] flex items-center justify-center p-6">
      <section className="auth-panel w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-[0_18px_60px_rgba(15,23,42,0.12)] overflow-hidden">
        <div className="bg-[#1b1f21] text-white p-7">
          <div className="h-16 w-16 rounded-xl bg-white flex items-center justify-center mb-5 overflow-hidden">
            <img src={devloftLogo} alt="Devloft" className="h-full w-full object-contain p-2" />
          </div>
          <h1 className="text-3xl font-bold">Devloft College Management</h1>
          <p className="text-sm text-slate-300 mt-1">College Management Suite</p>
        </div>

        <form onSubmit={submit} className="p-7 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Login</h2>
            {!isFirebaseConfigured && (
              <p className="text-sm text-slate-500 mt-1">Add Firebase values to .env before signing in.</p>
            )}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-slate-500">I am a</legend>
            <div className="grid grid-cols-3 gap-2">
              {roleOptions.map((role) => {
                const selected = form.roleId === role.id;
                return (
                  <label
                    key={role.id}
                    className={`auth-role-option h-11 rounded-lg border px-3 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer transition-colors ${
                      selected
                        ? 'is-selected border-[#00ff88] bg-[#00ff88] text-[#02100d]'
                        : 'border-slate-200 bg-[#f5f5f6] text-slate-600 hover:border-[#00ff88]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="roleId"
                      value={role.id}
                      checked={selected}
                      onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}
                      className="sr-only"
                    />
                    {role.id === 'admin' ? <ShieldCheck size={16} /> : <Users size={16} />}
                    {role.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Email</span>
            <div className="relative">
              <Mail size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full h-11 rounded-lg bg-[#f5f5f6] border border-slate-200 pl-10 pr-3 outline-none focus:ring-2 focus:ring-orange-100"
                placeholder={`${selectedRole.id}@college.edu`}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-500 mb-1.5 block">Password</span>
            <div className="relative">
              <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full h-11 rounded-lg bg-[#f5f5f6] border border-slate-200 pl-10 pr-11 outline-none focus:ring-2 focus:ring-orange-100"
                placeholder="minimum 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md text-slate-500 hover:bg-white flex items-center justify-center"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <button
              disabled={!isFirebaseConfigured || submitting || resetting}
              className="auth-primary-button flex-1 h-11 rounded-full bg-[#00ff88] text-[#02100d] font-bold disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? 'Please wait...' : 'Login'}
            </button>
            <button
              type="button"
              onClick={resetPassword}
              disabled={!isFirebaseConfigured || submitting || resetting}
              className="auth-reset-button h-11 px-4 rounded-full bg-transparent border border-slate-200 text-[#fb8d49] font-semibold disabled:cursor-not-allowed disabled:text-slate-400 disabled:bg-slate-100"
            >
              {resetting ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          <p className="text-sm text-center text-slate-500">
            Need an account? Ask an administrator to create one for you.
          </p>
        </form>
      </section>
    </main>
  );
}
