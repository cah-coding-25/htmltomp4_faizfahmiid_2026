import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { MASTER_CONFIG } from './src/config';
import { parseTransactionText, formatRupiah } from './src/utils/parser';
import { 
  analyzeReceiptImage, 
  getActiveGeminiConfig, 
  getActiveOcrConfig,
  OCR_PROVIDERS_CATALOG,
  getGeminiUsageStats, 
  resetTodayUsageCount, 
  testGeminiApiKey,
  testOcrSpaceApiKey
} from './src/utils/receiptService';

process.on('uncaughtException', (err: any) => {
  console.warn('[Server] Uncaught exception safely handled:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Server] Unhandled rejection safely handled:', reason?.message || reason);
});

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Direktori data untuk persistensi konfigurasi sistem global & pengaturan per-user
const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'system_config.json');
const USER_SETTINGS_FILE = path.join(DATA_DIR, 'user_settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

// Pastikan folder data tersedia
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Persistensi Transaksi Per-User
function readAllTransactions(): Record<string, any[]> {
  if (!fs.existsSync(TRANSACTIONS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(TRANSACTIONS_FILE, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('Failed to read transactions.json:', e);
    return {};
  }
}

function writeAllTransactions(data: Record<string, any[]>): void {
  try {
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write transactions.json:', e);
  }
}

function readUserTransactions(userId: string): any[] {
  const all = readAllTransactions();
  if (userId === 'all') {
    const list: any[] = [];
    for (const uTxs of Object.values(all)) {
      if (Array.isArray(uTxs)) {
        list.push(...uTxs);
      }
    }
    // Urutkan transaksi terbaru di atas
    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }
  return all[userId] || [];
}

// Pelacak transaksi yang telah dihapus permanen agar tidak pernah dibangkitkan lagi oleh proses sinkronisasi manapun
const deletedTransactionIds = new Set<string>();

// Pelacak waktu reset/pembersihan data per pengguna (transaksi dengan tanggal/waktu sebelum waktu ini dihapus permanen)
const userLastClearedAt = new Map<string, number>();

function getLinkedUserIds(userId: string): string[] {
  if (!userId || userId === 'all') return [userId];
  // Isolasi ketat: hindari cross-contaminasi antar akun pengguna yang berbeda
  return [userId];
}

function saveUserTransaction(userId: string, tx: any): any[] {
  const all = readAllTransactions();
  const linkedIds = getLinkedUserIds(userId);
  let mainList: any[] = [];
  
  linkedIds.forEach(id => {
    const current = all[id] || [];
    const existingIdx = current.findIndex((item: any) => item.id === tx.id);
    if (existingIdx !== -1) {
      current[existingIdx] = tx;
    } else {
      current.unshift(tx);
    }
    all[id] = current;
    if (id === userId) mainList = current;
  });

  writeAllTransactions(all);
  return mainList.length > 0 ? mainList : (all[userId] || []);
}

function editUserTransaction(userId: string, tx: any): any[] {
  const all = readAllTransactions();
  const linkedIds = getLinkedUserIds(userId);
  let mainList: any[] = [];

  linkedIds.forEach(id => {
    const current = all[id] || [];
    const idx = current.findIndex((item: any) => item.id === tx.id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...tx };
      all[id] = current;
    }
    if (id === userId) mainList = current;
  });

  writeAllTransactions(all);
  return mainList.length > 0 ? mainList : (all[userId] || []);
}

function deleteUserTransaction(userId: string, txId: string): any[] {
  if (txId) {
    deletedTransactionIds.add(txId.toString());
  }
  const all = readAllTransactions();
  const linkedIds = getLinkedUserIds(userId);
  let mainList: any[] = [];

  linkedIds.forEach(id => {
    const current = all[id] || [];
    all[id] = current.filter((item: any) => item.id && item.id.toString() !== txId.toString());
    if (id === userId) mainList = all[id];
  });

  writeAllTransactions(all);
  return mainList;
}

function clearUserTransactions(userId: string): void {
  const all = readAllTransactions();
  const now = Date.now();
  if (userId === 'all') {
    writeAllTransactions({});
    userSyncCache.clear();
    userLastClearedAt.set('all', now);
    for (const k of Object.keys(all)) {
      userLastClearedAt.set(k, now);
    }
    return;
  }
  userLastClearedAt.set(userId, now);
  const linkedIds = getLinkedUserIds(userId);
  linkedIds.forEach(id => {
    all[id] = [];
    userSyncCache.delete(id);
    userLastClearedAt.set(id, now);
  });
  all[userId] = [];
  userSyncCache.delete(userId);
  writeAllTransactions(all);
}

interface SystemConfig {
  adminGoogleSheetUrl: string;
  googleClientId: string;
  globalGoogleSheetUrl: string;
  geminiApiKey?: string;
  ocrSpaceApiKey?: string;
  activeProvider?: 'gemini' | 'ocr_space' | 'local_tesseract';
  ocrMode?: 'auto' | 'ocr_only' | 'gemini_only';
  updatedAt: string;
}

interface UserSettingsRecord {
  googleSheetUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  useCloudStorage: boolean;
  updatedAt?: string;
}

// Inisialisasi file konfigurasi awal jika belum ada
function readSystemConfig(): SystemConfig {
  const defaultConfig: SystemConfig = {
    adminGoogleSheetUrl: process.env.ADMIN_GOOGLE_SHEET_URL || MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL || '',
    googleClientId: process.env.GOOGLE_CLIENT_ID || MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID || '',
    globalGoogleSheetUrl: process.env.GLOBAL_GOOGLE_SHEET_URL || '',
    geminiApiKey: '',
    ocrSpaceApiKey: '',
    activeProvider: 'gemini',
    ocrMode: 'auto',
    updatedAt: new Date().toISOString()
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    } catch (e) {
      console.error('Failed to write initial system config file:', e);
      return defaultConfig;
    }
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      adminGoogleSheetUrl: parsed.adminGoogleSheetUrl || process.env.ADMIN_GOOGLE_SHEET_URL || MASTER_CONFIG.DEFAULT_ADMIN_SHEET_URL || '',
      googleClientId: parsed.googleClientId || process.env.GOOGLE_CLIENT_ID || MASTER_CONFIG.DEFAULT_GOOGLE_CLIENT_ID || '',
      globalGoogleSheetUrl: parsed.globalGoogleSheetUrl || process.env.GLOBAL_GOOGLE_SHEET_URL || '',
      geminiApiKey: parsed.geminiApiKey || '',
      ocrSpaceApiKey: parsed.ocrSpaceApiKey || '',
      activeProvider: ['gemini', 'ocr_space', 'local_tesseract'].includes(parsed.activeProvider) ? parsed.activeProvider : 'gemini',
      ocrMode: ['auto', 'ocr_only', 'gemini_only'].includes(parsed.ocrMode) ? parsed.ocrMode : 'auto',
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch (err) {
    console.error('Failed to read system config file:', err);
    return defaultConfig;
  }
}

function writeSystemConfig(updates: Partial<SystemConfig>): SystemConfig {
  const current = readSystemConfig();
  const cleanClientId = updates.googleClientId !== undefined 
    ? updates.googleClientId.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim() 
    : current.googleClientId;
  const merged: SystemConfig = {
    adminGoogleSheetUrl: updates.adminGoogleSheetUrl !== undefined ? updates.adminGoogleSheetUrl.trim() : current.adminGoogleSheetUrl,
    googleClientId: cleanClientId,
    globalGoogleSheetUrl: updates.globalGoogleSheetUrl !== undefined ? updates.globalGoogleSheetUrl.trim() : current.globalGoogleSheetUrl,
    geminiApiKey: updates.geminiApiKey !== undefined ? updates.geminiApiKey.trim() : (current.geminiApiKey || ''),
    ocrSpaceApiKey: updates.ocrSpaceApiKey !== undefined ? updates.ocrSpaceApiKey.trim() : (current.ocrSpaceApiKey || ''),
    activeProvider: updates.activeProvider !== undefined ? updates.activeProvider : (current.activeProvider || 'gemini'),
    ocrMode: updates.ocrMode !== undefined ? updates.ocrMode : (current.ocrMode || 'auto'),
    updatedAt: new Date().toISOString()
  };

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to persist system config file:', e);
  }

  return merged;
}

// Persistensi Pengaturan Privat Masing-masing User (Google Sheet URL & Bot Telegram)
function readAllUserSettings(): Record<string, any> {
  if (!fs.existsSync(USER_SETTINGS_FILE)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(USER_SETTINGS_FILE, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (e) {
    console.error('Failed to read user_settings.json:', e);
    return {};
  }
}

function writeUserSettings(userId: string, data: Partial<UserSettingsRecord> & { explicitClearSheet?: boolean }): UserSettingsRecord {
  const all = readAllUserSettings();
  const current = all[userId] || {
    googleSheetUrl: '',
    telegramBotToken: '',
    telegramChatId: '',
    useCloudStorage: false
  };

  // Pastikan URL spreadsheet tidak terhapus jika caller hanya memperbarui bot token
  let finalSheetUrl = current.googleSheetUrl;
  if (data.googleSheetUrl !== undefined) {
    const trimmed = data.googleSheetUrl.trim();
    if (trimmed !== '') {
      finalSheetUrl = trimmed;
    } else if (data.explicitClearSheet) {
      finalSheetUrl = '';
    }
  }

  // Telegram Bot Token
  let finalBotToken = current.telegramBotToken;
  if (data.telegramBotToken !== undefined) {
    finalBotToken = data.telegramBotToken.trim();
  }

  // Telegram Chat ID
  let finalChatId = current.telegramChatId;
  if (data.telegramChatId !== undefined) {
    const trimmedChat = data.telegramChatId.trim();
    if (trimmedChat !== '') {
      finalChatId = trimmedChat;
    }
  }

  const updated: UserSettingsRecord = {
    googleSheetUrl: finalSheetUrl,
    telegramBotToken: finalBotToken,
    telegramChatId: finalChatId,
    useCloudStorage: data.useCloudStorage !== undefined ? data.useCloudStorage : (Boolean(finalSheetUrl) || current.useCloudStorage),
    updatedAt: new Date().toISOString()
  };

  all[userId] = updated;

  try {
    fs.writeFileSync(USER_SETTINGS_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write user_settings.json:', e);
  }

  return updated;
}

// Sinkronisasi Real-time Transaksi dari Google Spreadsheet (Termasuk Pemasukan & Pengeluaran)
// Tanpa cache / TTL: Selalu ambil data langsung secara real-time dari Google Spreadsheet & Server
const userSyncCache = new Map<string, number>();

// Helper terpusat untuk mengirim mutasi transaksi ke Google Spreadsheet secara server-side
async function pushTransactionToGoogleSheet(
  sheetUrl: string,
  data: any,
  action: 'add' | 'edit' | 'delete' | 'clear' | 'batch_add',
  userId?: string,
  username?: string
): Promise<{ success: boolean; message?: string }> {
  if (!sheetUrl || !sheetUrl.startsWith('http')) {
    return { success: false, message: 'URL Spreadsheet tidak valid' };
  }
  if (sheetUrl.includes('AKfycby') || sheetUrl.includes('AKfycbwPLC')) {
    return { success: false, message: 'URL Spreadsheet demo/dummy diabaikan' };
  }

  try {
    const payload: any = {
      action,
      userId: userId || 'all',
      username: username || '',
      clearAll: action === 'clear' ? true : undefined,
      timestamp: new Date().toISOString()
    };

    if (action === 'add' || action === 'edit') {
      payload.transaction = data;
    } else if (action === 'delete') {
      payload.id = typeof data === 'string' ? data : data?.id;
    } else if (action === 'clear') {
      payload.clearAll = true;
      payload.userId = userId || 'all';
    } else if (action === 'batch_add') {
      payload.transactions = Array.isArray(data) ? data : [data];
    }

    let postSuccess = false;
    try {
      const res = await fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        postSuccess = true;
        // Jika batch_add belum didukung script spreadsheet lama pengguna, fallback kirim berurutan
        if (action === 'batch_add' && Array.isArray(data) && data.length > 0) {
          try {
            const textRes = await res.text();
            if (textRes.includes('Aksi tidak dikenal') || textRes.includes('unknown action')) {
              for (const item of data) {
                await fetch(sheetUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'add', transaction: item, userId, username }),
                  signal: AbortSignal.timeout(10000)
                }).catch(() => {});
              }
            }
          } catch {}
        }
      }
    } catch (postErr: any) {
      console.warn(`[PushToGoogleSheet] POST error for ${action}:`, postErr.message);
    }

    if (!postSuccess) {
      // Fallback via GET query jika POST terhambat redirect CORS atau jaringan di Apps Script
      try {
        const delimiter = sheetUrl.includes('?') ? '&' : '?';
        const encoded = encodeURIComponent(JSON.stringify(payload));
        const getRes = await fetch(`${sheetUrl}${delimiter}action=${action}&data=${encoded}`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(15000)
        });
        if (getRes.ok) {
          return { success: true };
        }
      } catch (getErr: any) {
        console.warn(`[PushToGoogleSheet] GET fallback error for ${action}:`, getErr.message);
      }
      return { success: false, message: 'Gagal mengirim mutasi ke Google Apps Script' };
    }

    return { success: true };
  } catch (err: any) {
    console.warn(`[PushToGoogleSheet] Action ${action} failed:`, err.message);
    return { success: false, message: err.message };
  }
}

// Sinkronisasi Dua Arah Terpadu (Website & Spreadsheet Saling Melengkapi)
async function syncTwoWayWithGoogleSheet(
  userId: string,
  targetSheetUrl?: string
): Promise<{
  success: boolean;
  pushedToSheet: number;
  pulledToWeb: number;
  total: number;
  transactions: any[];
  message?: string;
}> {
  const localTxs = readUserTransactions(userId);
  const allSettings = readAllUserSettings();
  const allUsers = readStoredUsers();
  const userCfg = allSettings[userId] || (allUsers.find(u => u.id === userId) as any);
  const sysCfg = readSystemConfig();
  let sheetUrl = (targetSheetUrl || userCfg?.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();

  if (sheetUrl.includes('AKfycby') || sheetUrl.includes('AKfycbwPLC')) {
    sheetUrl = '';
  }

  if (!sheetUrl || !sheetUrl.startsWith('http')) {
    return {
      success: true,
      pushedToSheet: 0,
      pulledToWeb: 0,
      total: localTxs.length,
      transactions: localTxs,
      message: 'Spreadsheet belum dikonfigurasi, menggunakan data lokal.'
    };
  }

  try {
    const delimiter = sheetUrl.includes('?') ? '&' : '?';
    const readUrl = `${sheetUrl}${delimiter}action=get_transactions&userId=all`;
    const res = await fetch(readUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000)
    });

    let sheetData: any[] = [];
    if (res.ok) {
      const json: any = await res.json();
      sheetData = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);
    }

    // 1. Petakan data riil dari Google Spreadsheet
    // 0. Filter transaksi lokal agar transaksi yang telah dihapus tidak pernah dikirim ke Google Spreadsheet
    const clearedTime = userLastClearedAt.get(userId) || userLastClearedAt.get('all') || 0;
    const filterValid = (items: any[]) => {
      return (Array.isArray(items) ? items : []).filter(item => {
        if (!item || !item.id) return false;
        if (deletedTransactionIds.has(item.id.toString())) return false;
        if (clearedTime > 0) {
          const itemTime = new Date(item.date || item.createdAt || 0).getTime();
          if (itemTime > 0 && itemTime <= clearedTime) return false;
        }
        return true;
      });
    };

    const validLocalTxs = filterValid(localTxs);

    // 1. Petakan data riil dari Google Spreadsheet (hanya data yang sah)
    const validSheetData = filterValid(sheetData);
    const sheetMap = new Map<string, any>();
    validSheetData.forEach(item => {
      if (item && item.id) {
        sheetMap.set(item.id.toString(), {
          ...item,
          amount: Number(item.amount) || 0,
          type: item.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
          userId: item.userId || userId
        });
      }
    });

    // 2. Transaksi di Website yang BELUM ADA di Spreadsheet -> kirim ke Spreadsheet
    const missingOnSheet: any[] = [];
    validLocalTxs.forEach(item => {
      if (item && item.id && !sheetMap.has(item.id.toString())) {
        missingOnSheet.push(item);
      }
    });

    // 3. Transaksi di Spreadsheet yang BELUM ADA di Website -> tarik ke Website
    const localIdSet = new Set(validLocalTxs.map(t => t?.id?.toString()).filter(Boolean));
    const missingOnLocal: any[] = [];
    sheetMap.forEach((item, id) => {
      if (!localIdSet.has(id)) {
        missingOnLocal.push(item);
      }
    });

    // 4. Website mengirim data ke Spreadsheet (saling melengkapi)
    if (missingOnSheet.length > 0) {
      await pushTransactionToGoogleSheet(sheetUrl, missingOnSheet, 'batch_add', userId, userCfg?.username);
    }

    // 5. Gabungkan kedua data secara komprehensif
    const mergedMap = new Map<string, any>();
    sheetMap.forEach((val, key) => mergedMap.set(key, val));
    validLocalTxs.forEach(item => {
      if (item && item.id) {
        mergedMap.set(item.id.toString(), item);
      }
    });

    const mergedList = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      return timeB - timeA;
    });

    // Simpan hasil sinkronisasi gabungan ke server disk
    const allDiskTxs = readAllTransactions();
    allDiskTxs[userId] = mergedList;
    userSyncCache.set(userId, Date.now());
    writeAllTransactions(allDiskTxs);

    return {
      success: true,
      pushedToSheet: missingOnSheet.length,
      pulledToWeb: missingOnLocal.length,
      total: mergedList.length,
      transactions: mergedList,
      message: `Sinkronisasi dua arah berhasil: ${missingOnSheet.length} dikirim ke Spreadsheet, ${missingOnLocal.length} ditarik ke Website.`
    };
  } catch (err: any) {
    console.warn(`[SyncTwoWay] Notice during sync for user ${userId}:`, err.message);
    return {
      success: false,
      pushedToSheet: 0,
      pulledToWeb: 0,
      total: localTxs.length,
      transactions: localTxs,
      message: 'Gagal sinkronisasi dengan Google Spreadsheet: ' + err.message
    };
  }
}

