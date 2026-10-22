import React, { useState } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  Mail, 
  ShieldCheck, 
  KeyRound, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  UserPlus,
  LogIn,
  AtSign
} from 'lucide-react';
import { 
  loginUser, 
  registerUser, 
  resetPasswordUser, 
  loginWithGoogleEmail, 
  getGoogleClientId, 
  cleanGoogleClientId,
  parseJwt 
} from '../utils/authService';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onSuccessLogin: (user: UserType) => void;
  googleSheetUrl?: string;
  adminGoogleSheetUrl?: string;
  googleClientId?: string;
  theme?: 'light' | 'dark' | 'luxury-gold';
}

export default function AuthModal({
  isOpen,
  onSuccessLogin,
  googleSheetUrl,
  adminGoogleSheetUrl,
  googleClientId
}: AuthModalProps) {
  if (!isOpen) return null;

  const targetAuthSheetUrl = adminGoogleSheetUrl || googleSheetUrl;

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Forgot password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearErrors = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    setIsSubmitting(true);

    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
    }, 10000);

    try {
      const res = await loginUser(loginId, loginPassword, targetAuthSheetUrl);
      if (res.success && res.user) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onSuccessLogin(res.user!);
        }, 600);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    // Validasi Password Dua Kali (Konfirmasi Sandi)
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage('Kata sandi minimal 4 karakter!');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok! Pastikan Anda memasukkan kata sandi yang sama persis di kedua kolom.');
      return;
    }

    setIsSubmitting(true);
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
    }, 10000);

    try {
      const res = await registerUser(
        {
          name: regName,
          email: regEmail,
          username: regUsername,
          password: regPassword
        },
        targetAuthSheetUrl
      );

      if (res.success && res.user) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          onSuccessLogin(res.user!);
        }, 800);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat mendaftar');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();

    if (forgotNewPassword !== forgotConfirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi baru!');
      return;
    }

    setIsSubmitting(true);
    const safetyTimer = setTimeout(() => {
      setIsSubmitting(false);
    }, 10000);

    try {
      const res = await resetPasswordUser(forgotEmail, forgotNewPassword, targetAuthSheetUrl);
      if (res.success) {
        setSuccessMessage(res.message);
        setForgotEmail('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setTimeout(() => {
          setMode('login');
          setLoginPassword('');
        }, 1800);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal mengatur ulang kata sandi');
    } finally {
      clearTimeout(safetyTimer);
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    clearErrors();
    const clientId = cleanGoogleClientId(googleClientId || getGoogleClientId());

    if (!clientId) {
      setErrorMessage('Google Auth Client ID belum dikonfigurasi. Administrator dapat memasukkan Google Auth Client ID di menu Pengaturan / Tab Admin.');
      return;
    }

    if (typeof window === 'undefined') return;
    const google = (window as any).google;

    if (!google) {
      setErrorMessage('Layanan Google Sign-In sedang dimuat. Mohon tunggu beberapa saat atau periksa koneksi internet Anda.');
      return;
    }

    setIsGoogleLoading(true);

    // Timeout pengaman otomatis (maksimal 10 detik) agar tombol tidak pernah stuck loading
    const safetyTimer = setTimeout(() => {
      setIsGoogleLoading(false);
    }, 10000);

    // Deteksi saat jendela browser kembali aktif (misal popup Google ditutup oleh pengguna)
    const onWindowFocus = () => {
      setTimeout(() => {
        setIsGoogleLoading(false);
        clearTimeout(safetyTimer);
      }, 1200);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });

    // Fungsi pusat pengolahan profil Google pengguna
    const handleGoogleUserData = async (email: string, name?: string) => {
      clearTimeout(safetyTimer);
      window.removeEventListener('focus', onWindowFocus);
      try {
        const res = await loginWithGoogleEmail(email, name, targetAuthSheetUrl);
        if (res.success && res.user) {
          setSuccessMessage(res.message);
          setTimeout(() => {
            onSuccessLogin(res.user!);
          }, 600);
        } else {
          // ATURAN UTAMA: Jika belum terdaftar, langsung tempelkan email & nama ke formulir pendaftaran
          const cleanEmail = email.trim().toLowerCase();
          const cleanName = (name || cleanEmail.split('@')[0] || '').trim();
          setRegEmail(cleanEmail);
          setRegName(cleanName);
          const autoUser = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
          setRegUsername(prev => prev.trim() ? prev : autoUser);
          
          // Alihkan mode ke pendaftaran seketika
          setMode('register');
          setSuccessMessage(`Akun Google (${cleanEmail}) terhubung! Seluruh kolom (Email, Nama, dan Username) telah otomatis terisi dan DAPAT ANDA EDIT BEBAS sesuai keinginan. Silakan lengkapi kata sandi untuk mendaftar.`);
          setErrorMessage('');
        }
      } catch (err: any) {
        setErrorMessage('Gagal memverifikasi akun Google: ' + (err?.message || 'Error'));
      } finally {
        setIsGoogleLoading(false);
      }
    };

    // 1. Prioritaskan OAuth2 Token Client (Popup)
    if (google.accounts?.oauth2) {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          error_callback: (err: any) => {
            clearTimeout(safetyTimer);
            window.removeEventListener('focus', onWindowFocus);
            setIsGoogleLoading(false);
            if (err && err.type !== 'popup_closed') {
              setErrorMessage('Otorisasi Google: ' + (err.message || err.type || 'Dibatalkan'));
            }
          },
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              clearTimeout(safetyTimer);
              window.removeEventListener('focus', onWindowFocus);
              setIsGoogleLoading(false);
              if (tokenResponse.error !== 'popup_closed_by_user') {
                setErrorMessage('Otorisasi Google dibatalkan atau gagal: ' + tokenResponse.error);
              }
              return;
            }
            if (tokenResponse?.access_token) {
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                });
                const userData = await userRes.json();
                if (userData?.email) {
                  await handleGoogleUserData(userData.email, userData.name);
                } else {
                  clearTimeout(safetyTimer);
                  setIsGoogleLoading(false);
                  setErrorMessage('Gagal memperoleh email dari akun Google.');
                }
              } catch (err: any) {
                clearTimeout(safetyTimer);
                setIsGoogleLoading(false);
                setErrorMessage('Gagal memverifikasi akun Google: ' + (err?.message || 'Error'));
              }
            } else {
              clearTimeout(safetyTimer);
              setIsGoogleLoading(false);
            }
          }
        });
        tokenClient.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err: any) {
        console.warn('OAuth token client init failed, trying Identity Services prompt', err);
      }
    }

    // 2. Fallback ke google.accounts.id Prompt
    if (google.accounts?.id) {
      try {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: any) => {
            if (response?.credential) {
              const payload = parseJwt(response.credential);
              if (payload?.email) {
                await handleGoogleUserData(payload.email, payload.name);
                return;
              }
            }
            clearTimeout(safetyTimer);
            setIsGoogleLoading(false);
          },
          auto_select: false,
        });

        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            clearTimeout(safetyTimer);
            window.removeEventListener('focus', onWindowFocus);
            setIsGoogleLoading(false);
            setErrorMessage('Popup Google tidak dapat ditampilkan. Pastikan popup tidak diblokir browser atau periksa Authorized JavaScript Origins di Google Cloud Console.');
          }
        });
      } catch (e: any) {
        clearTimeout(safetyTimer);
        window.removeEventListener('focus', onWindowFocus);
        setIsGoogleLoading(false);
        setErrorMessage('Gagal memulai Google Sign-In: ' + (e?.message || 'Error'));
      }
    } else {
      clearTimeout(safetyTimer);
      window.removeEventListener('focus', onWindowFocus);
      setIsGoogleLoading(false);
      setErrorMessage('Modul Google Sign-In belum tersedia di browser.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all">
        
        {/* Modal Top Header (Clean Professional Header without top tabs) */}
        <div className="p-6 pb-5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-slate-900 dark:via-emerald-950 dark:to-slate-900 text-white relative">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-sm shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black tracking-tight text-white">FahKeu</h2>
              </div>
              <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
                {mode === 'login' && 'Masuk ke akun keuangan pribadi Anda'}
                {mode === 'register' && 'Daftar akun baru untuk mulai mencatat'}
                {mode === 'forgot' && 'Pemulihan kata sandi akun terdaftar'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Form Content */}
        <div className="p-6 space-y-4">
          
          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span className="leading-relaxed font-medium">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
              <span className="leading-relaxed font-medium">{successMessage}</span>
            </div>
          )}

          {/* 1. FORM LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Username atau Email</span>
                </label>
                <input
                  type="text"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Masukkan username atau email Anda..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Kata Sandi</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setMode('forgot'); clearErrors(); }}
                    className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    Lupa sandi?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi..."
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Memproses Masuk...' : 'Masuk ke Akun'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Garis Pemisah (Divider) */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  atau
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              {/* Tombol Masuk dengan Akun Google */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2.5 transition cursor-pointer active:scale-[0.99] disabled:opacity-60"
                  title="Masuk langsung menggunakan akun Google yang sudah didaftarkan"
                >
                  {isGoogleLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Menghubungkan Akun Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span className="text-xs">Masuk dengan Akun Google</span>
                    </>
                  )}
                </button>
                {isGoogleLoading && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGoogleLoading(false);
                        clearErrors();
                      }}
                      className="text-[11px] text-slate-500 hover:text-rose-500 underline cursor-pointer"
                    >
                      Batal koneksi Google
                    </button>
                  </div>
                )}
              </div>

              {/* Tombol Daftar Akun Berada di Bawah Login (Clean Professional Layout) */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Belum memiliki akun?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('register'); clearErrors(); }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                  >
                    <span>Daftar Sekarang</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 2. FORM REGISTER (Tampil jika user klik Daftar Akun) */}
          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {(regEmail || regName) && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-start justify-between space-x-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-start space-x-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <span className="font-bold">Data Terisi Otomatis: </span>
                      <span>Kolom Nama, Email, dan Username di bawah ini <strong>TIDAK DIPATENKAN</strong> dan <strong>bebas Anda edit / ganti</strong> sebelum mendaftar.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRegName('');
                      setRegEmail('');
                      setRegUsername('');
                    }}
                    className="text-[11px] text-emerald-700 dark:text-emerald-300 hover:text-rose-500 hover:underline shrink-0 cursor-pointer font-medium"
                    title="Kosongkan kolom dan ketik manual"
                  >
                    Kosongkan
                  </button>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <UserIcon className="w-3 h-3 text-slate-500" />
                    <span>Nama Lengkap</span>
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bisa diedit bebas</span>
                </div>
                <input
                  type="text"
                  required
                  readOnly={false}
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Contoh: Ahmad Faiz"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <Mail className="w-3 h-3 text-emerald-600" />
                    <span>Alamat Email (Wajib untuk Pemulihan Sandi)</span>
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Bisa diubah / diedit bebas</span>
                </div>
                <input
                  type="email"
                  required
                  readOnly={false}
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="email@anda.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <AtSign className="w-3 h-3 text-slate-500" />
                    <span>Username Unik</span>
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bisa disesuaikan bebas</span>
                </div>
                <input
                  type="text"
                  required
                  readOnly={false}
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder="faiz99"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 font-mono transition"
                />
              </div>

              {/* KATA SANDI BARU (Input Pertama) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Kata Sandi Baru</span>
                </label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Minimal 4 karakter"
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showRegPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ULANGI KATA SANDI (Input Kedua - Verifikasi) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Ulangi Kata Sandi (Verifikasi)</span>
                  </label>
                  {regConfirmPassword.length > 0 && (
                    <span className={`text-[10px] font-bold ${
                      regPassword === regConfirmPassword
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-500'
                    }`}>
                      {regPassword === regConfirmPassword ? '✓ Sandi cocok' : '✗ Belum cocok'}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showRegConfirmPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang kata sandi yang sama persis"
                    className={`w-full pl-3.5 pr-10 py-2 rounded-xl border bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 ${
                      regConfirmPassword.length > 0 && regPassword !== regConfirmPassword
                        ? 'border-rose-300 dark:border-rose-800 focus:ring-rose-500'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-emerald-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showRegConfirmPassword ? 'Sembunyikan kata sandi' : 'Lihat konfirmasi kata sandi'}
                  >
                    {showRegConfirmPassword ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Mendaftarkan...' : 'Daftar Akun Baru'}</span>
                <UserPlus className="w-4 h-4" />
              </button>

              {/* Garis Pemisah (Divider) */}
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
                <span className="flex-shrink mx-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  atau
                </span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
              </div>

              {/* Tombol Isi Otomatis dengan Akun Google */}
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 font-bold rounded-xl shadow-xs flex items-center justify-center space-x-2.5 transition cursor-pointer active:scale-[0.99] disabled:opacity-60"
                  title="Ambil data email dan nama secara otomatis dari akun Google Anda"
                >
                  {isGoogleLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs">Menghubungkan Akun Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span className="text-xs">Isi Cepat dari Akun Google</span>
                    </>
                  )}
                </button>
                {isGoogleLoading && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGoogleLoading(false);
                        clearErrors();
                      }}
                      className="text-[11px] text-slate-500 hover:text-rose-500 underline cursor-pointer"
                    >
                      Batal koneksi Google
                    </button>
                  </div>
                )}
              </div>

              {/* Kembali ke halaman Login */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Sudah memiliki akun?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); clearErrors(); }}
                    className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 hover:underline cursor-pointer"
                  >
                    Masuk di sini
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* 3. FORM FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-3.5">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <div className="font-bold flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                  <span>Atur Ulang Kata Sandi Mandiri</span>
                </div>
                <p className="leading-relaxed text-[11px]">
                  Masukkan alamat email yang <b>sama persis</b> dengan saat Anda mendaftar akun. Kata sandi baru akan langsung diperbarui dan disinkronkan ke sistem admin.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Email Terdaftar (Wajib Sama)</span>
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Masukkan email yang terdaftar..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kata Sandi Baru</span>
                </label>
                <div className="relative">
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Masukkan kata sandi baru..."
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showForgotNewPassword ? 'Sembunyikan sandi' : 'Lihat kata sandi baru'}
                  >
                    {showForgotNewPassword ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Ulangi Kata Sandi Baru
                </label>
                <div className="relative">
                  <input
                    type={showForgotConfirmPassword ? 'text' : 'password'}
                    required
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru..."
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showForgotConfirmPassword ? 'Sembunyikan sandi' : 'Lihat konfirmasi sandi'}
                  >
                    {showForgotConfirmPassword ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Menyimpan...' : 'Perbarui Kata Sandi Saya'}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode('login'); clearErrors(); }}
                  className="text-xs text-slate-500 hover:text-emerald-600 font-semibold cursor-pointer"
                >
                  ← Kembali ke Halaman Masuk
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer Note */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-center text-slate-400">
          Sistem Keamanan Akun Terproteksi • FahKeu by faiz_fahmi_id
        </div>
      </div>
    </div>
  );
}
