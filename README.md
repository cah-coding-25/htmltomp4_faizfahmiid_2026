# 📘 PRODUCT REQUIREMENTS DOCUMENT (PRD) & BLUEPRINT ARSITEKTUR TEKNIS MASTER
# 💎 FAHKEU (FAIZ KEUANGAN) — ECOSYSTEM CATAT KEUANGAN CERDAS 100% PERSIS
> **Dokumen Spesifikasi Kebutuhan Produk (PRD) & Blueprint Rekonstruksi Sistem Komprehensif**  
> **Pemilik Ide, Konsep & Pengembang Utama:** **`by: Faiz_Fahmi_ID`**  
> **Hak Cipta © 2026 by: Faiz_Fahmi_ID — Hak Cipta Dilindungi Undang-Undang**  
> **Versi Dokumen:** 4.0 (Production-Ready Release Specification & Multi-Channel Real-Time Parity)  
> **Target Paritas:** 100% Sama Persis dalam Desain, Alur Interaksi, Bot Telegram, Basis Data, dan Logika Backend.

---

## 📑 DAFTAR ISI DOKUMEN (PRD)

1. [RINGKASAN EKSEKUTIF & TUJUAN PRODUK](#1-ringkasan-eksekutif--tujuan-produk)
2. [PENGGUNA SASARAN & PERSONA PENGGUNA](#2-pengguna-sasaran--persona-pengguna)
3. [TUMPUKAN TEKNOLOGI & DEPENDENSI RESMI (TECH STACK)](#3-tumpukan-teknologi--dependensi-resmi-tech-stack)
4. [STRUKTUR DIREKTORI & MODULARITAS FILE](#4-struktur-direktori--modularitas-file)
5. [MODEL DATA, ENTITAS, & TIPE TYPESCRIPT](#5-model-data-entitas--tipe-typescript)
6. [SPESIFIKASI FITUR SISI KLIEN (FRONTEND SPECIFICATIONS)](#6-spesifikasi-fitur-sisi-klien-frontend-specifications)
   - 6.1 Desain Visual, Tiga Tema (Light, Dark, Luxury Gold), & Sistem Navigasi
   - 6.2 Antarmuka Obrolan Pintar (Smart Conversational NLP Chat) & Feedback Telegram Otomatis
   - 6.3 Mesin Pemindai Struk Bon Multi-Provider AI (Gemini 2.5 Flash, OCR.space, Tesseract OCR)
   - 6.4 Dashboard Finansial Interaktif & Visualisasi Grafik (Recharts)
   - 6.5 Generator Laporan PDF Standar Perbankan Berformat A4 (jsPDF)
   - 6.6 Panel Pengaturan Keuangan Pribadi (Sisi Pengguna Biasa)
   - 6.7 Dashboard Super Admin, Master Database, & Manajemen OCR Provider
   - 6.8 Sistem Autentikasi Mandiri & Google OAuth 2.0 (GSI)
7. [SPESIFIKASI BACKEND RUNTIME & REST API (`server.ts`)](#7-spesifikasi-backend-runtime--rest-api-serverts)
   - 7.1 Daftar Lengkap Endpoint REST API
   - 7.2 Mesin Polling Daemon Bot Telegram 24/7 Multi-Akun
   - 7.3 State Machine Draf Struk Telegram & 100% Tombol Edit Interaktif
   - 7.4 Alur Transaksi Percakapan Teks Biasa via Telegram
   - 7.5 Mekanisme Proxy Google Apps Script (Bypass CORS & 302 Redirect)
8. [ARSITEKTUR BASIS DATA GOOGLE APPS SCRIPT (DUAL-SPREADSHEET)](#8-arsitektur-basis-data-google-apps-script-dual-spreadsheet)
   - 8.1 Spreadsheet Transaksi Pengguna (`financeCode.gs.ts`)
   - 8.2 Spreadsheet Master Administrator (`adminCode.gs.ts`)
9. [INTEGRASI SINKRONISASI REAL-TIME WEBPAGE <-> BOT TELEGRAM <-> SPREADSHEET](#9-integrasi-sinkronisasi-real-time-webpage---bot-telegram---spreadsheet)
10. [MATRIKS PENGUJIAN MUTU (QA & ACCEPTANCE CRITERIA)](#10-matriks-pengujian-mutu-qa--acceptance-criteria)
11. [PANDUAN LANGKAH-DEMI-LANGKAH MEMBANGUN DARI NOL (STEP-BY-STEP BLUEPRINT)](#11-panduan-langkah-demi-langkah-membangun-dari-nol-step-by-step-blueprint)

---

## 1. RINGKASAN EKSEKUTIF & TUJUAN PRODUK

### 1.1 Visi Produk
**FahKeu (Faiz Keuangan)** adalah ekosistem aplikasi web pencatatan keuangan pribadi dan usaha modern yang memadukan kesederhanaan **antarmuka chat percakapan**, kecepatan pencatatan natural berbasis **AI Heuristic NLP**, pemindai struk bon cerdas bertenaga **Google Gemini 2.5 Flash / OCR.space / Tesseract**, integrasi **Cloud Database Google Spreadsheet gratis tanpa batas**, serta **Bot Telegram 24/7 mandiri** yang terhubung secara **real-time 100% dua arah**.

### 1.2 Masalah yang Dipecahkan
1. **Pencatatan Konvensional yang Melelahkan:** Aplikasi keuangan biasa mewajibkan pengisian formulir bertingkat (tanggal, dompet, nominal, kategori). FahKeu cukup mengetik *`beli cimol 3k`* atau *`gaji 5jt`*.
2. **Ketergantungan Biaya API Berbayar:** FahKeu mendukung multi-provider: dari mode hemat kuota gratis dengan Google Gemini 2.5 Flash, OCR.space, hingga mode lokal Tesseract OCR yang 100% gratis tanpa kuota API.
3. **Penyimpanan Foto Menumpuk (Storage Bloat):** Scanner struk FahKeu memproses citra secara *in-memory buffer* tanpa menyimpan file gambar berlebih di penyimpanan ponsel.
4. **Biaya Database Cloud yang Mahal:** Menggantikan database SQL/Firebase berbayar dengan **Google Sheets (via Google Apps Script V8)** yang aman, gratis selamanya, dan dapat diekspor ke Excel kapan pun.
5. **Aksesibilitas Multi-Channel Real-Time:** Pengguna dapat mencatat mutasi saat bepergian melalui **Bot Telegram**, dan catatan langsung muncul di dashboard website dan Google Spreadsheet dalam waktu < 3.5 detik dengan notifikasi audio.

---

## 2. PENGGUNA SASARAN & PERSONA PENGGUNA

| Persona | Kebutuhan Utama | Solusi di FahKeu |
| :--- | :--- | :--- |
| **Individu Sibuk & Karyawan** | Ingin mencatat pengeluaran harian secepat kilat tanpa ribet. | Chat NLP di web atau ketik langsung ke Bot Telegram saat di jalan. |
| **Pecinta Belanja & Pemburu Struk** | Sering lupa nominal belanja minimarket/kafe. | Foto struk belanja via kamera web atau kirim foto ke bot Telegram dengan tombol koreksi. |
| **Pemilik Usaha Kecil (UMKM)** | Butuh laporan keuangan rapi untuk evaluasi bulanan tanpa menyewa akuntan. | Download Laporan PDF Vektor berstandar perbankan dalam satu klik. |
| **Super Administrator** | Memantau kesehatan ekosistem, mengelola hak akses akun, konfigurasi AI & Google Client ID. | Panel Super Admin komprehensif dengan metrik global dan sinkronisasi cloud. |

---

## 3. TUMPUKAN TEKNOLOGI & DEPENDENSI RESMI (TECH STACK)

Untuk merekonstruksi aplikasi ini 100% sama persis, gunakan dependensi dengan spesifikasi berikut:

```json
{
  "dependencies": {
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "recharts": "^3.9.0",
    "tesseract.js": "^7.0.0",
    "jspdf": "^4.2.1",
    "express": "^4.21.2",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@types/express": "^4.17.21",
    "@vitejs/plugin-react": "^5.0.4",
    "vite": "^6.2.3",
    "typescript": "~5.8.2",
    "tailwindcss": "^4.1.14",
    "@tailwindcss/vite": "^4.1.14",
    "esbuild": "^0.25.0",
    "tsx": "^4.21.0"
  }
}
```

### Konfigurasi Build & Run Script (`package.json`)
```json
{
  "scripts": {
    "dev": "tsx server.ts",
    "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs",
    "start": "node dist/server.cjs",
    "lint": "tsc --noEmit"
  }
}
```

---

## 4. STRUKTUR DIREKTORI & MODULARITAS FILE

```
├── .env.example                     # Dokumentasi variabel lingkungan (GEMINI_API_KEY, dll)
├── metadata.json                    # Metadata aplikasi & izin kamera
├── index.html                       # HTML Entry Point & Google Identity Services CDN
├── package.json                     # Konfigurasi dependensi dan skrip eksekusi
├── tsconfig.json                    # Konfigurasi compiler TypeScript
├── vite.config.ts                   # Konfigurasi Vite & Tailwind CSS v4 Plugin
├── server.ts                        # Express Backend, Proxy GAS, & Daemon Polling Telegram
├── data/                            # Direktori persistensi lokal JSON server
│   ├── system_config.json           # Master config (Admin sheet URL, Google Client ID, Provider OCR)
│   ├── users.json                   # Database lokal kredensial akun pengguna
│   ├── user_settings.json           # Kredensial privat per user (Sheet URL & Bot Token)
│   └── transactions.json            # Database lokal seluruh transaksi per user
└── src/
    ├── main.tsx                     # Entry point React
    ├── index.css                    # Tailwind CSS v4 Global import (@import "tailwindcss";)
    ├── App.tsx                      # Root Application, Theme Provider, Real-Time Poller & Audio Chime
    ├── types.ts                     # Tipe data & antarmuka TypeScript terpadu
    ├── config.ts                    # Single Source of Truth Master Configuration
    ├── components/
    │   ├── ChatInterface.tsx        # Antarmuka chat NLP & Quick Chips
    │   ├── ReceiptScanner.tsx       # In-memory camera WebRTC & Multi-provider OCR
    │   ├── Dashboard.tsx            # Analitik KPI, AreaChart, PieChart, & Tabel Mutasi
    │   ├── SettingsPanel.tsx        # Pengaturan sisi pengguna biasa & Bot Telegram
    │   ├── AdminDashboard.tsx       # Panel kontrol Super Admin, Manajemen Pengguna & Kuota AI
    │   └── AuthModal.tsx            # Modal Login, Register, Reset Sandi, & Google OAuth
    └── utils/
        ├── parser.ts                # Mesin Natural Language Processing Bahasa Indonesia
        ├── categories.ts            # Definisi 8 Kategori Baku, Icon, & Warna
        ├── receiptParser.ts         # Heuristik pemindai teks struk belanja kasir
        ├── receiptService.ts        # Layanan OCR Multi-Provider (Gemini, OCR.space, Tesseract)
        ├── pdfGenerator.ts          # Generator dokumen laporan keuangan PDF A4 perbankan
        ├── authService.ts           # Logika sesi, otentikasi, enkripsi lokal, & sinkronisasi
        ├── financeCode.gs.ts        # Source code Google Apps Script transaksi kas
        └── adminCode.gs.ts          # Source code Google Apps Script database admin
```

---

## 5. MODEL DATA, ENTITAS, & TIPE TYPESCRIPT

Semua modul wajib menggunakan definisi tipe baku pada `src/types.ts`:

```typescript
// 1. Tipe Pengguna & Akun (RBAC)
export interface User {
  id: string;                         // Format: 'usr_admin_01', 'usr_faiz_02', dll.
  name: string;                       // Nama lengkap pengguna
  email: string;                      // Email terdaftar
  username: string;                   // Username unik huruf kecil tanpa spasi
  password?: string;                  // Kata sandi
  role: 'admin' | 'user';             // Hak akses: admin memiliki akses AdminDashboard
  createdAt: string;                  // Waktu pendaftaran ISO string
  status: 'active' | 'suspended';     // Status akun
  googleSheetUrl?: string;            // URL Spreadsheet transaksi privat
  telegramBotToken?: string;          // Token Bot Telegram pribadi
  telegramChatId?: string;            // Chat ID Telegram pribadi
  avatarUrl?: string;                 // Foto profil pengguna
}

// 2. Tipe Transaksi Keuangan
export interface Transaction {
  id: string;                         // Format: 'tx_timestamp_random' atau 'tg_...'
  date: string;                       // ISO date string
  type: 'pemasukan' | 'pengeluaran';  // Jenis arus kas
  amount: number;                     // Nilai nominal uang positif (>= 0)
  description: string;                // Keterangan transaksi / nama toko
  category: string;                   // Salah satu dari 8 kategori baku
  source?: 'web' | 'telegram' | 'offline_sync';
  userId?: string;                    // Pemilik transaksi
  username?: string;                  // Nama pembuat mutasi
}

// 3. Tipe Pengaturan Aplikasi
export interface AppSettings {
  googleSheetUrl: string;             // URL Spreadsheet transaksi pengguna
  adminGoogleSheetUrl?: string;       // URL Spreadsheet Master Admin
  googleClientId?: string;            // Google OAuth 2.0 Web Client ID
  telegramBotToken: string;           // Token bot @BotFather
  telegramChatId: string;             // Chat ID Telegram hasil deteksi
  useCloudStorage: boolean;           // Sakelar sinkronisasi cloud
  currency: string;                   // Default: 'IDR'
  theme: 'light' | 'dark' | 'luxury'; // 3 Pilihan tema visual
}

// 4. Tipe Pesan Obrolan (Conversational UI)
export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  parsedTransaction?: {
    type: 'pemasukan' | 'pengeluaran';
    amount: number;
    description: string;
    category: string;
    feedback: string;
    balanceAfter: number;
  };
  pdfPeriod?: 'all' | 'week' | 'month' | 'year';
}

// 5. Tipe Draf Struk Telegram (State Machine OCR di Bot)
export interface TelegramDraftReceipt {
  id: string;                         // Format: 'dr_timestamp_random'
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
  username?: string;
  previewMessageId?: number;          // Message ID kartu di Telegram untuk di-update
  waitingFor?: 'amount' | 'description' | null;
  createdAt: number;
}
```

---

## 6. SPESIFIKASI FITUR SISI KLIEN (FRONTEND SPECIFICATIONS)

### 6.1 Desain Visual & Tiga Mode Tema
Aplikasi mendukung 3 tema visual yang konsisten di seluruh komponen:
1. **Light Mode (`light`):** Kanvas bersih `bg-slate-50`, kartu putih dengan pembatas `border-slate-200`, kontras tinggi, aksen emerald dan rose.
2. **Dark Mode (`dark`):** Kanvas obsidian modern `bg-slate-950`, kartu `bg-slate-900/90 border-slate-800`, teks ramah mata `text-slate-100`.
3. **Luxury Gold Mode (`luxury` - Sultan Edition by Faiz_Fahmi_ID):** Kanvas hitam pekat `bg-zinc-950`, kartu `bg-zinc-900/95 border-amber-500/30`, tipografi emas metalik dengan tombol gradasi emas murni `from-amber-500 to-yellow-600 text-zinc-950 font-bold`.

### 6.2 Antarmuka Obrolan Pintar & Feedback Real-Time
- **Komponen:** `src/components/ChatInterface.tsx` & `src/utils/parser.ts`
- **Spesifikasi Parsing Transaksi:**
  - Mengenali format angka fleksibel: `3k`, `15k`, `15rb`, `15ribu`, `1.5jt`, `1.5juta`, `50.000`, `Rp 50.000`, `IDR 50000`.
  - Mengklasifikasikan 8 kategori baku otomatis: *Makanan & Minuman, Belanja & Pribadi, Transportasi, Tagihan & Utilitas, Hiburan & Rekreasi, Kesehatan & Medis, Pendidikan, dan Pemasukan*.
- **Feedback Otomatis Mutasi Telegram:**
  - Saat ada transaksi baru masuk dari Telegram, obrolan web langsung menampilkan balasan bot:
    `Terima kasih, transaksi dari Telegram sudah tercatat! 📲\nAda uang keluar Rp 3.000, sisa saldo kas Anda sekarang menjadi Rp ...`
  - Dilengkapi lonceng audio notifikasi lembut (Web Audio API) tanpa bergantung pada file audio eksternal.

### 6.3 Mesin Pemindai Struk Bon Kamera & Multi-Provider AI
- **Komponen:** `src/components/ReceiptScanner.tsx` & `src/utils/receiptService.ts`
- **Pilihan Provider OCR:**
  1. **Google Gemini 2.5 Flash:** Kecepatan kilat, pemahaman konteks semantik nota kasir, akurasi tinggi membaca item barang dan pajak.
  2. **OCR.space API:** Alternatif cloud OCR cepat dengan kuota gratis melimpah.
  3. **Local Tesseract.js (WASM):** Pemrosesan 100% offline di memori peramban tanpa memerlukan API key eksternal.
- **Formulir Koreksi Sebelum Simpan:** Hasil scan menampilkan Nama Toko, Tanggal, Nominal, Kategori, Subtotal, Pajak, dan Rincian Barang yang dapat disunting sebelum disimpan.

### 6.4 Dashboard Finansial Interaktif & Visualisasi Grafik
- **Komponen:** `src/components/Dashboard.tsx`
- **4 Kartu Metrik Finansial Utama (KPI):**
  1. **Sisa Saldo Kas (Uang Riil):** `Total Pemasukan - Total Pengeluaran` (dengan label status surplus/defisit).
  2. **Total Pemasukan:** Akumulasi seluruh uang masuk.
  3. **Total Pengeluaran:** Akumulasi seluruh uang keluar.
  4. **Rasio Tabungan:** `((Pemasukan - Pengeluaran) / Pemasukan) * 100%`.
- **Area Chart Arus Kas (Recharts):** Kurva gradien lembut hijau emerald (Pemasukan) dan merah rose (Pengeluaran).
- **Donut Pie Chart Kategori (Recharts):** Distribusi persentase pengeluaran per kategori.
- **Tabel Mutasi Lengkap:** Pencarian instan, filter waktu (*7 hari, 30 hari, tahun ini*), pengurutan, pagination, edit baris, dan hapus.

### 6.5 Generator Laporan PDF Standar Perbankan Berformat A4
- **Komponen:** `src/utils/pdfGenerator.ts`
- Format A4 Portrait (210 x 297 mm) via `jspdf`.
- Kop laporan resmi: `FahKeu — by: Faiz_Fahmi_ID`.
- 3 Kotak ringkasan finansial, tabel bergaris zebra dengan auto page break, tanda tangan digital resmi, dan nomor halaman.

### 6.6 Panel Pengaturan Keuangan Pribadi (Sisi Pengguna)
- **Komponen:** `src/components/SettingsPanel.tsx`
- Pengaturan URL Google Spreadsheet pribadi dengan tombol **Uji Koneksi Real-Time**.
- Konfigurasi Bot Telegram dengan tombol **Deteksi Chat ID Otomatis** dan **Uji Kirim Pesan Bot**.
- Tombol **Salin Skrip Transaksi (Code.gs)** untuk deployment mudah.

### 6.7 Dashboard Super Admin & Manajemen Pengguna
- **Komponen:** `src/components/AdminDashboard.tsx`
- Hanya dapat diakses oleh akun `role === 'admin'`.
- Statistik global pengguna, manajemen kuota struk, konfigurasi API Key Gemini & OCR.space.
- CRUD Pengguna: Tambah, edit, intip password, suspend/aktifkan, hapus, dan sinkronkan massal ke Spreadsheet Admin.

### 6.8 Sistem Autentikasi Mandiri & Google OAuth 2.0 (GSI)
- Form login, register unik (case-insensitive), self-service reset kata sandi, dan **Google Sign-In** via Google Identity Services CDN.
- Akun bawaan awal:
  - **Super Admin:** Username `admin` | Password `admin123`
  - **Regular User:** Username `faiz` | Password `user123`

---

## 7. SPESIFIKASI BACKEND RUNTIME & REST API (`server.ts`)

### 7.1 Daftar Lengkap Endpoint REST API

| Method | Endpoint Path | Fungsi & Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck server runtime dan status waktu ISO. |
| `POST` | `/api/sheets-proxy` | Meneruskan request ke Google Apps Script Web App untuk membypass CORS & HTTP 302 Redirect. |
| `GET` | `/api/system-config` | Mengambil konfigurasi global (Admin Sheet URL, Google Client ID, Provider OCR). |
| `POST` | `/api/system-config` | Memperbarui konfigurasi global master ke `data/system_config.json`. |
| `GET` | `/api/user-settings` | Mengambil URL Spreadsheet dan Token Bot user tertentu (`?userId=xxx`). |
| `POST` | `/api/user-settings` | Menyimpan URL Spreadsheet dan Token Bot user ke `data/user_settings.json`. |
| `GET` | `/api/users` | Mengambil daftar seluruh akun pengguna dari `data/users.json`. |
| `POST` | `/api/users` | Menyimpan dan memperbarui seluruh daftar akun pengguna ke `data/users.json`. |
| `GET` | `/api/transactions` | Mengambil transaksi pengguna (`?userId=xxx` atau `?userId=all` untuk admin). |
| `POST` | `/api/transactions` | Menambah transaksi (`action: "add"`), update (`action: "edit"`), hapus (`action: "delete"`), reset (`action: "clear"`). |
| `POST` | `/api/scan-receipt` | Endpoint scan struk berbasis AI Vision / OCR. |
| `GET` | `/api/admin/gemini-status` | Cek status API Key Gemini, OCR.space, dan pemakaian kuota harian. |
| `POST` | `/api/admin/gemini-config` | Simpan API Key Gemini / OCR.space serta mode aktif. |
| `GET` | `/api/telegram/detect-chat-id` | Mengambil Chat ID yang baru terdeteksi secara live. |
| `POST` | `/api/telegram/test-message` | Mengirim pesan tes uji coba dari bot Telegram ke Chat ID pengguna. |

### 7.2 Mesin Polling Daemon Bot Telegram 24/7 Multi-Akun
- Server menjalankan kelas singleton `TelegramPollerService` yang secara otomatis mengelola *long-polling* (`/getUpdates`) untuk semua token bot aktif.
- Memproses update secara sekuensial untuk menghindari *race-condition* saat pengguna mengetik nominal pengganti.
- Mengaitkan `chatId` dengan `targetUserId` secara otomatis sejak pesan pertama.

### 7.3 State Machine Draf Struk Telegram & 100% Tombol Edit Interaktif
Saat pengguna mengirimkan foto struk ke bot Telegram:
1. Bot mengunduh file gambar melalui Telegram Bot File API (`/getFile`).
2. Server menjalankan OCR/AI Vision (`analyzeReceiptImage`) untuk mengekstrak Nama Toko, Tanggal, Nominal, Kategori, dan Rincian Barang.
3. Server membuat objek `TelegramDraftReceipt` yang disimpan pada peta memori `activeDraftReceipts` dan memetakan `chatId` pada `userPendingDraftReceipt`.
4. Bot mengirimkan kartu pratinjau struk lengkap dengan **Inline Keyboard**:
   ```
   [ 💾 Simpan ke Catatan ]
   [ ✏️ Ubah Nominal ]  [ ✏️ Ubah Toko/Ket ]
   [ 🏷️ Ganti Kategori ]  [ 🔄 Ganti Jenis ]
   [ ❌ Batal ]
   ```
5. **Alur Seluruh Tombol Berfungsi 100%:**
   - **`💾 Simpan ke Catatan` (`dr_save:<draftId>`):**
     - Menyimpan transaksi ke basis data internal server (`saveUserTransaction`).
     - Menginvalidasi cache sinkronisasi (`userSyncCache.delete`).
     - Menghitung sisa saldo kas kumulatif terbaru.
     - Memperbarui pesan Telegram dengan rekap saldo dan menghilangkan tombol inline keyboard.
     - Meneruskan ke Google Spreadsheet di latar belakang secara asinkron.
   - **`✏️ Ubah Nominal` (`dr_edit_amt:<draftId>`):**
     - Mengubah state draf menjadi `waitingFor = 'amount'`.
     - Mengirim instruksi ke chat: *`✏️ Ubah Nominal Struk: Ketikkan angka nominal yang benar...`*
     - Pengguna mengetik nominal baru (contoh: `185000`, `185k`, atau `181.475`).
     - Parser angka `parseSimpleAmount` mengonversi input menjadi angka valid.
     - Kartu pratinjau diperbarui dengan nominal baru dan keyboard tetap lengkap aktif.
   - **`✏️ Ubah Toko/Ket` (`dr_edit_desc:<draftId>`):**
     - Mengubah state draf menjadi `waitingFor = 'description'`.
     - Mengirim instruksi ke chat: *`✏️ Ubah Nama Toko / Keterangan...`*
     - Pengguna mengetik nama toko baru (contoh: `Indomaret Point`).
     - Kartu pratinjau diperbarui dengan nama toko baru dan keyboard tetap aktif.
   - **`🏷️ Ganti Kategori` (`dr_cat_menu:<draftId>`):**
     - Menampilkan keyboard pilihan kategori interaktif:
       - 🍽️ Makanan & Minum
       - 🛒 Belanja & Pribadi
       - 🚗 Transportasi
       - 💡 Tagihan & Utilitas
       - 💼 Operasional Usaha
       - 📦 Pengeluaran Lain
       - 🔙 Selesai / Kembali ke Pratinjau
     - Menekan tombol kategori (`dr_set_cat:<draftId>:<cat>`) langsung mengubah kategori draf dan mengembalikan kartu ke pratinjau semula.
   - **`🔄 Ganti Jenis` (`dr_toggle_type:<draftId>`):**
     - Menukar jenis transaksi antara `pengeluaran` (🔴) dan `pemasukan` (🟢) secara instan.
   - **`🔙 Selesai / Kembali` (`dr_back:<draftId>`):**
     - Mengembalikan tampilan ke kartu pratinjau dengan keyboard lengkap.
   - **`❌ Batal` (`dr_cancel:<draftId>`):**
     - Menghapus draf dari memori, membersihkan keyboard, dan mengubah pesan menjadi: *`❌ Scan struk dibatalkan.`*

### 7.4 Alur Transaksi Percakapan Teks Biasa via Telegram
- Pengguna mengetik pesan seperti *`beli cimol 3k`*, *`kopi 18rb`*, atau *`gaji 5jt`*.
- Bot memproses teks dengan `parseTransactionText`, menyimpan ke server lokal, meneruskan ke Google Spreadsheet, dan langsung membalas dalam < 500ms dengan:
  - Ringkasan transaksi
  - Total pemasukan
  - Total pengeluaran
  - Sisa saldo kas uang riil
  - Catatan sinkronisasi website & spreadsheet

---

## 8. ARSITEKTUR BASIS DATA GOOGLE APPS SCRIPT (DUAL-SPREADSHEET)

### 8.1 Spreadsheet Transaksi Pengguna (`financeCode.gs.ts`)
- **Lembar:** `"Transactions"`
- **Kolom:** A: `ID` | B: `Date` | C: `Type` | D: `Amount` | E: `Description` | F: `Category` | G: `Source` | H: `User_ID` | I: `Username`
- **Aksi `doPost`:** `add`, `edit`, `delete`, `clear`, `sync`, `setup_telegram`.

### 8.2 Spreadsheet Master Administrator (`adminCode.gs.ts`)
- **Lembar 1: `"Users"`:** Kredensial akun, password, role, status, dan URL spreadsheet.
- **Lembar 2: `"Settings"`:** Konfigurasi master sistem (`GOOGLE_CLIENT_ID`, dll).
- **Aksi `doPost`:** `register`, `login`, `reset_password`, `get_users`, `update_user`, `delete_user`, `sync_all_users`.

---

## 9. INTEGRASI SINKRONISASI REAL-TIME WEBPAGE <-> BOT TELEGRAM <-> SPREADSHEET

```
┌─────────────────┐       Kirim Struk / Teks        ┌───────────────────────────┐
│                 │ ──────────────────────────────> │                           │
│  TELEGRAM BOT   │                                 │       EXPRESS SERVER      │
│  (Chat / Foto)  │ <────────────────────────────── │        (`server.ts`)      │
└─────────────────┘       Balas Instan < 500ms      └───────────────────────────┘
                                                                  ▲   │
                                          Polling Setiap 3.5s     │   │ Forward
                                     (Endpoint /api/transactions) │   │ Background
                                                                  │   ▼
┌─────────────────┐                                 ┌───────────────────────────┐
│                 │                                 │                           │
│  WEBSITE CLIENT │ <────────────────────────────── │     GOOGLE APPS SCRIPT    │
│   (`App.tsx`)   │     Auto Chat Feedback & Chime  │     (Google Spreadsheet)  │
└─────────────────┘                                 └───────────────────────────┘
```

1. **Telegram -> Server:** Pengguna mengirim teks atau struk bon ke bot Telegram. Server memvalidasi, menyimpan ke basis data lokal, mengupdate sisa saldo, dan membalas pesan ke pengguna.
2. **Server -> Google Spreadsheet:** Secara asinkron, server mengirimkan mutasi ke Google Apps Script via `fetch` POST (`action: "add"`), memastikan spreadsheet selalu mutakhir 100%.
3. **Server -> Website:** Website client menjalankan background interval setiap 3.5 detik ke `/api/transactions?userId=...`.
4. **Website Feedback:** Begitu ada mutasi baru dari Telegram:
   - Pesan balasan bot otomatis dimunculkan di antarmuka obrolan web.
   - Sisa saldo kas kumulatif, grafik AreaChart, dan tabel riwayat transaksi seketika ter-update.
   - Lonceng audio Web Audio API berbunyi lembut sebagai penanda sinkronisasi berhasil.

---

## 10. MATRIKS PENGUJIAN MUTU (QA & ACCEPTANCE CRITERIA)

| No | Kasus Uji | Perilaku yang Diharapkan | Status |
| :---: | :--- | :--- | :--- |
| 1 | **Login & Registrasi** | Validasi email & username unik; tersimpan di server lokal & spreadsheet admin. | ✅ 100% LULUS |
| 2 | **Google Sign-In** | Masuk satu klik menggunakan akun Google tanpa sandi via GSI. | ✅ 100% LULUS |
| 3 | **Chat NLP Web** | Ketik *`beli martabak 20k`* -> Tercatat Pengeluaran, 20.000, Makanan & Minuman. | ✅ 100% LULUS |
| 4 | **Pemasukan NLP** | Ketik *`gaji freelance 1.5jt`* -> Tercatat Pemasukan, 1.500.000, Saldo bertambah. | ✅ 100% LULUS |
| 5 | **Scanner Kamera Web** | WebRTC aktif, multi-provider OCR membaca struk, formulir koreksi siap simpan. | ✅ 100% LULUS |
| 6 | **Draf Struk Telegram** | Kirim foto struk -> Kartu pratinjau muncul dengan 6 tombol inline keyboard lengkap. | ✅ 100% LULUS |
| 7 | **Tombol Ubah Nominal** | Klik tombol -> Ketik `185k` -> Nominal ter-update instan di kartu pratinjau. | ✅ 100% LULUS |
| 8 | **Tombol Ubah Toko** | Klik tombol -> Ketik nama toko -> Nama toko ter-update instan di kartu. | ✅ 100% LULUS |
| 9 | **Tombol Ganti Kategori**| Klik tombol -> Muncul pilihan 6 kategori -> Kategori berubah dan kembali ke kartu. | ✅ 100% LULUS |
| 10 | **Tombol Ganti Jenis** | Klik tombol -> Berpindah dari 🔴 Pengeluaran ke 🟢 Pemasukan secara instan. | ✅ 100% LULUS |
| 11 | **Tombol Simpan Struk** | Klik simpan -> Tersimpan di Server, Google Sheet, dan muncul di Web dalam 3.5s. | ✅ 100% LULUS |
| 12 | **Teks Biasa Telegram** | Ketik *`beli cimol 3k`* -> Terbalas ringkasan saldo riil dan tersinkron ke Web & Sheet. | ✅ 100% LULUS |
| 13 | **Perintah /hapus** | Ketik `/hapus` -> Transaksi terakhir terhapus dari Server dan Google Sheet. | ✅ 100% LULUS |
| 14 | **Sinkronisasi Web Realtime** | Web menerima mutasi Telegram -> Muncul feedback di chat & berbunyi chime audio. | ✅ 100% LULUS |
| 15 | **Ekspor Laporan PDF** | Dokumen A4 bergaris zebra terunduh dengan tanda tangan **Faiz_Fahmi_ID**. | ✅ 100% LULUS |
| 16 | **Mode Luxury Gold** | Antarmuka obsidian dengan gradasi emas metalik mewah bebas bug kontras. | ✅ 100% LULUS |
| 17 | **Panel Super Admin** | Kelola akun pengguna, intip password, kuota AI, dan konfigurasi master. | ✅ 100% LULUS |

---

## 11. PANDUAN LANGKAH-DEMI-LANGKAH MEMBANGUN DARI NOL (STEP-BY-STEP BLUEPRINT)

### Langkah 1: Inisialisasi Proyek & Dependensi
```bash
# 1. Buat direktori proyek baru
mkdir fahkeu-app && cd fahkeu-app

# 2. Inisialisasi package.json dan instalasi seluruh dependensi
npm init -y
npm install react@^19.0.1 react-dom@^19.0.1 lucide-react@^0.546.0 motion@^12.23.24 recharts@^3.9.0 tesseract.js@^7.0.0 jspdf@^4.2.1 express@^4.21.2 dotenv@^17.2.3
npm install -D vite@^6.2.3 @vitejs/plugin-react@^5.0.4 typescript@~5.8.2 tailwindcss@^4.1.14 @tailwindcss/vite@^4.1.14 esbuild@^0.25.0 tsx@^4.21.0 @types/react@^19.0.10 @types/react-dom@^19.0.4 @types/express@^4.17.21
```

### Langkah 2: Konfigurasi File Inti
1. Konfigurasikan `vite.config.ts` dengan plugin `@tailwindcss/vite` dan `@vitejs/plugin-react`.
2. Buat `src/index.css` dengan satu baris: `@import "tailwindcss";`.
3. Buat `index.html` dengan judul **FahKeu**, meta tag deskripsi, dan skrip Google Identity Services CDN:
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   ```
4. Tambahkan permission kamera pada `metadata.json`:
   ```json
   {
     "name": "FahKeu",
     "description": "Aplikasi pencatat keuangan interaktif cerdas by Faiz_Fahmi_ID",
     "requestFramePermissions": ["camera"],
     "majorCapabilities": ["MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API"]
   }
   ```

### Langkah 3: Deployment Skrip Google Apps Script (Cloud Database)
1. **Spreadsheet Transaksi Pengguna:**
   - Buat Google Spreadsheet baru bernama *"Catatan Keuangan FahKeu"*.
   - Buka menu *Ekstensi > Apps Script*, tempel seluruh isi kode dari `src/utils/financeCode.gs.ts`.
   - Klik *Terapkan (Deploy) > Deployment baru > Jenis: Aplikasi Web*.
   - Setel: Jalankan sebagai: *Saya (Me)*, Akses: *Siapa saja (Anyone)*.
   - Salin URL Web App yang berakhiran `/exec`.
2. **Spreadsheet Master Administrator:**
   - Buat Google Spreadsheet baru bernama *"Database Admin FahKeu"*.
   - Buka menu *Ekstensi > Apps Script*, tempel seluruh isi kode dari `src/utils/adminCode.gs.ts`.
   - Deploy sebagai Aplikasi Web dengan akses *Siapa saja (Anyone)*.
   - Salin URL Web App yang berakhiran `/exec` ke `src/config.ts` (`DEFAULT_ADMIN_SHEET_URL`).

### Langkah 4: Menjalankan & Memverifikasi Server
```bash
# Menjalankan server development terpadu (Vite Middleware + Express Backend)
npm run dev
```
Aplikasi akan aktif pada port `3000`. Akses `http://localhost:3000` di peramban Anda untuk menikmati ekosistem keuangan cerdas paling lengkap, cepat, dan aman!

---

> **Diciptakan dan Dikembangkan dengan Dedikasi Tinggi oleh:**  
> **Faiz_Fahmi_ID**  
> *Hak Cipta © 2026 by: Faiz_Fahmi_ID — All Rights Reserved.*
