import React, { useState, useEffect, useRef } from 'react';
import {
  Clipboard,
  Check,
  ExternalLink,
  Bot,
  Database,
  RefreshCw,
  AlertTriangle,
  Code,
  HelpCircle,
  Play,
  Palette,
  Sun,
  Moon,
  Crown,
  Download,
  Smartphone,
  Laptop,
  CheckCheck,
  Lock,
  ShieldCheck,
  User as UserIcon,
  Sparkles,
  Zap,
  Send,
  MessageSquare,
  Trash2,
  Save,
  AlertCircle,
  Loader2,
  Receipt,
  Camera
} from 'lucide-react';
import { AppSettings, User } from '../types';
import { GOOGLE_APPS_SCRIPT_FINANCE_CODE } from '../utils/code.gs';
import { getGoogleClientId, getAdminGoogleSheetUrl, cleanTelegramToken, isValidTelegramToken } from '../utils/authService';

// ============================================================================
// KONFIGURASI TAUTAN UNDUHAN GOOGLE DRIVE (Android & Desktop)
// Masukkan link Google Drive / file APK / file Installer Desktop Anda di sini:
// ============================================================================
export const DOWNLOAD_LINK_ANDROID = "https://drive.google.com/drive/folders/YOUR_ANDROID_DRIVE_LINK";
export const DOWNLOAD_LINK_DESKTOP = "https://drive.google.com/drive/folders/YOUR_DESKTOP_DRIVE_LINK";

interface SettingsPanelProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  onTestConnection: (urlToTest?: string) => Promise<boolean>;
  theme: 'light' | 'dark' | 'luxury-gold';
  onChangeTheme: (theme: 'light' | 'dark' | 'luxury-gold') => void;
  currentUser?: User | null;
  onClearTransactions?: () => Promise<void> | void;
  transactionCount?: number;
  onSyncBiDirectional?: (url?: string) => Promise<any>;
}