async function syncAndGetUserTransactions(userId: string, forceSync: boolean = false): Promise<any[]> {
  const localTxs = readUserTransactions(userId);
  if (!userId) return localTxs;

  if (userId === 'all') {
    // Gabungkan seluruh transaksi dari semua user untuk mode admin
    const all = readAllTransactions();
    const combined: any[] = [];
    Object.values(all).forEach(list => {
      if (Array.isArray(list)) combined.push(...list);
    });
    return combined.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }

  const allSettings = readAllUserSettings();
  const allUsers = readStoredUsers();
  const userCfg = allSettings[userId] || (allUsers.find(u => u.id === userId) as any);
  const sysCfg = readSystemConfig();
  let sheetUrl = (userCfg?.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
  // Filter out any legacy dummy/demo URLs so user data is NEVER contaminated
  if (sheetUrl.includes('AKfycby') || sheetUrl.includes('AKfycbwPLC')) {
    sheetUrl = '';
  }

  // Filter helper untuk memastikan transaksi terhapus atau sebelum waktu reset tidak pernah dibangkitkan
  const clearedTime = userLastClearedAt.get(userId) || userLastClearedAt.get('all') || 0;
  const filterValid = (items: any[]) => {
    return (Array.isArray(items) ? items : []).filter(item => {
      if (!item || !item.id) return false;
      const idStr = item.id.toString();
      if (deletedTransactionIds.has(idStr)) return false;
      if (clearedTime > 0) {
        const itemTime = new Date(item.date || item.createdAt || 0).getTime();
        if (itemTime > 0 && itemTime <= clearedTime) return false;
      }
      return true;
    });
  };

  const filteredLocalTxs = filterValid(localTxs);

  // Jika URL spreadsheet tidak terpasang, langsung kembalikan transaksi lokal user yang sah
  if (!sheetUrl || !sheetUrl.startsWith('http')) {
    return filteredLocalTxs;
  }

  // Jika bukan forceSync dan sinkronisasi terakhir dilakukan < 2 detik lalu, kembalikan langsung dari disk lokal
  const lastSync = userSyncCache.get(userId) || 0;
  const now = Date.now();
  if (!forceSync && (now - lastSync < 2000)) {
    return filteredLocalTxs;
  }

  if (sheetUrl && sheetUrl.startsWith('http')) {
    try {
      const delimiter = sheetUrl.includes('?') ? '&' : '?';
      // Wajib ambil seluruh transaksi riil dari Google Spreadsheet tanpa filter fragmentasi userId
      const readUrl = `${sheetUrl}${delimiter}action=get_transactions&userId=all`;
      const res = await fetch(readUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const json: any = await res.json();
        const sheetData: any[] = Array.isArray(json.data) ? json.data : (Array.isArray(json) ? json : []);

        // ATURAN UTAMA: Jika Google Spreadsheet kosong (0 data), berarti data telah dihapus atau dikosongkan.
        // Wajib mengembalikan Rp 0 dan mulai dari nol! Jangan pernah membangkitkan transaksi lama dari disk lokal.
        if (sheetData.length === 0) {
          const allDiskTxs = readAllTransactions();
          allDiskTxs[userId] = [];
          writeAllTransactions(allDiskTxs);
          userSyncCache.set(userId, Date.now());
          return [];
        }

        // Filter data spreadsheet yang sah
        const validSheetTxs = filterValid(sheetData).map(item => ({
          ...item,
          amount: Number(item.amount) || 0,
          type: item.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
          userId: item.userId || userId
        }));

        // Jika setelah filtering terhadap data yang dihapus hasilnya 0
        if (validSheetTxs.length === 0) {
          const allDiskTxs = readAllTransactions();
          allDiskTxs[userId] = [];
          writeAllTransactions(allDiskTxs);
          userSyncCache.set(userId, Date.now());
          return [];
        }

        const sortedList = validSheetTxs.sort((a, b) => {
          const timeA = new Date(a.date || 0).getTime();
          const timeB = new Date(b.date || 0).getTime();
          return timeB - timeA;
        });

        // Simpan data mutakhir yang sah ke disk server untuk akun ini
        const allDiskTxs = readAllTransactions();
        allDiskTxs[userId] = sortedList;
        userSyncCache.set(userId, Date.now());
        writeAllTransactions(allDiskTxs);

        return sortedList;
      }
    } catch (e: any) {
      console.warn(`[SyncTransactions] Notice fetching from Google Sheet for user ${userId}:`, e.message);
    }
  }

  return filteredLocalTxs;
}

// Persistensi Daftar Pengguna Terdaftar
const DEFAULT_SERVER_USERS = [
  {
    id: 'usr_admin_01',
    name: 'Administrator Utama',
    email: 'admin@fahkeu.id',
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    status: 'active'
  },
  {
    id: 'usr_faiz_02',
    name: 'Faiz Fahmi',
    email: 'faiz@fahkeu.id',
    username: 'faiz',
    password: 'user123',
    role: 'user',
    createdAt: '2026-01-02T10:00:00.000Z',
    status: 'active'
  }
];

function readStoredUsers(): any[] {
  if (!fs.existsSync(USERS_FILE)) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_SERVER_USERS, null, 2), 'utf-8');
      return DEFAULT_SERVER_USERS;
    } catch (e) {
      return DEFAULT_SERVER_USERS;
    }
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SERVER_USERS;
  } catch (e) {
    console.error('Failed to read users.json:', e);
    return DEFAULT_SERVER_USERS;
  }
}

function writeStoredUsers(usersList: any[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersList, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write users.json:', e);
  }
}

// API Routes FIRST
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Endpoint PROXY ke Google Apps Script (Bebas kendala CORS & redirect browser)
app.post('/api/sheets-proxy', async (req, res) => {
  try {
    const { url, payload, method } = req.body || {};
    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return res.status(400).json({ success: false, message: 'URL Google Apps Script tidak valid.' });
    }

    let cleanUrl = url.trim();
    if (cleanUrl.includes('AKfycbwPLC') || cleanUrl.includes('AKfycby')) {
      return res.status(400).json({ success: false, message: 'URL template demo lama tidak aktif. Harap gunakan URL Web App Spreadsheet pribadi Anda.' });
    }
    const httpMethod = (method || 'POST').toUpperCase();

    let fetchUrl = cleanUrl;
    let fetchOptions: RequestInit = {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    };

    if (httpMethod === 'GET') {
      if (payload && typeof payload === 'object') {
        const queryParams = new URLSearchParams();
        Object.keys(payload).forEach(key => {
          const val = payload[key];
          queryParams.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));
        });
        const delimiter = cleanUrl.includes('?') ? '&' : '?';
        fetchUrl = `${cleanUrl}${delimiter}${queryParams.toString()}`;
      }
    } else {
      fetchOptions.body = JSON.stringify(payload || {});
    }

    const gasResponse = await fetch(fetchUrl, fetchOptions);
    const responseText = await gasResponse.text();

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = { raw: responseText };
    }

    console.log(`[SheetsProxy] Proxied ${httpMethod} to GAS. Status: ${gasResponse.status}`);

    res.json({
      success: gasResponse.ok,
      status: gasResponse.status,
      data: parsedData
    });
  } catch (err: any) {
    console.error('[SheetsProxy] Error forwarding to Google Apps Script:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menghubungi Google Apps Script melalui proxy server.'
    });
  }
});

// Endpoint untuk mengambil konfigurasi sistem global
app.get('/api/system-config', (req, res) => {
  try {
    const config = readSystemConfig();
    res.json({
      success: true,
      config
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal membaca konfigurasi sistem.'
    });
  }
});

// Endpoint untuk menyimpan konfigurasi sistem global selamanya
app.post('/api/system-config', (req, res) => {
  try {
    const { adminGoogleSheetUrl, googleClientId, globalGoogleSheetUrl } = req.body || {};
    const updated = writeSystemConfig({
      adminGoogleSheetUrl,
      googleClientId,
      globalGoogleSheetUrl
    });

    console.log('[SystemConfig] Updated system configuration globally:', {
      adminGoogleSheetUrl: updated.adminGoogleSheetUrl ? '[CONFIGURED]' : '[EMPTY]',
      googleClientId: updated.googleClientId ? '[CONFIGURED]' : '[EMPTY]',
      updatedAt: updated.updatedAt
    });

    res.json({
      success: true,
      message: 'Konfigurasi global sistem berhasil disimpan selamanya di server!',
      config: updated
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menyimpan konfigurasi sistem.'
    });
  }
});

// ============================================================================
// ENDPOINT ADMIN: MANAJEMEN GEMINI & OCR PROVIDERS SERTA KUOTA STRUK
// ============================================================================

// 1. Ambil status API Key, katalog penyedia OCR/AI, dan statistik pemakaian kuota real-time
app.get('/api/admin/gemini-status', (req, res) => {
  try {
    const ocrConfig = getActiveOcrConfig();
    const stats = getGeminiUsageStats();
    res.json({
      success: true,
      providers: OCR_PROVIDERS_CATALOG,
      config: {
        hasKey: Boolean(ocrConfig.geminiApiKey),
        isCustom: ocrConfig.isCustomGemini,
        ocrMode: ocrConfig.ocrMode,
        activeProvider: ocrConfig.activeProvider,
        maskedKey: ocrConfig.maskedGeminiKey,
        hasOcrSpaceKey: Boolean(ocrConfig.ocrSpaceApiKey),
        isCustomOcrSpace: ocrConfig.isCustomOcrSpace,
        maskedOcrSpaceKey: ocrConfig.maskedOcrSpaceKey
      },
      stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal membaca status Gemini & OCR API.'
    });
  }
});

// Alias untuk route /api/admin/ocr-providers
app.get('/api/admin/ocr-providers', (req, res) => {
  try {
    const ocrConfig = getActiveOcrConfig();
    const stats = getGeminiUsageStats();
    res.json({
      success: true,
      providers: OCR_PROVIDERS_CATALOG,
      config: {
        hasKey: Boolean(ocrConfig.geminiApiKey),
        isCustom: ocrConfig.isCustomGemini,
        ocrMode: ocrConfig.ocrMode,
        activeProvider: ocrConfig.activeProvider,
        maskedKey: ocrConfig.maskedGeminiKey,
        hasOcrSpaceKey: Boolean(ocrConfig.ocrSpaceApiKey),
        isCustomOcrSpace: ocrConfig.isCustomOcrSpace,
        maskedOcrSpaceKey: ocrConfig.maskedOcrSpaceKey
      },
      stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal membaca daftar penyedia OCR.'
    });
  }
});

// 2. Simpan atau perbarui API Key Gemini, OCR.space, Active Provider, dan Mode OCR
app.post('/api/admin/gemini-config', (req, res) => {
  try {
    const { geminiApiKey, ocrSpaceApiKey, activeProvider, ocrMode } = req.body || {};
    const updates: Partial<SystemConfig> = {};

    if (geminiApiKey !== undefined) {
      updates.geminiApiKey = typeof geminiApiKey === 'string' ? geminiApiKey.trim() : '';
    }
    if (ocrSpaceApiKey !== undefined) {
      updates.ocrSpaceApiKey = typeof ocrSpaceApiKey === 'string' ? ocrSpaceApiKey.trim() : '';
    }
    if (activeProvider && ['gemini', 'ocr_space', 'local_tesseract'].includes(activeProvider)) {
      updates.activeProvider = activeProvider;
    }
    if (ocrMode && ['auto', 'ocr_only', 'gemini_only'].includes(ocrMode)) {
      updates.ocrMode = ocrMode;
    }

    const updated = writeSystemConfig(updates);
    const ocrConfig = getActiveOcrConfig();
    const stats = getGeminiUsageStats();

    res.json({
      success: true,
      message: 'Pengaturan Provider AI & Mode OCR berhasil disimpan selamanya!',
      providers: OCR_PROVIDERS_CATALOG,
      config: {
        hasKey: Boolean(ocrConfig.geminiApiKey),
        isCustom: ocrConfig.isCustomGemini,
        ocrMode: ocrConfig.ocrMode,
        activeProvider: ocrConfig.activeProvider,
        maskedKey: ocrConfig.maskedGeminiKey,
        hasOcrSpaceKey: Boolean(ocrConfig.ocrSpaceApiKey),
        isCustomOcrSpace: ocrConfig.isCustomOcrSpace,
        maskedOcrSpaceKey: ocrConfig.maskedOcrSpaceKey
      },
      stats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menyimpan konfigurasi Gemini & OCR.'
    });
  }
});

// 3. Uji Validitas API Key (Mendukung Gemini dan OCR.space)
app.post('/api/admin/gemini-test', async (req, res) => {
  try {
    const { apiKey, provider } = req.body || {};
    if (provider === 'ocr_space') {
      const result = await testOcrSpaceApiKey(apiKey);
      return res.json(result);
    }
    const testResult = await testGeminiApiKey(apiKey);
    res.json(testResult);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      latencyMs: 0,
      message: err.message || 'Terjadi kesalahan saat menguji API Key.'
    });
  }
});

// 4. Reset counter pemakaian kuota harian
app.post('/api/admin/gemini-reset-counter', (req, res) => {
  try {
    const updatedStats = resetTodayUsageCount();
    res.json({
      success: true,
      message: 'Penghitung kuota harian Gemini berhasil di-reset ke 0!',
      stats: updatedStats
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal me-reset counter kuota.'
    });
  }
});

// Endpoint untuk mengambil pengaturan privat per-user (Google Sheet URL & Bot Token)
app.get('/api/user-settings/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID wajib disertakan.' });
    }
    const all = readAllUserSettings();
    const userSettings = all[userId] || null;
    res.json({
      success: true,
      settings: userSettings
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal membaca pengaturan pengguna.'
    });
  }
});

// Endpoint untuk menyimpan pengaturan privat per-user selamanya di server
app.post('/api/user-settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID wajib disertakan.' });
    }
    const { googleSheetUrl, telegramBotToken, telegramChatId, useCloudStorage, explicitClearSheet } = req.body || {};

    const allExistingSettings = readAllUserSettings();
    const oldUserConfig = allExistingSettings[userId] || {};
    const oldBotToken = cleanTelegramToken(oldUserConfig.telegramBotToken || '');
    const cleanToken = cleanTelegramToken(telegramBotToken !== undefined ? telegramBotToken : oldBotToken);

    // Pemutusan Cerdas: Jika bot token baru dimasukkan/berubah, putuskan total koneksi bot lama!
    if (cleanToken && oldBotToken && cleanToken !== oldBotToken) {
      await severAndDisconnectOldTelegramBots(cleanToken, oldBotToken, userId);
    }

    const updated = writeUserSettings(userId, {
      googleSheetUrl,
      telegramBotToken,
      telegramChatId,
      useCloudStorage,
      explicitClearSheet
    });

    // Perbarui juga data di USERS_FILE jika ada
    const allUsers = readStoredUsers();
    const uIndex = allUsers.findIndex(u => u.id === userId);
    let matchedUser = null;
    if (uIndex !== -1) {
      allUsers[uIndex] = {
        ...allUsers[uIndex],
        googleSheetUrl: updated.googleSheetUrl,
        telegramBotToken: updated.telegramBotToken,
        telegramChatId: updated.telegramChatId,
        useCloudStorage: updated.useCloudStorage
      };
      writeStoredUsers(allUsers);
      matchedUser = allUsers[uIndex];
    }

    console.log(`[UserSettings] Updated private settings for user ${userId}:`, {
      sheetUrlConfigured: Boolean(updated.googleSheetUrl),
      telegramBotConfigured: Boolean(updated.telegramBotToken),
      updatedAt: updated.updatedAt
    });

    // Otomatis aktifkan / hentikan background poller sesuai ketersediaan token Telegram
    const finalCleanToken = cleanTelegramToken(updated.telegramBotToken || cleanToken || '');
    if (finalCleanToken && finalCleanToken.includes(':')) {
      telegramPoller.startPoller(userId, finalCleanToken, updated.googleSheetUrl).then((pRes) => {
        if (pRes.success) {
          console.log(`[UserSettings] Telegram poller active for user ${userId} (@${pRes.bot?.username})`);
        } else {
          console.warn(`[UserSettings] Telegram poller start notice for user ${userId}:`, pRes.error);
        }
      }).catch(err => {
        console.warn(`[UserSettings] Poller start error for ${userId}:`, err.message);
      });
    } else if (!finalCleanToken) {
      telegramPoller.stopPoller(userId);
    }

    // Teruskan pembaruan kredensial akun ke Google Spreadsheet Admin (jika admin URL terkonfigurasi)
    const sysConfig = readSystemConfig();
    if (sysConfig.adminGoogleSheetUrl && sysConfig.adminGoogleSheetUrl.trim()) {
      const payloadUser = matchedUser || {
        id: userId,
        googleSheetUrl: updated.googleSheetUrl,
        telegramBotToken: updated.telegramBotToken,
        telegramChatId: updated.telegramChatId,
        useCloudStorage: updated.useCloudStorage
      };

      fetch(sysConfig.adminGoogleSheetUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_user_credentials',
          user: payloadUser
        })
      })
      .then(async gasRes => {
        console.log(`[ServerSync] Forwarded user ${userId} credentials to Admin Sheet. Status: ${gasRes.status}`);
      })
      .catch(gasErr => {
        console.warn(`[ServerSync] Warning: Failed to forward user ${userId} credentials to Admin Sheet:`, gasErr.message);
      });
    }

    // Inisialisasi Sinkronisasi Dua Arah (Saling Melengkapi) saat awal konfigurasi spreadsheet
    let syncResult: any = null;
    if (updated.googleSheetUrl && updated.googleSheetUrl.startsWith('http')) {
      try {
        syncResult = await syncTwoWayWithGoogleSheet(userId, updated.googleSheetUrl);
        console.log(`[UserSettings] Initial bi-directional sync completed on config save for user ${userId}:`, {
          pushedToSheet: syncResult.pushedToSheet,
          pulledToWeb: syncResult.pulledToWeb,
          total: syncResult.total
        });
      } catch (sErr: any) {
        console.warn(`[UserSettings] Bi-directional sync error on save for ${userId}:`, sErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Pengaturan pengguna berhasil disimpan & data otomatis saling melengkapi!',
      settings: updated,
      syncResult
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menyimpan pengaturan pengguna.'
    });
  }
});

// Endpoint Sinkronisasi Dua Arah Khusus (Website & Spreadsheet Saling Melengkapi 100%)
app.post('/api/sync-two-way', async (req, res) => {
  try {
    const { userId, sheetUrl } = req.body || {};
    const targetUserId = (userId || 'usr_admin_01').trim();
    const result = await syncTwoWayWithGoogleSheet(targetUserId, sheetUrl);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menjalankan sinkronisasi dua arah.'
    });
  }
});

// Endpoint untuk sinkronisasi daftar pengguna terdaftar ke server
app.get('/api/users', (req, res) => {
  try {
    const users = readStoredUsers();
    res.json({
      success: true,
      users
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal membaca data pengguna.'
    });
  }
});

app.post('/api/users', (req, res) => {
  try {
    const { users } = req.body || {};
    if (Array.isArray(users)) {
      writeStoredUsers(users);
      res.json({
        success: true,
        message: 'Daftar pengguna berhasil disimpan di server.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Format data pengguna tidak valid.'
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: err.message || 'Gagal menyimpan data pengguna.'
    });
  }
});

// 1. ENDPOINT TRANSAKSI (Sinkronisasi Database Server)
app.get('/api/transactions', async (req, res) => {
  try {
    const userId = (req.query.userId as string || '').trim();
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId diperlukan.' });
    }
    const txs = await syncAndGetUserTransactions(userId);
    res.json({ success: true, transactions: txs, data: txs });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal membaca transaksi.' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { action, userId, transaction, id } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId diperlukan.' });
    }

    // Helper untuk mengambil sheetUrl & data user aktif
    const allSettings = readAllUserSettings();
    const allUsers = readStoredUsers();
    const userCfg = allSettings[userId] || (allUsers.find(u => u.id === userId) as any);
    const sysCfg = readSystemConfig();
    let sheetUrl = (userCfg?.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
    if (sheetUrl.includes('AKfycby') || sheetUrl.includes('AKfycbwPLC')) {
      sheetUrl = '';
    }

    if (action === 'add') {
      if (!transaction) return res.status(400).json({ success: false, message: 'Data transaksi diperlukan.' });
      const updated = saveUserTransaction(userId, transaction);
      userSyncCache.delete(userId);

      // Teruskan ke Google Spreadsheet secara server-side jika terpasang
      if (sheetUrl) {
        pushTransactionToGoogleSheet(sheetUrl, transaction, 'add', userId, userCfg?.username).catch(() => {});
      }

      return res.json({ success: true, message: 'Transaksi berhasil ditambahkan.', transactions: updated });
    }

    if (action === 'edit' || action === 'update') {
      if (!transaction) return res.status(400).json({ success: false, message: 'Data transaksi diperlukan.' });
      const updated = editUserTransaction(userId, transaction);
      userSyncCache.delete(userId);

      // Teruskan edit ke Google Spreadsheet secara server-side
      if (sheetUrl) {
        pushTransactionToGoogleSheet(sheetUrl, transaction, 'edit', userId, userCfg?.username).catch(() => {});
      }

      return res.json({ success: true, message: 'Transaksi berhasil diupdate.', transactions: updated });
    }

    if (action === 'delete') {
      const targetId = id || (transaction && transaction.id);
      if (!targetId) return res.status(400).json({ success: false, message: 'ID transaksi diperlukan.' });
      const updated = deleteUserTransaction(userId, targetId);
      userSyncCache.delete(userId);

      // Teruskan delete ke Google Spreadsheet secara server-side
      if (sheetUrl) {
        pushTransactionToGoogleSheet(sheetUrl, targetId, 'delete', userId, userCfg?.username).catch(() => {});
      }

      return res.json({ success: true, message: 'Transaksi berhasil dihapus.', transactions: updated });
    }

    if (action === 'clear') {
      clearUserTransactions(userId);
      userSyncCache.delete(userId);
      userLastClearedAt.set(userId, Date.now());

      // 1. Bersihkan Google Spreadsheet kembali ke 0 (menghapus seluruh baris data)
      if (sheetUrl) {
        await pushTransactionToGoogleSheet(sheetUrl, null, 'clear', userId, userCfg?.username).catch(err => {
          console.warn('[Clear] Forwarding clear to Google Sheet notice:', err.message);
        });
      }

      // 2. Beritahu Bot Telegram bahwa saldo kas direset kembali menjadi Rp 0
      const activeToken = userCfg?.telegramBotToken;
      const activeChatId = userCfg?.telegramChatId;
      if (activeToken && activeChatId) {
        fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: activeChatId,
            text: '🗑️ <b>Pemberitahuan Sistem:</b>\n' +
                  'Seluruh data transaksi telah direset menjadi <b>Rp 0</b> dari Website.\n\n' +
                  '💰 <b>Sisa Saldo Kas: Rp 0</b>\n' +
                  '📥 <b>Total Pemasukan:</b> Rp 0\n' +
                  '📤 <b>Total Pengeluaran:</b> Rp 0\n' +
                  '───────────────────────────\n' +
                  '✅ <i>Data di Website, Google Spreadsheet, dan Bot Telegram telah disetel ulang menjadi nol bersih.</i>',
            parse_mode: 'HTML'
          })
        }).catch(() => {});
      }

      return res.json({ success: true, message: 'Semua transaksi dibersihkan (kembali ke Rp 0).', transactions: [] });
    }

    res.status(400).json({ success: false, message: 'Aksi tidak dikenal.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal memproses transaksi.' });
  }
});

