/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, 
  BarChart3, 
  Settings, 
  Bot, 
  RefreshCw, 
  Coins, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Transaction, Message, AppSettings, OfflineAction, User } from './types';
import { parseTransactionText, formatRupiah } from './utils/parser';
import { generatePDFReport } from './utils/pdfGenerator';
import { 
  getCurrentUser, 
  setCurrentUser as setStoredCurrentUser, 
  syncAllUsersToCloud, 
  getGoogleClientId, 
  getUserSettings, 
  saveUserSettings,
  getAdminGoogleSheetUrl,
  fetchSystemConfigFromServer,
  fetchUserSettingsFromServer,
  fetchUsersFromServer
} from './utils/authService';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import AuthModal from './components/AuthModal';
import AdminDashboard from './components/AdminDashboard';
import UserProfileModal from './components/UserProfileModal';

// High quality initial seed data in Indonesian
const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'seed_1',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'pemasukan',
    amount: 7500000,
    description: 'Gaji Bulanan',
    category: 'Gaji & Pendapatan Tetap',
    source: 'web',
  },
  {
    id: 'seed_2',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'pengeluaran',
    amount: 1500000,
    description: 'Bayar Kosan',
    category: 'Tagihan & Utilitas',
    source: 'web',
  },
  {
    id: 'seed_3',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'pengeluaran',
    amount: 650000,
    description: 'Belanja Bulanan Supermarket',
    category: 'Belanja & Pribadi',
    source: 'web',
  },
  {
    id: 'seed_4',
    date: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'pengeluaran',
    amount: 35000,
    description: 'Makan Bakso Lapangan Tembak',
    category: 'Makanan & Minuman',
    source: 'telegram',
  },
  {
    id: 'seed_5',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'pemasukan',
    amount: 1200000,
    description: 'Freelance Landing Page UMKM',
    category: 'Freelance & Sampingan',
    source: 'web',
  },
  {
    id: 'seed_6',
    date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    type: 'pengeluaran',
    amount: 25000,
    description: 'Kopi Susu Aren',
    category: 'Makanan & Minuman',
    source: 'telegram',
  },
  {
    id: 'seed_7',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    type: 'pengeluaran',
    amount: 50000,
    description: 'Isi Bensin Motor',
    category: 'Transportasi',
    source: 'web',
  },
];

const getWelcomeMessages = (u?: User | null): Message[] => [
  {
    id: 'msg_welcome_1',
    sender: 'bot',
    text: `👋 Halo${u ? `, **${u.name}** (@${u.username})` : ''}! Saya **Bot FahKeu**.\nSaya siap membantu Anda mencatat pemasukan dan pengeluaran secara cepat dan aman di akun Anda!`,
    timestamp: '09:00',
  },
  {
    id: 'msg_welcome_2',
    sender: 'bot',
    text: 'Ketik transaksi Anda dengan bahasa santai:\n✍️ *gaji masuk 3juta*\n✍️ *bakso 15k*\n✍️ *bayar internet 150.000*\n\nData keuangan Anda tersimpan privat khusus di akun ini!',
    timestamp: '09:01',
  },
];

const DEFAULT_SETTINGS: AppSettings = {
  googleSheetUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  useCloudStorage: false,
};

