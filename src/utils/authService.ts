import { User, AppSettings } from '../types';
import { MASTER_CONFIG } from '../config';

const USERS_STORAGE_KEY = 'catatkeu_users';
const CURRENT_USER_KEY = 'catatkeu_auth_session';
const ADMIN_GOOGLE_SHEET_KEY = 'catatkeu_admin_google_sheet_url';
const GOOGLE_CLIENT_ID_KEY = 'catatkeu_google_client_id';

// In-Memory fallback caches to prevent accidental wipe
let inMemoryAdminSheetUrl = '';
let inMemoryGoogleClientId = '';

export interface ServerSystemConfig {
  adminGoogleSheetUrl: string;
  googleClientId: string;
  globalGoogleSheetUrl?: string;
  updatedAt?: string;
}

/**
 * Mengambil konfigurasi global sistem dari server backend (disimpan permanen di server untuk semua pengguna di dunia).
 */
export async function fetchSystemConfigFromServer(): Promise<ServerSystemConfig | null> {
  try {
    const res = await fetch('/api/system-config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.config) {
        const { adminGoogleSheetUrl, googleClientId } = data.config;
        if (adminGoogleSheetUrl && typeof adminGoogleSheetUrl === 'string' && adminGoogleSheetUrl.trim()) {
          inMemoryAdminSheetUrl = adminGoogleSheetUrl.trim();
          saveAdminGoogleSheetUrl(inMemoryAdminSheetUrl, false);
        }
        if (googleClientId && typeof googleClientId === 'string' && googleClientId.trim()) {
          inMemoryGoogleClientId = googleClientId.trim();
          saveGoogleClientId(inMemoryGoogleClientId, false);
        }
        return data.config;
      }
    }
  } catch (err) {
    console.warn('Gagal memuat konfigurasi sistem global dari server:', err);
  }
  return null;
}

/**
 * Menyimpan konfigurasi global sistem ke server backend selamanya.
 */
export async function saveSystemConfigToServer(updates: {
  adminGoogleSheetUrl?: string;
  googleClientId?: string;
  globalGoogleSheetUrl?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/system-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    return Boolean(data && data.success);
  } catch (err) {
    console.warn('Gagal menyimpan konfigurasi sistem global ke server:', err);
    return false;
  }
}

export function getAdminGoogleSheetUrl(): string {
  try {
    if (inMemoryAdminSheetUrl && inMemoryAdminSheetUrl.trim()) {
      return inMemoryAdminSheetUrl.trim();
    }
    const raw = localStorage.getItem(ADMIN_GOOGLE_SHEET_KEY);
    if (raw && raw.trim()) {
      inMemoryAdminSheetUrl = raw.trim();
      return inMemoryAdminSheetUrl;
    }
    // Cek juga dari global settings jika ada
    const settingsRaw = localStorage.getItem('catatkeu_settings');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed?.adminGoogleSheetUrl && parsed.adminGoogleSheetUrl.trim()) {
        inMemoryAdminSheetUrl = parsed.adminGoogleSheetUrl.trim();
        return inMemoryAdminSheetUrl;
      }
    }
    // Fallback ke master konfigurasi permanen di kode (GitHub)
    if (MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL && MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL.trim()) {
      inMemoryAdminSheetUrl = MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL.trim();
      return inMemoryAdminSheetUrl;
    }
    return '';
  } catch (e) {
    return inMemoryAdminSheetUrl || MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL || '';
  }
}