// Endpoint Analisis Struk/Nota Belanja (AI Vision & OCR)
app.post('/api/scan-receipt', async (req, res) => {
  try {
    const { imageBase64, mimeType, caption } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'Data gambar base64 diperlukan.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const result = await analyzeReceiptImage(buffer, mimeType || 'image/jpeg', caption);

    res.json(result);
  } catch (err: any) {
    console.error('[API scan-receipt error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Gagal menganalisis struk belanja.' });
  }
});

// 2. SISTEM TELEGRAM BOT PROFESIONAL (POLLING & WEBHOOK DUAL-ENGINE)
const processedTelegramUpdateIds = new Set<number>();

// Model draf struk belanja Telegram (Pratinjau, Edit sebelum Simpan, & Tombol Konfirmasi)
interface TelegramDraftReceipt {
  id: string;
  chatId: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  type: 'pengeluaran' | 'pemasukan';
  storeName?: string;
  subtotal?: number;
  tax?: number;
  tender?: number;
  change?: number;
  items?: string[];
  username: string;
  waitingFor?: 'amount' | 'description' | null;
  previewMessageId?: number;
  createdAt: number;
  savedTxId?: string; // ID transaksi yang otomatis tersimpan ke website & spreadsheet
}

const activeDraftReceipts = new Map<string, TelegramDraftReceipt>();
const userPendingDraftReceipt = new Map<string, string>(); // chatId -> draftId

// Model sesi edit interaktif untuk transaksi tersimpan via bot Telegram
interface TelegramPendingTxEdit {
  txId: string;
  userId: string;
  field: 'amount' | 'description';
}
const userPendingTxEdit = new Map<string, TelegramPendingTxEdit>(); // chatId -> TelegramPendingTxEdit

// Parser nominal fleksibel untuk pesan balasan pengguna (dukung 180k, 185rb, 181.475, 1.5jt, dll)
function parseSimpleAmount(input: string): number | null {
  if (!input) return null;
  const clean = input.toLowerCase().replace(/^(rp\.?|idr)\s*/i, '').trim();
  const jtMatch = clean.match(/^([\d.,]+)\s*(jt|juta)$/i);
  if (jtMatch) {
    const n = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000000);
  }
  const kMatch = clean.match(/^([\d.,]+)\s*(k|rb|ribu)$/i);
  if (kMatch) {
    const n = parseFloat(kMatch[1].replace(',', '.'));
    if (!isNaN(n) && n > 0) return Math.round(n * 1000);
  }
  const numClean = clean.replace(/[^\d]/g, '');
  const val = parseInt(numClean, 10);
  return (!isNaN(val) && val > 0) ? val : null;
}

// Format pesan konfirmasi struk tersimpan identik dengan UI Website & Spreadsheet
function formatReceiptSavedMessage(
  d: TelegramDraftReceipt,
  totalIncome: number,
  totalExpense: number,
  currentBalance: number,
  sheetSynced: boolean
): string {
  let cashierDetails = '';
  if (d.subtotal || d.tax || d.tender || d.change) {
    cashierDetails = `\n🧾 <b>Rincian Kasir:</b>\n` +
      (d.subtotal ? `• Subtotal: ${formatRupiah(d.subtotal)}\n` : '') +
      (d.tax ? `• Pajak: ${formatRupiah(d.tax)}\n` : '') +
      (d.tender ? `• Bayar: ${formatRupiah(d.tender)}\n` : '') +
      (d.change ? `• Kembalian: ${formatRupiah(d.change)}\n` : '');
  }

  let itemsSnippet = '';
  if (d.items && d.items.length > 0) {
    itemsSnippet = `\n📋 <b>Item Terdeteksi (${d.items.length}):</b>\n` +
      d.items.slice(0, 5).map(i => `• ${escapeHtml(i)}`).join('\n') + '\n';
  }

  const isIncome = d.type === 'pemasukan';
  const sign = isIncome ? '+ ' : '- ';
  const typeLabel = isIncome ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  const syncNote = sheetSynced
    ? '✅ <i>Tersimpan realtime di Website & Google Spreadsheet!</i>'
    : '✅ <i>Tersimpan realtime di Website & Database!</i>';

  let balanceNotice = '';
  if (totalIncome === 0 && totalExpense > 0) {
    balanceNotice = `\n💡 <i>Catatan: Belum ada saldo awal. Ketik contoh: <code>saldo awal 500rb</code> agar sisa uang riil Anda terhitung positif.</i>\n`;
  } else if (currentBalance < 0) {
    balanceNotice = `\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit ${formatRupiah(Math.abs(currentBalance))}).</i>\n`;
  }

  return `✅ <b>Struk Belanja Berhasil Disimpan ke Catatan Kas!</b>\n` +
    `───────────────────────────\n` +
    (d.storeName ? `🏪 <b>Toko / Merchant:</b> <b>${escapeHtml(d.storeName)}</b>\n` : '') +
    `📝 <b>Keterangan:</b> <b>${escapeHtml(d.description)}</b>\n` +
    `💵 <b>Nominal:</b> <b>${sign}${formatRupiah(d.amount)}</b>\n` +
    `📂 <b>Kategori:</b> <b>${escapeHtml(d.category)}</b>\n` +
    `🏷️ <b>Jenis:</b> ${typeLabel}\n` +
    cashierDetails +
    itemsSnippet +
    `───────────────────────────\n` +
    `📊 <b>Rekap Saldo Kas:</b>\n` +
    `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
    `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
    `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>${formatRupiah(currentBalance)}</b>\n` +
    balanceNotice +
    `───────────────────────────\n` +
    `${syncNote}\n\n` +
    `💡 <i>Ketik <b>/hapus</b> untuk membatalkan atau <b>/edit</b> untuk mengedit transaksi ini.</i>`;
}

// Format pesan pratinjau struk identik dengan UI Website
function formatReceiptPreviewMessage(d: TelegramDraftReceipt): string {
  let cashierDetails = '';
  if (d.subtotal || d.tax || d.tender || d.change) {
    cashierDetails = `\n🧾 <b>Rincian Kasir:</b>\n` +
      (d.subtotal ? `• Subtotal: ${formatRupiah(d.subtotal)}\n` : '') +
      (d.tax ? `• Pajak: ${formatRupiah(d.tax)}\n` : '') +
      (d.tender ? `• Bayar: ${formatRupiah(d.tender)}\n` : '') +
      (d.change ? `• Kembalian: ${formatRupiah(d.change)}\n` : '');
  }

  let itemsSnippet = '';
  if (d.items && d.items.length > 0) {
    itemsSnippet = `\n📋 <b>Item Terdeteksi (${d.items.length}):</b>\n` +
      d.items.slice(0, 5).map(i => `• ${escapeHtml(i)}`).join('\n') + '\n';
  }

  const typeLabel = d.type === 'pengeluaran' 
    ? '🔴 Pengeluaran (Uang Keluar)' 
    : '🟢 Pemasukan (Uang Masuk)';

  const amountDisplay = d.amount > 0 
    ? `💵 <b>Nominal:</b> <b>${formatRupiah(d.amount)}</b>` 
    : `💵 <b>Nominal:</b> ⚠️ <b>Belum terisi (Rp 0)</b> - <i>Ketik nominal di chat</i>`;

  return `📸 <b>PRATINJAU HASIL SCAN STRUK</b>\n` +
    `<i>Silakan periksa & edit data sebelum disimpan:</i>\n` +
    `───────────────────────────\n` +
    (d.storeName ? `🏪 <b>Toko / Merchant:</b> <b>${escapeHtml(d.storeName)}</b>\n` : '') +
    `📝 <b>Keterangan:</b> <b>${escapeHtml(d.description)}</b>\n` +
    `${amountDisplay}\n` +
    `📂 <b>Kategori:</b> <b>${escapeHtml(d.category)}</b>\n` +
    `🏷️ <b>Jenis:</b> ${typeLabel}\n` +
    cashierDetails +
    itemsSnippet +
    `───────────────────────────\n` +
    (d.amount > 0
      ? `💡 <i>Jika sudah tepat 100%, klik tombol <b>💾 Simpan ke Catatan</b> di bawah. Anda juga bisa mengedit nominal, nama toko, atau kategori dahulu jika ada yang salah.</i>`
      : `💡 <i>Ketik angka nominal di chat ini (contoh: <code>45k</code> atau <code>45000</code>) atau klik <b>✏️ Ubah Nominal</b> untuk mengisi total belanja.</i>`);
}

// Keyboard inline tombol pratinjau utama di Telegram
function getReceiptPreviewKeyboard(draftId: string, amount: number = 1) {
  const saveText = amount > 0 ? '💾 Simpan ke Catatan' : '✏️ Isi Nominal Dahulu';
  return {
    inline_keyboard: [
      [
        { text: saveText, callback_data: `dr_save:${draftId}` }
      ],
      [
        { text: '✏️ Ubah Nominal', callback_data: `dr_edit_amt:${draftId}` },
        { text: '✏️ Ubah Toko/Ket', callback_data: `dr_edit_desc:${draftId}` }
      ],
      [
        { text: '🏷️ Ganti Kategori', callback_data: `dr_cat_menu:${draftId}` },
        { text: '🔄 Ganti Jenis', callback_data: `dr_toggle_type:${draftId}` }
      ],
      [
        { text: '❌ Batal', callback_data: `dr_cancel:${draftId}` }
      ]
    ]
  };
}

// Keyboard inline pilihan kategori
function getCategorySelectKeyboard(draftId: string) {
  return {
    inline_keyboard: [
      [
        { text: '🍽️ Makanan & Minum', callback_data: `dr_set_cat:${draftId}:Makanan & Minuman` },
        { text: '🛒 Belanja & Pribadi', callback_data: `dr_set_cat:${draftId}:Belanja & Pribadi` }
      ],
      [
        { text: '🚗 Transportasi', callback_data: `dr_set_cat:${draftId}:Transportasi` },
        { text: '💡 Tagihan & Utilitas', callback_data: `dr_set_cat:${draftId}:Tagihan & Utilitas` }
      ],
      [
        { text: '💼 Operasional Usaha', callback_data: `dr_set_cat:${draftId}:Operasional Usaha` },
        { text: '📦 Pengeluaran Lain', callback_data: `dr_set_cat:${draftId}:Pengeluaran Lain` }
      ],
      [
        { text: '🔙 Selesai / Kembali ke Pratinjau', callback_data: `dr_back:${draftId}` }
      ]
    ]
  };
}

