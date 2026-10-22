export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  role: 'admin' | 'user';
  createdAt: string;
  status: 'active' | 'suspended';
  googleSheetUrl?: string; // Spreadsheet privat milik akun pengguna ini
  telegramBotToken?: string; // Token bot Telegram privat milik akun pengguna ini
  telegramChatId?: string; // Chat ID Telegram privat milik akun pengguna ini
  useCloudStorage?: boolean;
}

export interface Transaction {
  id: string;
  userId?: string;
  username?: string;
  date: string; // ISO String
  type: 'pemasukan' | 'pengeluaran';
  amount: number;
  description: string;
  category: string;
  source: 'web' | 'telegram';
  rawText?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string; // HH:MM
  source?: 'web' | 'telegram';
  status?: 'sending' | 'sent' | 'error';
  parsedTransaction?: {
    type: 'pemasukan' | 'pengeluaran';
    amount: number;
    description: string;
    category: string;
    feedback: string;
    balanceAfter: number;
  };
  isPdfSelector?: boolean;
  pdfDownloadUrl?: string;
  pdfPeriod?: string;
}

export interface AppSettings {
  googleSheetUrl: string; // Apps Script Web App URL untuk Pencatat Keuangan (Transaksi & Mutasi)
  adminGoogleSheetUrl?: string; // Apps Script Web App URL khusus Admin (Database Pengguna & Akun)
  telegramBotToken: string;
  telegramChatId: string;
  useCloudStorage: boolean;
  googleClientId?: string; // Google Auth Client ID (OAuth 2.0 Web Client ID)
}

export interface OfflineAction {
  id: string;
  action: 'add' | 'edit' | 'delete' | 'clear';
  transaction?: Transaction;
  transactionId?: string;
}

export interface OcrProviderInfo {
  id: 'gemini' | 'ocr_space' | 'local_tesseract' | 'gcp_vertex';
  name: string;
  providerCompany: string;
  type: 'ai_multimodal' | 'cloud_ocr' | 'offline_local';
  officialUrl: string;
  keyRegisterUrl: string;
  pricingLabel: string;
  dailyQuotaLabel: string;
  recommended: boolean;
  requiresKey: boolean;
  accuracyRating: string;
  speedRating: string;
  description: string;
  pros: string[];
  cons: string[];
  tutorialSteps: string[];
}

export interface CategoryConfig {
  name: string;
  color: string;
  keywords: string[];
  icon: string; // Lucide icon name
}