export function saveAdminGoogleSheetUrl(url: string, syncToServer: boolean = true): void {
  try {
    const clean = (url || '').trim();
    if (!clean && inMemoryAdminSheetUrl) {
      // Jangan timpa nilai yang sudah ada dengan string kosong secara tidak sengaja
      return;
    }
    inMemoryAdminSheetUrl = clean;
    localStorage.setItem(ADMIN_GOOGLE_SHEET_KEY, clean);

    const settingsRaw = localStorage.getItem('catatkeu_settings');
    let parsed: any = {};
    if (settingsRaw) {
      try {
        parsed = JSON.parse(settingsRaw);
      } catch (err) {}
    }
    parsed.adminGoogleSheetUrl = clean;
    localStorage.setItem('catatkeu_settings', JSON.stringify(parsed));

    // Kirim ke server agar tersimpan secara global selamanya
    if (syncToServer && clean) {
      saveSystemConfigToServer({ adminGoogleSheetUrl: clean }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save admin google sheet url:', e);
  }
}

// Akun bawaan awal (Default seed accounts)
export const DEFAULT_USERS: User[] = [
  {
    id: 'usr_admin_01',
    name: 'Administrator Utama',
    email: 'admin@fahkeu.id',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    createdAt: '2026-01-01T08:00:00.000Z',
    status: 'active',
    googleSheetUrl: '',
    telegramBotToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    telegramChatId: '847926189',
    useCloudStorage: false
  },
  {
    id: 'usr_faiz_02',
    name: 'Faiz Fahmi',
    email: 'faiz@fahkeu.id',
    username: 'faiz',
    password: 'user123',
    role: 'user',
    createdAt: '2026-01-02T10:00:00.000Z',
    status: 'active',
    googleSheetUrl: 'https://script.google.com/macros/s/AKfycbwPLCg1LaOfeGChXe0nuzH_8F6KyqqW60eGDKd26nz_ywuMidA23Bttg64EALdCwXJj/exec',
    telegramBotToken: '8709948311:AAFplXfgU1eWt4vqCGFLceyAybHYZ9BCKh0',
    telegramChatId: '7900068001',
    useCloudStorage: true
  }
];

export function getStoredUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      let changed = false;
      // Pastikan admin selalu tersedia
      const hasAdmin = parsed.some(u => u.username.toLowerCase() === 'admin' || u.role === 'admin');
      if (!hasAdmin) {
        parsed.unshift(DEFAULT_USERS[0]);
        changed = true;
      }
      // Pastikan akun faiz memiliki Google Sheet URL yang terhubung ke datanya jika sebelumnya kosong
      const faizUser = parsed.find(u => u.id === 'usr_faiz_02' || u.username.toLowerCase() === 'faiz');
      if (faizUser && !faizUser.googleSheetUrl) {
        faizUser.googleSheetUrl = DEFAULT_USERS[1].googleSheetUrl;
        faizUser.telegramBotToken = faizUser.telegramBotToken || DEFAULT_USERS[1].telegramBotToken;
        faizUser.telegramChatId = faizUser.telegramChatId || DEFAULT_USERS[1].telegramChatId;
        faizUser.useCloudStorage = true;
        changed = true;
      }
      if (changed) {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(parsed));
      }
      return parsed;
    }
    return DEFAULT_USERS;
  } catch (e) {
    console.error('Failed to read users from localStorage:', e);
    return DEFAULT_USERS;
  }
}

export function saveStoredUsers(users: User[]) {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    // Simpan juga ke server agar persisten lintas browser dan sesi
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users })
    }).catch(e => console.warn('Failed to post users to server:', e));
  } catch (e) {
    console.error('Failed to save users to localStorage:', e);
  }
}

export async function fetchUsersFromServer(): Promise<User[] | null> {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && Array.isArray(data.users) && data.users.length > 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(data.users));
      return data.users;
    }
  } catch (e) {
    console.warn('Failed to fetch users from server:', e);
  }
  return null;
}

export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user: User | null) {
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (e) {
    console.error('Failed to update auth session:', e);
  }
}

export async function loginUser(
  identifier: string, // username atau email
  passwordInput: string,
  googleSheetUrl?: string
): Promise<{ success: boolean; user?: User; message: string }> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanId || !cleanPass) {
    return { success: false, message: 'Username/Email dan kata sandi wajib diisi!' };
  }

  // Khusus pintasan admin: username 'admin' & pass 'admin123'
  if ((cleanId === 'admin' || cleanId === 'admin@fahkeu.id' || cleanId === 'admin123') && cleanPass === 'admin123') {
    const users = getStoredUsers();
    let admin = users.find(u => u.role === 'admin' || u.username === 'admin');
    if (!admin) {
      admin = DEFAULT_USERS[0];
      saveStoredUsers([admin, ...users]);
    }
    setCurrentUser(admin);
    return { success: true, user: admin, message: 'Selamat datang kembali, Administrator!' };
  }

  // Cek pada daftar pengguna lokal terlebih dahulu
  const users = getStoredUsers();
  const found = users.find(
    u => (u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId)
  );

  if (found) {
    if (found.status === 'suspended') {
      return { success: false, message: 'Akun Anda saat ini dinonaktifkan oleh Admin. Hubungi administrator untuk mengaktifkannya.' };
    }
    if (found.password === cleanPass) {
      setCurrentUser(found);
      return { success: true, user: found, message: `Selamat datang, ${found.name}!` };
    } else {
      return { success: false, message: 'Kata sandi yang Anda masukkan salah. Silakan coba lagi atau gunakan Lupa Sandi.' };
    }
  }

  // Jika tidak ditemukan di lokal dan ada googleSheetUrl atau adminGoogleSheetUrl, coba cek ke Cloud Spreadsheet Admin
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl) {
    try {
      const res = await fetch(`${targetSheetUrl}?action=login&identifier=${encodeURIComponent(cleanId)}&password=${encodeURIComponent(cleanPass)}`);
      const data = await res.json();
      if (data.success && data.user) {
        // Simpan ke lokal juga
        const existing = users.filter(u => u.id !== data.user.id);
        saveStoredUsers([...existing, data.user]);
        setCurrentUser(data.user);
        return { success: true, user: data.user, message: `Selamat datang, ${data.user.name}!` };
      }
    } catch (e) {
      console.warn('Login via Google Sheets failed, falling back to local result', e);
    }
  }

  return { success: false, message: 'Akun tidak ditemukan. Periksa kembali username/email Anda atau daftar akun baru.' };
}