// Fungsi Terpadu untuk Memproses Pesan Telegram (Digunakan oleh Poller & Webhook)
async function handleIncomingTelegramUpdate(
  update: any,
  forcedToken?: string,
  forcedUserId?: string
): Promise<{ success: boolean; chatId?: string; action?: string }> {
  try {
    if (!update || typeof update !== 'object') return { success: false };

    // Deduplikasi update_id
    if (update.update_id) {
      if (processedTelegramUpdateIds.has(update.update_id)) {
        return { success: true, action: 'duplicate_skipped' };
      }
      processedTelegramUpdateIds.add(update.update_id);
      if (processedTelegramUpdateIds.size > 3000) {
        const firstElem = processedTelegramUpdateIds.values().next().value;
        if (firstElem) processedTelegramUpdateIds.delete(firstElem);
      }
    }

    const isCallback = Boolean(update.callback_query);
    const callbackQuery = update.callback_query;
    const message = callbackQuery ? callbackQuery.message : (update.message || update.channel_post || update.edited_message);
    if (!message || !message.chat) return { success: false };

    const chatId = String(message.chat.id);
    const text = (isCallback ? (callbackQuery.data || '') : (message.text || message.caption || '')).trim();
    const fromUser = (isCallback ? callbackQuery.from : message.from) || {};

    // 1. Tentukan user target & token bot
    const allSettings = readAllUserSettings();
    const allUsers = readStoredUsers();
    let targetUserId = forcedUserId || '';

    // Jika belum ada forcedUserId, cari kecocokan berdasarkan token bot
    if (!targetUserId && forcedToken) {
      const cleanFToken = cleanTelegramToken(forcedToken);
      for (const [uId, cfg] of Object.entries(allSettings)) {
        if (cfg.telegramBotToken && cleanTelegramToken(cfg.telegramBotToken) === cleanFToken) {
          targetUserId = uId;
          break;
        }
      }
      if (!targetUserId) {
        const uMatch = allUsers.find(u => u.telegramBotToken && cleanTelegramToken(u.telegramBotToken) === cleanFToken);
        if (uMatch) targetUserId = uMatch.id;
      }
    }

    // Jika belum cocok, cari berdasarkan telegramChatId
    if (!targetUserId) {
      for (const [uId, cfg] of Object.entries(allSettings)) {
        if (cfg.telegramChatId && String(cfg.telegramChatId) === chatId) {
          targetUserId = uId;
          break;
        }
      }
      if (!targetUserId) {
        const uMatch = allUsers.find(u => u.telegramChatId && String(u.telegramChatId) === chatId);
        if (uMatch) targetUserId = uMatch.id;
      }
    }

    // Fallback default jika tidak ada kecocokan
    if (!targetUserId) {
      targetUserId = allUsers[0]?.id || 'usr_admin_01';
    }

    // Ambil konfigurasi user
    let userCfg = allSettings[targetUserId] || (allUsers.find(u => u.id === targetUserId) as any) || {
      googleSheetUrl: '',
      telegramBotToken: forcedToken || '',
      telegramChatId: chatId,
      useCloudStorage: false
    };

    // Fallback URL Google Spreadsheet dari system_config jika user belum mengisi
    if (!userCfg.googleSheetUrl) {
      const sysCfg = readSystemConfig();
      if (sysCfg.globalGoogleSheetUrl) {
        userCfg.googleSheetUrl = sysCfg.globalGoogleSheetUrl;
      }
    }

    const activeToken = forcedToken || userCfg.telegramBotToken;
    if (!activeToken) {
      console.warn(`[Telegram] No active token found for message from ${chatId}`);
      return { success: false, chatId };
    }

    // Auto-update Chat ID jika belum tersimpan atau berubah
    if (userCfg.telegramChatId !== chatId) {
      console.log(`[Telegram] Auto-linking Chat ID for user ${targetUserId}: ${chatId}`);
      writeUserSettings(targetUserId, { telegramChatId: chatId, telegramBotToken: activeToken });
      telegramPoller.updateDetectedChatId(targetUserId, chatId);

      const uIdx = allUsers.findIndex(u => u.id === targetUserId);
      if (uIdx !== -1) {
        allUsers[uIdx].telegramChatId = chatId;
        allUsers[uIdx].telegramBotToken = activeToken;
        writeStoredUsers(allUsers);
      }
    }

    // Helper fungsi pengirim dan pengedit pesan ke Telegram
    const sendChatAction = async (action: string = 'typing') => {
      try {
        await fetch(`https://api.telegram.org/bot${activeToken}/sendChatAction`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            action
          })
        });
      } catch {}
    };

    const sendReply = async (msgHtml: string): Promise<number | null> => {
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: msgHtml,
            parse_mode: 'HTML'
          })
        });
        const tgData: any = await tgRes.json();
        if (tgData.ok && tgData.result?.message_id) {
          return tgData.result.message_id;
        }
        // Fallback tanpa HTML jika ada error parsing tag HTML
        const fallbackRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: msgHtml.replace(/<[^>]*>/g, '')
          })
        });
        const fallbackData: any = await fallbackRes.json();
        return fallbackData.result?.message_id || null;
      } catch (err: any) {
        console.error(`[Telegram] Failed to send reply to ${chatId}:`, err.message);
        return null;
      }
    };

    const sendReplyWithMarkup = async (msgHtml: string, replyMarkup?: any): Promise<number | null> => {
      try {
        const bodyObj: any = {
          chat_id: chatId,
          text: msgHtml,
          parse_mode: 'HTML'
        };
        if (replyMarkup) bodyObj.reply_markup = replyMarkup;

        const tgRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        });
        const tgData: any = await tgRes.json();
        if (tgData.ok && tgData.result?.message_id) {
          return tgData.result.message_id;
        }
        // Fallback plain text
        const fallbackObj: any = {
          chat_id: chatId,
          text: msgHtml.replace(/<[^>]*>/g, '')
        };
        if (replyMarkup) fallbackObj.reply_markup = replyMarkup;

        const fbRes = await fetch(`https://api.telegram.org/bot${activeToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackObj)
        });
        const fbData: any = await fbRes.json();
        return fbData.result?.message_id || null;
      } catch (err: any) {
        console.error(`[Telegram] Failed to send reply with markup to ${chatId}:`, err.message);
        return null;
      }
    };

    const editReplyWithMarkup = async (messageId: number, msgHtml: string, replyMarkup?: any): Promise<boolean> => {
      try {
        const bodyObj: any = {
          chat_id: chatId,
          message_id: messageId,
          text: msgHtml,
          parse_mode: 'HTML'
        };
        if (replyMarkup) bodyObj.reply_markup = replyMarkup;

        const tgRes = await fetch(`https://api.telegram.org/bot${activeToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyObj)
        });
        const tgData: any = await tgRes.json();
        if (tgData.ok) return true;

        // Fallback plain text jika parsing HTML gagal
        const fbObj: any = {
          chat_id: chatId,
          message_id: messageId,
          text: msgHtml.replace(/<[^>]*>/g, '')
        };
        if (replyMarkup) fbObj.reply_markup = replyMarkup;

        const fbRes = await fetch(`https://api.telegram.org/bot${activeToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fbObj)
        });
        const fbData: any = await fbRes.json();
        return Boolean(fbData.ok);
      } catch (err: any) {
        console.warn(`[Telegram] Failed to edit message with markup ${messageId}:`, err.message);
        return false;
      }
    };

    const editReply = async (messageId: number, msgHtml: string): Promise<boolean> => {
      return editReplyWithMarkup(messageId, msgHtml);
    };

    const answerCallback = async (callbackQueryId: string, textAlert?: string): Promise<void> => {
      try {
        await fetch(`https://api.telegram.org/bot${activeToken}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: textAlert || ''
          })
        });
      } catch {}
    };

    // ========================================================================
    // PENANGANAN TOMBOL INTERAKTIF TELEGRAM (CALLBACK QUERY: EDIT & SIMPAN)
    // ========================================================================
    if (isCallback && callbackQuery) {
      const cbData = (callbackQuery.data || '').trim();
      const cbId = callbackQuery.id;

      // 1. Tombol Simpan Struk ke Catatan Kas
      if (cbData.startsWith('dr_save:')) {
        const draftId = cbData.replace('dr_save:', '');
        const draft = activeDraftReceipts.get(draftId);

        if (!draft) {
          await answerCallback(cbId, 'Struk sudah disimpan atau sesi telah berakhir.');
          await editReplyWithMarkup(message.message_id, 'ℹ️ <i>Data struk ini sudah tersimpan atau tidak ditemukan lagi.</i>', { inline_keyboard: [] });
          return { success: true, chatId, action: 'draft_not_found' };
        }

        // Validasi nominal harus > 0 sebelum disimpan
        if (!draft.amount || draft.amount <= 0) {
          await answerCallback(cbId, '⚠️ Nominal masih Rp 0. Masukkan nominal dahulu!');
          draft.waitingFor = 'amount';
          userPendingDraftReceipt.set(chatId, draftId);
          await sendReply(
            `✏️ <b>Nominal Belum Diisi:</b>\n` +
            `Silakan ketikkan nominal belanja di pesan chat ini (contoh: <code>45000</code> atau <code>45k</code>) sebelum menyimpan ke catatan kas.`
          );
          return { success: false, chatId, action: 'draft_need_amount' };
        }

        // Buat objek transaksi final
        const targetUserObj = allUsers.find(u => u.id === draft.userId);
        const resolvedUsername = targetUserObj?.username || targetUserObj?.name || fromUser.username || fromUser.first_name || 'Telegram User';

        const newTx = {
          id: `tg_ocr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          date: new Date().toISOString(),
          type: draft.type,
          amount: draft.amount,
          description: draft.description,
          category: draft.category,
          source: 'telegram',
          userId: draft.userId,
          username: resolvedUsername
        };

        // Ambil rekap saldo sebelum penambahan secara realtime dari Google Spreadsheet & Server
        const priorTxs = await syncAndGetUserTransactions(draft.userId, true);
        let priorIncome = 0;
        let priorExpense = 0;
        priorTxs.forEach((t: any) => {
          const amt = Number(t.amount) || 0;
          if (t.type === 'pemasukan') priorIncome += amt;
          else priorExpense += amt;
        });

        // Simpan transaksi ke database server lokal
        saveUserTransaction(draft.userId, newTx);
        userSyncCache.delete(draft.userId);

        // Teruskan ke Google Spreadsheet secara realtime dengan fallback tangguh
        let sheetSaved = false;
        const sysCfg = readSystemConfig();
        const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
        if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http') && !effectiveSheetUrl.includes('AKfycby') && !effectiveSheetUrl.includes('AKfycbwPLC')) {
          const pushRes = await pushTransactionToGoogleSheet(
            effectiveSheetUrl,
            newTx,
            'add',
            draft.userId,
            newTx.username
          );
          if (pushRes.success) sheetSaved = true;
        }

        // Hitung total mutakhir yang 100% akurat dari spreadsheet & transaksi baru
        const isDraftIncome = draft.type === 'pemasukan';
        const totalIncome = priorIncome + (isDraftIncome ? draft.amount : 0);
        const totalExpense = priorExpense + (!isDraftIncome ? draft.amount : 0);
        const newBalance = totalIncome - totalExpense;

        // Buat pesan bukti rekap kas tersimpan
        const savedMsg = formatReceiptSavedMessage(
          draft,
          totalIncome,
          totalExpense,
          newBalance,
          sheetSaved || Boolean(effectiveSheetUrl)
        );

        const savedActionKeyboard = {
          inline_keyboard: [
            [
              { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
              { text: "📊 Rekap Kas", callback_data: "cmd_rekap" }
            ],
            [
              { text: "✏️ Edit Transaksi", callback_data: `tx_edit_menu:${newTx.id}` },
              { text: "🗑️ Batalkan Transaksi", callback_data: "cmd_hapus" }
            ]
          ]
        };

        // Update pesan Telegram dengan menu navigasi & edit cepat
        await editReplyWithMarkup(message.message_id, savedMsg, savedActionKeyboard);
        if (draft.previewMessageId && draft.previewMessageId !== message.message_id) {
          editReplyWithMarkup(draft.previewMessageId, 'ℹ️ <i>Struk ini telah disimpan ke catatan kas.</i>', { inline_keyboard: [] }).catch(() => {});
        }
        await answerCallback(cbId, '✅ Transaksi struk berhasil disimpan!');

        // Hapus draf dari memori server
        activeDraftReceipts.delete(draftId);
        userPendingDraftReceipt.delete(chatId);

        return { success: true, chatId, action: 'draft_saved' };
      }

      // 2. Tombol Batal / Hapus Scan Struk
      if (cbData.startsWith('dr_cancel:')) {
        const draftId = cbData.replace('dr_cancel:', '');
        const draft = activeDraftReceipts.get(draftId);
        activeDraftReceipts.delete(draftId);
        userPendingDraftReceipt.delete(chatId);

        const cancelMsg = `❌ <b>Sesi Pemindaian Struk Dibatalkan.</b>\n` +
          `───────────────────────────\n` +
          `<i>Data struk belanja tidak disimpan ke database maupun Google Spreadsheet.</i>`;

        await editReplyWithMarkup(message.message_id, cancelMsg, { inline_keyboard: [] });
        if (draft?.previewMessageId && draft.previewMessageId !== message.message_id) {
          editReplyWithMarkup(draft.previewMessageId, '❌ <i>Scan struk dibatalkan.</i>', { inline_keyboard: [] }).catch(() => {});
        }
        await answerCallback(cbId, 'Scan struk dibatalkan.');
        return { success: true, chatId, action: 'draft_cancelled' };
      }

      // 3. Tombol Ubah Nominal
      if (cbData.startsWith('dr_edit_amt:')) {
        const draftId = cbData.replace('dr_edit_amt:', '');
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.waitingFor = 'amount';
          draft.previewMessageId = message.message_id;
          userPendingDraftReceipt.set(chatId, draftId);

          await sendReply(
            `✏️ <b>Ubah Nominal Struk:</b>\n\n` +
            `Ketikkan angka nominal yang benar di pesan chat ini.\n` +
            `Mendukung format: <code>185k</code>, <code>185rb</code>, <code>185000</code>, atau <code>181.475</code>`
          );
          await answerCallback(cbId, 'Silakan ketik nominal baru di chat.');
        } else {
          await answerCallback(cbId, 'Sesi struk sudah berakhir.');
        }
        return { success: true, chatId, action: 'draft_prompt_amount' };
      }

      // 4. Tombol Ubah Nama Toko / Keterangan
      if (cbData.startsWith('dr_edit_desc:')) {
        const draftId = cbData.replace('dr_edit_desc:', '');
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.waitingFor = 'description';
          draft.previewMessageId = message.message_id;
          userPendingDraftReceipt.set(chatId, draftId);

          await sendReply(
            `✏️ <b>Ubah Nama Toko / Keterangan:</b>\n\n` +
            `Ketikkan nama toko atau keterangan pengganti di pesan chat ini.\n` +
            `Contoh: <code>Indomaret</code> atau <code>Cafe Kopi Kenangan</code>`
          );
          await answerCallback(cbId, 'Silakan ketik nama toko di chat.');
        } else {
          await answerCallback(cbId, 'Sesi struk sudah berakhir.');
        }
        return { success: true, chatId, action: 'draft_prompt_desc' };
      }

      // 5. Tombol Menu Ganti Kategori (6 Kategori interaktif)
      if (cbData.startsWith('dr_cat_menu:')) {
        const draftId = cbData.replace('dr_cat_menu:', '');
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.waitingFor = null;
          draft.previewMessageId = message.message_id;

          await editReplyWithMarkup(
            message.message_id,
            formatReceiptPreviewMessage(draft) + `\n\n📂 <b>Silakan pilih salah satu kategori di bawah:</b>`,
            getCategorySelectKeyboard(draftId)
          );
          await answerCallback(cbId, 'Pilih kategori.');
        }
        return { success: true, chatId, action: 'draft_cat_menu' };
      }

      // 6. Tombol Pilih Kategori
      if (cbData.startsWith('dr_set_cat:')) {
        const parts = cbData.split(':');
        const draftId = parts[1];
        const newCategory = parts.slice(2).join(':') || 'Belanja & Pribadi';
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.category = newCategory;
          draft.waitingFor = null;
          draft.previewMessageId = message.message_id;

          await editReplyWithMarkup(
            message.message_id,
            formatReceiptPreviewMessage(draft),
            getReceiptPreviewKeyboard(draftId)
          );
          await answerCallback(cbId, `Kategori diubah: ${newCategory}`);
        }
        return { success: true, chatId, action: 'draft_cat_set' };
      }

      // 7. Tombol Ganti Jenis Transaksi (Pengeluaran / Pemasukan)
      if (cbData.startsWith('dr_toggle_type:')) {
        const draftId = cbData.replace('dr_toggle_type:', '');
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.type = draft.type === 'pengeluaran' ? 'pemasukan' : 'pengeluaran';
          draft.waitingFor = null;
          draft.previewMessageId = message.message_id;

          await editReplyWithMarkup(
            message.message_id,
            formatReceiptPreviewMessage(draft),
            getReceiptPreviewKeyboard(draftId)
          );
          const typeLabel = draft.type === 'pengeluaran' ? '🔴 Pengeluaran' : '🟢 Pemasukan';
          await answerCallback(cbId, `Jenis diubah: ${typeLabel}`);
        }
        return { success: true, chatId, action: 'draft_type_toggled' };
      }

      // 8. Tombol Kembali ke Menu Pratinjau
      if (cbData.startsWith('dr_back:')) {
        const draftId = cbData.replace('dr_back:', '');
        const draft = activeDraftReceipts.get(draftId);
        if (draft) {
          draft.waitingFor = null;
          draft.previewMessageId = message.message_id;

          await editReplyWithMarkup(
            message.message_id,
            formatReceiptPreviewMessage(draft),
            getReceiptPreviewKeyboard(draftId)
          );
          await answerCallback(cbId);
        }
        return { success: true, chatId, action: 'draft_back' };
      }

      // 9. Tombol Cek Saldo Cepat
      if (cbData === 'cmd_saldo') {
        const userTxs = await syncAndGetUserTransactions(targetUserId, true);
        let totalIncome = 0; let totalExpense = 0;
        userTxs.forEach((t: any) => {
          const amt = Number(t.amount) || 0;
          if (t.type === 'pemasukan') totalIncome += amt;
          else totalExpense += amt;
        });
        const balance = totalIncome - totalExpense;
        const msg = `📊 <b>Rekap Saldo Kas Saat Ini:</b>\n` +
          `───────────────────────────\n` +
          `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
          `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
          `💰 <b>Sisa Kas (Uang Riil):</b> <b>${formatRupiah(balance)}</b>\n` +
          `📑 <b>Total Transaksi:</b> ${userTxs.length} data\n` +
          `───────────────────────────\n` +
          `✅ <i>Sinkron realtime dengan Google Spreadsheet & Website.</i>`;
        await sendReply(msg);
        await answerCallback(cbId);
        return { success: true, chatId, action: 'cb_saldo' };
      }

      // 10. Tombol Rekap Kas Cepat
      if (cbData === 'cmd_rekap') {
        const userTxs = await syncAndGetUserTransactions(targetUserId, true);
        if (userTxs.length === 0) {
          await sendReply(`📭 <i>Belum ada transaksi tercatat.</i>`);
          await answerCallback(cbId);
          return { success: true, chatId, action: 'cb_rekap' };
        }
        const recent = userTxs.slice(0, 5);
        const listStr = recent.map((t: any, idx: number) => {
          const sign = t.type === 'pemasukan' ? '🟢 +' : '🔴 -';
          return `${idx + 1}. ${sign} <b>${formatRupiah(t.amount)}</b> | ${escapeHtml(t.description || t.category)}`;
        }).join('\n');
        let totalIncome = 0; let totalExpense = 0;
        userTxs.forEach((t: any) => {
          const amt = Number(t.amount) || 0;
          if (t.type === 'pemasukan') totalIncome += amt;
          else totalExpense += amt;
        });
        const balance = totalIncome - totalExpense;
        const msg = `📑 <b>5 Transaksi Terakhir:</b>\n` +
          `───────────────────────────\n` +
          `${listStr}\n` +
          `───────────────────────────\n` +
          `💰 <b>Sisa Saldo Kas:</b> <b>${formatRupiah(balance)}</b>\n` +
          `💡 <i>Ketik <b>/edit</b> jika ingin mengedit transaksi terakhir.</i>`;
        await sendReply(msg);
        await answerCallback(cbId);
        return { success: true, chatId, action: 'cb_rekap' };
      }

      // 11. Tombol Batalkan / Hapus Transaksi Terakhir Cepat
      if (cbData === 'cmd_hapus') {
        const userTxs = await syncAndGetUserTransactions(targetUserId, true);
        if (userTxs.length === 0) {
          await answerCallback(cbId, 'Tidak ada transaksi yang dapat dibatalkan.');
          return { success: true, chatId, action: 'cb_delete_none' };
        }
        const lastTx = userTxs[0];
        deleteUserTransaction(targetUserId, lastTx.id);
        userSyncCache.delete(targetUserId);

        const sysCfg = readSystemConfig();
        const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
        if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
          pushTransactionToGoogleSheet(effectiveSheetUrl, lastTx.id, 'delete', targetUserId, userCfg?.username).catch(() => {});
        }

        const newTxs = await syncAndGetUserTransactions(targetUserId, true);
        let totalIncome = 0; let totalExpense = 0;
        newTxs.forEach((t: any) => {
          const amt = Number(t.amount) || 0;
          if (t.type === 'pemasukan') totalIncome += amt;
          else totalExpense += amt;
        });
        const newBal = totalIncome - totalExpense;

        const cancelMsg = `🗑️ <b>Transaksi Berhasil Dibatalkan!</b>\n` +
          `───────────────────────────\n` +
          `Dihapus: <b>${escapeHtml(lastTx.description)}</b> (${formatRupiah(lastTx.amount)})\n` +
          `💰 <b>Sisa Saldo Kas Sekarang:</b> <b>${formatRupiah(newBal)}</b>\n` +
          `───────────────────────────\n` +
          `✅ <i>Sinkron realtime di Website & Google Spreadsheet.</i>`;
        await sendReply(cancelMsg);
        await answerCallback(cbId, 'Transaksi berhasil dibatalkan!');
        return { success: true, chatId, action: 'cb_deleted' };
      }

      // 12. Menu Edit Transaksi Interaktif
      if (cbData.startsWith('tx_edit_menu:')) {
        const txId = cbData.replace('tx_edit_menu:', '');
        const userTxs = await syncAndGetUserTransactions(targetUserId, true);
        const targetTx = userTxs.find((t: any) => t.id === txId) || userTxs[0];
        if (!targetTx) {
          await answerCallback(cbId, 'Transaksi tidak ditemukan.');
          return { success: false, chatId, action: 'tx_not_found' };
        }
        const sign = targetTx.type === 'pemasukan' ? '🟢 +' : '🔴 -';
        const editMenuMsg = `📝 <b>Menu Edit Transaksi:</b>\n` +
          `───────────────────────────\n` +
          `• ${sign} <b>${formatRupiah(targetTx.amount)}</b> | ${escapeHtml(targetTx.description)}\n` +
          `📂 Kategori: <b>${escapeHtml(targetTx.category)}</b>\n` +
          `───────────────────────────\n` +
          `Pilih data yang ingin Anda ubah:`;
        const editKb = {
          inline_keyboard: [
            [
              { text: '✏️ Ubah Nominal', callback_data: `tx_edit_amt:${targetTx.id}` },
              { text: '✏️ Ubah Keterangan', callback_data: `tx_edit_desc:${targetTx.id}` }
            ],
            [
              { text: '🏷️ Ganti Kategori', callback_data: `tx_edit_cat:${targetTx.id}` },
              { text: '🗑️ Hapus Transaksi Ini', callback_data: 'cmd_hapus' }
            ],
            [
              { text: '🔙 Selesai / Tutup', callback_data: `tx_edit_done:${targetTx.id}` }
            ]
          ]
        };
        await editReplyWithMarkup(message.message_id, editMenuMsg, editKb);
        await answerCallback(cbId);
        return { success: true, chatId, action: 'tx_edit_menu' };
      }

      // 13. Prompt Edit Nominal Transaksi
      if (cbData.startsWith('tx_edit_amt:')) {
        const txId = cbData.replace('tx_edit_amt:', '');
        userPendingTxEdit.set(chatId, { txId, userId: targetUserId, field: 'amount' });
        await sendReply(
          `✏️ <b>Ubah Nominal Transaksi:</b>\n\n` +
          `Ketikkan angka nominal yang baru di chat ini.\n` +
          `Mendukung format: <code>50000</code>, <code>50k</code>, <code>50rb</code>, atau <code>1.5jt</code>:`
        );
        await answerCallback(cbId, 'Silakan ketik nominal baru.');
        return { success: true, chatId, action: 'tx_prompt_amt' };
      }

      // 14. Prompt Edit Keterangan Transaksi
      if (cbData.startsWith('tx_edit_desc:')) {
        const txId = cbData.replace('tx_edit_desc:', '');
        userPendingTxEdit.set(chatId, { txId, userId: targetUserId, field: 'description' });
        await sendReply(
          `✏️ <b>Ubah Keterangan Transaksi:</b>\n\n` +
          `Ketikkan keterangan baru di chat ini (contoh: <code>Beli Kopi Kenangan</code>):`
        );
        await answerCallback(cbId, 'Silakan ketik keterangan baru.');
        return { success: true, chatId, action: 'tx_prompt_desc' };
      }

      // 15. Menu Ganti Kategori Transaksi
      if (cbData.startsWith('tx_edit_cat:')) {
        const txId = cbData.replace('tx_edit_cat:', '');
        const catKb = {
          inline_keyboard: [
            [
              { text: '🍽️ Makanan & Minum', callback_data: `tx_set_cat:${txId}:Makanan & Minuman` },
              { text: '🛒 Belanja & Pribadi', callback_data: `tx_set_cat:${txId}:Belanja & Pribadi` }
            ],
            [
              { text: '🚗 Transportasi', callback_data: `tx_set_cat:${txId}:Transportasi` },
              { text: '💡 Tagihan & Utilitas', callback_data: `tx_set_cat:${txId}:Tagihan & Utilitas` }
            ],
            [
              { text: '💼 Operasional Usaha', callback_data: `tx_set_cat:${txId}:Operasional Usaha` },
              { text: '📦 Pengeluaran Lain', callback_data: `tx_set_cat:${txId}:Pengeluaran Lain` }
            ],
            [
              { text: '🔙 Kembali ke Menu Edit', callback_data: `tx_edit_menu:${txId}` }
            ]
          ]
        };
        await editReplyWithMarkup(
          message.message_id,
          `📂 <b>Pilih Kategori Baru untuk Transaksi:</b>`,
          catKb
        );
        await answerCallback(cbId);
        return { success: true, chatId, action: 'tx_cat_menu' };
      }

      // 16. Tetapkan Kategori Baru Transaksi
      if (cbData.startsWith('tx_set_cat:')) {
        const parts = cbData.split(':');
        const txId = parts[1];
        const newCat = parts.slice(2).join(':') || 'Belanja & Pribadi';
        const userTxs = await syncAndGetUserTransactions(targetUserId, true);
        const targetTx = userTxs.find((t: any) => t.id === txId);
        if (targetTx) {
          targetTx.category = newCat;
          editUserTransaction(targetUserId, targetTx);
          userSyncCache.delete(targetUserId);

          const sysCfg = readSystemConfig();
          const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
          if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
            pushTransactionToGoogleSheet(effectiveSheetUrl, targetTx, 'edit', targetUserId, targetTx.username).catch(() => {});
          }

          await answerCallback(cbId, `Kategori diubah: ${newCat}`);
          await sendReply(
            `✅ <b>Kategori transaksi berhasil diubah menjadi "${escapeHtml(newCat)}"!</b>\n` +
            `<i>Tersimpan realtime di Website & Google Spreadsheet.</i>`
          );
        } else {
          await answerCallback(cbId, 'Transaksi tidak ditemukan.');
        }
        return { success: true, chatId, action: 'tx_cat_set' };
      }

      // 17. Selesai Edit
      if (cbData.startsWith('tx_edit_done:')) {
        userPendingTxEdit.delete(chatId);
        await editReplyWithMarkup(
          message.message_id,
          `✅ <i>Edit transaksi selesai. Seluruh data telah diperbarui di Website & Google Spreadsheet.</i>`,
          { inline_keyboard: [] }
        );
        await answerCallback(cbId, 'Selesai.');
        return { success: true, chatId, action: 'tx_edit_done' };
      }

      await answerCallback(cbId);
      return { success: true, chatId, action: 'callback_unhandled' };
    }

    // ========================================================================
    // DETEKSI FOTO / STRUK BELANJA DARI TELEGRAM (AI VISION & OCR DUAL ENGINE)
    // ========================================================================
    let mediaFileId = '';
    let mediaMimeType = 'image/jpeg';
    let isReceiptMedia = false;

    if (Array.isArray(message.photo) && message.photo.length > 0) {
      // Pilih resolusi optimal: jika ada multi-ukuran, pilih resolusi sedang-tinggi (~800-1400px)
      // agar unduhan & OCR berlangsung super cepat tanpa membebani memori
      let chosen = message.photo[message.photo.length - 1];
      if (message.photo.length >= 3) {
        const mediumHigh = message.photo[message.photo.length - 2];
        if (mediumHigh && (mediumHigh.width || 0) >= 700) {
          chosen = mediumHigh;
        }
      }
      mediaFileId = chosen.file_id;
      isReceiptMedia = true;
    } else if (message.photo && typeof message.photo === 'object' && (message.photo as any).file_id) {
      mediaFileId = (message.photo as any).file_id;
      isReceiptMedia = true;
    } else if (message.document && message.document.file_id) {
      mediaFileId = message.document.file_id;
      mediaMimeType = message.document.mime_type || 'image/jpeg';
      isReceiptMedia = true;
    }

    if (isReceiptMedia && mediaFileId) {
      console.log(`[Telegram] Incoming receipt image from chat ${chatId} (fileId: ${mediaFileId})`);
      await sendChatAction('upload_photo');
      const loadingMsgId = await sendReply(
        `⏳ <b>Membaca Struk Belanja...</b>\n` +
        `<code>[■■□□□□□□□□] 25%</code> Mengunduh foto dari server Telegram...`
      );

      try {
        // 1. Ambil info file dari server Telegram
        const fileRes = await fetch(`https://api.telegram.org/bot${activeToken}/getFile?file_id=${mediaFileId}`);
        const fileData: any = await fileRes.json();

        if (!fileData.ok || !fileData.result?.file_path) {
          const failDl = `⚠️ <i>Gagal mengunduh file foto dari server Telegram. Silakan coba kirim ulang foto struk Anda.</i>`;
          if (loadingMsgId) await editReply(loadingMsgId, failDl);
          else await sendReply(failDl);
          return { success: false, chatId, action: 'photo_download_failed' };
        }

        const filePath = fileData.result.file_path;
        const downloadUrl = `https://api.telegram.org/file/bot${activeToken}/${filePath}`;
        const imgResp = await fetch(downloadUrl);
        const arrayBuf = await imgResp.arrayBuffer();
        const imgBuffer = Buffer.from(arrayBuf);

        // Update progress loading ke Telegram: Foto terunduh, memulai OCR lokal
        if (loadingMsgId) {
          await editReply(
            loadingMsgId,
            `⏳ <b>Membaca Struk Belanja...</b>\n` +
            `<code>[■■■■■■□□□□] 65%</code> Memindai teks kasir, item & total belanja...`
          );
        }
        await sendChatAction('typing');

        // Ekstraksi transaksi struk menggunakan Mesin OCR Offline Lokal (Cepat & Tanpa Limit)
        const analysis = await analyzeReceiptImage(imgBuffer, mediaMimeType, message.caption || message.text);

        // Evaluasi hasil OCR lokal offline
        const hasDetectedAmount = Boolean(analysis.success && analysis.amount && analysis.amount > 0);
        const initialAmount = hasDetectedAmount ? (analysis.amount || 0) : 0;

        // Update progress loading: OCR berhasil 100%, menyiapkan pratinjau interaktif
        if (loadingMsgId) {
          await editReply(
            loadingMsgId,
            `⏳ <b>Membaca Struk Belanja (Offline OCR)...</b>\n` +
            `<code>[■■■■■■■■■■] 100%</code> Pemindaian selesai! Menyiapkan pratinjau...`
          );
        }

        const targetUserObj = allUsers.find(u => u.id === targetUserId);
        const resolvedUsername = targetUserObj?.username || targetUserObj?.name || fromUser.username || fromUser.first_name || 'Telegram User';

        const txDesc = analysis.description || analysis.storeName || 'Struk Belanja';
        const txCat = analysis.category || 'Belanja & Pribadi';
        const txType = analysis.type || 'pengeluaran';

        // Buat draf struk aktif untuk pratinjau & interaksi edit sebelum disimpan
        const draftId = `dr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const draft: TelegramDraftReceipt = {
          id: draftId,
          chatId,
          userId: targetUserId,
          amount: initialAmount,
          description: txDesc,
          category: txCat,
          type: txType,
          storeName: analysis.storeName,
          subtotal: analysis.subtotal,
          tax: analysis.tax,
          tender: analysis.tender,
          change: analysis.change,
          items: analysis.items,
          username: resolvedUsername,
          waitingFor: hasDetectedAmount ? null : 'amount',
          createdAt: Date.now()
        };

        activeDraftReceipts.set(draftId, draft);
        userPendingDraftReceipt.set(chatId, draftId);

        let previewMsg = formatReceiptPreviewMessage(draft);
        if (!hasDetectedAmount) {
          previewMsg += `\n\n👉 <b>Nominal belum terbaca otomatis:</b>\n` +
            `Silakan langsung ketik angka total belanja di chat ini (contoh: <code>45000</code> atau <code>45k</code>) atau klik <b>✏️ Ubah Nominal</b> di bawah agar tersimpan ke catatan kas.`;
        }
        const keyboard = getReceiptPreviewKeyboard(draftId, initialAmount);

        // Tampilkan kartu pratinjau interaktif di pesan Telegram
        if (loadingMsgId) {
          const edited = await editReplyWithMarkup(loadingMsgId, previewMsg, keyboard);
          if (edited) {
            draft.previewMessageId = loadingMsgId;
          } else {
            const newMsgId = await sendReplyWithMarkup(previewMsg, keyboard);
            draft.previewMessageId = newMsgId || undefined;
          }
        } else {
          const newMsgId = await sendReplyWithMarkup(previewMsg, keyboard);
          draft.previewMessageId = newMsgId || undefined;
        }

        return { success: true, chatId, action: 'ocr_preview_sent' };

      } catch (err: any) {
        console.error('[Telegram] Error processing photo OCR:', err);
        const errTxt = `⚠️ <i>Terjadi kesalahan saat memproses foto: ${escapeHtml(err.message || 'Error internal')}</i>`;
        if (loadingMsgId) await editReply(loadingMsgId, errTxt);
        else await sendReply(errTxt);
        return { success: false, chatId, action: 'ocr_error' };
      }
    }

    // ========================================================================
    // PENANGANAN INPUT EDIT DRAF STRUK DARI PESAN CHAT PENGGUNA
    // ========================================================================
    const pendingDraftId = userPendingDraftReceipt.get(chatId);
    if (pendingDraftId && activeDraftReceipts.has(pendingDraftId)) {
      const draft = activeDraftReceipts.get(pendingDraftId)!;

      // 1. Pengguna sedang mengetik nominal baru pengganti
      if (draft.waitingFor === 'amount') {
        const parsedAmt = parseSimpleAmount(text);
        if (parsedAmt && parsedAmt > 0) {
          draft.amount = parsedAmt;
          draft.waitingFor = null;

          // Perbarui kartu pratinjau utama di pesan Telegram secara instan & pertahankan seluruh menu tombol
          if (draft.previewMessageId) {
            await editReplyWithMarkup(
              draft.previewMessageId,
              formatReceiptPreviewMessage(draft),
              getReceiptPreviewKeyboard(draft.id)
            );
          }

          await sendReply(
            `✅ <b>Nominal berhasil diperbarui menjadi ${formatRupiah(parsedAmt)}!</b>\n` +
            `<i>Periksa kartu pratinjau di atas, lalu klik <b>💾 Simpan ke Catatan</b> jika sudah sesuai.</i>`
          );

          return { success: true, chatId, action: 'draft_amount_updated' };
        } else {
          await sendReply(
            `⚠️ <i>Format nominal belum tepat. Masukkan angka nominal yang benar.\nContoh: <code>185000</code>, <code>185k</code>, <code>185rb</code>, atau <code>181.475</code></i>`
          );
          return { success: false, chatId, action: 'draft_amount_invalid' };
        }
      }

      // 2. Pengguna sedang mengetik nama toko / keterangan baru pengganti
      if (draft.waitingFor === 'description') {
        if (text && text.trim().length > 0) {
          const newDesc = text.trim();
          draft.description = newDesc;
          draft.storeName = newDesc;
          draft.waitingFor = null;

          // Perbarui kartu pratinjau utama di pesan Telegram secara instan & pertahankan seluruh menu tombol
          if (draft.previewMessageId) {
            await editReplyWithMarkup(
              draft.previewMessageId,
              formatReceiptPreviewMessage(draft),
              getReceiptPreviewKeyboard(draft.id)
            );
          }

          await sendReply(
            `✅ <b>Toko / Keterangan berhasil diperbarui menjadi "${escapeHtml(newDesc)}"!</b>\n` +
            `<i>Periksa kartu pratinjau di atas, lalu klik <b>💾 Simpan ke Catatan</b> jika sudah sesuai.</i>`
          );

          return { success: true, chatId, action: 'draft_desc_updated' };
        }
      }
    }

    // ========================================================================
    // PENANGANAN INPUT EDIT TRANSAKSI TERSIMPAN (NOMINAL & KETERANGAN)
    // ========================================================================
    const pendingTxEdit = userPendingTxEdit.get(chatId);
    if (pendingTxEdit) {
      const userTxs = await syncAndGetUserTransactions(pendingTxEdit.userId, true);
      const targetTx = userTxs.find((t: any) => t.id === pendingTxEdit.txId);
      if (!targetTx) {
        userPendingTxEdit.delete(chatId);
        await sendReply(`⚠️ <i>Transaksi tidak ditemukan atau sudah dihapus sebelumnya.</i>`);
        return { success: false, chatId, action: 'tx_edit_not_found' };
      }

      if (pendingTxEdit.field === 'amount') {
        const parsedAmt = parseSimpleAmount(text);
        if (parsedAmt && parsedAmt > 0) {
          targetTx.amount = parsedAmt;
          editUserTransaction(pendingTxEdit.userId, targetTx);
          userSyncCache.delete(pendingTxEdit.userId);

          const sysCfg = readSystemConfig();
          const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
          if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
            pushTransactionToGoogleSheet(effectiveSheetUrl, targetTx, 'edit', pendingTxEdit.userId, targetTx.username).catch(() => {});
          }

          userPendingTxEdit.delete(chatId);

          const updatedTxs = await syncAndGetUserTransactions(pendingTxEdit.userId, true);
          let totalInc = 0; let totalExp = 0;
          updatedTxs.forEach((t: any) => {
            const a = Number(t.amount) || 0;
            if (t.type === 'pemasukan') totalInc += a;
            else totalExp += a;
          });
          const newBal = totalInc - totalExp;

          await sendReply(
            `✅ <b>Nominal Transaksi Berhasil Diperbarui!</b>\n` +
            `───────────────────────────\n` +
            `📝 <b>Keterangan:</b> ${escapeHtml(targetTx.description)}\n` +
            `💵 <b>Nominal Baru:</b> <b>${formatRupiah(parsedAmt)}</b>\n` +
            `💰 <b>Sisa Kas Riil:</b> <b>${formatRupiah(newBal)}</b>\n` +
            `───────────────────────────\n` +
            `✅ <i>Sinkron otomatis di Website & Google Spreadsheet.</i>`
          );
          return { success: true, chatId, action: 'tx_amount_updated' };
        } else {
          await sendReply(
            `⚠️ <i>Format nominal belum tepat. Masukkan angka nominal yang benar.\nContoh: <code>50000</code>, <code>50k</code>, atau <code>50rb</code></i>`
          );
          return { success: false, chatId, action: 'tx_amount_invalid' };
        }
      }

      if (pendingTxEdit.field === 'description') {
        if (text && text.trim().length > 0) {
          targetTx.description = text.trim();
          editUserTransaction(pendingTxEdit.userId, targetTx);
          userSyncCache.delete(pendingTxEdit.userId);

          const sysCfg = readSystemConfig();
          const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
          if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
            pushTransactionToGoogleSheet(effectiveSheetUrl, targetTx, 'edit', pendingTxEdit.userId, targetTx.username).catch(() => {});
          }

          userPendingTxEdit.delete(chatId);

          await sendReply(
            `✅ <b>Keterangan Transaksi Berhasil Diperbarui!</b>\n` +
            `───────────────────────────\n` +
            `📝 <b>Keterangan Baru:</b> "${escapeHtml(targetTx.description)}"\n` +
            `💵 <b>Nominal:</b> ${formatRupiah(targetTx.amount)}\n` +
            `───────────────────────────\n` +
            `✅ <i>Sinkron otomatis di Website & Google Spreadsheet.</i>`
          );
          return { success: true, chatId, action: 'tx_desc_updated' };
        }
      }
    }

    const cleanLower = text.toLowerCase();

    // A. Perintah /start atau bantuan atau help
    if (cleanLower.startsWith('/start') || cleanLower === 'help' || cleanLower === 'bantuan' || cleanLower === '/help') {
      const senderName = fromUser.first_name || 'Kak';
      // Ambil transaksi user saat ini agar saldo terkini langsung tampil
      let userTxs: any[] = [];
      let totalIncome = 0;
      let totalExpense = 0;
      try {
        userTxs = await syncAndGetUserTransactions(targetUserId, true);
        userTxs.forEach((t: any) => {
          const amt = Number(t.amount) || 0;
          if (t.type === 'pemasukan') totalIncome += amt;
          else totalExpense += amt;
        });
      } catch (txErr) {}
      const balance = totalIncome - totalExpense;

      const welcome = `👋 <b>Halo, ${escapeHtml(senderName)}!</b>\n\n` +
        `Selamat datang di <b>FahKeu - Catat Keuangan Cerdas</b> 🤖\n` +
        `Bot Telegram Anda telah <b>terhubung 100% secara realtime</b> ke Website & Google Spreadsheet!\n\n` +
        `🆔 <b>Chat ID Anda:</b> <code>${chatId}</code>\n` +
        `💰 <b>Saldo Kas Saat Ini:</b> <b>${formatRupiah(balance)}</b> (${userTxs.length} transaksi)\n\n` +
        `<b>🧾 Scan Struk / Nota Otomatis:</b>\n` +
        `Kirim <b>foto struk belanja, nota, atau bon</b> langsung ke chat ini! Sistem AI Vision akan membaca nama toko, rincian barang, dan total nominal secara otomatis.\n\n` +
        `<b>📝 Cara Mencatat Transaksi Teks:</b>\n` +
        `Ketik langsung di chat ini, contoh:\n` +
        `• <code>beli cimol 3k</code> (Pengeluaran)\n` +
        `• <code>kopi kenangan 18rb</code> (Pengeluaran)\n` +
        `• <code>makan soto 25k</code> (Pengeluaran)\n` +
        `• <code>bensin motor 25.000</code> (Pengeluaran)\n` +
        `• <code>gaji bulanan 5jt</code> (Pemasukan)\n` +
        `• <code>terima freelance 1.5jt</code> (Pemasukan)\n\n` +
        `<b>📊 Perintah Pintar:</b>\n` +
        `• <b>/saldo</b> - Cek sisa saldo kas saat ini\n` +
        `• <b>/rekap</b> - Lihat 5 transaksi terakhir\n` +
        `• <b>/edit</b> - Edit nominal atau keterangan transaksi terakhir\n` +
        `• <b>/hapus</b> - Batalkan transaksi yang baru dicatat\n` +
        `• <b>/bantuan</b> - Menampilkan panduan ini\n\n` +
        `<i>✨ Setiap transaksi langsung tercatat secara realtime di Website & Google Spreadsheet Anda!</i>`;
      await sendReply(welcome);
      return { success: true, chatId, action: 'start' };
    }

    // A2. Perintah Cek Chat ID (/id atau /chatid)
    if (cleanLower === '/id' || cleanLower === '/chatid' || cleanLower === 'id' || cleanLower === 'chat id' || cleanLower === 'chatid') {
      const idMsg = `🆔 <b>Informasi Telegram Chat ID Anda:</b>\n` +
        `───────────────────────────\n` +
        `Chat ID: <code>${chatId}</code>\n` +
        `Nama: <b>${escapeHtml(fromUser.first_name || 'Pengguna')}</b>\n` +
        (fromUser.username ? `Username: @${escapeHtml(fromUser.username)}\n` : '') +
        `───────────────────────────\n` +
        `✅ <i>Chat ID ini telah otomatis tersimpan & terhubung ke Website & Google Spreadsheet Anda.</i>\n\n` +
        `💡 <i>Jika diminta mengisi di Website, Anda cukup salin angka di atas: <code>${chatId}</code></i>`;
      await sendReply(idMsg);
      return { success: true, chatId, action: 'chatid' };
    }

    // A3. Perintah Panduan & Pengaturan Scan Struk (/struk atau /nota)
    if (cleanLower === '/struk' || cleanLower === '/nota' || cleanLower === 'struk' || cleanLower === 'nota') {
      const strukGuide = `🧾 <b>Panduan & Fitur Kirim Struk Belanja:</b>\n` +
        `───────────────────────────\n` +
        `Anda bisa mengirim <b>foto struk / nota belanja / bon</b> langsung ke chat bot ini!\n\n` +
        `<b>Fitur Pratinjau & Edit Sebelum Simpan:</b>\n` +
        `Saat foto struk dikirim, bot otomatis menganalisis teks kasir lalu menampilkan kartu pratinjau dengan menu:\n` +
        `• <b>💾 Simpan ke Catatan</b>: Menyimpan transaksi ke web & spreadsheet\n` +
        `• <b>✏️ Ubah Nominal</b>: Jika total nominal yang terdeteksi ingin dikoreksi\n` +
        `• <b>✏️ Ubah Toko/Ket</b>: Untuk mengubah nama toko atau keterangan\n` +
        `• <b>🏷️ Ganti Kategori</b>: Pilih dari 6 kategori yang tersedia\n` +
        `• <b>🔄 Ganti Jenis</b>: Beralih Pengeluaran atau Pemasukan\n` +
        `• <b>❌ Batal</b>: Membatalkan pencatatan struk\n\n` +
        `💡 <i>Tips Foto: Pastikan foto terang, tulisan kasir tegak, dan nominal total belanja terlihat jelas. Anda juga bisa menambahkan caption nominal saat mengirim foto (contoh: <code>indomaret 45k</code>).</i>`;
      await sendReply(strukGuide);
      return { success: true, chatId, action: 'struk_guide' };
    }

    // B. Perintah Cek Saldo
    if (cleanLower === 'saldo' || cleanLower === 'cek saldo' || cleanLower === 'sisa saldo' || cleanLower.startsWith('/saldo')) {
      await sendChatAction('typing');
      // SELALU ambil data mutakhir langsung dari Google Spreadsheet & Website (forceSync: true, NO CACHE)
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      if (userTxs.length === 0) {
        const zeroMsg = `📊 <b>Rekap Saldo Kas:</b>\n` +
          `───────────────────────────\n` +
          `📥 <b>Total Pemasukan:</b> Rp 0\n` +
          `📤 <b>Total Pengeluaran:</b> Rp 0\n` +
          `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>Rp 0</b>\n` +
          `📑 <b>Total Transaksi:</b> 0 data tercatat (Mulai dari Nol)\n` +
          `───────────────────────────\n` +
          `✅ <i>Data kas bersih. Siap mencatat transaksi baru melalui Bot Telegram, Website, atau Google Spreadsheet!</i>`;
        await sendReply(zeroMsg);
        return { success: true, chatId, action: 'saldo' };
      }

      let totalIncome = 0;
      let totalExpense = 0;
      userTxs.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'pemasukan') totalIncome += amt;
        else totalExpense += amt;
      });
      const balance = totalIncome - totalExpense;

      let balanceNotice = '';
      if (totalIncome === 0 && totalExpense > 0) {
        balanceNotice = `\n💡 <i>Catatan: Belum ada pemasukan/saldo awal tercatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar sisa uang riil Anda terhitung positif.</i>\n`;
      } else if (balance < 0) {
        balanceNotice = `\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit ${formatRupiah(Math.abs(balance))}). Catat pemasukan dengan mengetik misal: <code>gaji 2jt</code></i>\n`;
      }

      const balanceMsg = `📊 <b>Rekap Saldo Kas:</b>\n` +
        `───────────────────────────\n` +
        `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
        `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
        `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>${formatRupiah(balance)}</b>\n` +
        `📑 <b>Total Transaksi:</b> ${userTxs.length} data tercatat\n` +
        balanceNotice +
        `───────────────────────────\n` +
        `<i>Sinkron otomatis realtime dengan Website & Google Spreadsheet.</i>`;
      await sendReply(balanceMsg);
      return { success: true, chatId, action: 'saldo' };
    }

    // C. Perintah Rekap Transaksi Terakhir
    if (cleanLower === 'rekap' || cleanLower === 'laporan' || cleanLower.startsWith('/rekap')) {
      await sendChatAction('typing');
      // SELALU ambil data mutakhir langsung dari Google Spreadsheet & Website (forceSync: true, NO CACHE)
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      if (userTxs.length === 0) {
        await sendReply(`📭 <i>Belum ada transaksi tercatat. Coba ketik: <code>beli cimol 3k</code> atau <code>gaji 5jt</code></i>`);
        return { success: true, chatId, action: 'rekap' };
      }

      const recent = userTxs.slice(0, 5);
      let listStr = recent.map((t: any, idx: number) => {
        const sign = t.type === 'pemasukan' ? '🟢 +' : '🔴 -';
        return `${idx + 1}. ${sign} <b>${formatRupiah(t.amount)}</b> | ${escapeHtml(t.description || t.category)}`;
      }).join('\n');

      let totalIncome = 0;
      let totalExpense = 0;
      userTxs.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'pemasukan') totalIncome += amt;
        else totalExpense += amt;
      });
      const balance = totalIncome - totalExpense;

      const rekapMsg = `📑 <b>5 Transaksi Terakhir:</b>\n` +
        `───────────────────────────\n` +
        `${listStr}\n` +
        `───────────────────────────\n` +
        `📊 <b>Rekap Saldo Kas:</b>\n` +
        `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
        `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
        `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>${formatRupiah(balance)}</b>\n\n` +
        `💡 <i>Ketik <b>/saldo</b> untuk cek ringkasan saldo kas.</i>`;
      await sendReply(rekapMsg);
      return { success: true, chatId, action: 'rekap' };
    }

    // D. Perintah Batalkan / Hapus Transaksi Terakhir
    if (cleanLower === 'batal' || cleanLower === 'hapus' || cleanLower.startsWith('/hapus') || cleanLower === 'undo') {
      await sendChatAction('typing');
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      if (userTxs.length === 0) {
        await sendReply(`⚠️ Tidak ada transaksi yang dapat dibatalkan.`);
        return { success: true, chatId, action: 'delete_none' };
      }

      const lastTx = userTxs[0];
      deleteUserTransaction(targetUserId, lastTx.id);
      userSyncCache.delete(targetUserId);

      // Teruskan penghapusan ke Google Spreadsheet secara asinkron jika terhubung
      const sysCfg = readSystemConfig();
      const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
      if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
        fetch(effectiveSheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete',
            id: lastTx.id,
            userId: targetUserId
          }),
          signal: AbortSignal.timeout(10000)
        }).catch(() => {});
      }

      // Hitung saldo baru via sinkronisasi realtime
      const newTxs = await syncAndGetUserTransactions(targetUserId, true);
      let totalIncome = 0;
      let totalExpense = 0;
      newTxs.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'pemasukan') totalIncome += amt;
        else totalExpense += amt;
      });
      const newBal = totalIncome - totalExpense;

      const cancelMsg = `🗑️ <b>Transaksi Berhasil Dibatalkan!</b>\n` +
        `───────────────────────────\n` +
        `Dihapus: <b>${escapeHtml(lastTx.description)}</b> (${formatRupiah(lastTx.amount)})\n` +
        `───────────────────────────\n` +
        `📊 <b>Rekap Saldo Kas:</b>\n` +
        `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
        `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
        `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>${formatRupiah(newBal)}</b>\n` +
        `───────────────────────────\n` +
        `✅ <i>Sinkron otomatis di Website & Google Spreadsheet.</i>`;
      await sendReply(cancelMsg);
      return { success: true, chatId, action: 'deleted' };
    }

    // D2. Perintah Reset / Kosongkan Semua Transaksi ke Rp 0 (Bot, Website, Spreadsheet Nol Bersih)
    if (
      cleanLower === '/reset' ||
      cleanLower === '/kosongkan' ||
      cleanLower === '/cleartx' ||
      cleanLower === 'reset' ||
      cleanLower === 'reset saldo' ||
      cleanLower === 'kosongkan saldo' ||
      cleanLower === 'hapus semua' ||
      cleanLower === 'reset data'
    ) {
      await sendChatAction('typing');
      clearUserTransactions(targetUserId);
      userSyncCache.delete(targetUserId);
      userLastClearedAt.set(targetUserId, Date.now());

      // Teruskan pembersihan bersih ke Google Spreadsheet secara realtime
      const sysCfg = readSystemConfig();
      const effectiveSheetUrl = (userCfg.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
      if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http') && !effectiveSheetUrl.includes('AKfycby') && !effectiveSheetUrl.includes('AKfycbwPLC')) {
        await pushTransactionToGoogleSheet(effectiveSheetUrl, null, 'clear', targetUserId, userCfg?.username);
      }

      const resetMsg = `🗑️ <b>Seluruh data transaksi telah dikosongkan!</b>\n` +
        `───────────────────────────\n` +
        `💰 <b>Sisa Saldo Kas:</b> <b>Rp 0</b>\n` +
        `📥 <b>Total Pemasukan:</b> Rp 0\n` +
        `📤 <b>Total Pengeluaran:</b> Rp 0\n` +
        `───────────────────────────\n` +
        `✅ <i>Data di Website & Google Spreadsheet Anda juga telah disetel ulang menjadi nol bersih. Bot Telegram siap mencatat transaksi baru mulai dari nol!</i>`;
      await sendReply(resetMsg);
      return { success: true, chatId, action: 'reset_all' };
    }

    // D3. Perintah Edit Transaksi Terakhir (/edit atau /ubah)
    if (cleanLower === 'edit' || cleanLower === 'ubah' || cleanLower.startsWith('/edit') || cleanLower.startsWith('/ubah')) {
      await sendChatAction('typing');
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      if (userTxs.length === 0) {
        await sendReply(`⚠️ <i>Belum ada transaksi yang dapat diedit. Coba catat transaksi terlebih dahulu.</i>`);
        return { success: true, chatId, action: 'edit_none' };
      }

      const lastTx = userTxs[0];
      const sign = lastTx.type === 'pemasukan' ? '🟢 +' : '🔴 -';
      const editMsg = `📝 <b>Menu Edit Transaksi Terakhir:</b>\n` +
        `───────────────────────────\n` +
        `• ${sign} <b>${formatRupiah(lastTx.amount)}</b> | ${escapeHtml(lastTx.description)}\n` +
        `📂 Kategori: <b>${escapeHtml(lastTx.category)}</b>\n` +
        `───────────────────────────\n` +
        `Pilih bagian data yang ingin Anda ubah:`;

      const editKeyboard = {
        inline_keyboard: [
          [
            { text: '✏️ Ubah Nominal', callback_data: `tx_edit_amt:${lastTx.id}` },
            { text: '✏️ Ubah Keterangan', callback_data: `tx_edit_desc:${lastTx.id}` }
          ],
          [
            { text: '🏷️ Ganti Kategori', callback_data: `tx_edit_cat:${lastTx.id}` },
            { text: '🗑️ Hapus Transaksi Ini', callback_data: 'cmd_hapus' }
          ],
          [
            { text: '🔙 Selesai / Tutup', callback_data: `tx_edit_done:${lastTx.id}` }
          ]
        ]
      };

      await sendReplyWithMarkup(editMsg, editKeyboard);
      return { success: true, chatId, action: 'edit_prompt' };
    }

    // E. Deteksi Pertanyaan Saldo Kas Santai / Variasi Cek Saldo
    const balanceKeywords = ['saldo', 'sisa saldo', 'sisa uang', 'uang saya', 'cek duit', 'duit saya', 'berapa uang', 'berapa saldo', 'kas sekarang', 'uang kas', 'saldo kas', 'total kas', 'sisa kas'];
    if (balanceKeywords.some(bk => cleanLower === bk || cleanLower.includes(bk))) {
      await sendChatAction('typing');
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      if (userTxs.length === 0) {
        const zeroMsg = `📊 <b>Informasi Saldo Kas Anda:</b>\n` +
          `───────────────────────────\n` +
          `📥 <b>Total Pemasukan:</b> Rp 0\n` +
          `📤 <b>Total Pengeluaran:</b> Rp 0\n` +
          `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>Rp 0</b>\n` +
          `📑 <b>Total Transaksi:</b> 0 data tercatat (Mulai dari Nol)\n` +
          `───────────────────────────\n` +
          `✅ <i>Data kas bersih. Siap mencatat transaksi baru melalui Bot Telegram, Website, atau Google Spreadsheet!</i>`;
        await sendReply(zeroMsg);
        return { success: true, chatId, action: 'saldo_zero' };
      }

      let totalIncome = 0;
      let totalExpense = 0;
      userTxs.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'pemasukan') totalIncome += amt;
        else totalExpense += amt;
      });
      const balance = totalIncome - totalExpense;

      const balanceMsg = `📊 <b>Informasi Saldo Kas Anda:</b>\n` +
        `───────────────────────────\n` +
        `📥 <b>Total Pemasukan:</b> ${formatRupiah(totalIncome)}\n` +
        `📤 <b>Total Pengeluaran:</b> ${formatRupiah(totalExpense)}\n` +
        `💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>${formatRupiah(balance)}</b>\n` +
        `📑 <b>Total Transaksi:</b> ${userTxs.length} data tercatat\n` +
        `───────────────────────────\n` +
        `✅ <i>Sinkron 100% realtime dengan Website & Google Spreadsheet.</i>`;
      await sendReply(balanceMsg);
      return { success: true, chatId, action: 'saldo_inquiry' };
    }

    // F. Deteksi Sapaan Santai
    const greetingWords = ['halo', 'hai', 'hi', 'assalamualaikum', 'pagi', 'siang', 'sore', 'malam', 'tes', 'ping', 'p'];
    if (greetingWords.includes(cleanLower) || greetingWords.some(gw => cleanLower.startsWith(gw + ' '))) {
      const userTxs = await syncAndGetUserTransactions(targetUserId, true);
      let totalIncome = 0;
      let totalExpense = 0;
      userTxs.forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'pemasukan') totalIncome += amt;
        else totalExpense += amt;
      });
      const currentBal = totalIncome - totalExpense;

      const greetMsg = `👋 <b>Halo, ${escapeHtml(fromUser.first_name || 'Kak')}!</b>\n\n` +
        `💰 <b>Saldo Kas Saat Ini:</b> <b>${formatRupiah(currentBal)}</b>\n\n` +
        `Bot FahKeu siap mencatat keuangan Anda secara realtime ke Website & Google Spreadsheet:\n\n` +
        `📝 <b>Cara Catat Transaksi Cepat:</b>\n` +
        `• <code>beli makan siang 25k</code> (Pengeluaran)\n` +
        `• <code>kopi 18rb</code> (Pengeluaran)\n` +
        `• <code>gaji 5jt</code> (Pemasukan)\n` +
        `• <code>saldo awal 1jt</code> (Pemasukan)\n\n` +
        `🧾 <b>Scan Struk:</b> Kirim langsung <b>foto struk / nota</b> ke chat ini untuk pencatatan otomatis!`;
      await sendReply(greetMsg);
      return { success: true, chatId, action: 'greeting' };
    }

    // G. Parsing Transaksi Natural Language (contoh: "beli cimol 3k", "kopi 15rb", "gaji 5jt")
    const parsed = parseTransactionText(text);

    if (!parsed.success) {
      const hintMsg = `⚠️ <b>Pesan belum dapat dipahami sebagai transaksi.</b>\n\n` +
        `💡 <i>Pastikan menyertakan keterangan dan nominal transaksi, contoh:</i>\n` +
        `• <code>beli cimol 3k</code> (Pengeluaran)\n` +
        `• <code>makan bakso 25rb</code> (Pengeluaran)\n` +
        `• <code>kopi 18k</code> (Pengeluaran)\n` +
        `• <code>bensin 25.000</code> (Pengeluaran)\n` +
        `• <code>gaji masuk 5jt</code> (Pemasukan)\n` +
        `• Atau kirim <b>foto struk / nota</b> untuk pencatatan otomatis 🧾\n\n` +
        `Ketik <b>/saldo</b> untuk cek sisa uang atau <b>/bantuan</b> untuk panduan.`;
      await sendReply(hintMsg);
      return { success: false, chatId, action: 'unparsed' };
    }

    // 0. Mulai pengukuran stopwatch realtime & kirim feedback loading instan ke chat bot
    const txStartTime = Date.now();
    await sendChatAction('typing');

    const loadingMsgId = await sendReply(
      `⏳ <b>Mencatat Transaksi...</b>\n` +
      `🧾 <i>Memverifikasi format & menyiapkan struk realtime...</i>`
    );

    // 1. Buat objek transaksi baru
    const targetUserObj = allUsers.find(u => u.id === targetUserId);
    const resolvedUsername = targetUserObj?.username || targetUserObj?.name || fromUser.username || fromUser.first_name || 'Telegram User';

    const newTx = {
      id: `tg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: new Date().toISOString(),
      type: parsed.type,
      amount: parsed.amount,
      description: parsed.description,
      category: parsed.category,
      source: 'telegram',
      rawText: text,
      userId: targetUserId,
      username: resolvedUsername
    };

    // 2. Ambil data mutakhir yang sah dari Google Spreadsheet & Website sebelum menambah transaksi
    const priorTxs = await syncAndGetUserTransactions(targetUserId, true);
    let priorIncome = 0;
    let priorExpense = 0;
    priorTxs.forEach((t: any) => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'pemasukan') priorIncome += amt;
      else priorExpense += amt;
    });

    // 3. Simpan transaksi ke database internal server & hapus cache
    saveUserTransaction(targetUserId, newTx);
    userSyncCache.delete(targetUserId);

    // 4. Simpan langsung ke Google Spreadsheet secara realtime dengan fallback tangguh
    const sysCfg = readSystemConfig();
    let effectiveSheetUrl = (userCfg?.googleSheetUrl || sysCfg.globalGoogleSheetUrl || '').trim();
    if (effectiveSheetUrl.includes('AKfycby') || effectiveSheetUrl.includes('AKfycbwPLC')) {
      effectiveSheetUrl = '';
    }
    let sheetSynced = false;

    if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
      const pushRes = await pushTransactionToGoogleSheet(
        effectiveSheetUrl,
        newTx,
        'add',
        targetUserId,
        newTx.username
      );
      if (pushRes.success) {
        sheetSynced = true;
      }
    }

    // 5. Hitung total saldo kas mutakhir secara presisi dari spreadsheet & mutasi baru
    const isIncome = parsed.type === 'pemasukan';
    const totalIncome = priorIncome + (isIncome ? parsed.amount : 0);
    const totalExpense = priorExpense + (!isIncome ? parsed.amount : 0);
    const newBalance = totalIncome - totalExpense;

    // 6. Hitung durasi proses per detik & format waktu presisi per detik (WIB)
    const elapsedMs = Math.max(1, Date.now() - txStartTime);
    const elapsedSec = (elapsedMs / 1000).toFixed(2);

    const nowWib = new Date();
    const dateWibStr = nowWib.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const timeWibStr = nowWib.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    const exactSecondWib = `${dateWibStr} ${timeWibStr} WIB`;

    const amountFormatted = (isIncome ? '+ ' : '- ') + formatRupiah(parsed.amount);
    const typeLabel = isIncome ? '🟢 Pemasukan' : '🔴 Pengeluaran';
    let syncNote = '';
    if (sheetSynced) {
      syncNote = '✅ <i>Tersimpan realtime di Google Spreadsheet & Website!</i>';
    } else if (effectiveSheetUrl && effectiveSheetUrl.startsWith('http')) {
      syncNote = '✅ <i>Tersimpan di Website & Database Server!</i>\n⚠️ <i>(Gagal menulis ke Spreadsheet: periksa izin Web App disetel ke Anyone/Siapa saja)</i>';
    } else {
      syncNote = '✅ <i>Tersimpan realtime di Website & Server!</i>';
    }

    let balanceNotice = '';
    if (totalIncome === 0 && totalExpense > 0) {
      balanceNotice = `\n💡 <i>Catatan: Belum ada pemasukan/saldo awal. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 2jt</code> agar sisa kas riil bernilai positif.</i>`;
    } else if (newBalance < 0) {
      balanceNotice = `\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit ${formatRupiah(Math.abs(newBalance))}). Catat pemasukan dengan mengetik: <code>gaji 2jt</code></i>`;
    }

    // 7. Format Struk Bukti Transaksi Resmi Lengkap
    const receiptMsg =
      `🧾 ═══════════════════════\n` +
      `     <b>STRUK BUKTI TRANSAKSI RESMI</b>\n` +
      `═══════════════════════════\n` +
      `🟢 <b>STATUS : BERHASIL TERCATAT</b>\n` +
      `⚡ <b>Respon :</b> ${elapsedSec} detik (${elapsedMs} ms) • Realtime\n` +
      `📅 <b>Waktu  :</b> ${exactSecondWib}\n` +
      `🆔 <b>Struk  :</b> <code>#${newTx.id}</code>\n` +
      `───────────────────────────\n` +
      `🏪 <b>Keterangan :</b> <b>${escapeHtml(parsed.description)}</b>\n` +
      `📂 <b>Kategori   :</b> ${escapeHtml(parsed.category)}\n` +
      `🏷️ <b>Jenis      :</b> ${typeLabel}\n` +
      `💵 <b>Nominal    :</b> <b>${amountFormatted}</b>\n` +
      `───────────────────────────\n` +
      `📊 <b>REKAP SALDO KAS MUTAKHIR:</b>\n` +
      `📥 Pemasukan   : ${formatRupiah(totalIncome)}\n` +
      `📤 Pengeluaran : ${formatRupiah(totalExpense)}\n` +
      `💰 <b>Sisa Kas : ${formatRupiah(newBalance)}</b>\n` +
      balanceNotice +
      `───────────────────────────\n` +
      `${syncNote}\n` +
      `═══════════════════════════\n` +
      `💡 <i>Ketik <b>/hapus</b> untuk membatalkan atau <b>/edit</b> untuk mengedit transaksi ini.</i>`;

    const actionKeyboard = {
      inline_keyboard: [
        [
          { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
          { text: "📊 Rekap Kas", callback_data: "cmd_rekap" }
        ],
        [
          { text: "✏️ Edit Transaksi", callback_data: `tx_edit_menu:${newTx.id}` },
          { text: "🗑️ Batalkan Transaksi", callback_data: "cmd_hapus" }
        ]
      ]
    };

    if (loadingMsgId) {
      const edited = await editReplyWithMarkup(loadingMsgId, receiptMsg, actionKeyboard);
      if (!edited) {
        await sendReplyWithMarkup(receiptMsg, actionKeyboard);
      }
    } else {
      await sendReplyWithMarkup(receiptMsg, actionKeyboard);
    }

    return { success: true, chatId, action: 'recorded' };

  } catch (err: any) {
    console.error('[Telegram] Fatal error in handleIncomingTelegramUpdate:', err);
    return { success: false };
  }
}

