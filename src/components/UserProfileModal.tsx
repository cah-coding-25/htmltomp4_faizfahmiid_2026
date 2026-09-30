import React, { useState, useEffect } from 'react';
import { 
  User as UserIcon, 
  Lock, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Save,
  AtSign,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  FileSpreadsheet,
  Bot
} from 'lucide-react';
import { User } from '../types';
import { updateUserProfile } from '../utils/authService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUserUpdated: (updatedUser: User) => void;
  googleSheetUrl?: string;
  theme?: string;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUserUpdated,
  googleSheetUrl,
  theme
}: UserProfileModalProps) {
  const [emailInput, setEmailInput] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Toggle mata untuk melihat sandi
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copiedOldPassword, setCopiedOldPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setEmailInput(currentUser.email);
      setNewUsername(currentUser.username);
      setNewPassword('');
      setConfirmPassword('');
      setShowOldPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setCopiedOldPassword(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, currentUser]);

  const handleCopyOldPassword = () => {
    if (currentUser?.password && navigator.clipboard) {
      navigator.clipboard.writeText(currentUser.password);
      setCopiedOldPassword(true);
      setTimeout(() => setCopiedOldPassword(false), 2000);
    }
  };

  if (!isOpen || !currentUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanInputEmail = emailInput.trim().toLowerCase();
    const registeredEmail = currentUser.email.trim().toLowerCase();

    // 1. Validasi Wajib Email Sama
    if (!cleanInputEmail) {
      setErrorMsg('Alamat email wajib diisi untuk verifikasi keamanan akun!');
      return;
    }

    if (cleanInputEmail !== registeredEmail) {
      setErrorMsg(`Email tidak cocok! Anda wajib memasukkan email yang sama persis saat mendaftar (${currentUser.email.slice(0, 3)}***@***).`);
      return;
    }

    // 2. Validasi Username
    const cleanUser = newUsername.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
    if (cleanUser.length < 3) {
      setErrorMsg('Username minimal 3 karakter (hanya huruf, angka, atau garis bawah)!');
      return;
    }

    // 3. Validasi Password jika diisi
    if (newPassword) {
      if (newPassword.length < 4) {
        setErrorMsg('Kata sandi baru minimal 4 karakter!');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Konfirmasi kata sandi baru tidak cocok!');
        return;
      }
    }

    setLoading(true);

    try {
      const res = updateUserProfile(
        currentUser.id,
        cleanInputEmail,
        cleanUser,
        newPassword || undefined,
        googleSheetUrl
      );

      if (res.success && res.updatedUser) {
        setSuccessMsg(res.message);
        onUserUpdated(res.updatedUser);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memperbarui akun');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all flex flex-col max-h-[92vh]">
        
        {/* Header Modal */}
        <div className={`p-5 text-white relative flex items-center justify-between ${
          currentUser.role === 'admin'
            ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600'
            : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-xl font-black shadow-inner uppercase">
              {currentUser.name.substring(0, 1)}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-lg font-black tracking-tight text-white">{currentUser.name}</h2>
                {currentUser.role === 'admin' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/30 font-bold uppercase tracking-wider text-amber-200 border border-amber-300/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 font-medium">
                Edit Profil Akun (Username & Kata Sandi)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer"
            title="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          
          {/* Security Rule Banner */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Ketentuan Keamanan Profil:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              Hanya <strong>Username</strong> dan <strong>Kata Sandi</strong> yang dapat diubah. Demi keamanan data finansial, <strong>alamat email wajib sama persis</strong> dengan yang didaftarkan.
            </p>
          </div>

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-emerald-700 dark:text-emerald-300 text-xs flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* 1. EMAIL TERDAFTAR (Wajib Sama & Diverifikasi) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Alamat Email Terdaftar (Wajib Sama)</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  Verifikasi Identitas
                </span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Masukkan email terdaftar Anda"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Email akun Anda: <strong className="font-mono text-slate-800 dark:text-slate-200">{currentUser.email}</strong>. Tidak dapat diganti ke email lain.
              </p>
            </div>

            {/* 2. USERNAME BARU (Bisa diedit) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <AtSign className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Username Baru (Dapat Diubah)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Contoh: faiz_fahmi"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white"
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Username dipakai untuk masuk ke aplikasi. Minimal 3 karakter huruf/angka.
              </p>
            </div>

            {/* 3. KATA SANDI LAMA / SAAT INI (Agar pengguna tahu sandi lamanya) */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kata Sandi Lama / Saat Ini:</span>
                </label>
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70 px-2 py-0.5 rounded-full border border-amber-300/60 dark:border-amber-700/60">
                  Sandi Aktif Akun
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  value={currentUser.password || ''}
                  readOnly
                  className="w-full pl-9 pr-20 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                />
                <KeyRound className="w-4 h-4 text-amber-500 absolute left-3" />
                <div className="absolute right-1.5 flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="p-1.5 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title={showOldPassword ? 'Sembunyikan kata sandi lama' : 'Klik tombol mata untuk melihat kata sandi lama'}
                  >
                    {showOldPassword ? <EyeOff className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyOldPassword}
                    className="p-1.5 text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition cursor-pointer rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Salin kata sandi lama ke clipboard"
                  >
                    {copiedOldPassword ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Ini adalah kata sandi yang saat ini digunakan untuk masuk ke akun Anda.
              </p>
            </div>

            {/* 4. KATA SANDI BARU (Bisa diedit) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Kata Sandi Baru (Dapat Diubah)</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak ingin ganti sandi"
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title={showNewPassword ? 'Sembunyikan sandi' : 'Lihat sandi baru'}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 5. KONFIRMASI KATA SANDI BARU */}
            {newPassword.length > 0 && (
              <div className="space-y-1 animate-fadeIn">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Konfirmasi Kata Sandi Baru</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi baru Anda"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden dark:text-white"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                    title={showConfirmPassword ? 'Sembunyikan sandi' : 'Lihat konfirmasi sandi'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Info Waktu Mendaftar & Integrasi Privat */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5">
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Integrasi Data Akun Anda</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">100% Terisolasi Privat</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center space-x-1">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Google Spreadsheet:</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {currentUser.googleSheetUrl ? 'Spreadsheet Mandiri Terhubung' : 'Penyimpanan Lokal'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center space-x-1">
                    <Bot className="w-3.5 h-3.5 text-blue-500" />
                    <span>Bot Telegram:</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {currentUser.telegramBotToken ? 'Bot Telegram Privat Aktif' : 'Belum Dikonfigurasi'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Waktu Pendaftaran:</span>
                <span className="font-mono font-medium text-slate-600 dark:text-slate-300">
                  {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Tercatat'}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 text-white font-bold rounded-xl shadow-lg flex items-center justify-center space-x-2 transition cursor-pointer disabled:opacity-50 active:scale-[0.99] ${
                currentUser.role === 'admin'
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Menyimpan Perubahan...' : 'Simpan Perubahan Profil'}</span>
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