export default function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCurrentUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(!currentUser);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<'chat' | 'grafik' | 'pengaturan' | 'admin'>('chat');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [isTyping, setIsTyping] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [isDesktopOrTablet, setIsDesktopOrTablet] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [theme, setTheme] = useState<'light' | 'dark' | 'luxury-gold'>(() => {
    return (localStorage.getItem('catatkeu_theme') as any) || 'light';
  });

  // Track Telegram transaction IDs that have already been announced to prevent duplicate announcement
  const announcedTelegramTxIdsRef = useRef<Set<string>>(new Set());

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'luxury-gold');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'luxury-gold') {
      root.classList.add('dark', 'luxury-gold');
    }
    localStorage.setItem('catatkeu_theme', theme);
  }, [theme]);

  // Responsive layout detection (Desktop / Tablet)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    setIsDesktopOrTablet(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsDesktopOrTablet(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Sinkronisasi konfigurasi sistem global & daftar user dari server backend
  useEffect(() => {
    fetchSystemConfigFromServer()
      .then(cfg => {
        if (cfg) {
          setSettings(prev => ({
            ...prev,
            adminGoogleSheetUrl: cfg.adminGoogleSheetUrl || prev.adminGoogleSheetUrl || getAdminGoogleSheetUrl(),
            googleClientId: cfg.googleClientId || prev.googleClientId || getGoogleClientId(),
          }));
        }
      })
      .catch(err => {
        console.warn('Init fetch system config:', err);
      });

    fetchUsersFromServer().catch(err => {
      console.warn('Init fetch users from server:', err);
    });
  }, []);

  // Load Settings per User account (setiap user memiliki Google Spreadsheet & Bot Telegram privat)
  useEffect(() => {
    const uSettings = getUserSettings(currentUser?.id);
    setSettings(prev => ({
      ...prev,
      ...uSettings,
      adminGoogleSheetUrl: uSettings.adminGoogleSheetUrl || prev.adminGoogleSheetUrl || getAdminGoogleSheetUrl(),
      googleClientId: uSettings.googleClientId || prev.googleClientId || getGoogleClientId()
    }));

    // Sinkronisasi data pengaturan dari server jika akun sedang login
    if (currentUser?.id) {
      fetchUserSettingsFromServer(currentUser.id).then(serverSettings => {
        if (serverSettings) {
          setSettings(prev => ({
            ...prev,
            ...serverSettings,
            adminGoogleSheetUrl: prev.adminGoogleSheetUrl || getAdminGoogleSheetUrl(),
            googleClientId: prev.googleClientId || getGoogleClientId()
          }));
        }
      });
    }
  }, [currentUser?.id]);

  // Load and isolate data per User account
  useEffect(() => {
    if (!currentUser) return;

    const userTxKey = `catatkeu_tx_${currentUser.id}`;
    const userChatKey = `catatkeu_chat_${currentUser.id}`;

    // 1. Transactions
    const storedTrans = localStorage.getItem(userTxKey);
    if (storedTrans) {
      try {
        const parsed = JSON.parse(storedTrans);
        if (Array.isArray(parsed)) {
          setTransactions(parsed);
          parsed.forEach((t: Transaction) => {
            if (t && t.id) announcedTelegramTxIdsRef.current.add(t.id);
          });
        } else {
          setTransactions([]);
        }
      } catch (e) {
        setTransactions([]);
      }
    } else {
      setTransactions([]);
    }

    // 2. Chat history (deduplikasi otomatis untuk mencegah kunci identik di localStorage)
    const storedMessages = localStorage.getItem(userChatKey);
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed)) {
          const seenMsgIds = new Set<string>();
          const dedupedMessages: Message[] = [];
          for (const m of parsed) {
            if (m && m.id && !seenMsgIds.has(m.id)) {
              seenMsgIds.add(m.id);
              dedupedMessages.push(m);
            }
          }
          setMessages(dedupedMessages);
        } else {
          setMessages(getWelcomeMessages(currentUser));
        }
      } catch (e) {
        setMessages(getWelcomeMessages(currentUser));
      }
    } else {
      const welcome = getWelcomeMessages(currentUser);
      setMessages(welcome);
      localStorage.setItem(userChatKey, JSON.stringify(welcome));
    }
  }, [currentUser?.id]);

  // Save changes to per-user localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`catatkeu_tx_${currentUser.id}`, JSON.stringify(transactions));
    }
  }, [transactions, currentUser?.id]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`catatkeu_chat_${currentUser.id}`, JSON.stringify(messages));
    }
  }, [messages, currentUser?.id]);

  // Sync data automatically if Sheets URL is configured
  useEffect(() => {
    if (settings.googleSheetUrl && settings.useCloudStorage && currentUser) {
      syncWithGoogleSheets();
    }
  }, [settings.googleSheetUrl, settings.useCloudStorage, currentUser?.id]);

  // Calculate Cumulative Balance
  const totalBalance = useMemo(() => {
    return transactions.reduce((acc, curr) => {
      if (curr.type === 'pemasukan') {
        return acc + curr.amount;
      } else {
        return acc - curr.amount;
      }
    }, 0);
  }, [transactions]);

  // Get current time formatted (HH:MM)
  const getCurrentTime = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const [isSyncingOffline, setIsSyncingOffline] = useState(false);

  // Helper to add an action to offline queue
  const queueOfflineAction = (action: Omit<OfflineAction, 'id'>) => {
    const storedQueue = localStorage.getItem('catatkeu_offline_queue');
    let queue: OfflineAction[] = [];
    if (storedQueue) {
      try {
        queue = JSON.parse(storedQueue);
      } catch (e) {
        queue = [];
      }
    }
    const newAction: OfflineAction = {
      ...action,
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    queue.push(newAction);
    localStorage.setItem('catatkeu_offline_queue', JSON.stringify(queue));
  };

  // Helper to process any pending offline transactions when we go online
  const processOfflineQueue = async () => {
    if (!settings.googleSheetUrl || !settings.useCloudStorage || isSyncingOffline) return;

    const storedQueue = localStorage.getItem('catatkeu_offline_queue');
    if (!storedQueue) return;

    let queue: OfflineAction[] = [];
    try {
      queue = JSON.parse(storedQueue);
    } catch (e) {
      return;
    }

    if (queue.length === 0) return;

    setIsSyncingOffline(true);
    setSyncStatus('loading');

    const remainingQueue = [...queue];

    try {
      for (const item of queue) {
        let payload: any = null;
        if (item.action === 'add') {
          payload = { 
            action: 'add', 
            transaction: item.transaction,
            userId: item.transaction?.userId || currentUser?.id,
            username: item.transaction?.username || currentUser?.username
          };
        } else if (item.action === 'delete') {
          payload = { 
            action: 'delete', 
            id: item.transactionId,
            userId: currentUser?.id
          };
        } else if (item.action === 'clear') {
          payload = { 
            action: 'clear',
            userId: currentUser?.role === 'admin' ? 'all' : currentUser?.id
          };
        }

        if (payload) {
          await fetch(settings.googleSheetUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }

        // Successfully sent, pop from memory and localStorage
        remainingQueue.shift();
        localStorage.setItem('catatkeu_offline_queue', JSON.stringify(remainingQueue));
      }

      // Refresh data from sheets to align local and sheet state
      await syncWithGoogleSheets();
    } catch (err) {
      console.error('Failed to flush offline queue to cloud:', err);
      setSyncStatus('failed');
    } finally {
      setIsSyncingOffline(false);
    }
  };

  // Process offline queue on mount or when online event is triggered
  useEffect(() => {
    const handleOnline = () => {
      console.log('Online detected. Syncing offline data...');
      setIsOnline(true);
      processOfflineQueue();
      if (settings.googleSheetUrl) {
        syncAllUsersToCloud(settings.googleSheetUrl);
      }
    };

    const handleOffline = () => {
      console.log('Offline detected.');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      processOfflineQueue();
      if (settings.googleSheetUrl) {
        syncAllUsersToCloud(settings.googleSheetUrl);
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [settings.googleSheetUrl, settings.useCloudStorage, isSyncingOffline]);

  // Sync / Fetch Transactions from Google Sheets Web App & Server (Isolasi data per User & Real-Time Telegram Sync)
  const syncWithGoogleSheets = async (silent = false) => {
    if (!currentUser) return;
    if (!silent) setSyncStatus('loading');
    try {
      const isSuperAdmin = currentUser.role === 'admin';
      let fetchedTx: Transaction[] = [];

      // 1. Fetch dari Server Internal (/api/transactions) untuk mendapatkan transaksi Telegram terbaru secara real-time
      try {
        const srvRes = await fetch(`/api/transactions?userId=${encodeURIComponent(isSuperAdmin ? 'all' : currentUser.id)}`);
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          const srvList = srvData.transactions || srvData.data;
          if (srvData.success && Array.isArray(srvList)) {
            fetchedTx = srvList;
          }
        }
      } catch (srvErr) {
        console.warn('Failed to fetch from internal server transactions:', srvErr);
      }

      // 2. Fetch dari Google Apps Script jika URL terpasang dan bukan template dummy
      if (settings.googleSheetUrl && !settings.googleSheetUrl.includes('AKfycby') && !settings.googleSheetUrl.includes('AKfycbwPLC')) {
        const tgChatParam = settings.telegramChatId ? `&chatId=${encodeURIComponent(settings.telegramChatId.trim())}` : '';
        // Selalu ambil seluruh data riil dari Google Spreadsheet tanpa fragmentasi userId internal
        const queryParam = `action=get_transactions&userId=all${tgChatParam}`;
        
        const fullUrl = `${settings.googleSheetUrl}${settings.googleSheetUrl.includes('?') ? '&' : '?'}${queryParam}`;
        let data: any = null;

        try {
          const res = await fetch(fullUrl);
          data = await res.json();
        } catch (directErr) {
          // Fallback melalui Sheets Proxy di backend untuk mengatasi masalah CORS/network
          try {
            const proxyRes = await fetch('/api/sheets-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: fullUrl,
                method: 'GET'
              })
            });
            const proxyData = await proxyRes.json();
            data = proxyData.data || proxyData;
          } catch (proxyErr) {
            console.warn('Sheets proxy fallback failed:', proxyErr);
          }
        }

        if (data && (data.success || Array.isArray(data.data) || Array.isArray(data))) {
          const sheetTx: Transaction[] = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
          if (sheetTx.length === 0) {
            // ATURAN UTAMA: Jika Google Spreadsheet kosong (0 data), berarti data telah dihapus/direset
            // Wajib set fetchedTx menjadi [] agar mulai bersih dari nol, tidak membangkitkan data lama!
            fetchedTx = [];
          } else {
            fetchedTx = sheetTx;
          }
        }
      }

      if (fetchedTx.length > 0) {
        // Cari mutasi Telegram baru yang belum pernah diumumkan
        const unannouncedTelegramTx = fetchedTx.filter(t => 
          t.source === 'telegram' && !announcedTelegramTxIdsRef.current.has(t.id)
        );

        if (unannouncedTelegramTx.length > 0) {
          // Jika ini pertama kali sinkron dan announced set masih kosong (misal reload halaman),
          // tandai seluruh transaksi lama agar tidak membanjiri chat sekaligus
          const isInitialRun = announcedTelegramTxIdsRef.current.size === 0;
          const nowTime = Date.now();

          // Segera tandai agar tidak pernah diumumkan ganda
          unannouncedTelegramTx.forEach(t => announcedTelegramTxIdsRef.current.add(t.id));

          const currentTotalBalance = fetchedTx.reduce((acc, curr) => {
            return acc + (curr.type === 'pemasukan' ? curr.amount : -curr.amount);
          }, 0);

          // Jika initial run, hanya umumkan transaksi terbaru jika dibuat dalam 45 detik terakhir
          const itemsToAnnounce = isInitialRun
            ? unannouncedTelegramTx.filter(t => nowTime - new Date(t.date || 0).getTime() < 45000)
            : unannouncedTelegramTx;

          if (itemsToAnnounce.length > 0) {
            const sortedUnannounced = [...itemsToAnnounce].sort(
              (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
            );

            const newMessages: Message[] = [];
            sortedUnannounced.forEach(t => {
              const isIncome = t.type === 'pemasukan';
              const feedbackWord = isIncome ? 'uang masuk' : 'uang keluar';
              const formattedNominal = `Rp ${t.amount.toLocaleString('id-ID')}`;
              const timeStr = getCurrentTime();

              // 1. Pesan User terketik seolah dari chat website (dengan penanda Telegram)
              const userText = t.rawText || (isIncome ? `Pemasukan ${t.description} ${formattedNominal}` : `${t.description} ${formattedNominal}`);
              newMessages.push({
                id: `msg_user_tg_${t.id}`,
                sender: 'user' as const,
                text: userText,
                timestamp: timeStr,
                source: 'telegram' as const
              });

              // 2. Balasan konfirmasi Bot sistem dengan kartu rincian lengkap & sisa saldo kas
              newMessages.push({
                id: `msg_bot_tg_${t.id}`,
                sender: 'bot' as const,
                text: `Terima kasih, transaksi dari Telegram sudah tercatat! 📲\nAda ${feedbackWord} ${formattedNominal}, sisa saldo kas Anda sekarang menjadi ${formatRupiah(currentTotalBalance)}.`,
                timestamp: timeStr,
                source: 'telegram' as const,
                parsedTransaction: {
                  type: t.type,
                  amount: t.amount,
                  description: t.description,
                  category: t.category,
                  feedback: `Tercatat realtime via Bot Telegram`,
                  balanceAfter: currentTotalBalance
                }
              });
            });

            setMessages(mPrev => {
              const existingIds = new Set(mPrev.map(m => m.id));
              const uniqueToAdd = newMessages.filter(m => !existingIds.has(m.id));
              if (uniqueToAdd.length === 0) return mPrev;
              return [...mPrev, ...uniqueToAdd];
            });

            // Gentle audio chime for real-time Telegram sync notification
            try {
              const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.35);
              }
            } catch {}
          }
        }

        setTransactions(fetchedTx);
        if (isSuperAdmin) {
          setAllTransactions(fetchedTx);
        }
        setSyncStatus('success');
      } else {
        setTransactions(prev => {
          if (prev.length > 0) {
            if (isSuperAdmin) setAllTransactions([]);
            return [];
          }
          return prev;
        });
        if (!silent) setSyncStatus('success');
      }
    } catch (err) {
      console.error('Error syncing with sheets:', err);
      if (!silent) setSyncStatus('failed');
    }
  };

  // Interval sinkronisasi realtime: memeriksa mutasi baru dari Telegram/Spreadsheet setiap 3.5 detik
  // serta langsung memeriksa begitu jendela browser kembali aktif (focus)
  useEffect(() => {
    if (!currentUser) return;

    // Langsung periksa saat awal halaman dibuka
    syncWithGoogleSheets(true);

    // Sinkronisasi periodik di background (setiap 2 detik untuk respon Telegram instan)
    const interval = setInterval(() => {
      syncWithGoogleSheets(true);
    }, 2000);

    const handleFocus = () => {
      syncWithGoogleSheets(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [settings.googleSheetUrl, currentUser?.id]);

  // Sinkronisasi Dua Arah Terpadu (Website & Spreadsheet Saling Melengkapi 100%)
  const syncBidirectionalWithGoogleSheets = async (targetSheetUrl?: string, silent: boolean = false) => {
    const activeUrl = (targetSheetUrl || settings.googleSheetUrl || '').trim();
    if (!activeUrl || !activeUrl.startsWith('http')) {
      return { success: false, message: 'URL Spreadsheet belum diatur.' };
    }
    if (activeUrl.includes('AKfycby') || activeUrl.includes('AKfycbwPLC')) {
      return { success: false, message: 'URL demo tidak digunakan.' };
    }

    if (!silent) setSyncStatus('syncing');
    try {
      const res = await fetch('/api/sync-two-way', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          sheetUrl: activeUrl
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          if (currentUser?.role === 'admin') {
            setAllTransactions(data.transactions);
          }
          if (currentUser) {
            localStorage.setItem(`catatkeu_tx_${currentUser.id}`, JSON.stringify(data.transactions));
          }
          if (!silent) setSyncStatus('success');

          // Notifikasi informatif di bot chat jika ada data yang saling dilengkapi
          if (!silent && (data.pushedToSheet > 0 || data.pulledToWeb > 0)) {
            const botNotice: Message = {
              id: `msg_sync_${Date.now()}`,
              sender: 'bot',
              text: `🔄 **Sinkronisasi Dua Arah Selesai!**\n\nData di Website dan Google Spreadsheet Anda kini saling melengkapi secara otomatis:\n- **${data.pushedToSheet}** transaksi dari Website dikirim ke Spreadsheet\n- **${data.pulledToWeb}** transaksi dari Spreadsheet ditarik ke Website\n- Total saat ini: **${data.total}** transaksi.`,
              timestamp: getCurrentTime()
            };
            setMessages(prev => [...prev, botNotice]);
          }
          return data;
        }
      }
      if (!silent) setSyncStatus('success');
      return { success: true };
    } catch (err: any) {
      console.warn('Bidirectional sync notice:', err.message);
      if (!silent) setSyncStatus('failed');
      return { success: false, message: err.message };
    }
  };

  // Helper terpusat untuk sinkronisasi ke Google Spreadsheet via proxy backend & fallback direct
  const sendToGoogleSheet = async (payload: any) => {
    if (!settings.googleSheetUrl) return;
    // Jangan batalkan aksi clear meskipun useCloudStorage tidak aktif
    if (payload.action !== 'clear' && !settings.useCloudStorage) return;
    try {
      // 1. Prioritas: Kirim via proxy server (bebas masalah CORS browser & auto redirect 302 Google Apps Script)
      const proxyRes = await fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.googleSheetUrl,
          method: 'POST',
          payload
        })
      });
      if (!proxyRes.ok) {
        throw new Error(`Proxy error status: ${proxyRes.status}`);
      }
    } catch {
      // 2. Fallback direct browser fetch jika proxy backend offline
      await fetch(settings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  };

  // Handles adding transaction to local + cloud (berisi userId & username)
  const handleAddTransaction = async (newT: Transaction) => {
    if (currentUser) {
      newT.userId = currentUser.id;
      newT.username = currentUser.username;
    }

    // 1. Snappy Local Update
    const updated = [newT, ...transactions];
    setTransactions(updated);
    if (currentUser?.role === 'admin') {
      setAllTransactions(prev => [newT, ...prev]);
    }

    // 2. Server persistence update (/api/transactions)
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'add',
        userId: currentUser?.id,
        transaction: newT
      })
    }).catch(err => console.warn('Failed to post tx to server:', err));

    // 3. Cloud Update if enabled (100% sinkron ke Google Spreadsheet)
    if (settings.googleSheetUrl && settings.useCloudStorage) {
      if (!navigator.onLine) {
        queueOfflineAction({ action: 'add', transaction: newT });
        return;
      }
      sendToGoogleSheet({
        action: 'add',
        transaction: newT,
        userId: currentUser?.id,
        username: currentUser?.username,
      }).catch(err => {
        console.error('Failed to post transaction to cloud, queuing for offline sync:', err);
        queueOfflineAction({ action: 'add', transaction: newT });
      });
    }
  };

  // Handles editing transaction (CRUD: Update)
  const handleEditTransaction = async (updatedT: Transaction) => {
    if (currentUser && !updatedT.userId) {
      updatedT.userId = currentUser.id;
      updatedT.username = currentUser.username;
    }

    // 1. Local update
    setTransactions(prev => prev.map(t => t.id === updatedT.id ? updatedT : t));
    if (currentUser?.role === 'admin') {
      setAllTransactions(prev => prev.map(t => t.id === updatedT.id ? updatedT : t));
    }

    // 2. Server persistence update
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'edit',
        userId: currentUser?.id,
        transaction: updatedT
      })
    }).catch(err => console.warn('Failed to edit tx on server:', err));

    // 3. Cloud update (100% sinkron ke Google Spreadsheet)
    if (settings.googleSheetUrl && settings.useCloudStorage) {
      if (!navigator.onLine) {
        queueOfflineAction({ action: 'edit', transaction: updatedT });
        return;
      }
      sendToGoogleSheet({
        action: 'edit',
        transaction: updatedT,
        userId: currentUser?.id,
        username: currentUser?.username,
      }).catch(err => {
        console.error('Failed to post edit to cloud, queuing for offline sync:', err);
        queueOfflineAction({ action: 'edit', transaction: updatedT });
      });
    }
  };

  // Handles deleting single transaction
  const handleDeleteTransaction = async (id: string) => {
    setTransactions(transactions.filter((t) => t.id !== id));
    if (currentUser?.role === 'admin') {
      setAllTransactions(prev => prev.filter((t) => t.id !== id));
    }

    // Server persistence update
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete',
        userId: currentUser?.id,
        id
      })
    }).catch(err => console.warn('Failed to delete tx on server:', err));

    if (settings.googleSheetUrl && settings.useCloudStorage) {
      if (!navigator.onLine) {
        queueOfflineAction({ action: 'delete', transactionId: id });
        return;
      }
      sendToGoogleSheet({
        action: 'delete',
        id,
        userId: currentUser?.id,
      }).catch(err => {
        console.error('Failed to delete transaction on cloud, queuing for offline sync:', err);
        queueOfflineAction({ action: 'delete', transactionId: id });
      });
    }
  };

  // Handles deleting multiple transactions
  const handleDeleteMultipleTransactions = async (ids: string[]) => {
    setTransactions(prev => prev.filter((t) => !ids.includes(t.id)));
    if (currentUser?.role === 'admin') {
      setAllTransactions(prev => prev.filter((t) => !ids.includes(t.id)));
    }

    // Server persistence update
    ids.forEach(id => {
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          userId: currentUser?.id,
          id
        })
      }).catch(() => {});
    });

    if (settings.googleSheetUrl && settings.useCloudStorage) {
      if (!navigator.onLine) {
        ids.forEach(id => {
          queueOfflineAction({ action: 'delete', transactionId: id });
        });
        return;
      }
      Promise.all(
        ids.map(id =>
          sendToGoogleSheet({
            action: 'delete',
            id,
            userId: currentUser?.id,
          })
        )
      ).catch(err => {
        console.error('Failed to batch delete transactions on cloud, queuing for offline sync:', err);
        ids.forEach(id => {
          queueOfflineAction({ action: 'delete', transactionId: id });
        });
      });
    }
  };

  // Handles clearing user data (Reset transaksi ke Rp 0 bersih di Website, Server, Google Spreadsheet, dan Bot Telegram)
  const handleClearTransactions = async () => {
    setTransactions([]);
    if (currentUser) {
      localStorage.removeItem(`catatkeu_tx_${currentUser.id}`);
      if (currentUser.role === 'admin') {
        setAllTransactions([]);
      }
    } else {
      localStorage.removeItem('catatkeu_tx_guest');
    }

    // Bersihkan pelacak notifikasi suara & Telegram agar mulai dari nol
    announcedTelegramTxIdsRef.current.clear();

    const targetUserId = currentUser?.role === 'admin' ? 'all' : (currentUser?.id || 'guest');

    // 1. Server persistence update (/api/transactions: menghapus lokal server & kirim notifikasi reset ke Telegram)
    try {
      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'clear',
          userId: targetUserId
        })
      });
    } catch (err) {
      console.warn('Failed to clear tx on server:', err);
    }

    // 2. Google Spreadsheet sync (100% dibersihkan dari cloud kembali ke header saja)
    if (settings.googleSheetUrl) {
      if (!navigator.onLine) {
        queueOfflineAction({ action: 'clear' });
      } else {
        try {
          await sendToGoogleSheet({
            action: 'clear',
            userId: targetUserId,
            clearAll: true
          });
        } catch (err) {
          console.error('Failed to clear transactions on cloud, queuing for offline sync:', err);
          queueOfflineAction({ action: 'clear' });
        }
      }
    }

    // 3. Kirim notifikasi reset langsung ke Bot Telegram agar bot langsung terupdate seketika
    const tgToken = settings.telegramBotToken || currentUser?.telegramBotToken;
    const tgChatId = settings.telegramChatId || currentUser?.telegramChatId;
    if (tgToken && tgChatId) {
      try {
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: '🗑️ <b>Pemberitahuan Sistem FahKeu:</b>\n\n' +
                  'Seluruh data transaksi telah <b>dihapus dari Website!</b>\n\n' +
                  '📊 <b>Status Saldo Kas Terbaru:</b>\n' +
                  '🟢 Pemasukan: Rp 0\n' +
                  '🔴 Pengeluaran: Rp 0\n' +
                  '💵 Sisa Saldo Kas: <b>Rp 0</b>\n' +
                  '───────────────────────────\n' +
                  '✅ <i>Bot Telegram, Website, & Google Spreadsheet kini kembali sinkron dari nol (Rp 0).</i>',
            parse_mode: 'HTML'
          })
        }).catch(() => {});
      } catch (tgErr) {}
    }

    // 4. Tambahkan pesan notifikasi bot di chat bahwa saldo telah direset bersih ke Rp 0
    const resetMsg: Message = {
      id: `msg_${Date.now()}`,
      sender: 'bot',
      text: '🗑️ **Seluruh data transaksi telah dikosongkan!**\n\nSisa saldo kas Anda kini telah direset bersih menjadi **Rp 0** di Website, Google Spreadsheet, dan Bot Telegram. Seluruh sistem kini mulai mencatat kembali dari nol!',
      timestamp: getCurrentTime(),
    };
    setMessages((prev) => [...prev, resetMsg]);
  };

  // Handles clearing chat history
  const handleClearChat = () => {
    setMessages([]);
    if (currentUser) {
      localStorage.setItem(`catatkeu_chat_${currentUser.id}`, JSON.stringify([]));
    }
  };

  // Handles directly recorded transactions (e.g. from receipt OCR scan)
  const handleDirectTransaction = (tx: {
    type: 'pemasukan' | 'pengeluaran';
    amount: number;
    description: string;
    category: string;
  }) => {
    const newTransaction: Transaction = {
      id: `tx_${Date.now()}`,
      date: new Date().toISOString(),
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
      source: 'web',
    };

    handleAddTransaction(newTransaction);

    const userMsgId = `msg_${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text: `🧾 Mengunggah struk/nota: "${tx.description}"`,
      timestamp: getCurrentTime(),
    };

    const balanceAfter = totalBalance + (tx.type === 'pemasukan' ? tx.amount : -tx.amount);
    const botMsgId = `msg_${Date.now() + 1}`;
    const feedbackWord = tx.type === 'pemasukan' ? 'pemasukan' : 'pengeluaran';
    const detailFeedbackWord = tx.type === 'pemasukan' ? 'uang masuk' : 'uang keluar';
    const botMsg: Message = {
      id: botMsgId,
      sender: 'bot',
      text: `Hasil scan struk berhasil dicatat! 🧾✨\nAda ${feedbackWord} **${tx.description}** sebesar **${formatRupiah(tx.amount)}** (${tx.category}). Sisa saldo Anda sekarang menjadi **${formatRupiah(balanceAfter)}**.`,
      timestamp: getCurrentTime(),
      parsedTransaction: {
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        category: tx.category,
        feedback: `${detailFeedbackWord} ${formatRupiah(tx.amount)}`,
        balanceAfter: balanceAfter,
      }
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  // Generate PDF report for selected period and trigger download
  const handleGeneratePDFReport = (period: 'all' | 'week' | 'month' | 'year') => {
    let filtered = [...transactions];
    let periodName = 'Semua Transaksi';

    if (period === 'week') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      filtered = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
      periodName = '7 Hari Terakhir (Minggu Ini)';
    } else if (period === 'month') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = transactions.filter(t => new Date(t.date) >= thirtyDaysAgo);
      periodName = '30 Hari Terakhir (Bulan Ini)';
    } else if (period === 'year') {
      const currentYear = new Date().getFullYear();
      filtered = transactions.filter(t => new Date(t.date).getFullYear() === currentYear);
      periodName = `Tahun ${currentYear}`;
    }

    generatePDFReport(filtered, periodName);

    const successReply: Message = {
      id: `msg_pdf_ok_${Date.now()}`,
      sender: 'bot',
      text: `✅ **Laporan PDF Berhasil Dibuat!**\n\nRekapitulasi untuk periode **${periodName}** (${filtered.length} transaksi) berhasil diunduh secara otomatis ke perangkat Anda.\n\n_Jika unduhan tidak berjalan otomatis, silakan klik tombol unduh di bawah ini:_`,
      timestamp: getCurrentTime(),
      pdfPeriod: period,
    };
    
    setMessages((prev) => [...prev, successReply]);
  };

  // Handles user messages sent from Chat component
  const handleUserMessage = (text: string) => {
    const cleanText = text.toLowerCase().trim();

    // Check if user wants to clear the chat via message command
    if (
      cleanText === 'hapus chat' ||
      cleanText === 'bersihkan chat' ||
      cleanText === 'hapus riwayat' ||
      cleanText === 'hapus semua chat' ||
      cleanText === 'clear chat' ||
      cleanText === 'hapus semua'
    ) {
      handleClearChat();
      return;
    }

    const userMsgId = `msg_${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: getCurrentTime(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    // Handle bot reply after 700ms
    setTimeout(() => {
      setIsTyping(false);
      // Status 'sent' muncul sementara saat pesan diproses & dijawab
      setMessages((prev) =>
        prev.map((m) => (m.id === userMsgId ? { ...m, status: 'sent' } : m))
      );

      // Notifikasi terkirim otomatis menghilang setelah balasan diterima agar riwayat obrolan kembali bersih
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, status: undefined } : m))
        );
      }, 1200);

      const cleanText = text.toLowerCase().trim();

      // Check if user just queried for balance
      if (cleanText === 'sisa saldo' || cleanText === 'saldo' || cleanText === 'cek saldo') {
        const income = transactions.filter(t => t.type === 'pemasukan').reduce((a, b) => a + b.amount, 0);
        const expense = transactions.filter(t => t.type === 'pengeluaran').reduce((a, b) => a + b.amount, 0);
        
        const balanceReply: Message = {
          id: `msg_${Date.now()}`,
          sender: 'bot',
          text: `📊 **Status Keuangan Anda saat ini:**\n\n• Sisa Saldo: **${formatRupiah(totalBalance)}**\n• Total Pemasukan: ${formatRupiah(income)}\n• Total Pengeluaran: ${formatRupiah(expense)}`,
          timestamp: getCurrentTime(),
        };
        setMessages((prev) => [...prev, balanceReply]);
        return;
      }

      // Check if user is asking for PDF / rekapitulasi download
      const pdfTriggers = [
        'download rekap', 'unduh rekap', 'rekap pdf', 'pdf rekap', 
        'rekap keuangan', 'laporan keuangan', 'export pdf', 'pdf report', 
        'download laporan', 'unduh laporan', 'rekap bulanan', 'rekap harian',
        'pdf rekapitulasi', 'cetak rekap', 'download pdf', 'cetak pdf', 'buat pdf',
        'rekap minggu', 'rekap tahun', 'rekap'
      ];
      const matchesPdf = pdfTriggers.some(trigger => cleanText.includes(trigger)) || 
                          (cleanText.includes('pdf') && cleanText.includes('unduh')) || 
                          (cleanText.includes('rekap') && cleanText.includes('cetak'));

      if (matchesPdf) {
        const pdfSelectorReply: Message = {
          id: `msg_pdf_sel_${Date.now()}`,
          sender: 'bot',
          text: `📄 **Laporan Keuangan PDF (FahKeu)**\n\nSaya dapat membuatkan berkas laporan PDF rekapitulasi transaksi Anda secara otomatis, rapi, dan aman.\n\nSilakan tentukan jangka waktu data transaksi yang ingin Anda masukkan ke dalam laporan PDF:`,
          timestamp: getCurrentTime(),
          isPdfSelector: true,
        };
        setMessages((prev) => [...prev, pdfSelectorReply]);
        return;
      }

      // Parse Transaction
      const parsed = parseTransactionText(text);

      if (!parsed.success) {
        const errorReply: Message = {
          id: `msg_${Date.now()}`,
          sender: 'bot',
          text: `⚠️ Maaf, saya tidak dapat memahami format transaksi tersebut.\n\nPastikan Anda menyertakan keterangan dan nominal uang, misalnya:\n• _gaji masuk 3juta_\n• _bakso 15k_`,
          timestamp: getCurrentTime(),
        };
        setMessages((prev) => [...prev, errorReply]);
        return;
      }

      // Generate New Transaction
      const newTransaction: Transaction = {
        id: `tx_${Date.now()}`,
        date: new Date().toISOString(),
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        category: parsed.category,
        source: 'web',
      };

      // Add to database
      handleAddTransaction(newTransaction);

      // Compute balance after
      const balanceAfter = totalBalance + (parsed.type === 'pemasukan' ? parsed.amount : -parsed.amount);

      // Generate Bot Success Message
      const feedbackWord = parsed.type === 'pemasukan' ? 'uang masuk' : 'uang keluar';
      const botReply: Message = {
        id: `msg_${Date.now()}`,
        sender: 'bot',
        text: `Terima kasih, sudah tercatat! 💰\nAda ${feedbackWord} ${formatRupiah(parsed.amount)}, sisa saldo Anda sekarang menjadi ${formatRupiah(balanceAfter)}.`,
        timestamp: getCurrentTime(),
        parsedTransaction: {
          type: parsed.type,
          amount: parsed.amount,
          description: parsed.description,
          category: parsed.category,
          feedback: `${feedbackWord} ${formatRupiah(parsed.amount)}`,
          balanceAfter,
        },
      };

      setMessages((prev) => [...prev, botReply]);
    }, 800);
  };

  // Handles updating credentials settings per active user
  const handleSaveSettings = (newSettings: AppSettings) => {
    const safeAdminUrl = (newSettings.adminGoogleSheetUrl && newSettings.adminGoogleSheetUrl.trim())
      ? newSettings.adminGoogleSheetUrl.trim()
      : settings.adminGoogleSheetUrl || getAdminGoogleSheetUrl();

    const safeClientId = (newSettings.googleClientId && newSettings.googleClientId.trim())
      ? newSettings.googleClientId.trim()
      : settings.googleClientId || getGoogleClientId();

    const merged: AppSettings = {
      ...newSettings,
      adminGoogleSheetUrl: safeAdminUrl,
      googleClientId: safeClientId
    };

    setSettings(merged);
    saveUserSettings(currentUser?.id, merged);

    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        googleSheetUrl: merged.googleSheetUrl,
        telegramBotToken: merged.telegramBotToken,
        telegramChatId: merged.telegramChatId,
        useCloudStorage: merged.useCloudStorage
      };
      setCurrentUser(updatedUser);
      setStoredCurrentUser(updatedUser);
    }

    // Jalankan Sinkronisasi Dua Arah (Saling Melengkapi) saat konfigurasi spreadsheet disimpan
    if (merged.googleSheetUrl && merged.googleSheetUrl.startsWith('http')) {
      syncBidirectionalWithGoogleSheets(merged.googleSheetUrl, false);
    }
  };

  // Test Web App connectivity
  const handleTestConnection = async (): Promise<boolean> => {
    if (!settings.googleSheetUrl) return false;
    // 1. Coba via backend proxy (bypass CORS)
    try {
      const pRes = await fetch('/api/sheets-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: settings.googleSheetUrl,
          method: 'GET'
        })
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData && (pData.success || pData.data?.success)) return true;
      }
    } catch (e) {}

    // 2. Direct fetch fallback
    try {
      const res = await fetch(settings.googleSheetUrl);
      const data = await res.json();
      return !!data.success;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleLogout = () => {
    setStoredCurrentUser(null);
    setCurrentUser(null);
    // Kembalikan pengaturan ke status tamu bersih (tanpa spreadsheet atau bot privat user sebelumnya)
    setSettings(getUserSettings(null));
    setActiveTab('chat');
    setIsAuthModalOpen(true);
  };

  const handleSuccessLogin = (user: User) => {
    setCurrentUser(user);
    const userSettings = getUserSettings(user.id);
    setSettings(userSettings);
    setIsAuthModalOpen(false);

    // Ambil sinkronisasi terbaru dari server
    if (user.id) {
      fetchUserSettingsFromServer(user.id).then(serverSettings => {
        if (serverSettings) {
          setSettings(prev => ({
            ...prev,
            ...serverSettings,
            adminGoogleSheetUrl: prev.adminGoogleSheetUrl || getAdminGoogleSheetUrl(),
            googleClientId: prev.googleClientId || getGoogleClientId()
          }));
        }
      });
    }
  };

  const getTabClass = (tab: 'chat' | 'grafik' | 'pengaturan' | 'admin') => {
    const isActive = activeTab === tab;
    if (isActive) {
      if (tab === 'admin') {
        return 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105';
      }
      if (theme === 'luxury-gold') {
        return 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.45)] font-black scale-105';
      }
      return 'bg-emerald-500 text-slate-950 font-bold';
    }
    if (tab === 'admin') {
      return 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/40';
    }
    return 'text-slate-300 hover:text-white hover:bg-slate-700/50';
  };

  return (
    <div className={`flex flex-col h-screen bg-slate-100 dark:bg-slate-900 font-sans ${theme === 'luxury-gold' ? 'luxury-gold' : ''}`}>
      
      {/* Top Navbar */}
      <header className={`bg-slate-900 text-white px-3 sm:px-6 py-3.5 flex items-center justify-between border-b shadow-sm shrink-0 ${
        theme === 'luxury-gold' ? 'border-amber-500/20 shadow-[0_4px_20px_rgba(0,0,0,0.4)]' : 'border-slate-800'
      }`}>
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative ${
            theme === 'luxury-gold'
              ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-emerald-500'
          }`}>
            <div className="relative w-6.5 h-6.5 flex items-center justify-center">
              <Bot className={`w-4.5 h-4.5 absolute top-0.5 left-0.5 ${theme === 'luxury-gold' ? 'text-slate-950' : 'text-white'}`} />
              <Coins className={`w-3.5 h-3.5 absolute -bottom-0.5 -right-0.5 ${
                theme === 'luxury-gold' ? 'text-amber-950' : 'text-amber-300 dark:text-amber-400'
              } drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.45)]`} />
            </div>
          </div>
          <div className="truncate">
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>FahKeu</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60 hidden sm:inline-block">
                by faiz_fahmi_id
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium truncate">Pencatat Keuangan AI Multi-User</p>
          </div>
        </div>

        {/* Header Right Content: Sisa Saldo, Profil & Navigation */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Balance Display */}
          <div className={`hidden xs:flex flex-col items-end bg-slate-800/40 px-2.5 py-1 rounded-xl border ${
            theme === 'luxury-gold' ? 'border-amber-500/10' : 'border-slate-700/30'
          }`}>
            <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Saldo</span>
            <span className={`text-xs font-mono font-black ${
              theme === 'luxury-gold' ? 'text-amber-400 font-extrabold' : 'text-emerald-400'
            }`}>
              {formatRupiah(totalBalance)}
            </span>
          </div>

          {/* Navigation Tab Pills */}
          <div className={`flex p-0.5 rounded-xl border ${
            theme === 'luxury-gold' ? 'bg-amber-950/25 border-amber-500/15' : 'bg-slate-800 border-slate-700/40'
          }`}>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${getTabClass('chat')}`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('grafik')}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${getTabClass('grafik')}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grafik</span>
            </button>

            <button
              onClick={() => setActiveTab('pengaturan')}
              className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${getTabClass('pengaturan')}`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pengaturan</span>
            </button>

            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition ${getTabClass('admin')}`}
                title="Kelola Data Seluruh Pengguna"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="inline">Admin</span>
              </button>
            )}
          </div>

          {/* User Account / Profile Chip & Logout */}
          {currentUser ? (
            <div className="flex items-center space-x-1.5">
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className={`cursor-pointer flex items-center space-x-1.5 px-2 py-1 rounded-xl border text-xs transition hover:scale-105 active:scale-95 ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-700/70'
                }`}
                title="Klik logo akun untuk edit username & kata sandi"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px] uppercase shadow-sm ${
                  currentUser.role === 'admin'
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950'
                    : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                }`}>
                  {currentUser.name.substring(0, 1)}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none max-w-[90px]">
                  <span className="font-bold text-[11px] truncate text-white">{currentUser.name}</span>
                  <span className="text-[9px] text-slate-400 font-mono truncate">@{currentUser.username}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                title="Keluar dari Akun (Logout)"
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition"
            >
              Masuk
            </button>
          )}

          {/* Sync Button (If sheet URL set) */}
          {settings.googleSheetUrl && settings.useCloudStorage && (
            <button
              onClick={syncWithGoogleSheets}
              disabled={syncStatus === 'loading'}
              className={`flex items-center justify-center p-2 rounded-xl transition border shrink-0 ${
                theme === 'luxury-gold'
                  ? 'bg-amber-950/40 hover:bg-amber-900/30 border-amber-500/20 text-amber-400 hover:text-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
              }`}
              title="Sinkronisasi Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncStatus === 'loading' && 'animate-spin'}`} />
            </button>
          )}
        </div>
      </header>

      {/* Offline Banner or Sync In-Progress Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center space-x-2">
            <WifiOff className="w-4 h-4 text-slate-950 shrink-0" />
            <span>Mode Offline — Data tersimpan aman di perangkat ini dan akan otomatis tersimpan ke database saat online.</span>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-950/15 border border-slate-950/20 shrink-0">
            Lokal Mode
          </span>
        </div>
      )}

      {isOnline && isSyncingOffline && (
        <div className="bg-emerald-600 text-white px-4 py-1.5 text-xs font-bold flex items-center space-x-2 shadow-sm shrink-0">
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Koneksi online terdeteksi: Menyinkronkan seluruh transaksi offline ke Google Spreadsheet...</span>
        </div>
      )}

      {/* Main Single-Panel Content Layout */}
      <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
        
        {/* Chat Interface (Centered panel for premium readability) */}
        {activeTab === 'chat' && (
          <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col h-full bg-white dark:bg-slate-950 shadow-sm border-x border-slate-200/50 dark:border-slate-800/50">
            <ChatInterface
              messages={messages}
              onSendMessage={handleUserMessage}
              onClearChat={handleClearChat}
              isTyping={isTyping}
              totalBalance={totalBalance}
              onAddTransactionDirect={handleDirectTransaction}
              onGeneratePDFReport={handleGeneratePDFReport}
            />
          </div>
        )}

        {/* Dashboard/Grafik */}
        {activeTab === 'grafik' && (
          <div className="flex-1 flex flex-col h-full min-w-0">
            <Dashboard
              transactions={transactions}
              onDeleteTransaction={handleDeleteTransaction}
              onDeleteMultipleTransactions={handleDeleteMultipleTransactions}
              onClearTransactions={handleClearTransactions}
              onEditTransaction={handleEditTransaction}
              onAddTransaction={handleAddTransaction}
            />
          </div>
        )}

        {/* SettingsPanel */}
        {activeTab === 'pengaturan' && (
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
            <SettingsPanel
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestConnection={handleTestConnection}
              theme={theme}
              onChangeTheme={setTheme}
              currentUser={currentUser}
              onClearTransactions={handleClearTransactions}
              transactionCount={transactions.length}
              onSyncBiDirectional={syncBidirectionalWithGoogleSheets}
            />
          </div>
        )}

        {/* Admin Dashboard Panel (Khusus Role Admin: Kelola Seluruh Data User) */}
        {activeTab === 'admin' && currentUser?.role === 'admin' && (
          <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto">
            <AdminDashboard
              currentUser={currentUser}
              allTransactions={allTransactions.length > 0 ? allTransactions : transactions}
              googleSheetUrl={settings.googleSheetUrl}
              adminGoogleSheetUrl={settings.adminGoogleSheetUrl}
              onRefreshData={syncWithGoogleSheets}
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          </div>
        )}

      </div>

      {/* Modal Autentikasi (Login / Register / Lupa Sandi) */}
      <AuthModal
        isOpen={isAuthModalOpen || !currentUser}
        onSuccessLogin={handleSuccessLogin}
        googleSheetUrl={settings.googleSheetUrl}
        adminGoogleSheetUrl={settings.adminGoogleSheetUrl}
        googleClientId={settings.googleClientId || getGoogleClientId()}
        theme={theme}
      />

      {/* Modal Edit Profil Pengguna (Username & Password - Wajib Email Sama) */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            setStoredCurrentUser(updatedUser);
            // Perbarui username di transaksi aktif jika berubah
            setTransactions(prev => prev.map(t => (t.userId === updatedUser.id ? { ...t, username: updatedUser.username } : t)));
            setAllTransactions(prev => prev.map(t => (t.userId === updatedUser.id ? { ...t, username: updatedUser.username } : t)));
          }}
          googleSheetUrl={settings.googleSheetUrl}
          theme={theme}
        />
      )}

    </div>
  );
}