// ============================================================================
// TELEGRAM BOT LONG-POLLING SERVICE
// Mengatasi 100% kendala webhook domain & memastikan bot merespon instan 24 jam!
// ============================================================================

export function cleanTelegramToken(raw: string | undefined | null): string {
  if (!raw) return '';
  let token = String(raw).trim();
  token = token.replace(/^https?:\/\/api\.telegram\.org\/bot/i, '');
  token = token.replace(/^["']+|["']+$/g, '');
  if (/^bot\d+:/i.test(token)) {
    token = token.substring(3);
  }
  return token.trim();
}

class TelegramPollerService {
  private pollers = new Map<string, {
    isRunning: boolean;
    token: string;
    userId: string;
    botUsername?: string;
    botFirstName?: string;
    botId?: number;
    lastDetectedChatId?: string;
    abortController: AbortController;
  }>();

  private startingLocks = new Map<string, Promise<{
    success: boolean;
    bot?: any;
    detectedChatId?: string;
    error?: string;
  }>>();

  public async startPoller(
    userId: string,
    token: string,
    googleSheetUrl?: string,
    options?: { forceResetWebhook?: boolean }
  ): Promise<{
    success: boolean;
    bot?: any;
    detectedChatId?: string;
    error?: string;
    mode?: 'polling' | 'webhook';
    webhookUrl?: string;
  }> {
    const cleanToken = cleanTelegramToken(token);
    if (!cleanToken) return { success: false, error: 'Token bot tidak boleh kosong.' };

    if (!/^\d{6,16}:[A-Za-z0-9_-]{20,}$/.test(cleanToken)) {
      return {
        success: false,
        error: 'Format Token Bot Telegram tidak valid. Token harus diawali angka ID bot, titik dua (:), lalu kode unik dari @BotFather.'
      };
    }

    // 1. Cek apakah poller untuk user ini sudah aktif dengan token yang SAMA PERSIS
    const existing = this.pollers.get(userId);
    if (existing && existing.isRunning && existing.token === cleanToken) {
      console.log(`[TelegramPoller] Poller for user ${userId} (@${existing.botUsername}) is already active and healthy.`);
      return {
        success: true,
        bot: {
          id: existing.botId,
          username: existing.botUsername,
          first_name: existing.botFirstName || existing.botUsername
        },
        detectedChatId: existing.lastDetectedChatId,
        mode: 'polling'
      };
    }

    // 2. Cegah race condition jika ada proses startup poller yang sedang berjalan bersamaan
    if (this.startingLocks.has(userId)) {
      try {
        const lockedRes = await this.startingLocks.get(userId);
        if (lockedRes && lockedRes.success) return lockedRes;
      } catch (e) {}
    }

    const startPromise = (async () => {
      try {
        // Hentikan poller lama dan batalkan request getUpdates yang sedang gantung
        this.stopPoller(userId);

        // Tunggu 500ms agar koneksi socket lama dilepas sepenuhnya oleh Telegram
        await new Promise(r => setTimeout(r, 500));

        // 1. Verifikasi bot via getMe
        const getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
          signal: AbortSignal.timeout(10000)
        });
        const getMeData: any = await getMeRes.json();
        if (!getMeData.ok) {
          return { success: false, error: getMeData.description || 'Token bot ditolak oleh Telegram.' };
        }
        const botInfo = getMeData.result;

        // 2. Cek apakah ada Webhook aktif (misalnya ke Google Apps Script)
        let hasActiveWebhook = false;
        let activeWebhookUrl = '';
        try {
          const whCheck = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`, {
            signal: AbortSignal.timeout(6000)
          });
          const whData: any = await whCheck.json();
          if (whData.ok && whData.result?.url) {
            hasActiveWebhook = true;
            activeWebhookUrl = whData.result.url;
          }
        } catch {}

        // JIKA WEBHOOK SUDAH AKTIF DAN USER TIDAK MEMINTA FORCE RESET:
        // Jaga webhook tetap berjalan 24 jam nonstop, JANGAN hapus webhook!
        if (hasActiveWebhook && !options?.forceResetWebhook) {
          console.log(`[TelegramPoller] Bot @${botInfo.username} has active Webhook (${activeWebhookUrl}). Skipping poller daemon to preserve 24/7 webhook.`);
          return {
            success: true,
            bot: {
              id: botInfo.id,
              username: botInfo.username,
              first_name: botInfo.first_name || botInfo.username
            },
            detectedChatId: existing?.lastDetectedChatId || '',
            mode: 'webhook' as const,
            webhookUrl: activeWebhookUrl
          };
        }

        // Hapus webhook hanya jika tidak ada webhook aktif ATAU user secara eksplisit meminta beralih ke Mode Poller
        try {
          await fetch(`https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`, {
            signal: AbortSignal.timeout(8000)
          });
          console.log(`[TelegramPoller] Cleared webhook & prepared polling connection for @${botInfo.username}`);
        } catch (delErr) {
          console.warn('[TelegramPoller] deleteWebhook warning:', delErr);
        }

        // 3. Ambil pesan pendahulu secara sinkron untuk mendeteksi Chat ID sebelum daemon loop berjalan
        let detectedChatId = '';
        let initialOffset = 0;
        try {
          const initRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=25`, {
            signal: AbortSignal.timeout(8000)
          });
          const initData: any = await initRes.json();
          if (initData.ok && Array.isArray(initData.result) && initData.result.length > 0) {
            for (const u of initData.result) {
              initialOffset = Math.max(initialOffset, u.update_id + 1);
              const msg = u.message || u.channel_post || u.edited_message;
              if (msg && msg.chat && msg.chat.id) {
                detectedChatId = String(msg.chat.id);
              }
              // Tangani pesan awal jika ada
              await handleIncomingTelegramUpdate(u, cleanToken, userId);
            }
          }
        } catch (initErr) {
          console.warn('[TelegramPoller] Initial getUpdates warning:', initErr);
        }

        // 4. Daftarkan instance poller baru dengan AbortController
        const abortController = new AbortController();
        const state = {
          isRunning: true,
          token: cleanToken,
          userId,
          botUsername: botInfo.username,
          botFirstName: botInfo.first_name,
          botId: botInfo.id,
          lastDetectedChatId: detectedChatId,
          abortController
        };
        this.pollers.set(userId, state);

        // 5. Jalankan daemon polling loop
        this.runLoop(userId, state, initialOffset);

        return {
          success: true,
          bot: {
            id: botInfo.id,
            username: botInfo.username,
            first_name: botInfo.first_name || botInfo.username
          },
          detectedChatId,
          mode: 'polling' as const
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Gagal menghubungi Telegram API' };
      } finally {
        this.startingLocks.delete(userId);
      }
    })();

    this.startingLocks.set(userId, startPromise);
    return await startPromise;
  }

  public stopPoller(userId: string) {
    const p = this.pollers.get(userId);
    if (p) {
      p.isRunning = false;
      try {
        p.abortController.abort();
      } catch (e) {}
      this.pollers.delete(userId);
      console.log(`[TelegramPoller] Stopped poller & aborted pending requests for user ${userId}`);
    }
  }

  public stopPollerByToken(token: string, exceptUserId?: string) {
    const clean = cleanTelegramToken(token);
    if (!clean) return;
    for (const [uId, p] of this.pollers.entries()) {
      if (cleanTelegramToken(p.token) === clean && (!exceptUserId || uId !== exceptUserId)) {
        p.isRunning = false;
        try {
          p.abortController.abort();
        } catch (e) {}
        this.pollers.delete(uId);
        console.log(`[TelegramPoller] Severed poller connection for token ${clean.substring(0, 10)}... (user: ${uId})`);
      }
    }
  }

  public getStatus(userId: string) {
    const p = this.pollers.get(userId);
    if (!p || !p.isRunning) return { active: false };
    return {
      active: true,
      botUsername: p.botUsername,
      botFirstName: p.botFirstName,
      botId: p.botId
    };
  }

  public getDetectedChatId(userId: string): string | undefined {
    return this.pollers.get(userId)?.lastDetectedChatId;
  }

  public updateDetectedChatId(userId: string, chatId: string) {
    const p = this.pollers.get(userId);
    if (p) {
      p.lastDetectedChatId = chatId;
    }
  }

  private async runLoop(
    userId: string,
    state: {
      isRunning: boolean;
      token: string;
      userId: string;
      botUsername?: string;
      lastDetectedChatId?: string;
      abortController: AbortController;
    },
    startOffset: number = 0
  ) {
    console.log(`[TelegramPoller] Poller daemon activated for user ${userId} (@${state.botUsername}) at offset ${startOffset}`);
    let offset = startOffset;
    let consecutive409 = 0;

    while (state.isRunning) {
      try {
        if (!state.isRunning) break;

        // Pasang timeout 16 detik yang terhubung ke abort controller
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 16000);

        const onAbort = () => timeoutController.abort();
        state.abortController.signal.addEventListener('abort', onAbort, { once: true });

        let res: Response;
        try {
          const url = `https://api.telegram.org/bot${state.token}/getUpdates?offset=${offset}&timeout=10&limit=25`;
          res = await fetch(url, { signal: timeoutController.signal });
        } finally {
          clearTimeout(timeoutId);
          state.abortController.signal.removeEventListener('abort', onAbort);
        }

        if (!state.isRunning) break;

        if (!res.ok) {
          if (res.status === 409) {
            consecutive409++;
            console.warn(`[TelegramPoller] 409 Conflict for @${state.botUsername} (#${consecutive409}). Checking if webhook is active...`);
            try {
              const whCheck = await fetch(`https://api.telegram.org/bot${state.token}/getWebhookInfo`);
              const whData: any = await whCheck.json();
              if (whData.ok && whData.result?.url) {
                console.log(`[TelegramPoller] Webhook active (${whData.result.url}) for @${state.botUsername}. Gracefully stopping poller.`);
                state.isRunning = false;
                break;
              }
            } catch {}
            const delay = Math.min(3000 * consecutive409, 12000);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }

        consecutive409 = 0;
        const data: any = await res.json();
        if (data.ok && Array.isArray(data.result)) {
          for (const u of data.result) {
            if (!state.isRunning) break;
            offset = Math.max(offset, u.update_id + 1);
            const msg = u.message || u.channel_post || u.edited_message || (u.callback_query && u.callback_query.message);
            if (msg && msg.chat && msg.chat.id) {
              state.lastDetectedChatId = String(msg.chat.id);
            }
            try {
              await handleIncomingTelegramUpdate(u, state.token, userId);
            } catch (err) {
              console.error('[TelegramPoller] Error handling update:', err);
            }
          }
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (loopErr: any) {
        if (!state.isRunning) break;
        if (state.abortController.signal.aborted) {
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log(`[TelegramPoller] Poller loop terminated cleanly for user ${userId} (@${state.botUsername})`);
  }
}

export const telegramPoller = new TelegramPollerService();

/**
 * Pemutus Koneksi Cerdas:
 * Ketika API token Bot Telegram baru didaftarkan atau digunakan,
 * fungsi ini secara cerdas memutuskan seluruh koneksi bot terdahulu (lama),
 * mencabut/menghapus webhook lama dengan drop_pending_updates: true,
 * mematikan seluruh daemon poller yang masih menggantung,
 * dan memastikan sistem 100% fokus eksklusif hanya pada bot baru ini.
 */
export async function severAndDisconnectOldTelegramBots(
  newCleanToken: string,
  oldToken?: string,
  targetUserId?: string
): Promise<{ severedOldToken: boolean; flushedNewToken: boolean }> {
  let severedOldToken = false;
  let flushedNewToken = false;

  const cleanOld = cleanTelegramToken(oldToken || '');
  const cleanNew = cleanTelegramToken(newCleanToken || '');

  // 1. Putuskan bot lama secara menyeluruh jika berbeda dari bot baru
  if (cleanOld && cleanOld !== cleanNew) {
    console.log(`[TelegramSever] Intelligent severance: disconnecting old bot (${cleanOld.substring(0, 10)}...) for user ${targetUserId || 'unknown'}`);
    telegramPoller.stopPollerByToken(cleanOld);
    if (targetUserId) {
      telegramPoller.stopPoller(targetUserId);
    }
    try {
      await fetch(`https://api.telegram.org/bot${cleanOld}/deleteWebhook?drop_pending_updates=true`, {
        signal: AbortSignal.timeout(6000)
      });
      severedOldToken = true;
      console.log(`[TelegramSever] Successfully revoked webhook and cleared pending updates for old bot.`);
    } catch (err: any) {
      console.warn(`[TelegramSever] Notice revoking old bot webhook:`, err.message);
    }
  }

  // 2. Putuskan instance poller pada user lain yang mungkin tidak sengaja memakai token baru ini
  if (cleanNew) {
    telegramPoller.stopPollerByToken(cleanNew, targetUserId);
    // 3. Bersihkan antrean pending updates & webhook gantung pada token baru
    try {
      await fetch(`https://api.telegram.org/bot${cleanNew}/deleteWebhook?drop_pending_updates=true`, {
        signal: AbortSignal.timeout(6000)
      });
      flushedNewToken = true;
      console.log(`[TelegramSever] New bot token (${cleanNew.substring(0, 10)}...) prepped cleanly (pending updates flushed).`);
    } catch (err: any) {
      console.warn(`[TelegramSever] Notice prepping new bot token:`, err.message);
    }
  }

  return { severedOldToken, flushedNewToken };
}

// ENDPOINT WEBHOOK TELEGRAM SERVER (Opsional jika webhook tetap diaktifkan)
app.post('/api/telegram/webhook', async (req, res) => {
  res.status(200).json({ ok: true });
  try {
    const update = req.body;
    const queryToken = cleanTelegramToken(req.query.token as string || '');
    const queryUserId = (req.query.userId as string || '').trim();
    await handleIncomingTelegramUpdate(update, queryToken, queryUserId);
  } catch (err: any) {
    console.error('[TelegramWebhook] Webhook route error:', err);
  }
});

// 3. ENDPOINT SETUP OTOMATIS TELEGRAM BOT
app.post('/api/telegram/auto-setup', async (req, res) => {
  try {
    const { token, googleSheetUrl, userId, username, chatId: clientChatId } = req.body || {};

    const cleanToken = cleanTelegramToken(token);
    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Token Bot Telegram wajib diisi.' });
    }

    if (!/^\d{6,16}:[A-Za-z0-9_-]{20,}$/.test(cleanToken)) {
      return res.status(400).json({
        success: false,
        message: 'Format Token Bot Telegram tidak valid. Token harus diawali angka ID bot, tanda titik dua (:), lalu deretan karakter rahasia dari @BotFather.'
      });
    }

    const targetUserId = userId || 'usr_admin_01';
    const allSettings = readAllUserSettings();
    const existingCfg = allSettings[targetUserId] || { googleSheetUrl: '', telegramChatId: '' };

    // Pemutusan Cerdas: Putuskan seluruh koneksi bot terdahulu & bersihkan antrean updates
    await severAndDisconnectOldTelegramBots(cleanToken, (existingCfg as any)?.telegramBotToken, targetUserId);

    // Pertahankan URL spreadsheet yang sudah ada jika caller tidak mengirimkan yang baru
    const cleanUrl = (googleSheetUrl && googleSheetUrl.trim()) ? googleSheetUrl.trim() : (existingCfg.googleSheetUrl || '');

    // 1. Nyalakan Poller Service & Bersihkan Webhook yang Macet
    const pollerResult = await telegramPoller.startPoller(targetUserId, cleanToken, cleanUrl);
    if (!pollerResult.success) {
      return res.status(400).json({
        success: false,
        message: `Gagal menghubungkan Bot Telegram: ${pollerResult.error}`
      });
    }

    const botInfo = pollerResult.bot;
    console.log(`[TelegramSetup] Poller active for user ${targetUserId} (@${botInfo.username})`);

    // 2. Deteksi Chat ID: prioritaskan clientChatId jika valid, atau pollerResult.detectedChatId, atau existingChatId
    let detectedChatId = clientChatId ? String(clientChatId).trim() : (pollerResult.detectedChatId || existingCfg.telegramChatId || '');

    // 3. Teruskan konfigurasi ke Google Apps Script jika URL terisi
    if (cleanUrl && cleanUrl.startsWith('http')) {
      try {
        fetch(cleanUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'setup_telegram',
            token: cleanToken,
            chatId: detectedChatId,
            userId: targetUserId,
            username: username || ''
          }),
          signal: AbortSignal.timeout(8000)
        }).catch(() => {});
      } catch (gasErr) {}
    }

    // 4. Simpan ke database server & users.json (mempertahankan URL Google Sheet)
    const updatedSettings = writeUserSettings(targetUserId, {
      googleSheetUrl: cleanUrl,
      telegramBotToken: cleanToken,
      telegramChatId: detectedChatId,
      useCloudStorage: Boolean(cleanUrl)
    });

    const allUsers = readStoredUsers();
    const uIndex = allUsers.findIndex(u => u.id === targetUserId);
    if (uIndex !== -1) {
      allUsers[uIndex] = {
        ...allUsers[uIndex],
        googleSheetUrl: updatedSettings.googleSheetUrl,
        telegramBotToken: cleanToken,
        telegramChatId: detectedChatId,
        useCloudStorage: Boolean(updatedSettings.googleSheetUrl)
      };
      writeStoredUsers(allUsers);
    }

    // 5. Kirim pesan selamat datang ke Telegram jika Chat ID sudah terdeteksi
    if (detectedChatId) {
      try {
        const welcomeText = `🎉 <b>Bot FahKeu Berhasil Terhubung!</b>\n` +
          `───────────────────────────\n` +
          `👤 <b>Akun:</b> ${escapeHtml(username || 'Pengguna')}\n` +
          `🤖 <b>Bot:</b> @${botInfo.username}\n\n` +
          `✅ <b>Status:</b> Terhubung 100% secara realtime ke Website & Google Spreadsheet.\n\n` +
          `Coba ketik transaksi Anda sekarang, contoh:\n` +
          `• <code>beli cimol 3k</code>\n` +
          `• <code>kopi 15rb</code>\n` +
          `• <code>gaji 5jt</code>\n` +
          `• <b>/saldo</b> (Cek saldo kas)`;

        await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: detectedChatId,
            text: welcomeText,
            parse_mode: 'HTML'
          }),
          signal: AbortSignal.timeout(6000)
        });
      } catch (msgErr: any) {
        console.warn('[TelegramSetup] Welcome message error:', msgErr.message);
      }
    }

    res.json({
      success: true,
      message: detectedChatId
        ? `Bot @${botInfo.username} berhasil terhubung 100%! Chat ID (${detectedChatId}) tersimpan rapi & siap mencatat transaksi realtime.`
        : `Bot @${botInfo.username} aktif & terhubung 100%! Buka bot di Telegram (@${botInfo.username}), lalu klik tombol START (/start) agar Chat ID terhubung otomatis.`,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name
      },
      chatId: detectedChatId
    });
  } catch (err: any) {
    console.error('[TelegramSetup] Error in auto-setup:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Terjadi kesalahan saat memproses konfigurasi Telegram.'
    });
  }
});