export async function registerUser(
  data: { name: string; email: string; username: string; password: string },
  googleSheetUrl?: string
): Promise<{ success: boolean; user?: User; message: string }> {
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const username = data.username.trim().toLowerCase().replace(/\s+/g, '');
  const password = data.password.trim();

  if (!name || !email || !username || !password) {
    return { success: false, message: 'Seluruh formulir (Nama, Email, Username, Password) wajib diisi!' };
  }

  if (username.length < 3) {
    return { success: false, message: 'Username minimal terdiri dari 3 karakter tanpa spasi!' };
  }

  if (password.length < 4) {
    return { success: false, message: 'Kata sandi minimal 4 karakter!' };
  }

  if (!email.includes('@') || !email.includes('.')) {
    return { success: false, message: 'Format alamat email tidak valid!' };
  }

  // Cek duplikasi di lokal
  const users = getStoredUsers();
  const emailExists = users.some(u => u.email.toLowerCase() === email);
  if (emailExists) {
    return { success: false, message: 'Email tersebut sudah terdaftar! Silakan gunakan fitur Masuk atau Lupa Sandi.' };
  }

  const usernameExists = users.some(u => u.username.toLowerCase() === username);
  if (usernameExists) {
    return { success: false, message: 'Username tersebut sudah dipakai orang lain. Silakan pilih username yang lain.' };
  }

  const newUser: User = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name,
    email,
    username,
    password,
    role: 'user',
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  const updatedUsers = [...users, newUser];
  saveStoredUsers(updatedUsers);
  setCurrentUser(newUser);

  // Kirim ke Google Sheets di background jika ada URL
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl) {
    try {
      fetch(targetSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          user: newUser
        })
      }).catch(e => console.warn('Sync register to Sheets error:', e));
    } catch (err) {
      console.warn('Register cloud sync error:', err);
    }
  }

  return { 
    success: true, 
    user: newUser, 
    message: `Pendaftaran berhasil! Selamat bergabung di FahKeu, ${name}.` 
  };
}

export async function resetPasswordUser(
  emailInput: string,
  newPasswordInput: string,
  googleSheetUrl?: string
): Promise<{ success: boolean; message: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPass = newPasswordInput.trim();

  if (!cleanEmail || !cleanPass) {
    return { success: false, message: 'Email terdaftar dan kata sandi baru wajib diisi!' };
  }

  if (cleanPass.length < 4) {
    return { success: false, message: 'Kata sandi baru minimal 4 karakter!' };
  }

  const users = getStoredUsers();
  const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

  if (userIndex === -1) {
    return { 
      success: false, 
      message: 'Email tidak ditemukan! Pastikan memasukkan alamat email yang persis sama dengan yang pernah Anda daftarkan.' 
    };
  }

  const targetUser = users[userIndex];
  targetUser.password = cleanPass;
  users[userIndex] = targetUser;
  saveStoredUsers(users);

  // Jika user saat ini yang sedang login adalah akun yang di-reset, perbarui sesi
  const current = getCurrentUser();
  if (current && current.email.toLowerCase() === cleanEmail) {
    setCurrentUser(targetUser);
  }

  // Sinkronisasi ke Google Sheets
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl) {
    try {
      fetch(targetSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          email: cleanEmail,
          newPassword: cleanPass
        })
      }).catch(e => console.warn('Sync reset password to sheet err:', e));
    } catch (e) {
      console.warn('Failed to post reset password to sheets:', e);
    }
  }

  return {
    success: true,
    message: `Kata sandi untuk akun (${targetUser.username}) berhasil diperbarui! Silakan masuk dengan kata sandi baru Anda.`
  };
}

