import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Bot, User, HelpCircle, CheckCircle, ArrowDownRight, 
  ArrowUpRight, Coins, Trash2, Camera, Loader2, X, Image, RefreshCw
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import { Message, Transaction } from '../types';
import { parseTransactionText, formatRupiah } from '../utils/parser';
import { parseReceiptText } from '../utils/receiptParser';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../utils/categories';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (text: string) => void;
  onClearChat?: () => void;
  isTyping: boolean;
  totalBalance: number;
  onAddTransactionDirect?: (tx: {
    type: 'pemasukan' | 'pengeluaran';
    amount: number;
    description: string;
    category: string;
  }) => void;
  onGeneratePDFReport?: (period: 'all' | 'week' | 'month' | 'year') => void;
}

// Helper to render bold text from ** markdown markup safely without displaying raw asterisks
const renderMessageText = (text: string) => {
  if (!text) return null;
  const parts = text.split('**');
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <strong key={index} className="font-extrabold text-slate-900 dark:text-white">
          {part}
        </strong>
      );
    }
    return part;
  });
};

export default function ChatInterface({ 
  messages, 
  onSendMessage, 
  onClearChat, 
  isTyping, 
  totalBalance,
  onAddTransactionDirect,
  onGeneratePDFReport
}: ChatInterfaceProps) {
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR state
  const [isScanning, setIsScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<{
    amount: number;
    description: string;
    category: string;
    type: 'pemasukan' | 'pengeluaran';
  } | null>(null);

  // In-app Camera states
  const [showSourceOptions, setShowSourceOptions] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('environment');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const suggestionChips = [
    'gaji masuk 3juta',
    'pengeluaran bakso 15k',
    'freelance 1.5jt',
    'bayar kos 1.500.000',
    'beli kopi 20rb',
    'sisa saldo',
  ];

  // Close source menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowSourceOptions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isScanning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleChipClick = (chipText: string) => {
    onSendMessage(chipText);
  };

  const startCamera = async (facing: 'user' | 'environment' = 'environment') => {
    try {
      setShowSourceOptions(false);
      setIsCameraOpen(true);
      setCameraFacing(facing);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Error playing video stream:", err));
      }
    } catch (err) {
      console.error("Gagal memulai kamera:", err);
      alert("Tidak dapat mengakses kamera. Pastikan Anda mengizinkan akses kamera di peramban atau silakan gunakan foto dari galeri.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const toggleCameraFacing = async () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    await startCamera(nextFacing);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (cameraFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
          processImageFile(file);
        }
        stopCamera();
      }, 'image/jpeg', 0.85);
    }
  };

  const processImageFile = async (file: File) => {
    setIsScanning(true);
    setOcrProgress(10);
    setOcrResult(null);

    try {
      // 1. Coba terlebih dahulu via Server AI Vision (/api/scan-receipt)
      let parsedFromApi: any = null;
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        setOcrProgress(35);
        const apiRes = await fetch('/api/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg'
          })
        });

        if (apiRes.ok) {
          const json = await apiRes.json();
          if (json.success && json.amount > 0) {
            parsedFromApi = json;
            setOcrProgress(100);
          }
        }
      } catch (apiErr) {
        console.warn('Server OCR scan failed, falling back to browser OCR:', apiErr);
      }

      if (parsedFromApi) {
        setOcrResult({
          amount: parsedFromApi.amount,
          description: parsedFromApi.description,
          category: parsedFromApi.category,
          type: parsedFromApi.type || 'pengeluaran'
        });
        return;
      }

      // 2. Fallback ke OCR Client Tesseract.js
      setOcrProgress(40);
      const result = await Tesseract.recognize(
        file,
        'eng', // English is universally pre-installed & blazing fast for numerals
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setOcrProgress(40 + Math.round(m.progress * 60));
            }
          }
        }
      );

      const text = result.data.text;
      const parsed = parseReceiptText(text);

      // Map to standard application category names
      let mappedCategory = 'Lain-lain';
      if (parsed.category === 'Makanan') {
        mappedCategory = 'Makanan & Minuman';
      } else if (parsed.category === 'Belanja') {
        mappedCategory = 'Belanja & Pribadi';
      } else if (parsed.category === 'Tagihan') {
        mappedCategory = 'Tagihan & Utilitas';
      } else if (parsed.category === 'Hiburan') {
        mappedCategory = 'Hiburan & Liburan';
      } else if (
        ['Transportasi', 'Kesehatan', 'Lain-lain'].includes(parsed.category)
      ) {
        mappedCategory = parsed.category;
      }

      setOcrResult({
        amount: parsed.amount,
        description: parsed.description,
        category: mappedCategory,
        type: 'pengeluaran'
      });

    } catch (err) {
      console.error("OCR error:", err);
      alert("Gagal membaca struk. Pastikan kualitas foto struk jelas dan terang.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
  };

  const handleSaveOcrResult = () => {
    if (!ocrResult || !onAddTransactionDirect) return;
    onAddTransactionDirect({
      type: ocrResult.type,
      amount: ocrResult.amount,
      description: ocrResult.description,
      category: ocrResult.category,
    });
    setOcrResult(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* Premium Sub-Header to Clear Chat when history exists */}
      {messages.length > 0 && onClearChat && (
        <div className="px-5 py-2.5 bg-white dark:bg-slate-950 border-b border-slate-100 dark:border-slate-900/50 flex justify-between items-center text-xs text-slate-400 dark:text-slate-500 shrink-0">
          <span className="font-semibold uppercase tracking-wider text-[10px]">Riwayat Percakapan</span>
          <button
            onClick={onClearChat}
            className="flex items-center space-x-1.5 text-[10px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-bold uppercase tracking-wider transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus Chat</span>
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Help Banner if chat is empty */}
        {messages.length === 0 && (
          <div className="mx-auto max-w-sm my-6 p-5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              Selamat Datang di FahKeu!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Aplikasi pencatat keuangan pintar. Cukup ketik transaksi Anda seperti sedang mengobrol dengan teman.
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium mt-1 mb-4">
              by : Faiz_Fahmi_Id since 2026
            </p>
            <div className="text-left space-y-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
              <p className="font-semibold text-slate-600 dark:text-slate-400">💡 Contoh pengetikan:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                <li>gaji masuk 3juta</li>
                <li>pengeluaran bakso 15k</li>
                <li>freelance 1.5jt</li>
                <li>bayar internet 150.000</li>
                <li>sisa saldo</li>
              </ul>
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, index) => {
          const isBot = msg.sender === 'bot';
          const bubbleKey = msg.id ? `${msg.id}_${index}` : `msg_${index}`;
          return (
            <div
              key={bubbleKey}
              className={`flex ${isBot ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
            >
              <div className={`flex items-start space-x-2 max-w-[85%] ${!isBot && 'flex-row-reverse space-x-reverse'}`}>
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold relative ${
                    isBot
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  }`}
                >
                  {isBot ? (
                    <div className="relative w-5.5 h-5.5 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 absolute top-0 left-0" />
                      <Coins className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
                    </div>
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>

                {/* Bubble Body */}
                <div className="flex flex-col">
                  <div
                    className={`px-4 py-2.5 rounded-2xl shadow-sm leading-relaxed text-sm ${
                      isBot
                        ? 'bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800/80'
                        : msg.source === 'telegram'
                          ? 'bg-sky-600 text-white rounded-tr-none shadow-sky-600/10'
                          : 'bg-emerald-600 text-white rounded-tr-none'
                    }`}
                  >
                    {/* Telegram Source Header if user sent from Telegram */}
                    {!isBot && msg.source === 'telegram' && (
                      <div className="flex items-center space-x-1 text-[10px] text-sky-100/90 font-semibold mb-1 pb-1 border-b border-sky-400/30">
                        <span>📲 Terkirim via Bot Telegram</span>
                      </div>
                    )}

                    {/* Message Text */}
                    <div className="whitespace-pre-wrap">{renderMessageText(msg.text)}</div>

                    {/* Parsed Card for Bot Confirmations */}
                    {isBot && msg.parsedTransaction && (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                        <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-1.5">
                          <span className="font-semibold text-slate-500">Ringkasan Pencatatan</span>
                          <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium space-x-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Tercatat</span>
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                          <span className="text-slate-400">Keterangan:</span>
                          <span className="font-semibold text-right text-slate-800 dark:text-slate-200 truncate">
                            {msg.parsedTransaction.description}
                          </span>

                          <span className="text-slate-400">Kategori:</span>
                          <span className="text-right font-medium text-slate-600 dark:text-slate-400">
                            {msg.parsedTransaction.category}
                          </span>

                          <span className="text-slate-400">Jenis:</span>
                          <span className="text-right">
                            {msg.parsedTransaction.type === 'pemasukan' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <ArrowDownRight className="w-3 h-3 mr-0.5" />
                                Pemasukan
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                <ArrowUpRight className="w-3 h-3 mr-0.5" />
                                Pengeluaran
                              </span>
                            )}
                          </span>

                          <span className="text-slate-400">Nominal:</span>
                          <span className={`font-mono font-bold text-right ${
                            msg.parsedTransaction.type === 'pemasukan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {msg.parsedTransaction.type === 'pemasukan' ? '+' : '-'} {formatRupiah(msg.parsedTransaction.amount)}
                          </span>

                          <span className="text-slate-400 border-t border-slate-200/30 dark:border-slate-800/30 pt-1.5">Sisa Saldo:</span>
                          <span className="font-mono font-bold text-right text-slate-800 dark:text-slate-200 border-t border-slate-200/30 dark:border-slate-800/30 pt-1.5">
                            {formatRupiah(msg.parsedTransaction.balanceAfter)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* PDF Period Selectors */}
                    {isBot && msg.isPdfSelector && onGeneratePDFReport && (
                      <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
                        <button
                          onClick={() => onGeneratePDFReport('all')}
                          className="flex items-center justify-center space-x-1 px-2.5 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/40 dark:border-emerald-900/40 rounded-xl cursor-pointer transition text-[11px] active:scale-95"
                        >
                          <span>📂 Semua Transaksi</span>
                        </button>
                        <button
                          onClick={() => onGeneratePDFReport('week')}
                          className="flex items-center justify-center space-x-1 px-2.5 py-2.5 bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200/40 dark:border-indigo-900/40 rounded-xl cursor-pointer transition text-[11px] active:scale-95"
                        >
                          <span>📅 Minggu Ini</span>
                        </button>
                        <button
                          onClick={() => onGeneratePDFReport('month')}
                          className="flex items-center justify-center space-x-1 px-2.5 py-2.5 bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/40 dark:border-amber-900/40 rounded-xl cursor-pointer transition text-[11px] active:scale-95"
                        >
                          <span>📆 Bulan Ini</span>
                        </button>
                        <button
                          onClick={() => onGeneratePDFReport('year')}
                          className="flex items-center justify-center space-x-1 px-2.5 py-2.5 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold border border-rose-200/40 dark:border-rose-900/40 rounded-xl cursor-pointer transition text-[11px] active:scale-95"
                        >
                          <span>🗓️ Tahun Ini</span>
                        </button>
                      </div>
                    )}

                    {/* PDF Repeat-Download Button */}
                    {isBot && msg.pdfPeriod && onGeneratePDFReport && (
                      <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => onGeneratePDFReport(msg.pdfPeriod as any)}
                          className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-extrabold rounded-xl cursor-pointer shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-98 transition text-xs"
                        >
                          <span className="shrink-0 text-sm">📥</span>
                          <span>Unduh File PDF ({
                            msg.pdfPeriod === 'all' ? 'Semua' :
                            msg.pdfPeriod === 'week' ? 'Minggu Ini' :
                            msg.pdfPeriod === 'month' ? 'Bulan Ini' : 'Tahun Ini'
                          })</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Timestamp, Status & Source */}
                  <div className={`flex items-center space-x-1.5 text-[10px] text-slate-400 mt-1 ${!isBot ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                    {msg.source === 'telegram' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                        Telegram
                      </span>
                    )}
                    <span>{msg.timestamp}</span>
                    {!isBot && msg.status === 'sending' && (
                      <span className="inline-flex items-center space-x-1 text-[10px] text-amber-500 dark:text-amber-400 font-medium animate-pulse">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Sedang kirim...</span>
                      </span>
                    )}
                    {!isBot && msg.status === 'sent' && (
                      <span className="inline-flex items-center space-x-0.5 text-[10px] text-emerald-500 font-medium animate-in fade-in transition duration-300">
                        <span>✓ Terkirim</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing & Processing indicator */}
        {isTyping && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className="flex items-start space-x-2 max-w-sm">
              <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-semibold relative shrink-0">
                <div className="relative w-5.5 h-5.5 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 absolute top-0 left-0" />
                  <Coins className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-amber-500 dark:text-amber-400 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-md border border-emerald-200 dark:border-emerald-800/50 space-y-1">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-spin shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    Sedang memproses transaksi...
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                  <span>Menyinkronkan ke Google Spreadsheet</span>
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OCR Scanning Status */}
        {isScanning && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className="flex items-start space-x-2 w-full max-w-sm">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-semibold">
                <Camera className="w-4 h-4 animate-spin" />
              </div>
              <div className="flex-1 bg-slate-900 border border-amber-500/20 text-white px-4 py-3.5 rounded-2xl rounded-tl-none shadow-lg space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-amber-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Sedang Membaca Struk (Offline OCR)...</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-amber-400 to-yellow-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${ocrProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>Proses ekstraksi</span>
                  <span>{ocrProgress}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 bg-slate-100/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-900 overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
        <div className="flex space-x-2">
          {suggestionChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-800 transition shadow-sm shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* OCR Result Confirmation Card (Review Sheet) */}
      {ocrResult && (
        <div className="mx-4 my-3 p-4 bg-white dark:bg-slate-950 border border-amber-500/30 rounded-2xl shadow-xl space-y-4 text-slate-800 dark:text-white animate-in slide-in-from-bottom duration-300 shrink-0">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-2">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs tracking-wide uppercase text-slate-900 dark:text-amber-400 block leading-none">Pratinjau Hasil Scan Struk</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 block">Silakan periksa & edit data sebelum disimpan</span>
              </div>
            </div>
            <button 
              onClick={() => setOcrResult(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 transition"
              title="Batalkan Scan"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-xs">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1 uppercase tracking-wider">Keterangan / Nama Toko</label>
              <input 
                type="text" 
                value={ocrResult.description}
                onChange={(e) => setOcrResult({ ...ocrResult, description: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1 uppercase tracking-wider">Nominal (Rp)</label>
              <input 
                type="number" 
                value={ocrResult.amount}
                onChange={(e) => setOcrResult({ ...ocrResult, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1 uppercase tracking-wider">Kategori</label>
              <select
                value={ocrResult.category}
                onChange={(e) => setOcrResult({ ...ocrResult, category: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white font-medium"
              >
                {ocrResult.type === 'pengeluaran' ? (
                  EXPENSE_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                ) : (
                  INCOME_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)
                )}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1 uppercase tracking-wider">Jenis Transaksi</label>
              <select
                value={ocrResult.type}
                onChange={(e) => {
                  const newType = e.target.value as 'pemasukan' | 'pengeluaran';
                  const defaultCat = newType === 'pemasukan' ? 'Gaji & Pendapatan Tetap' : 'Makanan & Minuman';
                  setOcrResult({ ...ocrResult, type: newType, category: defaultCat });
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-white font-semibold"
              >
                <option value="pengeluaran">Pengeluaran (Uang Keluar)</option>
                <option value="pemasukan">Pemasukan (Uang Masuk)</option>
              </select>
            </div>

            <div className="col-span-2 pt-2 flex items-center justify-end space-x-2.5 border-t border-slate-100 dark:border-slate-900">
              <button
                type="button"
                onClick={() => setOcrResult(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveOcrResult}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 transition-all shadow-md hover:shadow-amber-500/20 active:scale-95"
              >
                Simpan ke Catatan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input for Receipt Capture */}
      <input 
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Input Bar */}
      <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <form onSubmit={handleSubmit} className="flex items-center space-x-3">
          {/* Receipt Capture Trigger Button with Popover Selector */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowSourceOptions(!showSourceOptions)}
              disabled={isScanning}
              className={`w-11 h-11 rounded-2xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800/80 flex items-center justify-center transition active:scale-95 shadow-sm disabled:opacity-50 ${
                showSourceOptions ? 'ring-2 ring-emerald-500 border-transparent bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : ''
              }`}
              title="Scan Struk Belanja"
            >
              <Camera className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
            </button>

            {/* Source Options Bubble Menu */}
            {showSourceOptions && (
              <div className="absolute bottom-13 left-0 w-48 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5 z-30 flex flex-col space-y-1 animate-in slide-in-from-bottom-2 duration-150">
                <div className="px-2 py-1 text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Sumber Foto Struk
                </div>
                <button
                  type="button"
                  onClick={() => startCamera('environment')}
                  className="w-full flex items-center space-x-2.5 px-2 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition text-left"
                >
                  <Camera className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span>Ambil Foto Langsung</span>
                    <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-normal">Tidak simpan di galeri</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSourceOptions(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full flex items-center space-x-2.5 px-2 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 transition text-left"
                >
                  <Image className="w-4 h-4 text-sky-500 shrink-0" />
                  <div className="flex flex-col leading-tight">
                    <span>Pilih dari Galeri</span>
                    <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-normal">Gunakan foto di HP</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Tulis transaksi... (e.g. "gaji masuk 3juta" atau "bakso 4k")'
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition placeholder-slate-400 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition shadow-md shrink-0 ${
              inputText.trim()
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg active:scale-95'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-400 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
            }`}
          >
            <Send className="w-4.5 h-4.5" />
          </button>
        </form>
      </div>

      {/* Immersive Camera Stream Overlay */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-between p-4 md:p-6 animate-in fade-in duration-200">
          {/* Header */}
          <div className="w-full max-w-md flex justify-between items-center text-white pt-2">
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-wider uppercase text-emerald-400">FAHKEU CAMERA</span>
              <span className="text-[10px] text-slate-400">Foto diproses langsung tanpa disimpan di galeri</span>
            </div>
            <button 
              type="button"
              onClick={stopCamera}
              className="p-2.5 rounded-full bg-slate-900/60 hover:bg-rose-600 border border-slate-800 text-slate-300 hover:text-white transition active:scale-95"
              title="Tutup Kamera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Camera Viewfinder Viewport */}
          <div className="w-full max-w-md aspect-[3/4] relative bg-black border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center my-auto">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
            {/* Guide Grid & Framer Box to guide user */}
            <div className="absolute inset-0 border-2 border-transparent flex flex-col items-center justify-center pointer-events-none p-6">
              {/* Receipt Framing Box */}
              <div className="w-4/5 h-2/3 border-2 border-dashed border-emerald-500/80 rounded-2xl relative flex flex-col items-center justify-between p-4 bg-emerald-500/5">
                <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl"></div>
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr"></div>
                <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl"></div>
                <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br"></div>

                <div className="text-[10px] bg-slate-950/80 px-2.5 py-1 rounded-full text-emerald-400 font-bold tracking-wide uppercase text-center mt-2 shadow-sm">
                  TEMPATKAN STRUK DI SINI
                </div>
                <div className="text-[9px] text-slate-300 text-center mb-2 px-2 leading-relaxed bg-slate-950/70 py-1.5 rounded-xl font-medium">
                  Pastikan tulisan struk tegak, jelas, dan berada di dalam area kotak
                </div>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="w-full max-w-md flex items-center justify-between px-6 pb-6 pt-2">
            {/* Gallery fallback */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                fileInputRef.current?.click();
              }}
              className="w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center transition active:scale-95"
              title="Pilih dari Galeri"
            >
              <Image className="w-5 h-5" />
            </button>

            {/* Shutter capture button */}
            <button
              type="button"
              onClick={handleCapture}
              className="w-18 h-18 rounded-full border-4 border-white/25 bg-white hover:bg-slate-100 flex items-center justify-center transition active:scale-90 shadow-lg relative"
              title="Ambil Foto"
            >
              <div className="w-13 h-13 rounded-full bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center text-white font-extrabold shadow-inner">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>

            {/* Flip camera button */}
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 flex items-center justify-center transition active:scale-95"
              title="Putar Kamera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