// 3b. ENDPOINT DAFTARKAN WEBHOOK 24 JAM KE GOOGLE APPS SCRIPT
app.post('/api/telegram/setup-gas-webhook', async (req, res) => {
  try {
    const { token, googleSheetUrl, userId, username, chatId: clientChatId } = req.body || {};
    const cleanToken = cleanTelegramToken(token);
    const cleanUrl = (googleSheetUrl || '').trim();

    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Token Bot Telegram wajib diisi.' });
    }
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'URL Google Apps Script Web App wajib diisi.' });
    }
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      return res.status(400).json({
        success: false,
        message: 'URL yang dimasukkan adalah link lembar Google Spreadsheet biasa, bukan URL Web App (akhiran /exec). Silakan deploy Web App di Apps Script (Terapkan > Deployment Baru > Web App) atau jalankan menu "📊 Keuangan FahKeu" > "⚡ Aktifkan Webhook Bot 24 Jam Otomatis" langsung di Google Spreadsheet Anda.'
      });
    }

    const targetUserId = userId || 'usr_admin_01';
    const allSettings = readAllUserSettings();
    const existingCfg = allSettings[targetUserId] || { googleSheetUrl: '', telegramChatId: '' };

    // Pemutusan Cerdas: Putuskan seluruh koneksi bot terdahulu & bersihkan webhook lama
    await severAndDisconnectOldTelegramBots(cleanToken, (existingCfg as any)?.telegramBotToken, targetUserId);

    // 1. Verifikasi Bot via getMe
    const getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, { signal: AbortSignal.timeout(8000) });
    const getMeData: any = await getMeRes.json();
    if (!getMeData.ok) {
      return res.status(400).json({ success: false, message: getMeData.description || 'Token ditolak oleh Telegram.' });
    }
    const botInfo = getMeData.result;

    // 2. Hentikan Poller lokal agar tidak ada error 409 Conflict dengan Webhook 24 Jam
    telegramPoller.stopPoller(targetUserId);

    // 3. Pasang Webhook langsung ke URL Google Apps Script
    const targetWebhookUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(cleanToken)}`;
    const setWhRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetWebhookUrl,
        drop_pending_updates: true,
        allowed_updates: ['message', 'edited_message', 'callback_query', 'channel_post']
      }),
      signal: AbortSignal.timeout(10000)
    });
    const setWhData: any = await setWhRes.json();
    if (!setWhData.ok) {
      return res.status(400).json({ success: false, message: `Gagal memasang webhook ke Telegram: ${setWhData.description}` });
    }

    // 4. Deteksi Chat ID jika belum ada
    let detectedChatId = clientChatId ? String(clientChatId).trim() : (existingCfg.telegramChatId || '');

    // 5. Teruskan konfigurasi ke Google Apps Script
    try {
      await fetch(cleanUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup_telegram',
          token: cleanToken,
          chatId: detectedChatId,
          userId: targetUserId,
          username: username || ''
        }),
        signal: AbortSignal.timeout(8000)
      });
    } catch (gasErr) {}

    // 6. Simpan konfigurasi
    writeUserSettings(targetUserId, {
      googleSheetUrl: cleanUrl,
      telegramBotToken: cleanToken,
      telegramChatId: detectedChatId,
      useCloudStorage: true
    });

    const allUsers = readStoredUsers();
    const uIdx = allUsers.findIndex(u => u.id === targetUserId);
    if (uIdx !== -1) {
      allUsers[uIdx].googleSheetUrl = cleanUrl;
      allUsers[uIdx].telegramBotToken = cleanToken;
      allUsers[uIdx].telegramChatId = detectedChatId;
      writeStoredUsers(allUsers);
    }

    // 7. Kirim pesan konfirmasi ke Telegram jika Chat ID tersedia
    if (detectedChatId) {
      try {
        await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: detectedChatId,
            text: `🎉 <b>Webhook 24 Jam Berhasil Diaktifkan!</b>\n` +
                  `───────────────────────────\n` +
                  `Bot @${botInfo.username} kini aktif 24 jam nonstop terhubung langsung ke Google Spreadsheet & Website FahKeu!\n\n` +
                  `Silakan coba ketik transaksi sekarang, contoh:\n` +
                  `• <code>beli cimol 3k</code>\n` +
                  `• <code>gaji masuk 20 juta</code>\n` +
                  `• Atau kirim <b>foto struk belanja</b> 🧾`,
            parse_mode: 'HTML'
          }),
          signal: AbortSignal.timeout(6000)
        });
      } catch (e) {}
    }

    return res.json({
      success: true,
      message: `🎉 Webhook 24 Jam berhasil diaktifkan untuk @${botInfo.username}! Bot kini aktif 24 jam nonstop di Google Apps Script.`,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name
      },
      webhookUrl: targetWebhookUrl,
      chatId: detectedChatId
    });
  } catch (err: any) {
    console.error('[setup-gas-webhook error]:', err);
    res.status(500).json({ success: false, message: err.message || 'Gagal mengatur webhook 24 jam.' });
  }
});

// 3c. ENDPOINT CEK STATUS WEBHOOK SECARA RIIL DARI SERVER (Tanpa Terhalang CORS Browser)
app.get('/api/telegram/webhook-info', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || 'usr_faiz_02';
    const allSettings = readAllUserSettings();
    const cfg = allSettings[userId] || {};
    const cleanToken = cleanTelegramToken((req.query.token as string) || cfg.telegramBotToken || '');
    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Token Bot belum diatur.' });
    }
    const whRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`, {
      signal: AbortSignal.timeout(8000)
    });
    const whData: any = await whRes.json();
    if (!whData.ok) {
      return res.status(400).json({ success: false, message: whData.description || 'Gagal mengambil info webhook.' });
    }

    let botInfo: any = null;
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, { signal: AbortSignal.timeout(5000) });
      const meData: any = await meRes.json();
      if (meData.ok) botInfo = meData.result;
    } catch {}

    const isPollerActive = telegramPoller.getStatus(userId).active;

    res.json({
      success: true,
      info: whData.result,
      bot: botInfo,
      isPollerActive,
      mode: whData.result?.url ? 'webhook' : (isPollerActive ? 'polling' : 'none')
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal mengecek webhook Telegram.' });
  }
});