export function updateUserByAdmin(
  userId: string, 
  updateData: Partial<User>, 
  googleSheetUrl?: string
): { success: boolean; message: string; updatedUser?: User } {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    return { success: false, message: 'Pengguna tidak ditemukan' };
  }

  const updated: User = {
    ...users[index],
    ...updateData
  };
  users[index] = updated;
  saveStoredUsers(users);

  // Perbarui session jika user yang sedang login adalah user ini
  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  // Perbarui juga storage pengaturan khusus user ini jika ada konfigurasi spreadsheet/telegram
  if (updateData.googleSheetUrl !== undefined || updateData.telegramBotToken !== undefined || updateData.telegramChatId !== undefined) {
    const existing = getUserSettings(userId);
    const updatedSettings: AppSettings = {
      ...existing,
      googleSheetUrl: updateData.googleSheetUrl !== undefined ? updateData.googleSheetUrl : existing.googleSheetUrl,
      telegramBotToken: updateData.telegramBotToken !== undefined ? updateData.telegramBotToken : existing.telegramBotToken,
      telegramChatId: updateData.telegramChatId !== undefined ? updateData.telegramChatId : existing.telegramChatId,
      useCloudStorage: Boolean(updateData.googleSheetUrl !== undefined ? updateData.googleSheetUrl : existing.googleSheetUrl)
    };
    saveUserSettings(userId, updatedSettings);
  }

  // Kirim update ke Google Sheets Admin
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl) {
    // 1. Kirim update_user lewat proxy
    fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetSheetUrl,
        payload: {
          action: 'update_user',
          user: updated
        }
      })
    }).then(async () => {
      // Sinkronkan juga kredensial secara eksplisit
      if (updateData.googleSheetUrl !== undefined || updateData.telegramBotToken !== undefined || updateData.telegramChatId !== undefined) {
        syncUserCredentialsToAdminSheet(targetSheetUrl, updated);
      }
    }).catch(() => {
      // Direct browser fallback
      fetch(targetSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user',
          user: updated
        })
      }).then(() => {
        if (updateData.googleSheetUrl !== undefined || updateData.telegramBotToken !== undefined || updateData.telegramChatId !== undefined) {
          syncUserCredentialsToAdminSheet(targetSheetUrl, updated);
        }
      }).catch(e => console.warn('Update user to Sheets error:', e));
    });
  }

  return { success: true, message: 'Data pengguna berhasil diperbarui!', updatedUser: updated };
}

export function deleteUserByAdmin(
  userId: string, 
  googleSheetUrl?: string
): { success: boolean; message: string } {
  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);
  if (!target) {
    return { success: false, message: 'Pengguna tidak ditemukan' };
  }

  if (target.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
    return { success: false, message: 'Tidak dapat menghapus satu-satunya akun Administrator!' };
  }

  const filtered = users.filter(u => u.id !== userId);
  saveStoredUsers(filtered);

  // Bersihkan data transaksi dan pengaturan user lokal
  try {
    localStorage.removeItem(`catatkeu_tx_${userId}`);
    localStorage.removeItem(`catatkeu_chat_${userId}`);
    localStorage.removeItem(`catatkeu_settings_${userId}`);
  } catch (e) {}

  // Kirim aksi hapus ke Google Sheets
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl) {
    fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetSheetUrl,
        payload: {
          action: 'delete_user',
          userId: userId
        }
      })
    }).catch(() => {
      fetch(targetSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_user',
          userId: userId
        })
      }).catch(e => console.warn('Delete user from Sheets error:', e));
    });
  }

  return { success: true, message: `Akun pengguna ${target.name} (@${target.username}) berhasil dihapus!` };
}

// Sinkronisasi otomatis seluruh akun pengguna ke database Google Sheets saat online
export async function syncAllUsersToCloud(googleSheetUrl?: string): Promise<boolean> {
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (!targetSheetUrl) return false;
  try {
    const users = getStoredUsers();
    if (users.length === 0) return false;

    // 1. Coba kirim via server sheets-proxy
    try {
      const pRes = await fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetSheetUrl,
          payload: {
            action: 'sync_all_users',
            users
          }
        })
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData && pData.success) {
          return true;
        }
      }
    } catch (e) {
      console.warn('[SyncAll] Proxy attempt failed, falling back to direct fetch:', e);
    }

    // 2. Direct browser fetch
    await fetch(targetSheetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_all_users',
        users
      })
    });
    return true;
  } catch (e) {
    console.warn('Failed to sync all users to cloud:', e);
    return false;
  }
}

/**
 * Update profil pengguna mandiri:
 * - HANYA username dan password yang dapat diedit.
 * - Wajib memasukkan/memverifikasi email yang sama persis dengan email akun saat mendaftar.
 */