export default function SettingsPanel({ 
  settings, 
  onSaveSettings, 
  onTestConnection,
  theme,
  onChangeTheme,
  currentUser,
  onClearTransactions,
  transactionCount = 0,
  onSyncBiDirectional
}: SettingsPanelProps) {
  const [googleSheetUrl, setGoogleSheetUrl] = useState(settings.googleSheetUrl || '');
  const [telegramBotToken, setTelegramBotToken] = useState(settings.telegramBotToken || '');
  const [telegramChatId, setTelegramChatId] = useState(settings.telegramChatId || '');
  const [useCloudStorage, setUseCloudStorage] = useState(
    settings.useCloudStorage !== undefined 
      ? settings.useCloudStorage 
      : Boolean(settings.googleSheetUrl)
  );

  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccessToast, setClearSuccessToast] = useState(false);

  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'failed'>('idle');
  const [isSyncingTwoWay, setIsSyncingTwoWay] = useState(false);
  const [syncTwoWayResult, setSyncTwoWayResult] = useState<any>(null);
  
  // Sync state when settings prop changes
  useEffect(() => {
    setGoogleSheetUrl(settings.googleSheetUrl || '');
    setTelegramBotToken(settings.telegramBotToken || '');
    setTelegramChatId(settings.telegramChatId || '');
    setUseCloudStorage(
      settings.useCloudStorage !== undefined 
        ? settings.useCloudStorage 
        : Boolean(settings.googleSheetUrl)
    );
  }, [settings]);

  // Telegram webhook & polling states
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'success' | 'failed'>('idle');
  const [webhookMessage, setWebhookMessage] = useState('');
  const [isAutoSettingUp, setIsAutoSettingUp] = useState(false);
  const [isDetectingId, setIsDetectingId] = useState(false);
  const [isWaitingForChatId, setIsWaitingForChatId] = useState(false);
  const [chatIdCountdown, setChatIdCountdown] = useState(60);
  const [botDetails, setBotDetails] = useState<{ id: number; username: string; firstName: string } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [serverBotStatus, setServerBotStatus] = useState<{ active: boolean; botUsername: string; chatId: string } | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; has_custom_certificate?: boolean; pending_update_count?: number; last_error_date?: number; last_error_message?: string } | null>(null);
  const [isCheckingWebhook, setIsCheckingWebhook] = useState(false);

  // Periksa status aktif bot Telegram di server backend secara periodik
  useEffect(() => {
    let isMounted = true;
    const checkBotStatus = async () => {
      const uId = currentUser?.id || 'usr_faiz_02';
      try {
        const res = await fetch(`/api/telegram/status/${uId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            setServerBotStatus({
              active: Boolean(data.active),
              botUsername: data.botUsername || '',
              chatId: data.chatId || ''
            });
            if (data.botUsername && !botDetails) {
              setBotDetails({
                id: 0,
                username: data.botUsername,
                firstName: data.botUsername
              });
            }
            // Prefill field dari server jika input di form belum terisi
            if (data.token && !telegramBotToken) {
              setTelegramBotToken(data.token);
            }
            if (data.chatId && !telegramChatId) {
              setTelegramChatId(data.chatId);
            }
            if (data.googleSheetUrl && !googleSheetUrl) {
              setGoogleSheetUrl(data.googleSheetUrl);
            }
          }
        }
      } catch (err) {
        // Abaikan error jaringan sementara
      }
    };

    checkBotStatus();
    const timer = setInterval(checkBotStatus, 4000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [currentUser?.id, botDetails, telegramBotToken, telegramChatId, googleSheetUrl]);

  // Auto-polling checker untuk mendeteksi Chat ID secara otomatis setelah user klik /start
  const pollDetectChatId = (token: string, botUsername?: string) => {
    const cleanToken = cleanTelegramToken(token);
    const gasUrl = googleSheetUrl.trim();
    setIsWaitingForChatId(true);
    setChatIdCountdown(60);

    let attempts = 0;
    const maxAttempts = 30; // 30 kali x 2 detik = 60 detik batas waktu
    const interval = setInterval(async () => {
      attempts++;
      setChatIdCountdown(prev => Math.max(0, prev - 2));

      if (attempts > maxAttempts) {
        clearInterval(interval);
        setIsWaitingForChatId(false);
        return;
      }

      try {
        let foundId = '';

        // 1. Prioritas Utama: Cek Google Apps Script Webhook (Pilihan 2 - Realtime 24 Jam)
        if (gasUrl && gasUrl.startsWith('http')) {
          try {
            const delimiter = gasUrl.includes('?') ? '&' : '?';
            const gasRes = await fetch(`${gasUrl}${delimiter}action=get_chat_id&t=${Date.now()}`);
            if (gasRes.ok) {
              const gasData = await gasRes.json();
              if (gasData && gasData.success && gasData.chatId) {
                foundId = String(gasData.chatId).trim();
              }
            }
          } catch (gasErr) {}
        }

        // 2. Cek via backend server (/api/telegram/detect-chat-id)
        if (!foundId) {
          try {
            const res = await fetch('/api/telegram/detect-chat-id', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: cleanToken,
                userId: currentUser?.id
              })
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.chatId) {
                foundId = String(data.chatId).trim();
              }
            }
          } catch (serverErr) {}
        }

        // 3. Cek status poller server jika belum ketemu
        if (!foundId && currentUser?.id) {
          try {
            const statRes = await fetch(`/api/telegram/status/${currentUser.id}`);
            if (statRes.ok) {
              const statData = await statRes.json();
              if (statData.success && statData.chatId) {
                foundId = String(statData.chatId).trim();
              }
            }
          } catch (stErr) {}
        }

        // 4. Fallback Telegram getUpdates jika webhook belum aktif
        if (!foundId) {
          try {
            const updRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=10`);
            if (updRes.ok) {
              const updData = await updRes.json();
              if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
                for (let i = updData.result.length - 1; i >= 0; i--) {
                  const msg = updData.result[i].message || updData.result[i].channel_post;
                  if (msg && msg.chat && msg.chat.id) {
                    foundId = String(msg.chat.id).trim();
                    break;
                  }
                }
              }
            }
          } catch (updErr) {}
        }

        if (foundId) {
          clearInterval(interval);
          setIsWaitingForChatId(false);
          setTelegramChatId(foundId);
          setWebhookStatus('success');
          setWebhookMessage(`🎉 Chat ID (${foundId}) berhasil terhubung otomatis dari Telegram! Bot Anda sudah aktif 100%.`);

          // Simpan otomatis dengan mempertahankan Google Sheet URL
          const effectiveUrl = googleSheetUrl.trim() || settings?.googleSheetUrl || '';
          const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
          const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();
          onSaveSettings({
            googleSheetUrl: effectiveUrl,
            adminGoogleSheetUrl: existingAdminUrl,
            telegramBotToken: cleanToken,
            telegramChatId: foundId,
            useCloudStorage: Boolean(effectiveUrl),
            googleClientId: existingGoogleClientId,
          });
          setSavedToast(true);
          setTimeout(() => setSavedToast(false), 3000);
        }
      } catch (e) {}
    }, 2000);
  };

  const handleDetectChatId = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    const gasUrl = googleSheetUrl.trim();
    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('Masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }
    if (cleanToken !== telegramBotToken) {
      setTelegramBotToken(cleanToken);
    }

    setIsDetectingId(true);
    setWebhookMessage('Sedang mendeteksi Chat ID dari pesan Telegram terbaru...');
    let foundId = '';

    try {
      // 1. Cek langsung ke Google Apps Script Webhook
      if (gasUrl && gasUrl.startsWith('http')) {
        try {
          const delimiter = gasUrl.includes('?') ? '&' : '?';
          const gasRes = await fetch(`${gasUrl}${delimiter}action=get_chat_id&t=${Date.now()}`);
          if (gasRes.ok) {
            const gasData = await gasRes.json();
            if (gasData && gasData.success && gasData.chatId) {
              foundId = String(gasData.chatId).trim();
            }
          }
        } catch (gasErr) {}
      }

      // 2. Coba melalui server backend (/api/telegram/detect-chat-id)
      if (!foundId) {
        try {
          const res = await fetch('/api/telegram/detect-chat-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: cleanToken,
              userId: currentUser?.id
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.chatId) {
              foundId = String(data.chatId).trim();
            }
          }
        } catch (serverErr) {
          console.warn('[detectChatId] Server fetch error:', serverErr);
        }
      }

      // 3. Periksa status poller server
      if (!foundId && currentUser?.id) {
        try {
          const statRes = await fetch(`/api/telegram/status/${currentUser.id}`);
          if (statRes.ok) {
            const statData = await statRes.json();
            if (statData.success && statData.chatId) {
              foundId = String(statData.chatId).trim();
            }
          }
        } catch (stErr) {}
      }

      // 4. Fallback: getUpdates Telegram
      if (!foundId) {
        try {
          const updRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=15`);
          if (updRes.ok) {
            const updData = await updRes.json();
            if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
              for (let i = updData.result.length - 1; i >= 0; i--) {
                const msg = updData.result[i].message || updData.result[i].channel_post;
                if (msg && msg.chat && msg.chat.id) {
                  foundId = String(msg.chat.id).trim();
                  break;
                }
              }
            }
          }
        } catch (updErr) {}
      }

      if (foundId) {
        setTelegramChatId(foundId);
        setWebhookStatus('success');
        setWebhookMessage(`🎉 Chat ID ditemukan: ${foundId}. Berhasil disimpan 100%!`);

        // Simpan konfigurasi
        const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
        const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();
        onSaveSettings({
          googleSheetUrl: googleSheetUrl.trim(),
          adminGoogleSheetUrl: existingAdminUrl,
          telegramBotToken: cleanToken,
          telegramChatId: foundId,
          useCloudStorage: Boolean(googleSheetUrl.trim()),
          googleClientId: existingGoogleClientId,
        });
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
      } else {
        setWebhookStatus('loading');
        setWebhookMessage('Menunggu interaksi... Buka bot Anda di Telegram dan klik tombol START (/start) sekarang.');
        pollDetectChatId(cleanToken, botDetails?.username);
      }
    } catch (err: any) {
      setWebhookStatus('failed');
      setWebhookMessage(err.message || 'Gagal memeriksa Chat ID.');
    } finally {
      setIsDetectingId(false);
    }
  };

  const handleAutoSetupTelegram = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    const cleanUrl = googleSheetUrl.trim();

    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }

    // Normalisasikan token di input form jika user memasukkan spasi atau kutip
    if (cleanToken !== telegramBotToken) {
      setTelegramBotToken(cleanToken);
    }

    // Validasi format token bot Telegram (@BotFather)
    if (!isValidTelegramToken(cleanToken)) {
      setWebhookStatus('failed');
      setWebhookMessage(
        '⚠️ Format Token Bot Telegram tidak valid.\n\n' +
        'Token resmi dari @BotFather harus diawali angka ID bot, tanda titik dua (:), lalu kode unik rahasia.\n' +
        'Contoh format yang benar: 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ\n\n' +
        'Silakan buka Telegram @BotFather dan salin pesan token HTTP API bot Anda secara lengkap.'
      );
      return;
    }

    // Deteksi jika pengguna memasukkan link Google Spreadsheet biasa bukan Web App
    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      setWebhookStatus('failed');
      setWebhookMessage(
        '⚠️ URL yang Anda masukkan adalah tautan lembar kerja Google Spreadsheet biasa, bukan URL Web App (Google Apps Script).\n\n' +
        'Silakan buka Spreadsheet Anda > menu Ekstensi > Apps Script > tombol Terapkan (Deploy) > Deployment baru > pilih Aplikasi Web (Web App) > Akses: "Siapa saja (Anyone)" > salin URL yang berakhiran /exec.'
      );
      return;
    }

    setIsAutoSettingUp(true);
    setWebhookStatus('loading');
    setWebhookMessage('Sedang menghubungkan ke Bot Telegram & mengaktifkan layanan realtime...');

    let data: any = null;

    // 1. Panggil backend server (/api/telegram/auto-setup)
    try {
      const res = await fetch('/api/telegram/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          googleSheetUrl: cleanUrl,
          userId: currentUser?.id,
          username: currentUser?.username,
          chatId: telegramChatId.trim()
        })
      });

      if (res.ok) {
        data = await res.json();
      } else {
        try {
          data = await res.json();
        } catch (e) {}
      }
    } catch (netErr: any) {
      console.warn('[SettingsPanel] Server fetch error, preparing direct fallback:', netErr);
    }

    // 2. Tangani hasil dari server jika sukses
    if (data && data.success) {
      setWebhookStatus('success');
      setWebhookMessage(data.message);
      if (data.bot) {
        setBotDetails(data.bot);
      }
      if (data.chatId && data.chatId !== telegramChatId) {
        setTelegramChatId(data.chatId);
      }

      // Jika Chat ID belum ada, jalankan auto-polling untuk mendeteksi saat user klik /start di Telegram
      if (!data.chatId && !telegramChatId.trim()) {
        pollDetectChatId(cleanToken, data.bot?.username);
      }

      // Simpan otomatis ke state & database
      const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
      const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();
      onSaveSettings({
        googleSheetUrl: cleanUrl,
        adminGoogleSheetUrl: existingAdminUrl,
        telegramBotToken: cleanToken,
        telegramChatId: data.chatId || telegramChatId.trim(),
        useCloudStorage: Boolean(cleanUrl),
        googleClientId: existingGoogleClientId,
      });

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
      setIsAutoSettingUp(false);
      return;
    }

    // 3. Fallback Mandiri: Jika server memberikan error atau tidak terjangkau, lakukan verifikasi langsung ke Telegram API
    try {
      setWebhookMessage('Memverifikasi token langsung ke server Telegram...');
      const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const tgData = await tgRes.json();

      if (tgData.ok && tgData.result) {
        const botInfo = tgData.result;
        setBotDetails({
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name
        });

        // Cek apakah ada Chat ID dari getUpdates
        let detectedId = telegramChatId.trim();
        if (!detectedId) {
          try {
            const updRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getUpdates?limit=15`);
            const updData = await updRes.json();
            if (updData.ok && Array.isArray(updData.result) && updData.result.length > 0) {
              for (let i = updData.result.length - 1; i >= 0; i--) {
                const msg = updData.result[i].message || updData.result[i].channel_post || updData.result[i].edited_message;
                if (msg && msg.chat && msg.chat.id) {
                  detectedId = String(msg.chat.id);
                  break;
                }
              }
            }
          } catch (e) {}
        }

        if (detectedId) {
          setTelegramChatId(detectedId);
        }

        // Jika Google Spreadsheet diisi, pasang webhook langsung ke Google Apps Script agar bot langsung merespon di Vercel/hosting statis
        if (cleanUrl && cleanUrl.startsWith('http')) {
          setWebhookMessage(`Menghubungkan Webhook Bot @${botInfo.username} ke Google Apps Script...`);
          const webhookUrlWithParams = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 
            `token=${encodeURIComponent(cleanToken)}&userId=${encodeURIComponent(currentUser?.id || 'guest')}&username=${encodeURIComponent(currentUser?.username || '')}`;
          try {
            await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrlWithParams)}`);
            // Simpan konfigurasi ke Google Apps Script
            fetch(cleanUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({
                action: 'setup_telegram',
                token: cleanToken,
                chatId: detectedId || telegramChatId.trim(),
                userId: currentUser?.id,
                username: currentUser?.username
              })
            }).catch(() => {});
          } catch (hookErr) {}
        } else {
          // Jika tanpa spreadsheet, bersihkan webhook agar polling bot lokal lancar
          try {
            await fetch(`https://api.telegram.org/bot${cleanToken}/deleteWebhook?drop_pending_updates=false`);
          } catch (delErr) {}
        }

        // Simpan konfigurasi
        const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
        const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();
        onSaveSettings({
          googleSheetUrl: cleanUrl,
          adminGoogleSheetUrl: existingAdminUrl,
          telegramBotToken: cleanToken,
          telegramChatId: detectedId || telegramChatId.trim(),
          useCloudStorage: Boolean(cleanUrl),
          googleClientId: existingGoogleClientId,
        });

        setWebhookStatus('success');
        setWebhookMessage(
          detectedId
            ? `🎉 Bot @${botInfo.username} berhasil terverifikasi dan aktif 100%! Chat ID (${detectedId}) tersimpan rapi.`
            : `🎉 Bot @${botInfo.username} aktif 100%! Buka bot di Telegram (@${botInfo.username}) dan klik tombol START (/start) agar Chat ID terhubung otomatis.`
        );

        if (!detectedId) {
          pollDetectChatId(cleanToken, botInfo.username);
        }

        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
        setIsAutoSettingUp(false);
        return;
      } else if (tgData.description) {
        setWebhookStatus('failed');
        setWebhookMessage(`⚠️ Telegram menolak token bot ini: "${tgData.description}". Pastikan token disalin lengkap tanpa spasi dari @BotFather.`);
        setIsAutoSettingUp(false);
        return;
      }
    } catch (directErr) {
      console.warn('[SettingsPanel] Direct Telegram verification failed:', directErr);
    }

    // Jika semua cara gagal, tampilkan pesan informatif yang jelas
    setWebhookStatus('failed');
    setWebhookMessage(
      (data && data.message) ||
      '⚠️ Gagal menghubungi server Telegram. Periksa kembali token bot Anda dari @BotFather atau periksa koneksi internet Anda.'
    );
    setIsAutoSettingUp(false);
  };

  const handleSaveAndActivateTelegram = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    const cleanChatId = telegramChatId.trim();
    const cleanUrl = googleSheetUrl.trim();

    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }

    if (!isValidTelegramToken(cleanToken)) {
      setWebhookStatus('failed');
      setWebhookMessage('⚠️ Format Token Bot Telegram tidak valid. Pastikan token disalin lengkap dari @BotFather.');
      return;
    }

    setIsAutoSettingUp(true);
    setWebhookStatus('loading');
    setWebhookMessage('Sedang menyimpan dan mengaktifkan bot di server...');

    const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
    const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();

    // 1. Simpan ke Pengaturan App & Server
    onSaveSettings({
      googleSheetUrl: cleanUrl,
      adminGoogleSheetUrl: existingAdminUrl,
      telegramBotToken: cleanToken,
      telegramChatId: cleanChatId,
      useCloudStorage: Boolean(cleanUrl),
      googleClientId: existingGoogleClientId,
    });

    // 2. Hubungkan via auto-setup server (jika di-hosting di server Node.js seperti Render, Railway, VPS, atau Local)
    try {
      const res = await fetch('/api/telegram/auto-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          googleSheetUrl: cleanUrl,
          userId: currentUser?.id,
          username: currentUser?.username,
          chatId: cleanChatId
        })
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.success) {
          setWebhookStatus('success');
          const botUser = data.bot?.username || 'bot';
          setWebhookMessage(`🎉 Bot Telegram @${botUser} aktif 100%! Bot siap membalas chat Anda (misal: "beli bakso 20k") dan memproses foto struk secara realtime.`);
          if (data.bot) {
            setBotDetails(data.bot);
          }
          if (data.detectedChatId && !telegramChatId) {
            setTelegramChatId(data.detectedChatId);
          }
          setServerBotStatus({
            active: true,
            botUsername: botUser,
            chatId: cleanChatId || data.detectedChatId || ''
          });
          setIsAutoSettingUp(false);
          return;
        } else if (data.message) {
          setWebhookStatus('failed');
          setWebhookMessage(data.message);
          setIsAutoSettingUp(false);
          return;
        }
      }
    } catch (err: any) {
      console.warn('Auto-setup server note (server endpoint not available on static host):', err);
    }

    // 3. Fallback Mandiri (Khusus jika di-hosting di Vercel, Netlify, atau GitHub Pages):
    // Verifikasi Token langsung ke Telegram API dan pasang Webhook ke Google Spreadsheet jika ada
    try {
      setWebhookMessage('Memverifikasi bot langsung ke server Telegram...');
      const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
      const tgData = await tgRes.json();

      if (tgData.ok && tgData.result) {
        const botInfo = tgData.result;
        setBotDetails({
          id: botInfo.id,
          username: botInfo.username,
          firstName: botInfo.first_name
        });

        // Jika Google Spreadsheet diisi, pasang Webhook langsung ke Google Apps Script!
        // Ini memastikan bot membalas chat Telegram (beli bakso 20k) 24 jam nonstop bahkan jika di-hosting di Vercel / GitHub Pages!
        if (cleanUrl && cleanUrl.startsWith('http')) {
          setWebhookMessage(`Menghubungkan Webhook Bot @${botInfo.username} ke Google Apps Script...`);
          const webhookUrlWithParams = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + 
            `token=${encodeURIComponent(cleanToken)}&userId=${encodeURIComponent(currentUser?.id || 'guest')}&username=${encodeURIComponent(currentUser?.username || '')}`;
          try {
            const hookRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookUrlWithParams)}`);
            const hookData = await hookRes.json();
            
            // Simpan konfigurasi ke Google Apps Script
            fetch(cleanUrl, {
              method: 'POST',
              mode: 'no-cors',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({
                action: 'setup_telegram',
                token: cleanToken,
                chatId: cleanChatId,
                userId: currentUser?.id,
                username: currentUser?.username
              })
            }).catch(() => {});

            if (hookData.ok) {
              setWebhookStatus('success');
              setWebhookMessage(`🎉 Bot Telegram @${botInfo.username} berhasil terhubung langsung ke Google Apps Script via Webhook! Bot siap membalas chat (misal: "beli bakso 20k") 24 jam nonstop tanpa perlu server backend.`);
              setServerBotStatus({
                active: true,
                botUsername: botInfo.username,
                chatId: cleanChatId
              });
              setIsAutoSettingUp(false);
              return;
            }
          } catch (hookErr) {
            console.warn('Direct setWebhook note:', hookErr);
          }
        }

        setWebhookStatus('success');
        setWebhookMessage(`✅ Token Bot Telegram @${botInfo.username} valid! Tersimpan rapi.`);
        setServerBotStatus({
          active: true,
          botUsername: botInfo.username,
          chatId: cleanChatId
        });
        setIsAutoSettingUp(false);
        return;
      } else {
        setWebhookStatus('failed');
        setWebhookMessage(`⚠️ Token Bot tidak dikenali Telegram: ${tgData.description || 'Periksa token dari @BotFather'}`);
        setIsAutoSettingUp(false);
        return;
      }
    } catch (directErr: any) {
      setWebhookStatus('failed');
      setWebhookMessage(`⚠️ Gagal menghubungkan: ${directErr.message || 'Periksa koneksi internet'}`);
      setIsAutoSettingUp(false);
      return;
    }
  };

  const handleCheckWebhookInfo = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    if (!cleanToken) {
      setWebhookMessage('⚠️ Masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }
    setIsCheckingWebhook(true);
    try {
      // Prioritaskan endpoint server agar tidak terkena CORS
      const res = await fetch(`/api/telegram/webhook-info?token=${encodeURIComponent(cleanToken)}&userId=${encodeURIComponent(currentUser?.id || '')}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.info) {
          setWebhookInfo(data.info);
          if (data.bot?.username) {
            setBotDetails(data.bot);
          }
          if (data.isPollerActive !== undefined) {
            setServerBotStatus(prev => ({
              ...prev,
              active: data.isPollerActive,
              botUsername: data.bot?.username || prev.botUsername
            }));
          }
          return;
        }
      }
      // Fallback direct
      const directRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getWebhookInfo`);
      const directData = await directRes.json();
      if (directData.ok && directData.result) {
        setWebhookInfo(directData.result);
      } else {
        setWebhookMessage(`⚠️ Gagal mengecek webhook: ${directData.description || 'Token tidak valid'}`);
      }
    } catch (e: any) {
      setWebhookMessage(`⚠️ Gagal menghubungi Telegram: ${e.message}`);
    } finally {
      setIsCheckingWebhook(false);
    }
  };

  const handleRemoveWebhookAndSwitchToPoller = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    if (!cleanToken) {
      setWebhookMessage('⚠️ Masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }
    setIsAutoSettingUp(true);
    setWebhookStatus('loading');
    setWebhookMessage('Menonaktifkan Webhook & mengaktifkan Mode Server Realtime...');
    try {
      const res = await fetch('/api/telegram/remove-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          userId: currentUser?.id,
          googleSheetUrl: googleSheetUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setWebhookStatus('success');
        setWebhookMessage('🚀 Mode Server Realtime Berhasil Diaktifkan! Bot kini merespon pesan chat secara instan langsung dari server.');
        setWebhookInfo({ url: '', pending_update_count: 0 });
        setServerBotStatus(prev => ({ ...prev, active: true }));
      } else {
        setWebhookStatus('failed');
        setWebhookMessage(`⚠️ ${data.message || 'Gagal beralih ke Mode Server'}`);
      }
    } catch (e: any) {
      setWebhookStatus('failed');
      setWebhookMessage(`⚠️ Error: ${e.message}`);
    } finally {
      setIsAutoSettingUp(false);
      handleCheckWebhookInfo();
    }
  };

  const handleSyncNewBotToken = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('⚠️ Masukkan Token Bot Telegram baru dari @BotFather terlebih dahulu.');
      return;
    }
    setIsAutoSettingUp(true);
    setWebhookStatus('loading');
    setWebhookMessage('Memverifikasi dan menghubungkan Bot baru...');
    try {
      const res = await fetch('/api/telegram/sync-bot-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          userId: currentUser?.id,
          googleSheetUrl: googleSheetUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        if (data.bot?.username) {
          setBotDetails(data.bot);
        }
        setWebhookStatus('success');
        setWebhookMessage(data.message || '🎉 Bot baru berhasil dihubungkan 100%!');
        setServerBotStatus(prev => ({
          ...prev,
          active: true,
          botUsername: data.bot?.username || prev.botUsername
        }));
        handleCheckWebhookInfo();
      } else {
        setWebhookStatus('failed');
        setWebhookMessage(`⚠️ ${data.message || 'Gagal menyinkronkan token bot'}`);
      }
    } catch (e: any) {
      setWebhookStatus('failed');
      setWebhookMessage(`⚠️ Error: ${e.message}`);
    } finally {
      setIsAutoSettingUp(false);
    }
  };

  const handleSendTestMessage = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    const cleanChatId = telegramChatId.trim();

    if (!cleanToken || !cleanChatId) {
      setTestSendResult({
        success: false,
        message: 'Token Bot dan Chat ID diperlukan untuk menguji pengiriman pesan.'
      });
      return;
    }

    setTestSending(true);
    setTestSendResult(null);

    const testText = `🔔 *Tes Koneksi FahKeu Berhasil!*\n───────────────────────────\n👤 *Akun:* ${currentUser?.name || 'Pengguna'} (@${currentUser?.username || 'user'})\n✅ Bot Telegram Anda siap mencatat pengeluaran & pemasukan secara realtime 100%!\n\n💡 _Coba ketik transaksi Anda sekarang, contoh:_\n• *beli bakso 20k*\n• *gaji 5jt*\n• _Atau kirim foto struk belanja Anda!_`;

    const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
    const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();

    // 1. Coba melalui backend server (sekaligus auto-save & auto-start poller)
    try {
      const res = await fetch('/api/telegram/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cleanToken,
          chatId: cleanChatId,
          userId: currentUser?.id,
          username: currentUser?.username,
          text: testText
        })
      });

      const data = await res.json();
      if (data.success) {
        setTestSendResult({
          success: true,
          message: data.message || 'Pesan tes berhasil dikirim ke Telegram Anda & Bot aktif 100%!'
        });
        // Auto-save ke aplikasi agar pengguna tidak perlu klik simpan lagi
        onSaveSettings({
          googleSheetUrl: googleSheetUrl.trim(),
          adminGoogleSheetUrl: existingAdminUrl,
          telegramBotToken: cleanToken,
          telegramChatId: cleanChatId,
          useCloudStorage: Boolean(googleSheetUrl.trim()),
          googleClientId: existingGoogleClientId,
        });
        setServerBotStatus({
          active: true,
          botUsername: serverBotStatus?.botUsername || botDetails?.username || '',
          chatId: cleanChatId
        });
        setTestSending(false);
        return;
      }
    } catch (serverErr) {
      console.warn('[testMessage] Server error, falling back to direct Telegram API:', serverErr);
    }

    // 2. Fallback langsung ke Telegram API
    try {
      const directRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cleanChatId,
          text: testText,
          parse_mode: 'Markdown'
        })
      });

      const directData = await directRes.json();
      if (directData.ok) {
        setTestSendResult({
          success: true,
          message: 'Pesan tes berhasil terkirim langsung ke Telegram Anda!'
        });
        onSaveSettings({
          googleSheetUrl: googleSheetUrl.trim(),
          adminGoogleSheetUrl: existingAdminUrl,
          telegramBotToken: cleanToken,
          telegramChatId: cleanChatId,
          useCloudStorage: Boolean(googleSheetUrl.trim()),
          googleClientId: existingGoogleClientId,
        });
        setServerBotStatus({
          active: true,
          botUsername: serverBotStatus?.botUsername || botDetails?.username || '',
          chatId: cleanChatId
        });
      } else {
        setTestSendResult({
          success: false,
          message: directData.description || 'Gagal mengirim pesan dari Telegram.'
        });
      }
    } catch (err: any) {
      setTestSendResult({
        success: false,
        message: err.message || 'Gagal menghubungi Telegram API.'
      });
    } finally {
      setTestSending(false);
    }
  };

  // Kode Google Apps Script yang otomatis disisipkan Token Bot & Chat ID pengguna
  const personalizedCode = React.useMemo(() => {
    const cleanTok = cleanTelegramToken(telegramBotToken);
    const cleanChat = telegramChatId.trim();
    let code = GOOGLE_APPS_SCRIPT_FINANCE_CODE;
    if (cleanTok) {
      code = code.replace(/var TELEGRAM_BOT_TOKEN = ".*?";/, `var TELEGRAM_BOT_TOKEN = "${cleanTok}";`);
    }
    if (cleanChat) {
      code = code.replace(/var DEFAULT_CHAT_ID = ".*?";/, `var DEFAULT_CHAT_ID = "${cleanChat}";`);
    }
    return code;
  }, [telegramBotToken, telegramChatId]);

  // Handler Pemasangan Webhook 24 Jam Nonstop ke Google Apps Script
  const handleSetupGasWebhook = async () => {
    const cleanToken = cleanTelegramToken(telegramBotToken);
    const cleanUrl = googleSheetUrl.trim();
    const cleanChat = telegramChatId.trim();

    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }

    if (!isValidTelegramToken(cleanToken)) {
      setWebhookStatus('failed');
      setWebhookMessage('⚠️ Format Token Bot Telegram tidak valid. Pastikan token disalin lengkap dari @BotFather.');
      return;
    }

    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan URL Web App Spreadsheet (akhiran /exec) terlebih dahulu.');
      return;
    }

    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      setWebhookStatus('failed');
      setWebhookMessage('⚠️ Masukkan URL Web App Apps Script (akhiran /exec), bukan URL lembar kerja spreadsheet biasa.');
      return;
    }

    setIsAutoSettingUp(true);
    setWebhookStatus('loading');
    setWebhookMessage('Sedang mendaftarkan Webhook 24 Jam ke Google Apps Script & Telegram API...');

    const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
    const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();

    try {
      // 1. Panggil backend server /api/telegram/setup-gas-webhook
      let serverOk = false;
      let botUser = botDetails?.username || '';
      try {
        const res = await fetch('/api/telegram/setup-gas-webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: cleanToken,
            googleSheetUrl: cleanUrl,
            userId: currentUser?.id,
            username: currentUser?.username,
            chatId: cleanChat
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            serverOk = true;
            if (data.bot?.username) botUser = data.bot.username;
          }
        }
      } catch (srvErr) {}

      // 2. Direct Webhook Registration ke Telegram API
      let tgOk = false;
      let tgDesc = '';
      if (!serverOk) {
        try {
          const targetWebhookUrl = cleanUrl + (cleanUrl.includes('?') ? '&' : '?') + `token=${encodeURIComponent(cleanToken)}`;
          const tgRes = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(targetWebhookUrl)}&drop_pending_updates=true`);
          if (tgRes.ok) {
            const tgData = await tgRes.json();
            if (tgData.ok) {
              tgOk = true;
            } else {
              tgDesc = tgData.description || '';
            }
          }
        } catch (tgErr: any) {
          tgDesc = tgErr.message || '';
        }
      }

      // Ambil detail bot jika belum terdeteksi
      if (!botUser) {
        try {
          const meRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
          if (meRes.ok) {
            const meData = await meRes.json();
            if (meData.ok && meData.result?.username) {
              botUser = meData.result.username;
            }
          }
        } catch (meErr) {}
      }

      // 3. Trigger setup_telegram di Google Apps Script
      fetch(cleanUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'setup_telegram',
          token: cleanToken,
          chatId: cleanChat,
          userId: currentUser?.id,
          username: currentUser?.username
        })
      }).catch(() => {});

      if (tgOk || serverOk) {
        setWebhookStatus('success');
        setWebhookMessage(
          `🎉 Webhook 24 Jam Berhasil Diaktifkan!\n` +
          `Bot Telegram ${botUser ? `@${botUser}` : ''} kini aktif 24 jam nonstop terhubung langsung ke Google Apps Script.\n` +
          `Bot siap merespon chat seketika (contoh: "beli cimol 3k", "/saldo", "/edit") dan scan struk foto 100% gratis!`
        );

        setServerBotStatus({
          active: true,
          botUsername: botUser || 'bot',
          chatId: cleanChat
        });

        onSaveSettings({
          googleSheetUrl: cleanUrl,
          adminGoogleSheetUrl: existingAdminUrl,
          telegramBotToken: cleanToken,
          telegramChatId: cleanChat,
          useCloudStorage: true,
          googleClientId: existingGoogleClientId,
        });

        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3000);
        handleCheckWebhookInfo();
      } else {
        setWebhookStatus('failed');
        setWebhookMessage(
          `⚠️ Telegram menolak webhook: ${tgDesc || 'Periksa token bot dan pastikan URL Web App Apps Script valid (berakhiran /exec).'}\n\n` +
          `💡 Cara Mudah Langsung: Buka Google Spreadsheet Anda, klik menu atas "📊 Keuangan FahKeu" > "⚡ Aktifkan Webhook Bot 24 Jam Otomatis".`
        );
      }
    } catch (err: any) {
      setWebhookStatus('failed');
      setWebhookMessage(`⚠️ Gagal memasang webhook: ${err.message || 'Periksa koneksi internet.'}`);
    } finally {
      setIsAutoSettingUp(false);
    }
  };

  const handleCopyCode = async () => {
    let success = false;
    // Coba navigator.clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(personalizedCode);
        success = true;
      }
    } catch (e) {
      console.warn('Clipboard API not available or blocked, falling back to selection/execCommand', e);
    }

    // Fallback menggunakan seleksi textarea + execCommand
    if (!success && codeTextareaRef.current) {
      try {
        codeTextareaRef.current.focus();
        codeTextareaRef.current.select();
        codeTextareaRef.current.setSelectionRange(0, 999999);
        const execSuccess = document.execCommand('copy');
        if (execSuccess) success = true;
      } catch (err) {
        console.warn('execCommand failed', err);
      }
    }

    setCopied(true);
    setCopyFeedback(success ? 'Script transaksi berhasil disalin ke clipboard (Token bot sudah terpasang di kode)!' : 'Teks telah diseleksi penuh! Tekan Ctrl+C untuk menyalin.');
    setTimeout(() => {
      setCopied(false);
      setCopyFeedback('');
    }, 4000);
  };

  const handleSelectAllCode = () => {
    if (codeTextareaRef.current) {
      codeTextareaRef.current.focus();
      codeTextareaRef.current.select();
      codeTextareaRef.current.setSelectionRange(0, 999999);
      setCopyFeedback('Seluruh kode telah diseleksi! Silakan tekan tombol Ctrl+C untuk menyalin.');
      setTimeout(() => setCopyFeedback(''), 4000);
    }
  };

  const handleSave = () => {
    const trimmedUrl = googleSheetUrl.trim();
    // Jika URL diisi, otomatis aktifkan cloud storage
    const enableCloud = Boolean(trimmedUrl && useCloudStorage !== false);
    const existingGoogleClientId = settings?.googleClientId || getGoogleClientId();
    const existingAdminUrl = settings?.adminGoogleSheetUrl || getAdminGoogleSheetUrl();

    onSaveSettings({
      googleSheetUrl: trimmedUrl,
      adminGoogleSheetUrl: existingAdminUrl,
      telegramBotToken: telegramBotToken.trim(),
      telegramChatId: telegramChatId.trim(),
      useCloudStorage: enableCloud,
      googleClientId: existingGoogleClientId,
    });

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3000);
  };

  const handleTestConnect = async () => {
    setTestingConnection(true);
    setTestResult('idle');
    try {
      const res = await onTestConnection(googleSheetUrl.trim());
      setTestResult(res ? 'success' : 'failed');
    } catch {
      setTestResult('failed');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRegisterWebhook = async () => {
    const cleanToken = telegramBotToken.trim();
    const cleanUrl = googleSheetUrl.trim();

    if (!cleanToken) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan Token Bot Telegram terlebih dahulu.');
      return;
    }
    if (!cleanUrl) {
      setWebhookStatus('failed');
      setWebhookMessage('Mohon masukkan URL Apps Script Web App terlebih dahulu.');
      return;
    }

    if (cleanUrl.includes('docs.google.com/spreadsheets')) {
      setWebhookStatus('failed');
      setWebhookMessage(
        '⚠️ URL yang Anda masukkan adalah tautan lembar kerja Google Spreadsheet, bukan URL Web App (Google Apps Script). Mohon salin URL dari Apps Script > Terapkan > Aplikasi Web (/exec).'
      );
      return;
    }

    setWebhookStatus('loading');
    setWebhookMessage('Mendaftarkan Webhook ke Telegram...');
    
    try {
      const delimiter = cleanUrl.includes('?') ? '&' : '?';
      const webhookTarget = `${cleanUrl}${delimiter}token=${encodeURIComponent(cleanToken)}&userId=${encodeURIComponent(currentUser?.id || '')}&username=${encodeURIComponent(currentUser?.username || '')}&chatId=${encodeURIComponent(telegramChatId.trim())}`;

      const response = await fetch(
        `https://api.telegram.org/bot${cleanToken}/setWebhook?url=${encodeURIComponent(webhookTarget)}&drop_pending_updates=true`
      );
      const data = await response.json();

      if (data.ok) {
        setWebhookStatus('success');
        setWebhookMessage(`Sukses! Webhook berhasil didaftarkan. Tanggapan Telegram: "${data.description}"`);
      } else {
        setWebhookStatus('failed');
        setWebhookMessage(`Telegram mengembalikan error: ${data.description || 'Kesalahan tidak diketahui'}`);
      }
    } catch (err: any) {
      setWebhookStatus('failed');
      setWebhookMessage(`Gagal menghubungi server Telegram. Error: ${err.message || err}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 space-y-6">
      
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Integrasi & Pengaturan</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Hubungkan pencatat keuangan ini ke Google Spreadsheet Anda serta Bot Telegram secara mandiri.</p>
      </div>

      {/* Banner Isolasi Akun: Google Spreadsheet & Telegram Mandiri */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 shadow-md">
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5 border border-emerald-500/30">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Pengaturan Privat Akun:</span>
                <span className="text-emerald-400 font-extrabold">{currentUser?.name || 'Pengguna'}</span>
                <span className="text-slate-400 font-mono text-xs">(@{currentUser?.username || 'user'})</span>
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                Spreadsheet & Bot Terisolasi 100% Privat
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px] sm:text-xs">
              Masing-masing akun pengguna memiliki <b>Google Spreadsheet</b> dan <b>Bot Telegram sendiri yang terpisah</b>. Tautan Spreadsheet dan Token Bot Telegram yang Anda simpan di bawah ini khusus milik akun Anda, sehingga data keuangan dan pesan bot Anda tidak akan pernah bercampur dengan akun pengguna lain.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
              <span className="inline-flex items-center space-x-1 text-slate-400 font-medium">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>Spreadsheet: <b className={googleSheetUrl ? "text-emerald-400" : "text-amber-400"}>{googleSheetUrl ? "Terhubung" : "Belum Diatur"}</b></span>
              </span>
              <span className="inline-flex items-center space-x-1 text-slate-400 font-medium">
                <Bot className="w-3.5 h-3.5 text-blue-400" />
                <span>Bot Telegram: <b className={telegramBotToken ? "text-emerald-400" : "text-amber-400"}>{telegramBotToken ? "Terhubung" : "Belum Diatur"}</b></span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Settings Area (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Theme Premium Card */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-900">
              <Palette className="w-4 h-4 text-amber-500" />
              <span>Pilih Tema Tampilan (Premium)</span>
            </h2>
            
            <div className="grid grid-cols-3 gap-3">
              {/* Light Mode */}
              <button
                onClick={() => onChangeTheme('light')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 ${
                  theme === 'light'
                    ? 'border-indigo-500 bg-indigo-50/30 text-indigo-600 dark:text-indigo-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-[10px] tracking-wide uppercase">Terang</span>
              </button>

              {/* Dark Mode */}
              <button
                onClick={() => onChangeTheme('dark')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-slate-900 text-indigo-400 font-bold'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                <Moon className="w-4 h-4" />
                <span className="text-[10px] tracking-wide uppercase">Gelap Standard</span>
              </button>

              {/* Luxury Gold Mode */}
              <button
                onClick={() => onChangeTheme('luxury-gold')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all duration-300 relative overflow-hidden ${
                  theme === 'luxury-gold'
                    ? 'border-amber-500 bg-gradient-to-br from-amber-950 to-slate-950 text-amber-400 font-bold shadow-[0_0_15px_rgba(245,158,11,0.25)] scale-105'
                    : 'border-slate-200 dark:border-slate-800 bg-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                }`}
              >
                {theme === 'luxury-gold' && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping opacity-75"></span>
                )}
                <Crown className={`w-4 h-4 ${theme === 'luxury-gold' ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                <span className="text-[10px] tracking-wide uppercase font-black text-center leading-tight">Royal Gold (Termahal)</span>
              </button>
            </div>
          </div>

          {/* ======================================================================================================== */}
          {/* [SECTION MULAI] FITUR UNDUH APLIKASI (ANDROID & DESKTOP VIA GOOGLE DRIVE)                                 */}
          {/* PETUNJUK:                                                                                                */}
          {/* 1. Ganti tautan DOWNLOAD_LINK_ANDROID & DOWNLOAD_LINK_DESKTOP di baris 26-27 dengan link Google Drive.   */}
          {/* 2. Jika Anda TIDAK INGIN menampilkan kartu unduhan ini, HAPUS seluruh blok <div> di bawah ini           */}
          {/*    dari [SECTION MULAI] sampai [SECTION SELESAI].                                                        */}
          {/* ======================================================================================================== */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-900">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Download className="w-4.5 h-4.5 text-emerald-500" />
                <span>Unduh Aplikasi FahKeu (Android & Desktop)</span>
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-900/40">
                Google Drive Ready
              </span>
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Unduh berkas instalasi resmi FahKeu untuk perangkat Android (APK) atau Desktop PC/Laptop (Windows) melalui penyimpanan Google Drive Anda:
            </p>

            {/* 2 Tombol Unduhan: Android & Desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* 1. Unduh Android APK */}
              <a
                href={DOWNLOAD_LINK_ANDROID}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-emerald-50/70 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 rounded-xl border border-emerald-200/70 dark:border-emerald-900/60 flex items-center justify-between transition-all group shadow-sm hover:shadow active:scale-[0.98]"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Unduh Android</h4>
                      <span className="px-1.5 py-0.5 text-[9px] bg-emerald-200/80 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 font-bold rounded-md">APK</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Google Drive / Smartphone</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:translate-y-0.5 transition-transform">
                  <Download className="w-4 h-4" />
                </div>
              </a>

              {/* 2. Unduh Desktop Windows / PC */}
              <a
                href={DOWNLOAD_LINK_DESKTOP}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 bg-sky-50/70 hover:bg-sky-100/70 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 rounded-xl border border-sky-200/70 dark:border-sky-900/60 flex items-center justify-between transition-all group shadow-sm hover:shadow active:scale-[0.98]"
              >
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-11 h-11 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">Unduh Desktop</h4>
                      <span className="px-1.5 py-0.5 text-[9px] bg-sky-200/80 dark:bg-sky-900/80 text-sky-800 dark:text-sky-300 font-bold rounded-md">PC / EXE</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Google Drive / Laptop Windows</p>
                  </div>
                </div>
                <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:translate-y-0.5 transition-transform">
                  <Download className="w-4 h-4" />
                </div>
              </a>
            </div>
          </div>
          {/* ======================================================================================================== */}
          {/* [SECTION SELESAI] FITUR UNDUH APLIKASI (ANDROID & DESKTOP VIA GOOGLE DRIVE)                               */}
          {/* ======================================================================================================== */}

          {/* Main Credentials Card */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span>Google Spreadsheet Pencatat Keuangan</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  Khusus Transaksi & Telegram
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Spreadsheet ini khusus untuk mencatat data keuangan pribadi Anda (Pemasukan, Pengeluaran, Saldo, Kategori) dan Bot Telegram.
              </p>
            </div>

            {/* Cloud Storage toggle */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Aktifkan Database Cloud Transaksi</span>
                <p className="text-[10px] text-slate-400">Jika mati, mutasi kas hanya disimpan di browser (Local Storage).</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCloudStorage}
                  onChange={(e) => setUseCloudStorage(e.target.checked)}
                  disabled={!googleSheetUrl}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 disabled:opacity-50"></div>
              </label>
            </div>

            {/* Google Apps Script Web App URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                URL Web App Spreadsheet Pencatat Keuangan
              </label>
              <input
                type="text"
                value={googleSheetUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setGoogleSheetUrl(val);
                  if (val.trim()) {
                    setUseCloudStorage(true);
                  } else {
                    setUseCloudStorage(false);
                  }
                }}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              {googleSheetUrl.includes('docs.google.com/spreadsheets') && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 space-y-1">
                  <p className="font-semibold">⚠️ Anda memasukkan link Google Spreadsheet langsung:</p>
                  <p>Agar Bot Telegram dan Website dapat menulis dan membaca data otomatis, silakan deploy sebagai Web App: Buka spreadsheet Anda &gt; Menu <b>Ekstensi</b> &gt; <b>Apps Script</b> &gt; Klik <b>Deploy (Terapkan)</b> &gt; <b>Deployment Baru (New Deployment)</b> &gt; Pilih <b>Web App</b> &gt; Akses: <b>Siapa saja (Anyone)</b> &gt; Salin URL yang berakhiran <code>/exec</code> ke kolom ini.</p>
                </div>
              )}
              {(googleSheetUrl.includes('AKfycby') || googleSheetUrl.includes('AKfycbwPLC')) && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[11px] text-rose-700 dark:text-rose-300 space-y-1">
                  <p className="font-semibold">⚠️ URL Demo Lama Terdeteksi:</p>
                  <p>URL ini berisi data pengujian lama. Harap kosongkan atau gantikan dengan URL Web App Apps Script dari Google Spreadsheet pribadi Anda agar data Anda murni.</p>
                </div>
              )}
              <p className="text-[10px] text-slate-400">
                Masukkan URL deployment Aplikasi Web dari spreadsheet pencatat keuangan Anda (berakhiran <code>/exec</code>).
              </p>
            </div>

            {/* Test Connection, Two-Way Sync, and Save Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95"
              >
                Simpan Konfigurasi
              </button>

              {googleSheetUrl && (
                <button
                  onClick={async () => {
                    if (onSyncBiDirectional) {
                      setIsSyncingTwoWay(true);
                      try {
                        const res = await onSyncBiDirectional(googleSheetUrl.trim());
                        setSyncTwoWayResult(res);
                        setTimeout(() => setSyncTwoWayResult(null), 7000);
                      } finally {
                        setIsSyncingTwoWay(false);
                      }
                    }
                  }}
                  disabled={isSyncingTwoWay}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50"
                  title="Kirim data dari Website ke Spreadsheet dan tarik data dari Spreadsheet ke Website (Saling Melengkapi)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTwoWay && 'animate-spin'}`} />
                  <span>{isSyncingTwoWay ? 'Menyinkronkan...' : 'Sinkron Dua Arah (Saling Melengkapi)'}</span>
                </button>
              )}

              {googleSheetUrl && (
                <button
                  onClick={handleTestConnect}
                  disabled={testingConnection}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingConnection && 'animate-spin'}`} />
                  <span>Uji Hubungkan</span>
                </button>
              )}

              {savedToast && (
                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>Tersimpan & Saling Melengkapi!</span>
                </div>
              )}

              {testResult === 'success' && (
                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <Check className="w-4 h-4" />
                  <span>Koneksi Berhasil!</span>
                </div>
              )}
              {testResult === 'failed' && (
                <div className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Koneksi Gagal / Salah URL.</span>
                </div>
              )}
            </div>

            {/* Banner Hasil Sinkronisasi Dua Arah */}
            {syncTwoWayResult && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-900 dark:text-indigo-200 space-y-1 animate-in fade-in">
                <div className="flex items-center space-x-1.5 font-bold">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>Sinkronisasi Dua Arah Selesai!</span>
                </div>
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                  {syncTwoWayResult.pushedToSheet !== undefined ? (
                    <>
                      Data Website dan Spreadsheet telah saling melengkapi: <b>{syncTwoWayResult.pushedToSheet}</b> transaksi dikirim ke Spreadsheet, <b>{syncTwoWayResult.pulledToWeb}</b> transaksi ditarik ke Website. Total saat ini: <b>{syncTwoWayResult.total}</b> transaksi.
                    </>
                  ) : (
                    syncTwoWayResult.message || 'Data telah tersinkronisasi sempurna.'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Telegram Bot Integration Card */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-900">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 rounded-xl">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                    <span>Integrasi BOT Telegram Otomatis</span>
                    {telegramBotToken && telegramChatId && (
                      <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-md border border-emerald-200 dark:border-emerald-800">
                        Aktif
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ketik transaksi langsung via chat Telegram (contoh: <i>beli cimol 3k</i>) dan data otomatis tersinkron ke Spreadsheet & Website.
                  </p>
                </div>
              </div>

              {botDetails?.username && (
                <a
                  href={`https://t.me/${botDetails.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center space-x-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-xl text-xs font-semibold border border-blue-200/60 dark:border-blue-800 transition"
                >
                  <span>@{botDetails.username}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {/* Token Bot Telegram */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Token Bot Telegram (@BotFather)
                </label>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-blue-500 hover:text-blue-600 font-medium flex items-center space-x-1"
                >
                  <span>Dapatkan di @BotFather</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={telegramBotToken}
                  onChange={(e) => setTelegramBotToken(e.target.value)}
                  placeholder="1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                {telegramBotToken && (
                  <button
                    type="button"
                    onClick={() => {
                      setTelegramBotToken('');
                      setServerBotStatus(null);
                      setBotDetails(null);
                    }}
                    title="Kosongkan kolom untuk memasukkan token bot baru"
                    className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl shrink-0 transition"
                  >
                    Ganti Bot
                  </button>
                )}
              </div>
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center space-x-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                  <span>Setiap user memiliki bot sendiri. Anda bebas mengganti bot kapan saja tanpa khawatir data hilang (semua data transaksi di web &amp; spreadsheet tetap utuh).</span>
                </div>
                <div className="flex items-start space-x-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-200/50 dark:border-indigo-900/40">
                  <Zap className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">⚡ Pemutusan Koneksi Bot Lama &amp; Struk Realtime:</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400">
                      • <b>Pemutusan Cerdas:</b> Saat bot baru disimpan, seluruh koneksi bot terdahulu otomatis diputus agar tidak bentrok.<br />
                      • <b>Loading Struk Realtime:</b> Setiap input pesan transaksi langsung menampilkan indikator loading dan struk resmi tercatat per detik secara realtime.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat ID Telegram */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  ID Chat Telegram (Chat ID Anda)
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  {telegramChatId ? '✅ Terdeteksi' : 'Bisa otomatis terisi'}
                </span>
              </div>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  placeholder="ID Akun Telegram (Contoh: 123456789)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleDetectChatId}
                  disabled={isDetectingId || !telegramBotToken.trim()}
                  title="Deteksi Chat ID dari pesan /start bot terbaru"
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900 rounded-xl text-xs font-bold shrink-0 transition disabled:opacity-50 flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDetectingId ? 'animate-spin' : ''}`} />
                  <span>{isDetectingId ? 'Mendeteksi...' : '🔍 Deteksi ID'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Ketik <b>/start</b> di bot Telegram Anda, lalu klik <b>Deteksi ID</b> atau <b>Hubungkan & Pasang Otomatis</b> agar Chat ID terisi otomatis.
              </p>

              {/* Live Guidance Countdown saat menunggu user klik /start */}
              {isWaitingForChatId && (
                <div className="p-3.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400" />
                      <span>Menunggu Anda Klik START di Telegram...</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                      {chatIdCountdown}s
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Buka Telegram Anda sekarang, buka bot <b>@{botDetails?.username || 'bot Anda'}</b> lalu klik tombol <b>START</b> (atau kirim <code>/start</code>). Chat ID akan langsung tertangkap otomatis!
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    {botDetails?.username ? (
                      <a
                        href={`https://t.me/${botDetails.username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                      >
                        <span>Buka @{botDetails.username}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <div />}
                    <button
                      type="button"
                      onClick={() => setIsWaitingForChatId(false)}
                      className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Pemasangan Webhook Google Apps Script 24 Jam Nonstop */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/80 via-blue-50/60 to-emerald-50/50 dark:from-indigo-950/25 dark:via-blue-950/25 dark:to-emerald-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-2xl space-y-4">
              <div className="flex items-start space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl shrink-0 shadow-md shadow-indigo-500/20">
                  <Zap className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-xs space-y-1">
                  <span className="font-bold text-indigo-950 dark:text-indigo-100 text-sm block">
                    Koneksi Webhook Google Apps Script 24 Jam Non-Stop
                  </span>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Bot Telegram merespon chat keuangan Anda secara mandiri langsung melalui Google Apps Script. <b>100% Gratis &amp; Aktif 24/7 jam</b> tanpa ketergantungan server lokal, Vercel, ataupun komputer menyala!
                  </p>
                </div>
              </div>

              {/* Status Live Bot Telegram */}
              {serverBotStatus?.active ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                  <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <div className="flex-1 space-y-1">
                    <p className="font-bold flex items-center space-x-1.5">
                      <span>🟢 Bot Telegram Terhubung &amp; Aktif 24 Jam</span>
                      {serverBotStatus.botUsername && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">(@{serverBotStatus.botUsername})</span>
                      )}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Webhook langsung ke Google Apps Script aktif 24 jam nonstop. Siap menerima pencatatan, foto struk, edit (/edit), dan rekap kas realtime.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-start space-x-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <AlertCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 dark:text-slate-100">Bot Belum Terhubung</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Pastikan Token dan URL Web App Apps Script terisi, lalu klik tombol <b>⚡ Hubungkan Bot ke Google Apps Script (24 Jam Nonstop)</b> di bawah.
                    </p>
                  </div>
                </div>
              )}

              {/* 2 Metode Pemasangan Praktis */}
              <div className="p-3 bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-xl text-[11px] space-y-1.5 text-slate-600 dark:text-slate-300">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">
                  💡 Dua Cara Menghubungkan Bot 24 Jam:
                </span>
                <p>
                  <b>1. Dari Website ini:</b> Masukkan Token Bot &amp; URL Web App Apps Script (berakhiran <code>/exec</code>), lalu klik tombol <b>⚡ Hubungkan Bot ke Google Apps Script</b> di bawah.
                </p>
                <p>
                  <b>2. Langsung dari Google Spreadsheet:</b> Buka spreadsheet Anda, klik menu atas <b>📊 Keuangan FahKeu</b> &gt; <b>⚡ Aktifkan Webhook Bot 24 Jam Otomatis</b> (1-Klik otomatis tanpa perlu copy-paste URL).
                </p>
              </div>

              {/* Action Buttons: Bersih & Terarah */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleSetupGasWebhook}
                  disabled={isAutoSettingUp || !telegramBotToken.trim() || !googleSheetUrl.trim()}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
                  title="Hubungkan Webhook Telegram langsung ke Google Apps Script 24 jam nonstop"
                >
                  {isAutoSettingUp ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  )}
                  <span>⚡ Hubungkan Bot ke Google Apps Script (24 Jam Nonstop)</span>
                </button>

                {telegramBotToken && (
                  <button
                    type="button"
                    onClick={handleSendTestMessage}
                    disabled={testSending || !telegramChatId.trim()}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    title={!telegramChatId.trim() ? 'Chat ID diperlukan. Ketik /start di bot Anda terlebih dahulu' : 'Uji pengiriman pesan ke Telegram'}
                  >
                    {testSending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>🧪 Uji Kirim Pesan</span>
                  </button>
                )}

                {botDetails?.username && (
                  <a
                    href={`https://t.me/${botDetails.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-xl text-xs font-semibold border border-sky-200 dark:border-sky-900 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka @{botDetails.username}</span>
                  </a>
                )}

                {telegramBotToken.trim() && (
                  <button
                    type="button"
                    onClick={handleCheckWebhookInfo}
                    disabled={isCheckingWebhook}
                    className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-semibold border border-purple-200 dark:border-purple-800 transition disabled:opacity-50"
                    title="Cek status pendaftaran Webhook langsung dari server Telegram"
                  >
                    {isCheckingWebhook ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    )}
                    <span>🔍 Cek Status Webhook</span>
                  </button>
                )}
              </div>

              {/* Tampilan Diagnostik Webhook Telegram */}
              {webhookInfo && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-3 transition">
                  <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      Status Koneksi Bot Telegram
                    </span>
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                      webhookInfo.url 
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300' 
                        : (serverBotStatus.active
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300')
                    }`}>
                      {webhookInfo.url 
                        ? '🟢 Webhook 24 Jam Aktif (Google Apps Script)' 
                        : (serverBotStatus.active 
                          ? '🔵 Mode Realtime Server Aktif (Tanpa Webhook)' 
                          : '⚪ Belum Ada Webhook / Standby')}
                    </span>
                  </div>

                  {webhookInfo.url ? (
                    <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Target Webhook URL:</span>
                        <p className="break-all font-mono bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10.5px] text-emerald-600 dark:text-emerald-400">
                          {webhookInfo.url}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
                        <span>Pesan Tertunda di Antrian Telegram:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">
                          {webhookInfo.pending_update_count ?? 0} pesan
                        </span>
                      </div>
                      {webhookInfo.last_error_message && (
                        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-900 mt-1">
                          <p className="font-bold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Kendala dari Telegram Webhook:</span>
                          </p>
                          <p className="text-[10.5px] mt-1 font-mono leading-relaxed">{webhookInfo.last_error_message}</p>
                          <p className="text-[11px] mt-2 text-rose-800 dark:text-rose-200">
                            💡 <b>Solusi Cepat:</b> Klik tombol <b>"🚀 Mode Realtime Server (Tanpa Webhook)"</b> di atas agar bot langsung merespon via server tanpa terhalang kendala webhook Apps Script!
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <p className="leading-relaxed">
                        Bot Anda saat ini beroperasi dalam <b>Mode Realtime Server</b> (merespon otomatis saat website berjalan).
                      </p>
                      <p className="leading-relaxed">
                        Jika ingin bot merespon 24 jam nonstop bahkan saat website ditutup, pastikan Google Apps Script sudah dideploy dengan akses "Siapa saja", lalu klik tombol <b>⚡ Pasang Webhook 24 Jam (Apps Script)</b> di atas.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Webhook Status */}
              {webhookStatus === 'success' && (
                <div className="text-emerald-700 dark:text-emerald-300 text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-start space-x-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{webhookMessage}</span>
                </div>
              )}
              {webhookStatus === 'failed' && (
                <div className="text-rose-700 dark:text-rose-300 text-xs font-medium bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-800/50 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{webhookMessage}</span>
                </div>
              )}

              {/* Feedback Test Message */}
              {testSendResult && (
                <div className={`text-xs font-medium p-3 rounded-xl border flex items-start space-x-2 ${
                  testSendResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                }`}>
                  {testSendResult.success ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span>{testSendResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Kartu Khusus: Fitur & Pengaturan Kirim Struk Belanja Telegram & Website (Bisa Diedit) */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100 dark:border-amber-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span>Fitur Scan Struk Belanja Telegram &amp; Website</span>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800">
                      Bisa Diedit
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kirim foto nota / struk belanja Anda ke bot Telegram atau Website. Hasil bacaan dapat diedit sebelum disimpan!
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
              {/* Kolom 1: Telegram Bot Struk */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <Bot className="w-4 h-4" />
                  <span>Kirim Struk via Bot Telegram</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Cukup kirim foto struk belanja Anda ke bot Telegram. Bot akan memindai toko &amp; total nominal, lalu menampilkan menu interaktif:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                  <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      ✏️ Ubah Nominal
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">Ketik angka baru (misal <code>185k</code> atau <code>180000</code>) jika nominal kurang pas.</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      ✏️ Ubah Toko / Ket
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">Ganti nama toko/merchant atau catatan keterangan sesuai keinginan.</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      🏷️ Ganti Kategori
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">Pilih dari 6 kategori: Makanan, Belanja, Transportasi, Tagihan, Usaha, dll.</p>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200/60 dark:border-slate-800 space-y-0.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      🔄 Ganti Jenis
                    </span>
                    <p className="text-slate-500 dark:text-slate-400">Tukar antara Pengeluaran (uang keluar) atau Pemasukan (uang masuk).</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                  💡 Ketik <b>/struk</b> di bot Telegram kapan saja untuk melihat panduan lengkap ini.
                </p>
              </div>

              {/* Kolom 2: Website Scan Struk */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold">
                  <Camera className="w-4 h-4" />
                  <span>Scan Struk di Menu Chat Website</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  Pada tab <b>Chat</b>, Anda dapat mengklik ikon <b>Kamera</b> di sebelah kanan kolom input untuk memindai nota fisik secara langsung:
                </p>
                <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <li className="flex items-start space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Formulir Edit Lengkap:</b> Sebelum menekan "Simpan Transaksi", Anda dapat mengedit nama toko, nominal, kategori, dan jenis transaksi secara bebas.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>100% Offline OCR:</b> Pemindaian berjalan aman langsung di peramban Anda tanpa biaya API tambahan.</span>
                  </li>
                  <li className="flex items-start space-x-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>Otomatis Masuk Spreadsheet:</b> Begitu dikonfirmasi, transaksi langsung terkirim ke Google Sheets dan mengupdate saldo riil.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Zona Manajemen Data & Kosongkan Transaksi (Reset Rp 0) */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-rose-200/70 dark:border-rose-950/60 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100/70 dark:border-rose-950/40">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span>Kosongkan Seluruh Transaksi</span>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-md border border-rose-200 dark:border-rose-900">
                      Reset Rp 0
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Mulai pencatatan dari awal dengan membersihkan data di Website & Spreadsheet.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 rounded-xl p-3.5 border border-rose-100 dark:border-rose-900/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-medium">Status Akun ({currentUser?.username || 'Pengguna'}):</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
                  {transactionCount} Transaksi Tersimpan
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Fitur ini akan menghapus seluruh data transaksi milik Anda baik dari <b>Website, Database Server</b>, maupun <b>Google Spreadsheet</b> sehingga saldo kas Anda kembali bersih menjadi <b>Rp 0</b>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(true)}
                disabled={isClearing}
                className="flex items-center space-x-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-600/20 transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isClearing ? 'Sedang Mereset ke Rp 0...' : 'Kosongkan Semua Transaksi (Reset ke Rp 0)'}</span>
              </button>

              {clearSuccessToast && (
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <Check className="w-4 h-4" />
                  <span>Data Berhasil Dikosongkan! Saldo = Rp 0</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide Steps Panel */}
          <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2 pb-2 border-b border-slate-100 dark:border-slate-900">
              <HelpCircle className="w-4.5 h-4.5 text-amber-500" />
              <span>Langkah Penyiapan Mandiri (100% Gratis)</span>
            </h2>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-4 leading-relaxed">
              {/* Spreadsheet Guide */}
              <div className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                  <span className="w-4.5 h-4.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold mr-2">1</span>
                  Langkah Google Spreadsheet & Apps Script:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 pl-6 text-[11px] text-slate-500">
                  <li>Buat sebuah Spreadsheet baru di Google Drive Anda.</li>
                  <li>Di Spreadsheet, klik menu <b>Ekstensi &gt; Apps Script</b>.</li>
                  <li>Hapus semua kode bawaan, lalu salin dan tempel kode <b>Code.gs</b> yang ada di sebelah kanan panel ini.</li>
                  <li>Klik tombol Simpan 💾 di bar atas editor Apps Script.</li>
                  <li>Klik tombol <b>Terapkan &gt; Penerapan Baru</b> (Deploy &gt; New Deployment).</li>
                  <li>Klik ikon gerigi di sebelah "Pilih Jenis", pilih <b>Aplikasi Web</b> (Web App).</li>
                  <li>Ubah pengaturannya menjadi:
                    <ul className="list-disc list-inside pl-4 mt-0.5 space-y-0.5 font-medium">
                      <li><i>Jalankan sebagai:</i> <b>Saya (Email Anda)</b></li>
                      <li><i>Yang memiliki akses:</i> <b>Siapa saja (Anyone)</b></li>
                    </ul>
                  </li>
                  <li>Klik <b>Terapkan</b> (Deploy). Izinkan akses dari akun Google Anda jika muncul popup verifikasi keamanan.</li>
                  <li>Salin <b>URL Aplikasi Web</b> yang ditampilkan, lalu tempel di kolom "URL Web App" di atas. Selesai!</li>
                </ol>
              </div>

              {/* Telegram Bot Guide */}
              <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-900">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center">
                  <span className="w-4.5 h-4.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold mr-2">2</span>
                  Langkah Pembuatan Bot Telegram:
                </span>
                <ol className="list-decimal list-inside space-y-1.5 pl-6 text-[11px] text-slate-500">
                  <li>Buka Telegram, cari akun bot resmi <b>@BotFather</b>.</li>
                  <li>Kirim perintah <code>/newbot</code> lalu ikuti instruksinya (beri nama bot & username unik).</li>
                  <li>BotFather akan memberikan sebuah <b>Bot Token</b>. Salin token tersebut dan tempel di kolom di atas.</li>
                  <li>Isi URL Apps Script di atas terlebih dahulu, simpan, lalu klik tombol <b>"Daftarkan Webhook Bot"</b> di atas.</li>
                  <li>Buka bot Telegram Anda, kirim perintah <code>/start</code>. Sekarang Anda bisa langsung mencatat keuangan lewat HP!</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Code View Area (1 col on lg) */}
        <div className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm p-5 flex flex-col space-y-4">
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3 gap-2">
            <div className="space-y-0.5">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
                <Code className="w-4.5 h-4.5 text-emerald-600" />
                <span>Script Transaksi Keuangan (financeCode.gs)</span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Script khusus untuk pencatatan mutasi kas, kategori, dan Bot Telegram pribadi Anda.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleSelectAllCode}
                title="Pilih seluruh isi kode di textarea"
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                <span>Pilih Semua (Ctrl+A)</span>
              </button>

              <button
                type="button"
                onClick={handleCopyCode}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold transition ${
                  copied
                    ? 'bg-emerald-500 border-emerald-600 text-white dark:bg-emerald-600'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin!' : 'Salin Script Transaksi'}</span>
              </button>
            </div>
          </div>

          {copyFeedback && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center space-x-2 animate-fadeIn">
              <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Solusi Khusus Error Syntax Unexpected identifier 'doc' */}
          <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-amber-900 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>PENTING jika muncul error 'Unexpected identifier doc' di Apps Script:</span>
            </div>
            <p className="leading-relaxed">
              Error tersebut terjadi karena masih tersisa baris kode lama di editor Google Apps Script Anda.
              <b> Cara Bersih:</b> Buka <code className="font-mono bg-amber-100/80 dark:bg-amber-900/60 px-1 py-0.5 rounded">Code.gs</code> di Apps Script, tekan <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-mono font-bold">Ctrl + A</kbd> lalu tekan <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-mono font-bold">Backspace</kbd> sampai kosong bersih, lalu tekan <kbd className="px-1 py-0.5 bg-white dark:bg-slate-800 border rounded shadow-xs font-mono font-bold">Ctrl + V</kbd> untuk menempelkan kode baru, dan klik <b>Simpan (Ctrl+S)</b>.
            </p>
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Kode di bawah adalah script <b>financeCode.gs</b> khusus pencatatan keuangan harian, mutasi kas, kategori, dan Bot Telegram pribadi Anda.
          </p>

          <textarea
            ref={codeTextareaRef}
            readOnly
            value={personalizedCode}
            className="flex-1 w-full min-h-[350px] p-3.5 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl border border-slate-800 focus:outline-none resize-none scrollbar-thin overflow-y-auto"
          />

          {/* Bot Explanation Box */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-amber-500/30 rounded-xl space-y-4 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-200 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.07)]">
            <div className="flex items-center space-x-2 font-bold text-xs border-b border-slate-100 dark:border-slate-800 pb-2 text-slate-800 dark:text-white">
              <Bot className="w-4.5 h-4.5 text-indigo-600 dark:text-amber-400 shrink-0" />
              <span className="text-slate-800 dark:text-amber-400">💡 Cara Penggunaan & Tips Penting:</span>
            </div>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-bold mb-1 text-slate-900 dark:text-white">1. Tanpa Setup Ribet (Siap Pakai)</h4>
                <p className="text-slate-600 dark:text-slate-200">
                  Anda <b className="text-indigo-600 dark:text-amber-300 font-bold">tidak perlu membuat kolom atau tabel secara manual</b> di Google Spreadsheet Anda. 
                  Setelah script di atas dipasang, sistem akan otomatis mendeteksi spreadsheet Anda dan 
                  <b className="text-indigo-600 dark:text-amber-300 font-bold"> membuat baris kolom transaksi secara otomatis</b> (<i>ID, Tanggal, Jenis, Kategori, Nominal, Deskripsi</i>) saat pertama kali data terkirim.
                </p>
              </div>

              <div>
                <h4 className="font-bold mb-1 text-slate-900 dark:text-white">2. Langkah Pemasangan:</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-200 pl-1">
                  <li>Buat Google Spreadsheet baru, lalu buka menu <b className="text-indigo-600 dark:text-amber-300 font-bold">Ekstensi &gt; Apps Script</b>.</li>
                  <li>Hapus semua kode bawaan, lalu <b className="text-indigo-600 dark:text-amber-300 font-bold">tempelkan (paste)</b> kode Apps Script dari box di atas.</li>
                  <li>Klik tombol <b className="text-indigo-600 dark:text-amber-300 font-bold">Terapkan &gt; Penerapan Baru</b> (Deploy &gt; New Deployment).</li>
                  <li>Pilih jenis <b className="text-indigo-600 dark:text-amber-300 font-bold">Aplikasi Web</b>. Atur "Siapa yang memiliki akses" menjadi <b className="text-indigo-600 dark:text-amber-300 font-bold">Siapa saja (Anyone)</b>.</li>
                  <li>Klik <b className="text-indigo-600 dark:text-amber-300 font-bold">Terapkan</b>, lalu salin (copy) <b className="text-indigo-600 dark:text-amber-300 font-bold">URL Aplikasi Web</b> yang dihasilkan dan masukkan ke kolom URL Google Sheet di aplikasi ini.</li>
                </ol>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold mb-1 text-slate-900 dark:text-white flex items-center gap-1">
                  <span className="text-indigo-600 dark:text-amber-400">✨ Tips & Fitur Pintar:</span>
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-200 pl-1">
                  <li>
                    <b className="text-slate-800 dark:text-white">Pencatatan Berbasis AI:</b> Cukup ketik seperti biasa di menu chat, contoh: <i className="text-indigo-600 dark:text-amber-200 not-italic font-semibold">"makan siang 25 ribu"</i> atau <i className="text-indigo-600 dark:text-amber-200 not-italic font-semibold">"gajian 5 juta masuk rekening"</i>. AI akan mengkategorikan dan mencatatnya otomatis.
                  </li>
                  <li>
                    <b className="text-slate-800 dark:text-white">Sinkronisasi Offline Instan:</b> Jika internet HP Anda terputus (offline), transaksi yang Anda catat akan otomatis disimpan di penyimpanan lokal HP Anda. Begitu Anda tersambung kembali ke internet, aplikasi akan <b className="text-indigo-600 dark:text-amber-300 font-bold">langsung menyinkronkan data secara otomatis</b> ke Google Sheets tanpa kehilangan data!
                  </li>
                  <li>
                    <b className="text-slate-800 dark:text-white">Scan Foto Nota/Struk via Telegram Bot:</b> Anda sekarang bisa mengirim foto nota, bon, atau struk belanja Anda langsung ke bot Telegram Anda! Bot akan otomatis membaca nama toko & jumlah total pembayaran secara instan menggunakan Google OCR gratis tanpa perlu kunci API, lalu mencatatnya otomatis ke Spreadsheet Anda.
                  </li>
                  <li>
                    <b className="text-slate-800 dark:text-white">Bersihkan Riwayat Chat:</b> Ketik perintah chat seperti <i className="text-indigo-600 dark:text-amber-200 not-italic font-semibold">"hapus chat"</i>, <i className="text-indigo-600 dark:text-amber-200 not-italic font-semibold">"bersihkan chat"</i>, atau klik tombol <b className="text-indigo-600 dark:text-amber-300 font-bold">Hapus Chat</b> di atas ruang obrolan untuk mengosongkan layar obrolan agar selalu rapi.
                  </li>
                  <li>
                    <b className="text-slate-800 dark:text-white">Uji Coba di Apps Script:</b> Jika ingin mencoba menjalankan fungsi langsung di editor Apps Script dengan tombol <b>Jalankan (Run)</b>, pilih fungsi <code className="text-indigo-600 dark:text-amber-300 font-bold">testSheet</code> (jangan pilih doGet/doPost karena kedua fungsi tersebut hanya dipanggil oleh sistem Web App).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Kosongkan Transaksi */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Kosongkan Seluruh Transaksi?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-2">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                Anda akan menghapus <b>{transactionCount} data transaksi</b> milik akun <b>{currentUser?.username || 'Pengguna'}</b>.
              </p>
              <ul className="list-disc list-inside text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <li>Seluruh riwayat pemasukan & pengeluaran di <b>Website</b> dihapus bersih.</li>
                <li>Catatan transaksi di <b>Google Spreadsheet</b> dibersihkan.</li>
                <li>Sisa Saldo Kas akan kembali direset menjadi <b>Rp 0</b>.</li>
                <li>Anda bisa memulai kembali pencatatan keuangan dari awal.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                disabled={isClearing}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onClearTransactions) {
                    setIsClearing(true);
                    try {
                      await onClearTransactions();
                      setClearSuccessToast(true);
                      setTimeout(() => setClearSuccessToast(false), 4000);
                    } finally {
                      setIsClearing(false);
                      setConfirmClearOpen(false);
                    }
                  }
                }}
                disabled={isClearing}
                className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
              >
                {isClearing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isClearing ? 'Membersihkan...' : 'Ya, Kosongkan Bersih (Reset Rp 0)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