// 3d. ENDPOINT HAPUS WEBHOOK & BERALIH KE MODE REALTIME SERVER POLLER
app.post('/api/telegram/remove-webhook', async (req, res) => {
  try {
    const { token, userId, googleSheetUrl } = req.body || {};
    const targetUserId = userId || 'usr_faiz_02';
    const allSettings = readAllUserSettings();
    const cfg = allSettings[targetUserId] || {};
    const cleanToken = cleanTelegramToken(token || cfg.telegramBotToken || '');
    const cleanSheet = (googleSheetUrl || cfg.googleSheetUrl || '').trim();

    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Token Bot belum diatur.' });
    }

    // 1. Hapus webhook di Telegram API
    await fetch(`https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`, {
      signal: AbortSignal.timeout(8000)
    }).catch(() => {});

    // 2. Aktifkan Mode Polling Server Realtime
    const pollerRes = await telegramPoller.startPoller(targetUserId, cleanToken, cleanSheet, { forceResetWebhook: true });

    res.json({
      success: true,
      message: '✅ Webhook dinonaktifkan. Mode Polling Server Realtime kini aktif 100%!',
      poller: pollerRes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal menonaktifkan webhook.' });
  }
});

// 3e. ENDPOINT VERIFIKASI URL GOOGLE APPS SCRIPT
app.post('/api/telegram/verify-gas-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    const cleanUrl = (url || '').trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      return res.status(400).json({ success: false, message: 'URL Google Apps Script wajib diisi.' });
    }

    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      return res.json({
        success: false,
        isSpreadsheetUrl: true,
        message: '⚠️ URL ini adalah tautan spreadsheet biasa, bukan URL Web App (/exec). Buka Ekstensi > Apps Script > Terapkan > Aplikasi Web.'
      });
    }

    try {
      const pingRes = await fetch(`${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=get_telegram_status`, {
        headers: { 'Accept': 'application/json, text/html' },
        signal: AbortSignal.timeout(10000)
      });
      const text = await pingRes.text();

      if (text.includes('Page not found') || text.includes('Sorry, unable to open the file') || pingRes.status === 404) {
        return res.json({
          success: false,
          isDeploymentError: true,
          message: '⚠️ Google Apps Script mengembalikan "Page not found". Pastikan di Apps Script: Terapkan > Kelola Penerapan > Edit > Versi: Baru > Siapa saja yang memiliki akses: Siapa saja (Anyone).'
        });
      }

      if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
        return res.json({
          success: false,
          isAuthError: true,
          message: '⚠️ Google Apps Script meminta login Google. Ubah pengaturan akses Web App: "Siapa saja yang memiliki akses: Siapa saja" (Anyone), bukan "Hanya saya".'
        });
      }

      return res.json({
        success: true,
        message: '✅ URL Google Apps Script Web App aktif dan dapat diakses dengan baik.'
      });
    } catch (e: any) {
      return res.json({
        success: false,
        message: `⚠️ Gagal mengakses URL Google Apps Script: ${e.message}`
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3f. ENDPOINT SINKRONISASI TOKEN BOT BARU SECARA INSTAN
app.post('/api/telegram/sync-bot-token', async (req, res) => {
  try {
    const { token, userId, googleSheetUrl } = req.body || {};
    const cleanToken = cleanTelegramToken(token);
    const targetUserId = userId || 'usr_faiz_02';

    if (!cleanToken) {
      return res.status(400).json({ success: false, message: 'Token Bot wajib diisi.' });
    }

    // 1. Verifikasi token ke Telegram getMe
    const getMeRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`, {
      signal: AbortSignal.timeout(8000)
    });
    const getMeData: any = await getMeRes.json();
    if (!getMeData.ok) {
      return res.status(400).json({
        success: false,
        message: `Token ditolak oleh Telegram: ${getMeData.description || 'Token tidak valid'}. Periksa token dari @BotFather.`
      });
    }
    const botInfo = getMeData.result;

    // 2. Simpan token baru ke database user_settings & users
    const allSettings = readAllUserSettings();
    const existing = allSettings[targetUserId] || {};
    const effectiveSheet = googleSheetUrl || existing.googleSheetUrl || '';

    // Pemutusan Cerdas: Putuskan seluruh koneksi bot terdahulu & bersihkan webhook lama
    await severAndDisconnectOldTelegramBots(cleanToken, (existing as any)?.telegramBotToken, targetUserId);

    writeUserSettings(targetUserId, {
      telegramBotToken: cleanToken,
      googleSheetUrl: effectiveSheet
    });

    const allUsers = readStoredUsers();
    const uIdx = allUsers.findIndex(u => u.id === targetUserId);
    if (uIdx !== -1) {
      allUsers[uIdx].telegramBotToken = cleanToken;
      if (effectiveSheet) allUsers[uIdx].googleSheetUrl = effectiveSheet;
      writeStoredUsers(allUsers);
    }

    // 3. Mulai bot listener
    const pollerRes = await telegramPoller.startPoller(targetUserId, cleanToken, effectiveSheet);

    res.json({
      success: true,
      message: `🎉 Bot @${botInfo.username} (ID: ${botInfo.id}) berhasil dihubungkan 100%!`,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.first_name
      },
      poller: pollerRes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal menyinkronkan token bot.' });
  }
});

// 4. ENDPOINT DETEKSI CHAT ID SECARA INSTAN
app.post('/api/telegram/detect-chat-id', async (req, res) => {
  try {
    const { token, userId } = req.body || {};
    const targetUserId = userId || 'usr_admin_01';

    // Periksa apakah Chat ID sudah tersimpan di user_settings.json
    const allSettings = readAllUserSettings();
    const userCfg = allSettings[targetUserId] || {
      googleSheetUrl: '',
      telegramBotToken: '',
      telegramChatId: '',
      useCloudStorage: false
    };
    if (userCfg.telegramChatId) {
      return res.json({ success: true, chatId: userCfg.telegramChatId, source: 'cached' });
    }

    // Periksa apakah poller sudah mendeteksi Chat ID dari pesan terbaru
    const pollerChatId = telegramPoller.getDetectedChatId(targetUserId);
    if (pollerChatId) {
      writeUserSettings(targetUserId, { telegramChatId: pollerChatId });
      const allUsers = readStoredUsers();
      const uIdx = allUsers.findIndex(u => u.id === targetUserId);
      if (uIdx !== -1) {
        allUsers[uIdx].telegramChatId = pollerChatId;
        writeStoredUsers(allUsers);
      }
      return res.json({ success: true, chatId: pollerChatId, source: 'poller' });
    }

    const activeToken = cleanTelegramToken(token || userCfg.telegramBotToken || '');
    if (!activeToken) {
      return res.status(400).json({ success: false, message: 'Token bot belum diatur.' });
    }

    // Ambil dari Telegram getUpdates jika poller belum aktif
    if (!telegramPoller.getStatus(targetUserId).active) {
      try {
        const updRes = await fetch(`https://api.telegram.org/bot${activeToken}/getUpdates?limit=25`, {
          signal: AbortSignal.timeout(6000)
        });
        const updData: any = await updRes.json();
        if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
          for (let i = updData.result.length - 1; i >= 0; i--) {
            const msg = updData.result[i].message || updData.result[i].channel_post || updData.result[i].edited_message;
            if (msg && msg.chat && msg.chat.id) {
              const foundId = String(msg.chat.id);
              writeUserSettings(targetUserId, { telegramChatId: foundId });

              const allUsers = readStoredUsers();
              const uIdx = allUsers.findIndex(u => u.id === targetUserId);
              if (uIdx !== -1) {
                allUsers[uIdx].telegramChatId = foundId;
                writeStoredUsers(allUsers);
              }

              return res.json({ success: true, chatId: foundId, source: 'detected' });
            }
          }
        }
      } catch (tgErr) {
        console.warn('[detect-chat-id] fetch warning:', tgErr);
      }
    }

    res.json({
      success: false,
      message: 'Belum ada pesan terdeteksi. Silakan buka bot di Telegram dan klik tombol /start terlebih dahulu.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal mendeteksi Chat ID.' });
  }
});