export function updateUserProfile(
  userId: string,
  inputEmail: string,
  newUsername: string,
  newPassword?: string,
  googleSheetUrl?: string
): { success: boolean; message: string; updatedUser?: User } {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    return { success: false, message: 'Akun pengguna tidak ditemukan di sistem!' };
  }

  const current = users[index];
  const cleanEmail = inputEmail.trim().toLowerCase();
  const targetEmail = current.email.trim().toLowerCase();

  // VALIDASI KETAT: Email wajib sama persis dengan email saat mendaftar!
  if (!cleanEmail || cleanEmail !== targetEmail) {
    return { 
      success: false, 
      message: 'Email verifikasi tidak cocok! Email wajib sama persis dengan email yang didaftarkan pada akun Anda.' 
    };
  }

  const cleanUser = newUsername.trim().toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
  if (cleanUser.length < 3) {
    return { success: false, message: 'Username baru minimal 3 karakter (hanya huruf, angka, atau garis bawah).' };
  }

  // Cek apakah username baru sudah digunakan akun lain
  const conflict = users.find(u => u.id !== userId && u.username.toLowerCase() === cleanUser);
  if (conflict) {
    return { success: false, message: `Username "@${cleanUser}" sudah digunakan akun lain. Silakan pilih username lain.` };
  }

  // Siapkan objek update (hanya username & password)
  const updated: User = {
    ...current,
    username: cleanUser,
  };

  // Jika password diisi, perbarui password
  if (newPassword && newPassword.trim()) {
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 4) {
      return { success: false, message: 'Kata sandi baru minimal 4 karakter!' };
    }
    updated.password = cleanPass;
  }

  users[index] = updated;
  saveStoredUsers(users);

  // Perbarui session akun aktif
  setCurrentUser(updated);

  // Sinkronisasi otomatis ke Google Sheets jika online
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (targetSheetUrl && navigator.onLine) {
    try {
      fetch(targetSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          userId: updated.id,
          email: targetEmail,
          username: updated.username,
          password: updated.password
        })
      }).catch(e => console.warn('Sync profile update to sheet err:', e));
    } catch (e) {
      console.warn('Failed to post profile update to sheets:', e);
    }
  }

  return {
    success: true,
    message: 'Profil akun berhasil diperbarui! Username dan kata sandi Anda telah aktif.',
    updatedUser: updated
  };
}

export function cleanGoogleClientId(id: string): string {
  if (!id) return '';
  return id.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();
}

/**
 * Membersihkan Token Bot Telegram dari format berlebih, spasi, kutip, atau awalan bot/URL:
 * Contoh masukan yang dinormalisasi:
 * - "https://api.telegram.org/bot123456:ABC..." -> "123456:ABC..."
 * - "bot123456:ABC..." -> "123456:ABC..."
 * - "\"123456:ABC...\"" -> "123456:ABC..."
 */
export function cleanTelegramToken(raw: string | undefined | null): string {
  if (!raw) return '';
  let token = String(raw).trim();
  // Hapus awalan protokol URL Telegram jika ada
  token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
  // Hapus tanda petik ganda atau tunggal di ujung string
  token = token.replace(/^["']+|["']+$/g, '');
  // Hapus awalan kata 'bot' jika diikuti angka dan titik dua
  if (/^bot\d+:/i.test(token)) {
    token = token.substring(3);
  }
  return token.trim();
}

/**
 * Memvalidasi apakah format token Telegram memenuhi format standar Telegram Bot:
 * <bot_id_numerik>:<secret_hash>
 */
export function isValidTelegramToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const clean = cleanTelegramToken(token);
  return /^\d{6,16}:[A-Za-z0-9_-]{20,}$/.test(clean);
}

export function getGoogleClientId(): string {
  try {
    if (inMemoryGoogleClientId && inMemoryGoogleClientId.trim()) {
      return cleanGoogleClientId(inMemoryGoogleClientId);
    }
    const raw = localStorage.getItem(GOOGLE_CLIENT_ID_KEY);
    if (raw && raw.trim()) {
      inMemoryGoogleClientId = cleanGoogleClientId(raw);
      return inMemoryGoogleClientId;
    }
    const settingsRaw = localStorage.getItem('catatkeu_settings');
    if (settingsRaw) {
      const parsed = JSON.parse(settingsRaw);
      if (parsed?.googleClientId && parsed.googleClientId.trim()) {
        inMemoryGoogleClientId = cleanGoogleClientId(parsed.googleClientId);
        return inMemoryGoogleClientId;
      }
    }
    // Fallback ke master konfigurasi permanen di kode (GitHub)
    if (MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID && MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID.trim()) {
      inMemoryGoogleClientId = cleanGoogleClientId(MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID);
      return inMemoryGoogleClientId;
    }
    return '';
  } catch (e) {
    return cleanGoogleClientId(inMemoryGoogleClientId || MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID || '');
  }
}

export function saveGoogleClientId(clientId: string, syncToServer: boolean = true) {
  try {
    const clean = cleanGoogleClientId(clientId);
    if (!clean && inMemoryGoogleClientId) {
      // Cegah terhapus tidak sengaja jika sudah ada nilai tersimpan
      return;
    }
    inMemoryGoogleClientId = clean;
    localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clean);

    const settingsRaw = localStorage.getItem('catatkeu_settings');
    let parsed: any = {};
    if (settingsRaw) {
      try {
        parsed = JSON.parse(settingsRaw);
      } catch (err) {}
    }
    parsed.googleClientId = clean;
    localStorage.setItem('catatkeu_settings', JSON.stringify(parsed));

    if (syncToServer && clean) {
      saveSystemConfigToServer({ googleClientId: clean }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save Google client ID', e);
  }
}

export function parseJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT token', e);
    return null;
  }
}

