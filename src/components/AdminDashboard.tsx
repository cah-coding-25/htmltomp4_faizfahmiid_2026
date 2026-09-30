import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Search, 
  UserPlus, 
  Key, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Coins, 
  Receipt,
  FileSpreadsheet,
  AlertTriangle,
  Lock,
  ArrowUpDown,
  Code2,
  Copy,
  Check,
  X,
  Bot,
  ExternalLink,
  Sparkles,
  Zap,
  Sliders,
  RotateCcw,
  Cpu,
  HelpCircle,
  Info,
  Globe,
  Cloud,
  BookOpen,
  Layers
} from 'lucide-react';
import { User, Transaction, AppSettings, OcrProviderInfo } from '../types';
import { 
  getStoredUsers, 
  updateUserByAdmin, 
  deleteUserByAdmin, 
  saveStoredUsers,
  getGoogleClientId,
  cleanGoogleClientId,
  saveGoogleClientId,
  saveSettingToCloud,
  fetchSettingsFromCloud,
  saveUserSettings,
  getAdminGoogleSheetUrl,
  saveAdminGoogleSheetUrl,
  saveSystemConfigToServer
} from '../utils/authService';
import { formatRupiah } from '../utils/parser';
import { GOOGLE_APPS_SCRIPT_ADMIN_CODE, GOOGLE_APPS_SCRIPT_CODE } from '../utils/code.gs';

interface AdminDashboardProps {
  currentUser: User;
  allTransactions: Transaction[];
  googleSheetUrl?: string;
  adminGoogleSheetUrl?: string;
  onRefreshData?: () => void;
  settings?: AppSettings;
  onSaveSettings?: (settings: AppSettings) => void;
}