// 5. ENDPOINT STATUS POLLING TELEGRAM
app.get('/api/telegram/status', (req, res) => {
  const userId = (req.query.userId as string) || 'usr_admin_01';
  const status = telegramPoller.getStatus(userId);
  const allSettings = readAllUserSettings();
  const allUsers = readStoredUsers();
  const uObj = allUsers.find(u => u.id === userId);
  const cfg = allSettings[userId] || {
    googleSheetUrl: uObj?.googleSheetUrl || '',
    telegramBotToken: uObj?.telegramBotToken || '',
    telegramChatId: uObj?.telegramChatId || '',
    useCloudStorage: uObj?.useCloudStorage || false
  };
  const activeToken = cfg.telegramBotToken || uObj?.telegramBotToken || '';
  const activeChatId = cfg.telegramChatId || uObj?.telegramChatId || '';
  const activeSheet = cfg.googleSheetUrl || uObj?.googleSheetUrl || '';

  res.json({
    success: true,
    active: status.active,
    botUsername: status.botUsername || '',
    chatId: activeChatId,
    token: activeToken,
    googleSheetUrl: activeSheet,
    hasToken: Boolean(activeToken)
  });
});

app.get('/api/telegram/status/:userId', (req, res) => {
  const { userId } = req.params;
  const status = telegramPoller.getStatus(userId);
  const allSettings = readAllUserSettings();
  const allUsers = readStoredUsers();
  const uObj = allUsers.find(u => u.id === userId);
  const cfg = allSettings[userId] || {
    googleSheetUrl: uObj?.googleSheetUrl || '',
    telegramBotToken: uObj?.telegramBotToken || '',
    telegramChatId: uObj?.telegramChatId || '',
    useCloudStorage: uObj?.useCloudStorage || false
  };
  const activeToken = cfg.telegramBotToken || uObj?.telegramBotToken || '';
  const activeChatId = cfg.telegramChatId || uObj?.telegramChatId || '';
  const activeSheet = cfg.googleSheetUrl || uObj?.googleSheetUrl || '';

  res.json({
    success: true,
    active: status.active,
    botUsername: status.botUsername || '',
    chatId: activeChatId,
    token: activeToken,
    googleSheetUrl: activeSheet,
    hasToken: Boolean(activeToken)
  });
});

// Endpoint untuk mengirim pesan uji coba ke Telegram
app.post('/api/telegram/test-message', async (req, res) => {
  try {
    const { token, chatId, text, userId } = req.body || {};
    const cleanToken = cleanTelegramToken(token);
    const cleanChatId = (chatId || '').toString().trim();
    const targetUserId = userId || 'usr_faiz_02';

    if (!cleanToken || !cleanChatId) {
      return res.status(400).json({ success: false, message: 'Token dan Chat ID wajib disertakan.' });
    }

    const testText = text || `🔔 <b>Tes Koneksi FahKeu</b>\n───────────────────────────\n✅ Bot Telegram Anda berfungsi dengan sempurna 100%!`;

    let messageSent = false;
    const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChatId,
        text: testText,
        parse_mode: 'HTML'
      }),
      signal: AbortSignal.timeout(8000)
    });

    const tgData: any = await tgRes.json();
    if (tgData.ok) {
      messageSent = true;
    } else {
      // Fallback tanpa HTML tag jika parse_mode gagal
      const fallbackRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: testText.replace(/<[^>]*>/g, '')
        }),
        signal: AbortSignal.timeout(8000)
      });
      const fallbackData: any = await fallbackRes.json();
      if (fallbackData.ok) {
        messageSent = true;
      } else {
        return res.status(400).json({
          success: false,
          message: fallbackData.description || tgData.description || 'Gagal mengirim pesan dari Telegram.'
        });
      }
    }

    if (messageSent) {
      // 1. Simpan konfigurasi token & Chat ID ke user_settings.json & users.json
      writeUserSettings(targetUserId, {
        telegramBotToken: cleanToken,
        telegramChatId: cleanChatId
      });
      const allUsers = readStoredUsers();
      const uIdx = allUsers.findIndex(u => u.id === targetUserId);
      if (uIdx !== -1) {
        allUsers[uIdx].telegramBotToken = cleanToken;
        allUsers[uIdx].telegramChatId = cleanChatId;
        writeStoredUsers(allUsers);
      }

      // 2. Langsung nyalakan background poller server
      const allSettings: Record<string, any> = readAllUserSettings();
      const userCfg = allSettings[targetUserId] || {};
      telegramPoller.startPoller(targetUserId, cleanToken, userCfg.googleSheetUrl).then((pRes) => {
        if (pRes.success) {
          console.log(`[test-message] Telegram poller auto-started for @${pRes.bot?.username} (${targetUserId})`);
        } else {
          console.warn(`[test-message] Telegram poller notice:`, pRes.error);
        }
      }).catch(err => {
        console.warn(`[test-message] Poller start error:`, err.message);
      });

      return res.json({
        success: true,
        message: 'Pesan tes berhasil terkirim dan Bot Telegram langsung aktif 100% siap merespon chat!',
        active: true
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Gagal menghubungi Telegram API.' });
  }
});

// Vite middleware & Static SPA handling
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FahKeu Server] Server running on http://0.0.0.0:${PORT}`);

    // Auto-start Telegram Poller untuk semua user yang telah memiliki bot token tersimpan
    try {
      const allSettings = readAllUserSettings();
      const allUsers = readStoredUsers();
      const startedTokens = new Set<string>();

      for (const [uId, cfg] of Object.entries(allSettings)) {
        if (cfg.telegramBotToken && cfg.telegramBotToken.trim()) {
          const cleanToken = cleanTelegramToken(cfg.telegramBotToken);
          if (!startedTokens.has(cleanToken)) {
            startedTokens.add(cleanToken);
            // Cek apakah bot ini sudah terpasang Webhook 24 Jam ke Google Apps Script
            fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`, { signal: AbortSignal.timeout(4000) })
              .then(r => r.json())
              .then(whData => {
                if (whData.ok && whData.result?.url && whData.result.url.includes('script.google.com')) {
                  console.log(`[FahKeu Server] Bot @${cleanToken.substring(0, 8)}... has active 24/7 Google Apps Script Webhook. Skipping local poller to preserve 24h webhook.`);
                } else {
                  console.log(`[FahKeu Server] Initializing Telegram bot poller for user ${uId}...`);
                  telegramPoller.startPoller(uId, cleanToken, cfg.googleSheetUrl).catch(e => {
                    console.warn(`[FahKeu Server] Failed starting poller for ${uId}:`, e.message);
                  });
                }
              })
              .catch(() => {
                console.log(`[FahKeu Server] Initializing Telegram bot poller for user ${uId}...`);
                telegramPoller.startPoller(uId, cleanToken, cfg.googleSheetUrl).catch(e => {
                  console.warn(`[FahKeu Server] Failed starting poller for ${uId}:`, e.message);
                });
              });
          }
        }
      }

      for (const u of allUsers) {
        if (u.telegramBotToken && u.telegramBotToken.trim()) {
          const cleanToken = cleanTelegramToken(u.telegramBotToken);
          if (!startedTokens.has(cleanToken)) {
            startedTokens.add(cleanToken);
            console.log(`[FahKeu Server] Initializing Telegram bot poller for user ${u.id} (from users list)...`);
            telegramPoller.startPoller(u.id, cleanToken, u.googleSheetUrl).catch(e => {
              console.warn(`[FahKeu Server] Failed starting poller for ${u.id}:`, e.message);
            });
          }
        }
      }
      // Background sync user tokens from Admin Google Sheet to ensure permanent continuity
      const sysCfg = readSystemConfig();
      if (sysCfg.adminGoogleSheetUrl && sysCfg.adminGoogleSheetUrl.startsWith('http')) {
        fetch(`${sysCfg.adminGoogleSheetUrl}?action=get_users`, { signal: AbortSignal.timeout(10000) })
          .then(r => r.json())
          .then(cloudData => {
            if (cloudData.success && Array.isArray(cloudData.users)) {
              for (const cu of cloudData.users) {
                if (cu.id && cu.telegramBotToken) {
                  const cleanTok = cleanTelegramToken(cu.telegramBotToken);
                  if (cleanTok && !startedTokens.has(cleanTok)) {
                    startedTokens.add(cleanTok);
                    writeUserSettings(cu.id, {
                      telegramBotToken: cleanTok,
                      telegramChatId: cu.telegramChatId || '',
                      googleSheetUrl: cu.googleSheetUrl || ''
                    });
                    console.log(`[FahKeu Server] Cloud-synced bot poller activated for user ${cu.id}`);
                    telegramPoller.startPoller(cu.id, cleanTok, cu.googleSheetUrl).catch(() => {});
                  }
                }
              }
            }
          })
          .catch(e => console.warn('[FahKeu Server] Cloud user sync note:', e.message));
      }
    } catch (startPollerErr: any) {
      console.warn('[FahKeu Server] Error during poller bootstrap:', startPollerErr.message);
    }
  });
}

startServer().catch(err => {
  console.error('[FahKeu Server] Failed to start server:', err);
});