export async function loginWithGoogleEmail(
  googleEmail: string,
  googleName?: string,
  googleSheetUrl?: string
): Promise<{ 
  success: boolean; 
  user?: User; 
  message: string;
  notRegistered?: boolean;
  googleEmail?: string;
  googleName?: string;
}> {
  const cleanEmail = googleEmail.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, message: 'Email dari akun Google tidak terdeteksi.' };
  }

  let users = getStoredUsers();
  let found = users.find(u => u.email.toLowerCase() === cleanEmail);

  // 1. Cek langsung ke server API backend jika belum ditemukan di lokal
  if (!found) {
    try {
      const srvRes = await fetch('/api/users');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        const serverUsers: User[] = Array.isArray(srvData.users) ? srvData.users : (Array.isArray(srvData) ? srvData : []);
        if (serverUsers.length > 0) {
          saveStoredUsers(serverUsers);
          users = serverUsers;
          found = users.find((u: User) => u.email.toLowerCase() === cleanEmail);
        }
      }
    } catch (e) {
      console.warn('Sync users via /api/users failed', e);
    }
  }

  // 2. Jika tidak ditemukan di lokal/server dan ada Google Sheet, coba sinkronkan data pengguna
  const targetSheetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (!found && targetSheetUrl) {
    try {
      const res = await fetch(`${targetSheetUrl}?action=get_users`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        saveStoredUsers(data.users);
        found = data.users.find((u: User) => u.email.toLowerCase() === cleanEmail);
      }
    } catch (e) {
      console.warn('Sync users via Google Sheet failed', e);
    }
  }

  if (found) {
    if (found.status === 'suspended') {
      return { 
        success: false, 
        message: `Akun dengan email ${found.email} saat ini sedang dinonaktifkan oleh Administrator.` 
      };
    }
    setCurrentUser(found);
    return { 
      success: true, 
      user: found, 
      message: `Selamat datang kembali, ${found.name}! Masuk berhasil via Akun Google.` 
    };
  }

  return {
    success: false,
    notRegistered: true,
    googleEmail: cleanEmail,
    googleName: googleName || '',
    message: `Akun Google dengan email "${cleanEmail}" belum terdaftar di aplikasi. Formulir pendaftaran otomatis diisi dengan email Anda.`
  };
}

/**
 * Mengambil pengaturan sistem dari Lembar 'Settings' Google Spreadsheet.
 */
export async function fetchSettingsFromCloud(googleSheetUrl?: string): Promise<Record<string, string> | null> {
  const targetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (!targetUrl) return null;
  try {
    const res = await fetch(`${targetUrl}?action=get_settings`);
    const data = await res.json();
    if (data && data.success && data.settings) {
      const gId = data.settings.GOOGLE_CLIENT_ID || data.settings.googleClientId;
      if (gId) {
        saveGoogleClientId(gId);
      }
      return data.settings;
    }
  } catch (err) {
    console.warn('Gagal memuat pengaturan dari Google Spreadsheet:', err);
  }
  return null;
}

/**
 * Menyimpan satu nilai pengaturan ke Lembar 'Settings' Google Spreadsheet.
 */
export async function saveSettingToCloud(
  googleSheetUrl: string | undefined,
  key: string,
  value: string,
  description?: string
): Promise<{ success: boolean; message?: string }> {
  const targetUrl = googleSheetUrl || getAdminGoogleSheetUrl();
  if (!targetUrl) {
    return { success: false, message: 'URL Web App Google Sheet belum dikonfigurasi.' };
  }
  try {
    const params = new URLSearchParams({
      action: 'save_setting',
      key: key,
      value: value,
      description: description || ''
    });

    const res = await fetch(`${targetUrl}?${params.toString()}`);
    const data = await res.json();
    if (data && data.success) {
      return { success: true, message: data.message || 'Pengaturan berhasil disimpan di lembar Settings spreadsheet.' };
    }
  } catch (e) {
    // Fallback mode POST jika GET gagal
    try {
      await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_setting',
          key,
          value,
          description: description || ''
        }),
        mode: 'no-cors'
      });
      return { success: true, message: 'Data pengaturan telah diteruskan ke Google Spreadsheet.' };
    } catch (postErr) {
      console.error('Gagal menyimpan pengaturan ke spreadsheet:', postErr);
      return { success: false, message: 'Gagal terhubung ke server Google Spreadsheet.' };
    }
  }
  return { success: false, message: 'Tidak menerima respons sukses dari spreadsheet.' };
}