export default function AdminDashboard({
  currentUser,
  allTransactions,
  googleSheetUrl,
  adminGoogleSheetUrl,
  settings,
  onSaveSettings
}: AdminDashboardProps) {
  const [users, setUsers] = useState<User[]>(() => getStoredUsers());
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Google Spreadsheet Admin state (Khusus User Management & Master DB)
  const [adminSheetUrlInput, setAdminSheetUrlInput] = useState<string>(() => {
    return adminGoogleSheetUrl || settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl() || '';
  });
  const [savedAdminSheetToast, setSavedAdminSheetToast] = useState(false);
  const [testingAdminConnection, setTestingAdminConnection] = useState(false);
  const [adminTestResult, setAdminTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [codeScriptTab, setCodeScriptTab] = useState<'admin' | 'all'>('admin');

  // Helper untuk mendapatkan URL spreadsheet admin yang aktif
  const getActiveAdminUrl = () => {
    return adminSheetUrlInput.trim() || adminGoogleSheetUrl || settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl() || googleSheetUrl || '';
  };

  // Google Auth Client ID state
  const [googleClientIdInput, setGoogleClientIdInput] = useState<string>(() => {
    return settings?.googleClientId || getGoogleClientId();
  });
  const [savedGoogleAuthToast, setSavedGoogleAuthToast] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  const [copiedOrigin, setCopiedOrigin] = useState(false);

  // Modal edit user
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editGoogleSheetUrl, setEditGoogleSheetUrl] = useState('');
  const [editTelegramBotToken, setEditTelegramBotToken] = useState('');
  const [editTelegramChatId, setEditTelegramChatId] = useState('');

  // Modal tambah user
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newGoogleSheetUrl, setNewGoogleSheetUrl] = useState('');
  const [newTelegramBotToken, setNewTelegramBotToken] = useState('');
  const [newTelegramChatId, setNewTelegramChatId] = useState('');

  // ============================================================================
  // GEMINI AI & OCR PROVIDERS MANAGEMENT STATES
  // ============================================================================
  const [providersList, setProvidersList] = useState<OcrProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'ocr_space' | 'local_tesseract'>('gemini');
  const [expandedTutorialId, setExpandedTutorialId] = useState<string | null>(null);

  // Gemini state
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [geminiMaskedKey, setGeminiMaskedKey] = useState('');
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiIsCustom, setGeminiIsCustom] = useState(false);
  const [showGeminiKeyPlain, setShowGeminiKeyPlain] = useState(false);

  // OCR.space state
  const [ocrSpaceApiKeyInput, setOcrSpaceApiKeyInput] = useState('');
  const [ocrSpaceMaskedKey, setOcrSpaceMaskedKey] = useState('');
  const [ocrSpaceHasKey, setOcrSpaceHasKey] = useState(false);
  const [showOcrSpaceKeyPlain, setShowOcrSpaceKeyPlain] = useState(false);

  const [geminiOcrMode, setGeminiOcrMode] = useState<'auto' | 'ocr_only' | 'gemini_only'>('auto');
  const [geminiUsageStats, setGeminiUsageStats] = useState<{
    date: string;
    todayCount: number;
    dailyQuotaLimit: number;
    remainingToday: number;
    totalAllTimeCount: number;
    todayFallbackCount: number;
    totalFallbackCount: number;
    lastUsedAt: string;
    lastStatus: string;
    lastError?: string;
    latencyMs?: number;
  }>({
    date: new Date().toISOString().slice(0, 10),
    todayCount: 0,
    dailyQuotaLimit: 1500,
    remainingToday: 1500,
    totalAllTimeCount: 0,
    todayFallbackCount: 0,
    totalFallbackCount: 0,
    lastUsedAt: '',
    lastStatus: 'idle',
    lastError: '',
    latencyMs: 0
  });

  const [loadingGeminiStatus, setLoadingGeminiStatus] = useState(false);
  const [savingGeminiConfig, setSavingGeminiConfig] = useState(false);
  const [testingProviderKey, setTestingProviderKey] = useState<'gemini' | 'ocr_space' | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs?: number }>>({});
  const [savedGeminiToast, setSavedGeminiToast] = useState(false);

  // State Pengujian Langsung Mesin OCR Offline
  const [testingOcrFile, setTestingOcrFile] = useState(false);
  const [testReceiptResult, setTestReceiptResult] = useState<any>(null);
  const [testReceiptPreview, setTestReceiptPreview] = useState<string | null>(null);
  const [showRawOcrText, setShowRawOcrText] = useState(false);
  const ocrFileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTestOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTestingOcrFile(true);
    setTestReceiptResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setTestReceiptPreview(base64);
      try {
        const start = Date.now();
        const res = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg'
          })
        });
        const data = await res.json();
        const clientMs = Date.now() - start;
        setTestReceiptResult({
          ...data,
          clientDurationMs: clientMs
        });
        fetchGeminiStatus();
        if (data.success && data.amount > 0) {
          showNotification('success', `OCR Sukses! Terbaca ${formatRupiah(data.amount)} (${data.description || 'Struk'}) dalam ${clientMs} ms`);
        } else {
          showNotification('warning', data.message || 'Foto struk belum berhasil terbaca dengan jelas.');
        }
      } catch (err: any) {
        setTestReceiptResult({ success: false, message: err.message || 'Gagal memproses struk' });
        showNotification('error', 'Gagal memproses struk');
      } finally {
        setTestingOcrFile(false);
        if (ocrFileInputRef.current) ocrFileInputRef.current.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  // Fetch status Gemini & Katalog Provider dari server
  const fetchGeminiStatus = async () => {
    try {
      setLoadingGeminiStatus(true);
      const res = await fetch('/api/admin/gemini-status');
      if (res.ok) {
        const data = await res.json();
        if (data && data.providers) {
          setProvidersList(data.providers);
        }
        if (data && data.config) {
          setGeminiHasKey(Boolean(data.config.hasKey));
          setGeminiIsCustom(Boolean(data.config.isCustom));
          setGeminiMaskedKey(data.config.maskedKey || '');
          setOcrSpaceHasKey(Boolean(data.config.hasOcrSpaceKey));
          setOcrSpaceMaskedKey(data.config.maskedOcrSpaceKey || '');
          setActiveProvider(data.config.activeProvider || 'gemini');
          setGeminiOcrMode(data.config.ocrMode || 'auto');
        }
        if (data && data.stats) {
          setGeminiUsageStats(data.stats);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch gemini status:', e);
    } finally {
      setLoadingGeminiStatus(false);
    }
  };

  React.useEffect(() => {
    fetchGeminiStatus();
  }, []);

  const handleSaveAllOcrConfig = async (overrides?: {
    newOcrMode?: 'auto' | 'ocr_only' | 'gemini_only';
    newActiveProvider?: 'gemini' | 'ocr_space' | 'local_tesseract';
  }) => {
    setSavingGeminiConfig(true);
    try {
      const mode = overrides?.newOcrMode || geminiOcrMode;
      const provider = overrides?.newActiveProvider || activeProvider;
      const res = await fetch('/api/admin/gemini-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: geminiApiKeyInput.trim() ? geminiApiKeyInput.trim() : undefined,
          ocrSpaceApiKey: ocrSpaceApiKeyInput.trim() ? ocrSpaceApiKeyInput.trim() : undefined,
          activeProvider: provider,
          ocrMode: mode
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.providers) setProvidersList(data.providers);
        if (data.config) {
          setGeminiHasKey(Boolean(data.config.hasKey));
          setGeminiIsCustom(Boolean(data.config.isCustom));
          setGeminiMaskedKey(data.config.maskedKey || '');
          setOcrSpaceHasKey(Boolean(data.config.hasOcrSpaceKey));
          setOcrSpaceMaskedKey(data.config.maskedOcrSpaceKey || '');
          setActiveProvider(data.config.activeProvider || 'gemini');
          setGeminiOcrMode(data.config.ocrMode || 'auto');
        }
        if (data.stats) setGeminiUsageStats(data.stats);
        setGeminiApiKeyInput('');
        setOcrSpaceApiKeyInput('');
        setSavedGeminiToast(true);
        showNotification('success', 'Konfigurasi Provider & Kunci API berhasil disimpan selamanya!');
        setTimeout(() => setSavedGeminiToast(false), 3000);
      }
    } catch (e: any) {
      showNotification('error', 'Gagal menyimpan konfigurasi');
    } finally {
      setSavingGeminiConfig(false);
    }
  };

  const handleResetToDefaultKey = async () => {
    if (!window.confirm('Kembalikan API Key Gemini ke kunci default sistem bawaan?')) return;
    setSavingGeminiConfig(true);
    try {
      const res = await fetch('/api/admin/gemini-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiKey: '',
          activeProvider,
          ocrMode: geminiOcrMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setGeminiHasKey(Boolean(data.config.hasKey));
          setGeminiIsCustom(false);
          setGeminiMaskedKey(data.config.maskedKey || '');
        }
        if (data.stats) setGeminiUsageStats(data.stats);
        setGeminiApiKeyInput('');
        showNotification('success', 'API Key berhasil dikembalikan ke default sistem bawaan!');
      }
    } catch (e) {
      showNotification('error', 'Gagal mereset API Key');
    } finally {
      setSavingGeminiConfig(false);
    }
  };

  const handleTestProvider = async (provider: 'gemini' | 'ocr_space') => {
    setTestingProviderKey(provider);
    try {
      const keyToTest = provider === 'gemini' ? geminiApiKeyInput.trim() : ocrSpaceApiKeyInput.trim();
      const res = await fetch('/api/admin/gemini-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: keyToTest || undefined,
          provider
        })
      });
      const data = await res.json();
      setProviderTestResults(prev => ({ ...prev, [provider]: data }));
      if (data.success) {
        showNotification('success', `Koneksi ${provider === 'gemini' ? 'Google AI Studio' : 'OCR.space'} Berhasil! Latensi ${data.latencyMs || 0} ms.`);
      } else {
        showNotification('error', data.message || `Uji koneksi ${provider} gagal.`);
      }
    } catch (e: any) {
      setProviderTestResults(prev => ({
        ...prev,
        [provider]: { success: false, message: e.message || 'Gagal menghubungi server pengujian.' }
      }));
      showNotification('error', `Gagal menguji ${provider}`);
    } finally {
      setTestingProviderKey(null);
    }
  };

  const handleResetGeminiQuotaCounter = async () => {
    if (!window.confirm('Reset hitungan pemakaian kuota harian kembali ke 0?')) return;
    try {
      const res = await fetch('/api/admin/gemini-reset-counter', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setGeminiUsageStats(data.stats);
        showNotification('success', 'Penghitung kuota harian berhasil di-reset ke 0!');
      }
    } catch (e) {
      showNotification('error', 'Gagal me-reset kuota');
    }
  };

  // Sinkronisasi otomatis input dari props jika input saat ini kosong atau props diperbarui
  React.useEffect(() => {
    const latestAdminUrl = adminGoogleSheetUrl || settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();
    if (latestAdminUrl && !adminSheetUrlInput) {
      setAdminSheetUrlInput(latestAdminUrl);
    }
  }, [adminGoogleSheetUrl, settings?.adminGoogleSheetUrl]);

  React.useEffect(() => {
    const latestClientId = settings?.googleClientId || getGoogleClientId();
    if (latestClientId && !googleClientIdInput) {
      setGoogleClientIdInput(latestClientId);
    }
  }, [settings?.googleClientId]);

  // Sync cloud settings on load if Google Sheet is configured
  React.useEffect(() => {
    const targetUrl = getActiveAdminUrl();
    if (targetUrl) {
      fetchSettingsFromCloud(targetUrl).then((cloudSets) => {
        if (cloudSets) {
          const cloudGoogleId = cloudSets.GOOGLE_CLIENT_ID || cloudSets.googleClientId;
          if (cloudGoogleId && !googleClientIdInput) {
            setGoogleClientIdInput(cloudGoogleId);
          }
        }
      }).catch(err => console.warn('Sync cloud settings err:', err));
    }
  }, [adminSheetUrlInput, adminGoogleSheetUrl, googleSheetUrl]);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCopyCode = () => {
    const activeCode = codeScriptTab === 'admin' ? GOOGLE_APPS_SCRIPT_ADMIN_CODE : GOOGLE_APPS_SCRIPT_CODE;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activeCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      showNotification('success', codeScriptTab === 'admin' ? 'Script adminCode.gs berhasil disalin!' : 'Script Code.gs All-in-One berhasil disalin!');
    }
  };

  // Simpan URL Spreadsheet Khusus Admin (Tersimpan permanen di server & browser selamanya)
  const handleSaveAdminSheetUrl = async () => {
    const cleanUrl = adminSheetUrlInput.trim();
    saveAdminGoogleSheetUrl(cleanUrl, true);
    await saveSystemConfigToServer({ adminGoogleSheetUrl: cleanUrl });

    if (onSaveSettings && settings) {
      onSaveSettings({
        ...settings,
        adminGoogleSheetUrl: cleanUrl
      });
    }
    setSavedAdminSheetToast(true);
    showNotification('success', cleanUrl ? 'URL Google Spreadsheet Admin berhasil disimpan secara global di website selamanya!' : 'URL Google Spreadsheet Admin telah dikosongkan.');
    setTimeout(() => setSavedAdminSheetToast(false), 3000);
  };

  // Uji Koneksi ke Spreadsheet Admin
  const handleTestAdminConnection = async () => {
    const cleanUrl = adminSheetUrlInput.trim() || getActiveAdminUrl();
    if (!cleanUrl) {
      showNotification('error', 'Masukkan URL Spreadsheet Admin terlebih dahulu!');
      return;
    }
    setTestingAdminConnection(true);
    setAdminTestResult(null);

    // 1. Coba uji koneksi via backend proxy (bebas CORS & redirect)
    try {
      const pRes = await fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: cleanUrl,
          method: 'GET',
          payload: { action: 'get_users' }
        })
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        const gasData = pData.data;
        if (gasData && (gasData.success || Array.isArray(gasData.users))) {
          const count = Array.isArray(gasData.users) ? gasData.users.length : 0;
          setAdminTestResult({ 
            success: true, 
            message: `Koneksi berhasil! Ditemukan ${count} akun pengguna di Spreadsheet Admin.` 
          });
          if (Array.isArray(gasData.users) && gasData.users.length > 0) {
            saveStoredUsers(gasData.users);
            setUsers(gasData.users);
          }
          showNotification('success', 'Koneksi ke Google Spreadsheet Admin berhasil!');
          setTestingAdminConnection(false);
          return;
        }
      }
    } catch (e) {
      console.warn('[AdminTest] Sheets proxy error, falling back to direct fetch:', e);
    }

    // 2. Direct browser fetch
    try {
      const res = await fetch(`${cleanUrl}?action=get_users`);
      const data = await res.json();
      if (data && (data.success || Array.isArray(data.users))) {
        setAdminTestResult({ 
          success: true, 
          message: `Koneksi berhasil! Ditemukan ${data.users ? data.users.length : 0} akun pengguna di Spreadsheet Admin.` 
        });
        if (Array.isArray(data.users) && data.users.length > 0) {
          saveStoredUsers(data.users);
          setUsers(data.users);
        }
        showNotification('success', 'Koneksi ke Google Spreadsheet Admin berhasil!');
      } else {
        setAdminTestResult({ 
          success: false, 
          message: data.message || 'Spreadsheet merespons, namun format respons data tidak sesuai.' 
        });
      }
    } catch (err: any) {
      try {
        const pingRes = await fetch(`${cleanUrl}?action=test_connection`);
        const pingData = await pingRes.json();
        if (pingData && pingData.success) {
          setAdminTestResult({
            success: true,
            message: 'Koneksi berhasil terhubung dengan Web App Google Apps Script Admin!'
          });
          showNotification('success', 'Koneksi ke Spreadsheet Admin berhasil!');
          return;
        }
      } catch (e) {}

      setAdminTestResult({
        success: false,
        message: 'Gagal terhubung. Pastikan Web App disetel "Anyone" (Siapa saja) dan URL deployment berakhiran /exec.'
      });
      showNotification('error', 'Gagal terhubung ke Google Spreadsheet Admin');
    } finally {
      setTestingAdminConnection(false);
    }
  };

  const handleSaveGoogleClientId = async () => {
    const clean = cleanGoogleClientId(googleClientIdInput);
    setGoogleClientIdInput(clean);
    saveGoogleClientId(clean, true);
    await saveSystemConfigToServer({ googleClientId: clean });

    if (onSaveSettings && settings) {
      onSaveSettings({
        ...settings,
        googleClientId: clean
      });
    }
    setSavedGoogleAuthToast(true);
    setTimeout(() => setSavedGoogleAuthToast(false), 3000);

    // Sync to Google Spreadsheet 'Settings' Sheet
    const targetAdminUrl = getActiveAdminUrl();
    if (targetAdminUrl) {
      try {
        const cloudRes = await saveSettingToCloud(
          targetAdminUrl,
          'GOOGLE_CLIENT_ID',
          clean,
          'OAuth 2.0 Web Client ID untuk fitur Masuk dengan Akun Google'
        );
        if (cloudRes.success) {
          showNotification('success', 'Google Auth ID berhasil disimpan secara global di website & lembar "Settings" Google Spreadsheet Admin!');
        } else {
          showNotification('success', clean ? 'Google Auth Client ID berhasil disimpan secara global di website selamanya!' : 'Google Auth Client ID telah dikosongkan.');
        }
      } catch (err) {
        showNotification('success', clean ? 'Google Auth Client ID berhasil disimpan secara global di website selamanya!' : 'Google Auth Client ID telah dikosongkan.');
      }
    } else {
      showNotification('success', clean ? 'Google Auth Client ID berhasil disimpan secara global di website selamanya!' : 'Google Auth Client ID telah dikosongkan.');
    }
  };

  const handleCopyOrigin = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.origin);
      setCopiedOrigin(true);
      setTimeout(() => setCopiedOrigin(false), 2500);
      showNotification('success', 'URL Domain web berhasil disalin!');
    }
  };

  const refreshUserList = () => {
    setUsers(getStoredUsers());
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Open edit modal
  const handleStartEdit = (u: User) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditUsername(u.username);
    setEditPassword(u.password || '');
    setEditRole(u.role);
    setEditStatus(u.status);
    setEditGoogleSheetUrl(u.googleSheetUrl || '');
    setEditTelegramBotToken(u.telegramBotToken || '');
    setEditTelegramChatId(u.telegramChatId || '');
  };

  // Save edit user
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const targetAdminUrl = getActiveAdminUrl();
    const res = updateUserByAdmin(
      editingUser.id,
      {
        name: editName.trim(),
        email: editEmail.trim(),
        username: editUsername.trim(),
        password: editPassword.trim(),
        role: editRole,
        status: editStatus,
        googleSheetUrl: editGoogleSheetUrl.trim(),
        telegramBotToken: editTelegramBotToken.trim(),
        telegramChatId: editTelegramChatId.trim(),
        useCloudStorage: Boolean(editGoogleSheetUrl.trim())
      },
      targetAdminUrl
    );

    if (res.success) {
      showNotification('success', res.message);
      setEditingUser(null);
      refreshUserList();
    } else {
      showNotification('error', res.message);
    }
  };

  // Delete user
  const handleDeleteUser = (u: User) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pengguna "${u.name}" (@${u.username}) secara permanen? Seluruh riwayat transaksi akun ini juga akan dihapus.`)) {
      const targetAdminUrl = getActiveAdminUrl();
      const res = deleteUserByAdmin(u.id, targetAdminUrl);
      if (res.success) {
        showNotification('success', res.message);
        refreshUserList();
      } else {
        showNotification('error', res.message);
      }
    }
  };

  // Toggle user active/suspended status
  const handleToggleStatus = (u: User) => {
    const nextStatus = u.status === 'active' ? 'suspended' : 'active';
    const targetAdminUrl = getActiveAdminUrl();
    const res = updateUserByAdmin(u.id, { status: nextStatus }, targetAdminUrl);
    if (res.success) {
      showNotification('success', `Status akun @${u.username} diubah menjadi ${nextStatus === 'active' ? 'Aktif' : 'Dinonaktifkan'}`);
      refreshUserList();
    }
  };

  // Add new user by Admin
  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = newUsername.trim().toLowerCase().replace(/\s+/g, '');
    const cleanEmail = newEmail.trim().toLowerCase();

    if (!newName.trim() || !cleanEmail || !cleanUsername || !newPassword.trim()) {
      showNotification('error', 'Seluruh kolom utama wajib diisi!');
      return;
    }

    const currentUsers = getStoredUsers();
    if (currentUsers.some(u => u.username.toLowerCase() === cleanUsername)) {
      showNotification('error', 'Username tersebut sudah dipakai pengguna lain!');
      return;
    }

    if (currentUsers.some(u => u.email.toLowerCase() === cleanEmail)) {
      showNotification('error', 'Alamat email tersebut sudah terdaftar!');
      return;
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newName.trim(),
      email: cleanEmail,
      username: cleanUsername,
      password: newPassword.trim(),
      role: newRole,
      createdAt: new Date().toISOString(),
      status: 'active',
      googleSheetUrl: newGoogleSheetUrl.trim(),
      telegramBotToken: newTelegramBotToken.trim(),
      telegramChatId: newTelegramChatId.trim(),
      useCloudStorage: Boolean(newGoogleSheetUrl.trim())
    };

    const updated = [...currentUsers, newUser];
    saveStoredUsers(updated);

    // Simpan pengaturan privat user jika ada konfigurasi
    if (newGoogleSheetUrl.trim() || newTelegramBotToken.trim() || newTelegramChatId.trim()) {
      saveUserSettings(newUser.id, {
        googleSheetUrl: newGoogleSheetUrl.trim(),
        telegramBotToken: newTelegramBotToken.trim(),
        telegramChatId: newTelegramChatId.trim(),
        useCloudStorage: Boolean(newGoogleSheetUrl.trim())
      });
    }

    // Sync to Sheets
    const targetAdminUrl = getActiveAdminUrl();
    if (targetAdminUrl) {
      fetch(targetAdminUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', user: newUser })
      }).catch(err => console.warn('Sync add user to Sheets err:', err));
    }

    showNotification('success', `Pengguna baru "${newUser.name}" (@${newUser.username}) berhasil ditambahkan!`);
    setShowAddModal(false);
    setNewName('');
    setNewEmail('');
    setNewUsername('');
    setNewPassword('');
    setNewGoogleSheetUrl('');
    setNewTelegramBotToken('');
    setNewTelegramChatId('');
    refreshUserList();
  };

  // Sync users to Google Sheets manually
  const handleSyncUsersToSheet = async () => {
    const targetAdminUrl = getActiveAdminUrl();
    if (!targetAdminUrl) {
      showNotification('error', 'URL Google Apps Script Admin belum dikonfigurasi!');
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Post current users list to Sheets
      await fetch(targetAdminUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_all_users',
          users: users
        })
      });

      // 2. Coba fetch balik jika sheet mendukung
      try {
        const res = await fetch(`${targetAdminUrl}?action=get_users`);
        const json = await res.json();
        if (json.success && Array.isArray(json.users) && json.users.length > 0) {
          saveStoredUsers(json.users);
          setUsers(json.users);
        }
      } catch (err) {}

      showNotification('success', 'Sinkronisasi data seluruh akun pengguna ke Google Spreadsheet Admin berhasil!');
    } catch (e: any) {
      showNotification('error', 'Gagal menyinkronkan data pengguna ke Google Spreadsheet Admin');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter(u => {
    const matchSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (roleFilter === 'all') return matchSearch;
    return matchSearch && u.role === roleFilter;
  });

  // Count transactions per user
  const getUserTxStats = (userId: string, username: string) => {
    const userTx = allTransactions.filter(
      t => (t.userId && t.userId === userId) || (t.username && t.username.toLowerCase() === username.toLowerCase())
    );
    const totalAmount = userTx.reduce((sum, t) => sum + t.amount, 0);
    return { count: userTx.length, totalAmount };
  };

  const totalAllSystemMoney = allTransactions.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-fadeIn pb-16">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900/50 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black uppercase tracking-wider flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Super Admin Panel</span>
              </span>
              <span className="text-xs text-slate-400">• FahKeu Multi-User Management</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Dashboard Kontrol Administrator
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Halo, <b>{currentUser.name}</b> (@{currentUser.username})! Kelola seluruh akun pengguna, pantau lalu lintas keuangan masing-masing akun, reset kata sandi, dan sinkronkan data ke Google Spreadsheet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCodeModal(true)}
              className="px-3.5 py-2.5 bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-400/40 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer text-white shadow-md active:scale-95"
              title="Lihat & Salin Kode Apps Script (Code.gs) khusus database pengguna"
            >
              <Code2 className="w-4 h-4 text-emerald-200" />
              <span>Script Code.gs Admin</span>
            </button>

            <button
              onClick={handleSyncUsersToSheet}
              disabled={isSyncing}
              className="px-3.5 py-2.5 bg-indigo-600/60 hover:bg-indigo-600 border border-indigo-400/30 rounded-xl text-xs font-bold flex items-center space-x-2 transition cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-300' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkron ke Sheets'}</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Pengguna</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-md animate-fadeIn ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : feedback.type === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
            : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : feedback.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Metrik Ringkasan (Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Pengguna</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <span className="text-emerald-600 font-bold">{users.filter(u => u.status === 'active').length} Aktif</span>
            <span>•</span>
            <span className="text-rose-500 font-bold">{users.filter(u => u.status === 'suspended').length} Terblokir</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Akun Admin</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {users.filter(u => u.role === 'admin').length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Hak akses penuh sistem
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Transaksi Tercatat</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {allTransactions.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Lintas seluruh akun user
          </div>
        </div>

        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Volume Perputaran Dana</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-600">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 truncate">
            {formatRupiah(totalAllSystemMoney)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Akumulasi transaksi tersimpan
          </div>
        </div>
      </div>

      {/* Pengaturan Google Spreadsheet Khusus Admin (Database Pengguna & Master Sistem) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Google Spreadsheet Khusus Admin (Database Pengguna & Akun)
                </h2>
                {adminSheetUrlInput.trim() ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-black uppercase">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold uppercase">
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Masukkan URL Web App Google Apps Script khusus database admin untuk mengelola pendaftaran user, reset password, status akun, dan master pengaturan sistem.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setCodeScriptTab('admin');
                setShowCodeModal(true);
              }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Salin Script adminCode.gs</span>
            </button>
          </div>
        </div>

        {/* Banner Pembeda Kolom Spreadsheet Admin vs Pencatat Keuangan */}
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
          <div className="flex items-center space-x-2 font-bold text-amber-950 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Pembedaan Kolom Input Spreadsheet (Jangan Sampai Tertukar):</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] leading-relaxed">
            <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-1">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 block">
                1. Kolom Input di Sini (Spreadsheet Admin):
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                Khusus untuk <b>Super Admin</b> mengatur master pengguna (Sheet <code className="font-mono font-bold">Users</code>: Nama, Email, Username, Password, Status) & autentikasi sistem. Menggunakan script <code className="font-mono font-bold text-indigo-600 dark:text-indigo-400">adminCode.gs</code>.
              </p>
            </div>
            <div className="p-2.5 bg-white/70 dark:bg-slate-900/60 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-1">
              <span className="font-bold text-emerald-700 dark:text-emerald-300 block">
                2. Kolom Input di Tab Pengaturan (Pencatat Keuangan):
              </span>
              <p className="text-slate-700 dark:text-slate-300">
                Khusus untuk <b>Pencatat Keuangan</b> setiap pengguna untuk merekam mutasi uang (Pemasukan, Pengeluaran, Saldo) & Bot Telegram. Menggunakan script <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">financeCode.gs</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Input & Action Buttons */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            URL Web App Spreadsheet Khusus Admin (Database Pengguna)
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={adminSheetUrlInput}
                onChange={(e) => setAdminSheetUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSaveAdminSheetUrl}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition cursor-pointer active:scale-95"
              >
                {savedAdminSheetToast ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{savedAdminSheetToast ? 'Tersimpan!' : 'Simpan URL Admin'}</span>
              </button>

              <button
                type="button"
                onClick={handleTestAdminConnection}
                disabled={testingAdminConnection || !adminSheetUrlInput.trim()}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center space-x-1.5 transition cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingAdminConnection ? 'animate-spin text-indigo-500' : ''}`} />
                <span>{testingAdminConnection ? 'Menguji...' : 'Uji Koneksi'}</span>
              </button>
            </div>
          </div>

          {/* Test Result Toast/Notice */}
          {adminTestResult && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center space-x-2 animate-fadeIn ${
              adminTestResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
            }`}>
              {adminTestResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{adminTestResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Pengaturan Google Auth Client ID */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Pengaturan Google Auth ID
                </h2>
                {googleClientIdInput.trim() ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-black uppercase">
                    Aktif
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[10px] font-bold uppercase">
                    Belum Dikonfigurasi
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Masukkan Google Client ID (OAuth 2.0 Web Client ID) agar pengguna dan admin bisa langsung masuk dengan Akun Google yang terdaftar.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGoogleGuide(!showGoogleGuide)}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 self-start sm:self-auto cursor-pointer"
          >
            <span>{showGoogleGuide ? 'Sembunyikan Panduan' : '📖 Cara Mendapatkan Google Client ID'}</span>
          </button>
        </div>

        {/* Panduan Google Cloud Console (jika dibuka) */}
        {showGoogleGuide && (
          <div className="my-4 p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 rounded-2xl text-xs space-y-2.5 text-slate-700 dark:text-slate-300 animate-fadeIn">
            <div className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center space-x-1.5">
              <span>Langkah Cepat Mendapatkan Google Client ID:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
              <li>
                Buka <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 font-bold underline inline-flex items-center space-x-0.5"><span>Google Cloud Console Credentials</span></a>.
              </li>
              <li>
                Klik <b>+ CREATE CREDENTIALS</b> lalu pilih <b>OAuth client ID</b>.
              </li>
              <li>
                Pilih Application type: <b>Web application</b>.
              </li>
              <li className="flex flex-wrap items-center gap-1.5">
                <span>Pada bagian <b>Authorized JavaScript origins</b>, tambahkan URL web saat ini:</span>
                <span className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-indigo-600 dark:text-indigo-300 text-[11px]">
                  {typeof window !== 'undefined' ? window.location.origin : 'URL Web'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyOrigin}
                  className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700 transition cursor-pointer"
                >
                  {copiedOrigin ? 'Tersalin!' : 'Salin URL'}
                </button>
              </li>
              <li>
                Klik <b>CREATE</b>, lalu salin <b>Client ID</b> (berakhiran <code>.apps.googleusercontent.com</code>) dan tempelkan pada kolom di bawah.
              </li>
            </ol>
          </div>
        )}

        {/* Kolom Input & Simpan */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={googleClientIdInput}
              onChange={(e) => setGoogleClientIdInput(e.target.value)}
              placeholder="Contoh: 1234567890-abcdefgh12345.apps.googleusercontent.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveGoogleClientId}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition cursor-pointer active:scale-95 shrink-0"
          >
            {savedGoogleAuthToast ? <Check className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{savedGoogleAuthToast ? 'Tersimpan!' : 'Simpan Google Auth ID'}</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Tersimpan Rapi di Lembar 'Settings' Spreadsheet</span>
            </span>
            <span className="inline-flex items-center space-x-1 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800/60">
              <Lock className="w-3.5 h-3.5" />
              <span>Terpisah Aman dari Data Pengguna & Transaksi</span>
            </span>
          </div>
          <p className="leading-relaxed">
            💡 <b>Fitur Menu Kustom di Google Spreadsheet:</b> Anda juga dapat langsung mengelola pengaturan dan Google Auth ID langsung dari spreadsheet Anda melalui menu atas: <span className="font-bold text-slate-700 dark:text-slate-200">⚙️ Pengaturan FahKeu &gt; 🔑 Atur / Periksa Google Auth ID</span> tanpa perlu membuka panel admin ini!
          </p>
        </div>
      </div>



      {/* Notice Multi-Spreadsheet & Multi-Bot Telegram Privat */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-900/50 rounded-2xl shadow-sm text-xs space-y-2">
        <div className="flex items-center space-x-2 text-indigo-300 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Arsitektur Multi-Spreadsheet & Multi-Bot Telegram Mandiri</span>
        </div>
        <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
          Setiap akun pengguna memiliki <b>Google Spreadsheet</b> dan <b>Bot Telegram privat masing-masing</b>. Data keuangan antar pengguna 100% terisolasi dan tidak akan saling tercampur. Administrator dapat melihat status integrasi atau menetapkan tautan Spreadsheet & Bot Telegram pengguna melalui tombol <b>Edit (✏️)</b> pada tabel di bawah.
        </p>
      </div>

      {/* Tabel Manajemen Pengguna */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        
        {/* Filter & Pencarian Bar */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Daftar Pengguna Terdaftar ({filteredUsers.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, email, username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none font-medium"
            >
              <option value="all">Semua Peran</option>
              <option value="user">User Biasa</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>

        {/* Tabel Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Pengguna</th>
                <th className="px-4 py-3.5">Username & Email</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5">Kata Sandi</th>
                <th className="px-4 py-3.5">Spreadsheet & Bot Privat</th>
                <th className="px-4 py-3.5">Transaksi</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Tidak ditemukan data pengguna yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const txStats = getUserTxStats(u.id, u.username);
                  const isPassVisible = Boolean(visiblePasswords[u.id]);

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      
                      {/* Avatar & Nama */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase ${
                            u.role === 'admin' 
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/40'
                              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {u.name.substring(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                              <span>{u.name}</span>
                              {u.id === currentUser.id && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">Anda</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {u.id.substring(0, 12)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Username & Email */}
                      <td className="px-4 py-4">
                        <div className="font-mono text-slate-900 dark:text-slate-100">@{u.username}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4">
                        {u.role === 'admin' ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/50 text-[10px] font-bold inline-flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-amber-600" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold">
                            User
                          </span>
                        )}
                      </td>

                      {/* Kata Sandi (Bisa diintip admin) */}
                      <td className="px-4 py-4 font-mono">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-slate-700 dark:text-slate-200">
                            {isPassVisible ? u.password : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(u.id)}
                            className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition"
                            title={isPassVisible ? "Sembunyikan sandi" : "Lihat sandi"}
                          >
                            {isPassVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Spreadsheet & Bot Telegram Privat */}
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            {u.googleSheetUrl ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-semibold" title={u.googleSheetUrl}>
                                <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                <span>Sheet Privat</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                                <span>Sheet: Lokal</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            {u.telegramBotToken ? (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-semibold">
                                <Bot className="w-3 h-3 text-blue-600" />
                                <span>Bot Aktif</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                                <span>Bot: -</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Transaksi Count & Nominal */}
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {txStats.count} Catatan
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Vol: {formatRupiah(txStats.totalAmount)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(u)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer flex items-center space-x-1 ${
                            u.status === 'active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          <span>{u.status === 'active' ? 'Aktif' : 'Terblokir'}</span>
                        </button>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(u)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            title="Edit Data / Reset Password User"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            disabled={u.id === currentUser.id}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Hapus Akun Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Tabel Footer Info */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            💡 <b>Info Privasi:</b> Setiap transaksi keuangan yang dicatat oleh pengguna hanya dapat dilihat dan dikelola secara privat di akun masing-masing.
          </span>
          <span className="font-mono text-[10px]">
            Total Akun: {users.length} | Admin Terproteksi
          </span>
        </div>
      </div>

      {/* MODAL EDIT PENGGUNA */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Edit Pengguna: {editingUser.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Tutup ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Email Terdaftar</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Username</label>
                <input
                  type="text"
                  required
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <Key className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ubah/Reset Kata Sandi User</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Admin berhak mereset</span>
                </div>
                <input
                  type="text"
                  required
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kata sandi baru..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Role / Hak Akses</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                  >
                    <option value="user">User Biasa</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Status Akun</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                  >
                    <option value="active">Aktif (Bisa Login)</option>
                    <option value="suspended">Nonaktif / Terblokir</option>
                  </select>
                </div>
              </div>

              {/* Konfigurasi Mandiri Spreadsheet & Telegram Akun Ini */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
                <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-bold text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Spreadsheet & Bot Telegram Privat Akun</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  Setiap akun memiliki Google Spreadsheet dan Bot Telegram sendiri secara privat.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">
                    URL Web App Google Apps Script (Spreadsheet Privat)
                  </label>
                  <input
                    type="text"
                    value={editGoogleSheetUrl}
                    onChange={(e) => setEditGoogleSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Token Bot Telegram Privat (@BotFather)</span>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Hanya butuh token @BotFather</span>
                  </label>
                  <input
                    type="text"
                    value={editTelegramBotToken}
                    onChange={(e) => setEditTelegramBotToken(e.target.value)}
                    placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Cukup dapatkan Token dari @BotFather di Telegram. Tidak perlu Chat ID tambahan karena sistem otomatis mendeteksi chat ID saat pengguna berinteraksi.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PENGGUNA BARU */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-emerald-600" />
                <span>Tambah Akun Pengguna Baru</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Tutup ✕
              </button>
            </div>

            <form onSubmit={handleAddUserSubmit} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rian Pratama"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Alamat Email</label>
                <input
                  type="email"
                  required
                  placeholder="rian@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Username Unik</label>
                <input
                  type="text"
                  required
                  placeholder="rian_99"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Kata Sandi</label>
                <input
                  type="text"
                  required
                  placeholder="Minimal 4 karakter..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Role / Hak Akses</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-none"
                >
                  <option value="user">User Biasa</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* Konfigurasi Mandiri Spreadsheet & Telegram Akun Baru (Opsional) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-bold text-[11px]">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Spreadsheet & Bot Privat (Opsional)</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Dapat diisi sekarang atau nanti oleh user sendiri di menu Pengaturan.
                </p>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 block">
                    URL Google Apps Script (Spreadsheet Privat)
                  </label>
                  <input
                    type="text"
                    value={newGoogleSheetUrl}
                    onChange={(e) => setNewGoogleSheetUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>Token Bot Telegram (@BotFather)</span>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Hanya butuh token @BotFather</span>
                  </label>
                  <input
                    type="text"
                    value={newTelegramBotToken}
                    onChange={(e) => setNewTelegramBotToken(e.target.value)}
                    placeholder="Contoh: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-mono focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400">
                    Cukup Token dari @BotFather di Telegram (Chat ID tidak dibutuhkan).
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                >
                  Tambahkan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Khusus Script Code.gs Admin & User Database */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header Modal */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
                  <Code2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-white">Google Apps Script (Code.gs)</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Multi-User Ready
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {codeScriptTab === 'admin'
                      ? 'Script khusus pengelolaan database user (Sheet Users), registrasi akun, reset password, dan status akun.'
                      : 'Script gabungan (All-in-One) mencakup autentikasi user, transaksi multi-user, dan Bot Telegram.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCodeModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Script Tab Selector */}
            <div className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCodeScriptTab('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  codeScriptTab === 'admin'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                adminCode.gs (Khusus Database Pengguna & Admin)
              </button>
              <button
                type="button"
                onClick={() => setCodeScriptTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  codeScriptTab === 'all'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                Code.gs Gabungan (All-in-One)
              </button>
            </div>

            {/* Instruction Bar & Copy Action */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <div className="font-black text-slate-800 dark:text-slate-100 flex items-center space-x-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span>Struktur Database Google Spreadsheet yang Dibuat Otomatis:</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight space-y-0.5">
                  <div>• <b>Sheet 'Users'</b>: User_ID, Nama, Email, Username, Password, Role, Tanggal_Daftar, Status</div>
                  <div>• <b>Sheet 'Settings' (Pengaturan Rahasia)</b>: Key, Value, Keterangan, Terakhir_Diperbarui (tempat Google Auth ID tersimpan aman)</div>
                  {codeScriptTab === 'all' && <div>• <b>Sheet 'Transactions'</b>: ID, Tanggal, Tipe, Jumlah, Deskripsi, Kategori, Sumber, User_ID, Username</div>}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl flex items-center space-x-2 shadow-md transition cursor-pointer"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedCode ? 'Berhasil Disalin!' : codeScriptTab === 'admin' ? 'Salin adminCode.gs' : 'Salin Semua Code.gs'}</span>
                </button>
              </div>
            </div>

            {/* Step-by-Step Info */}
            <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <span>
                💡 <b>Langkah Pemasangan:</b> Buat Google Spreadsheet Admin baru &gt; Buka menu <b>Ekstensi &gt; Apps Script</b> &gt; Tempel kode di bawah &gt; Klik <b>Terapkan (Deploy) &gt; Deployment Baru (Jenis: Web App, Akses: Siapa saja)</b> &gt; Salin URL Web App ke input spreadsheet admin di atas.
              </span>
            </div>

            {/* Code Box */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-emerald-400 select-all">
              <pre className="whitespace-pre font-mono">
                {codeScriptTab === 'admin' ? GOOGLE_APPS_SCRIPT_ADMIN_CODE : GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Total ~1.600+ baris kode terintegrasi (CRUD User, Login, Reset Sandi, CRUD Transaksi, Bot Telegram, & PDF)
              </span>
              <button
                type="button"
                onClick={() => setShowCodeModal(false)}
                className="px-4 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