/**
 * Mengambil konfigurasi kredensial (Google Spreadsheet & Bot Telegram).
 * Menjamin isolasi penuh per-akun pengguna: link spreadsheet & token bot
 * milik satu pengguna tidak akan pernah bocor atau tertukar dengan pengguna lain.
 */
export function getUserSettings(userId?: string | null): AppSettings {
  const fallbackSettings: AppSettings = {
    googleSheetUrl: '',
    adminGoogleSheetUrl: getAdminGoogleSheetUrl(),
    telegramBotToken: '',
    telegramChatId: '',
    useCloudStorage: false,
    googleClientId: getGoogleClientId() || ''
  };

  if (!userId) {
    // Mode tamu / sebelum login
    return fallbackSettings;
  }

  const sanitizeSheetUrl = (url?: string) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('AKfycby') || trimmed.includes('AKfycbwPLC')) return '';
    return trimmed;
  };

  // 1. Cek storage privat khusus akun user ini
  const userKey = `catatkeu_settings_${userId}`;
  const raw = localStorage.getItem(userKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed) {
        const cleanSheetUrl = sanitizeSheetUrl(parsed.googleSheetUrl);
        return {
          googleSheetUrl: cleanSheetUrl,
          adminGoogleSheetUrl: getAdminGoogleSheetUrl(),
          telegramBotToken: parsed.telegramBotToken || '',
          telegramChatId: parsed.telegramChatId || '',
          useCloudStorage: parsed.useCloudStorage !== undefined ? parsed.useCloudStorage : Boolean(cleanSheetUrl),
          googleClientId: getGoogleClientId() || ''
        };
      }
    } catch (e) {}
  }

  // 2. Cek apakah tersimpan pada data profil user di daftar users
  const users = getStoredUsers();
  const found = users.find(u => u.id === userId);
  if (found && (found.googleSheetUrl || found.telegramBotToken || found.telegramChatId)) {
    const cleanSheetUrl = sanitizeSheetUrl(found.googleSheetUrl);
    return {
      googleSheetUrl: cleanSheetUrl,
      adminGoogleSheetUrl: getAdminGoogleSheetUrl(),
      telegramBotToken: found.telegramBotToken || '',
      telegramChatId: found.telegramChatId || '',
      useCloudStorage: found.useCloudStorage !== undefined ? found.useCloudStorage : Boolean(cleanSheetUrl),
      googleClientId: getGoogleClientId() || ''
    };
  }

  // 3. User baru / belum konfigurasi: kembalikan fallback bersih dengan URL Admin global (tidak mencemari data user lain)
  return fallbackSettings;
}

/**
 * Mengambil pengaturan privat user dari backend server jika tersedia (misal setelah refresh / beda perangkat)
 */
export async function fetchUserSettingsFromServer(userId: string): Promise<Partial<AppSettings> | null> {
  if (!userId) return null;
  try {
    const res = await fetch(`/api/user-settings/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      const userKey = `catatkeu_settings_${userId}`;
      const existing = getUserSettings(userId);
      let cleanSheet = (s.googleSheetUrl || existing.googleSheetUrl || '').trim();
      if (cleanSheet.includes('AKfycby') || cleanSheet.includes('AKfycbwPLC')) cleanSheet = '';
      const merged: AppSettings = {
        ...existing,
        googleSheetUrl: cleanSheet,
        telegramBotToken: s.telegramBotToken || existing.telegramBotToken || '',
        telegramChatId: s.telegramChatId || existing.telegramChatId || '',
        useCloudStorage: s.useCloudStorage !== undefined ? s.useCloudStorage : existing.useCloudStorage,
        adminGoogleSheetUrl: getAdminGoogleSheetUrl(),
        googleClientId: getGoogleClientId()
      };

      localStorage.setItem(userKey, JSON.stringify(merged));

      // Update user di stored users
      const users = getStoredUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx !== -1) {
        users[idx] = {
          ...users[idx],
          googleSheetUrl: merged.googleSheetUrl,
          telegramBotToken: merged.telegramBotToken,
          telegramChatId: merged.telegramChatId,
          useCloudStorage: merged.useCloudStorage
        };
        saveStoredUsers(users);
        const current = getCurrentUser();
        if (current && current.id === userId) {
          setCurrentUser(users[idx]);
        }
      }

      return merged;
    }
  } catch (err) {
    console.warn('Failed to fetch user settings from server:', err);
  }
  return null;
}

/**
 * Menyimpan pengaturan privat user ke Server backend
 */
export async function saveUserSettingsToServer(
  userId: string,
  settings: { googleSheetUrl?: string; telegramBotToken?: string; telegramChatId?: string; useCloudStorage?: boolean }
): Promise<boolean> {
  if (!userId) return false;
  try {
    const res = await fetch(`/api/user-settings/${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to save user settings to server:', err);
    return false;
  }
}

/**
 * Sinkronisasi kredensial privat akun ke Database Spreadsheet Admin (jika terhubung)
 */
export async function syncUserCredentialsToAdminSheet(
  adminUrl: string, 
  user: User
): Promise<{ success: boolean; message?: string }> {
  if (!adminUrl || !user || !user.id) {
    return { success: false, message: 'URL Admin atau data pengguna tidak valid.' };
  }

  const payload = {
    action: 'update_user_credentials',
    user: {
      id: user.id,
      name: user.name || user.username,
      username: user.username,
      email: user.email,
      googleSheetUrl: user.googleSheetUrl || '',
      telegramBotToken: user.telegramBotToken || '',
      telegramChatId: user.telegramChatId || '',
      useCloudStorage: user.useCloudStorage
    }
  };

  // 1. Coba via proxy server backend (bebas CORS & redirect)
  try {
    const proxyRes = await fetch('/api/sheets-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: adminUrl,
        payload
      })
    });
    if (proxyRes.ok) {
      const pData = await proxyRes.json();
      if (pData && pData.success && pData.data && pData.data.success !== false) {
        return { 
          success: true, 
          message: pData.data.message || 'Kredensial pengguna berhasil disinkronkan ke Spreadsheet Admin.' 
        };
      }
    }
  } catch (err) {
    console.warn('[Sync] Sheets proxy error, using direct browser fallback:', err);
  }

  // 2. Fallback kirim langsung dari browser
  try {
    await fetch(adminUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { success: true, message: 'Data kredensial telah dikirimkan ke Spreadsheet Admin.' };
  } catch (err: any) {
    console.warn('Sync user credentials to Admin Sheets direct error:', err);
    return { success: false, message: err?.message || 'Gagal mengirim ke Spreadsheet Admin.' };
  }
}

/**
 * Menyimpan konfigurasi kredensial (Google Spreadsheet & Bot Telegram) khusus per-akun pengguna.
 */
export function saveUserSettings(userId: string | undefined | null, newSettings: AppSettings): void {
  // Pastikan nilai adminGoogleSheetUrl dan googleClientId tidak hilang saat menyimpan pengaturan transaksi
  const existingAdminUrl = getAdminGoogleSheetUrl();
  const existingClientId = getGoogleClientId();

  const safeAdminUrl = (newSettings.adminGoogleSheetUrl && newSettings.adminGoogleSheetUrl.trim())
    ? newSettings.adminGoogleSheetUrl.trim()
    : existingAdminUrl;

  const safeClientId = (newSettings.googleClientId && newSettings.googleClientId.trim())
    ? newSettings.googleClientId.trim()
    : existingClientId;

  const consolidated: AppSettings = {
    ...newSettings,
    adminGoogleSheetUrl: safeAdminUrl,
    googleClientId: safeClientId,
  };

  // Simpan URL Admin Spreadsheet secara global jika ada
  if (safeAdminUrl) {
    saveAdminGoogleSheetUrl(safeAdminUrl);
  }
  // Simpan Google Client ID secara global jika ada
  if (safeClientId) {
    saveGoogleClientId(safeClientId);
  }

  const effectiveUserId = userId || 'usr_admin_01';

  // 1. Simpan di storage privat milik akun user & session storage
  localStorage.setItem('catatkeu_settings', JSON.stringify(consolidated));
  if (userId) {
    const userKey = `catatkeu_settings_${userId}`;
    localStorage.setItem(userKey, JSON.stringify(consolidated));
  }

  // 2. Perbarui data di daftar user jika ada
  const users = getStoredUsers();
  const idx = users.findIndex(u => u.id === effectiveUserId);
  if (idx !== -1) {
    users[idx] = {
      ...users[idx],
      googleSheetUrl: newSettings.googleSheetUrl,
      telegramBotToken: newSettings.telegramBotToken,
      telegramChatId: newSettings.telegramChatId,
      useCloudStorage: newSettings.useCloudStorage
    };
    saveStoredUsers(users);

    const current = getCurrentUser();
    if (current && current.id === effectiveUserId) {
      setCurrentUser(users[idx]);
    }
  }

  // 3. Simpan ke Server Backend secara permanen agar bot poller langsung aktif
  saveUserSettingsToServer(effectiveUserId, {
    googleSheetUrl: newSettings.googleSheetUrl || '',
    telegramBotToken: newSettings.telegramBotToken || '',
    telegramChatId: newSettings.telegramChatId || '',
    useCloudStorage: newSettings.useCloudStorage
  });

  // 4. Sinkronisasi ke Google Spreadsheet Admin jika ada
  if (safeAdminUrl && idx !== -1) {
    syncUserCredentialsToAdminSheet(safeAdminUrl, users[idx]);
  }
}


