# 💎 FAHKEU (FAIZ KEUANGAN) — SMART & INTERACTIVE FINANCIAL ECOSYSTEM
### *Aplikasi Pencatatan Keuangan Cerdas, Interaktif, Modern, & Berbasis Privasi Penuh*
> **Created & Engineered with Precision by: Faiz_Fahmi_ID**  
> **Hak Cipta © 2026 by: Faiz_Fahmi_ID — All Rights Reserved**  
> *Status:* Production Ready • Zero-Cost AI Engine • In-Memory OCR Scanner • Multi-User RBAC • Dual Google Sheets Cloud Architecture • Telegram Bot 24/7

---

## 📑 DAFTAR ISI UTAMA
1. [Tentang FahKeu](#1-tentang-fahkeu)
2. [Keunggulan Utama (Mengapa Memilih FahKeu?)](#2-keunggulan-utama-mengapa-memilih-fahkeu)
3. [Daftar Lengkap Library & Tumpukan Teknologi (Tech Stack)](#3-daftar-lengkap-library--tumpukan-teknologi-tech-stack)
4. [Rincian Seluruh Fitur Aplikasi](#4-rincian-seluruh-fitur-aplikasi)
   - [4.1 Autentikasi Multi-Peran & Google OAuth 2.0](#41-autentikasi-multi-peran--google-oauth-20)
   - [4.2 Natural Language Processing (NLP) Smart Chat](#42-natural-language-processing-nlp-smart-chat)
   - [4.3 In-Memory Camera Scanner & Optical Character Recognition (OCR)](#43-in-memory-camera-scanner--optical-character-recognition-ocr)
   - [4.4 Dashboard Finansial Interaktif & Visualisasi Grafik](#44-dashboard-finansial-interaktif--visualisasi-grafik)
   - [4.5 Generator Laporan PDF Vektor Standar Perbankan](#45-generator-laporan-pdf-vektor-standar-perbankan)
   - [4.6 Panel Pengaturan Keuangan Pribadi (Sisi User)](#46-panel-pengaturan-keuangan-pribadi-sisi-user)
   - [4.7 Dashboard Super Admin & Master Database Sistem (Sisi Admin)](#47-dashboard-super-admin--master-database-sistem-sisi-admin)
   - [4.8 Integrasi Bot Telegram 24/7 & Webhook Mandiri](#48-integrasi-bot-telegram-247--webhook-mandiri)
   - [4.9 Sistem 3 Tema Visual (Light, Dark, Luxury Gold)](#49-sistem-3-tema-visual-light-dark-luxury-gold)
   - [4.10 Server Proxy Backend & Single Source of Truth di GitHub](#410-server-proxy-backend--single-source-of-truth-di-github)
5. [Panduan Lengkap Cara Pakai (Step-by-Step User & Admin Guide)](#5-panduan-lengkap-cara-pakai-step-by-step-user--admin-guide)
   - [5.1 Cara Registrasi & Masuk Akun](#51-cara-registrasi--masuk-akun)
   - [5.2 Cara Mencatat Transaksi Lewat Chat](#52-cara-mencatat-transaksi-lewat-chat)
   - [5.3 Cara Memindai Struk Belanja dengan Kamera](#53-cara-memindai-struk-belanja-dengan-kamera)
   - [5.4 Cara Membaca Grafik & Menganalisis Pengeluaran](#54-cara-membaca-grafik--menganalisis-pengeluaran)
   - [5.5 Cara Mengunduh Laporan PDF Transaksi](#55-cara-mengunduh-laporan-pdf-transaksi)
   - [5.6 Cara Menghubungkan Google Spreadsheet Pribadi](#56-cara-menghubungkan-google-spreadsheet-pribadi)
   - [5.7 Cara Mengaktifkan Bot Telegram Pribadi](#57-cara-mengaktifkan-bot-telegram-pribadi)
   - [5.8 Cara Kerja & Konfigurasi Khusus Super Admin](#58-cara-kerja--konfigurasi-khusus-super-admin)
   - [5.9 Cara Menyimpan Link Master di GitHub (`src/config.ts`)](#59-cara-menyimpan-link-master-di-github-srcconfigts)
6. [Arsitektur Skrip Google Apps Script (`Code.gs`)](#6-arsitektur-skrip-google-apps-script-codegs)
7. [Struktur Direktori & Pemetaan File Proyek](#7-struktur-direktori--pemetaan-file-proyek)
8. [Panduan Instalasi & Menjalankan Proyek Secara Lokal](#8-panduan-instalasi--menjalankan-proyek-secara-lokal)
9. [Atribusi Resmi & Lisensi](#9-atribusi-resmi--lisensi)

---

## 1. TENTANG FAHKEU
**FahKeu (Faiz Keuangan)** adalah aplikasi web pencatatan dan pengelolaan keuangan generasi terbaru yang diciptakan oleh **`by: Faiz_Fahmi_ID`**. Aplikasi ini dirancang khusus untuk memecahkan kelemahan umum aplikasi keuangan konvensional yang kaku, rumit, boros penyimpanan, serta bergantung pada biaya langganan API berbayar.

Dengan memadukan kemudahan antarmuka obrolan (*conversational UI*), kecerdasan buatan berbasis heuristik (*client-side NLP*), pemindai struk instan berbasis kamera tanpa membebani memori internal perangkat (*in-memory OCR*), serta integrasi *Cloud Database* gratis seumur hidup menggunakan Google Spreadsheet dan Bot Telegram, FahKeu memberikan pengalaman mengelola uang yang luar biasa cepat, aman, dan memikat secara visual.

---

## 2. KEUNGGULAN UTAMA (MENGAPA MEMILIH FAHKEU?)

### 🚀 1. Zero-Cost AI Heuristic NLP (Hemat Biaya Token)
Mayoritas aplikasi cerdas memerlukan biaya berlangganan API LLM bulanan (seperti OpenAI GPT atau Claude) yang mahal. FahKeu mengimplementasikan mesin *Natural Language Processing* (NLP) deterministik berbasis *heuristic regex* di sisi peramban (*client-side*). Mampu memahami singkatan bahasa Indonesia sehari-hari (`makan bakso 15k`, `gaji 5jt`, `beli bensin 25rb`) **100% gratis tanpa biaya API sepeser pun**.

### 📸 2. In-Memory Camera Scanner (Bebas Sampah Memori / Anti-Bloat)
Berbeda dari aplikasi lain yang mewajibkan Anda menyimpan foto nota/struk ke galeri ponsel terlebih dahulu, FahKeu menggunakan teknologi aliran *WebRTC Video Stream* ke *HTML5 Canvas in-memory*. Citra struk diproses langsung di RAM peramban oleh WebAssembly Tesseract.js, lalu langsung dibuang seketika setelah nilai belanja terbaca. **Memori ponsel dan ruang disk Anda tetap 100% bersih dan aman**.

### 🔒 3. Keamanan Data & Multi-User RBAC (Role-Based Access Control)
Sistem memisahkan secara tegas hak akses antara pengguna umum (**User**) dan pengelola sistem (**Super Admin**). Data mutasi keuangan antar-pengguna terisolasi secara privat berdasarkan `User_ID`. Tidak ada pengguna yang dapat melihat catatan keuangan pengguna lainnya.

### 📊 4. Pemisahan Tegas Dual Database Google Spreadsheet
FahKeu menerapkan arsitektur *dual-cloud spreadsheet*:
1. **Spreadsheet Transaksi Pengguna (`financeCode.gs`):** Khusus menyimpan mutasi pemasukan/pengeluaran dan menangani webhook Bot Telegram pribadi milik masing-masing user.
2. **Spreadsheet Master Admin (`adminCode.gs`):** Khusus dikelola oleh Super Admin untuk menyimpan kredensial akun pengguna (`Users`), riwayat audit, serta variabel sistem (`Settings`) seperti Google OAuth Client ID.

### 🌐 5. Single Source of Truth di GitHub (`src/config.ts`)
Pengguna tidak perlu lagi khawatir link konfigurasi hilang saat browser melakukan *clear cache* atau saat server *container* melakukan restart. Cukup cantumkan URL Web App Google Apps Script Master Admin di file `src/config.ts` dan lakukan *commit* ke GitHub. Aplikasi akan secara otomatis melakukan *self-bootstrapping* menarik seluruh data pengguna dan pengaturan dari cloud!

### ⚡ 6. Bebas Kendala CORS & Redirect Google Apps Script (Bypass Proxy)
Google Apps Script sering mengalami kendala *CORS* dan *HTTP 302 Redirection* saat diakses langsung dari JavaScript browser. FahKeu dilengkapi dengan **Backend API Proxy (`/api/sheets-proxy`)** cerdas yang menjamin seluruh permintaan data (GET & POST) berhasil diproses dengan mulus tanpa error koneksi.

### ✈️ 7. Offline-First dengan Sinkronisasi Otomatis
Ketika koneksi internet terputus, FahKeu tetap dapat digunakan secara normal. Seluruh transaksi disimpan di penyimpanan lokal peramban dan dimasukkan ke dalam antrean offline (*offline queue*). Begitu perangkat kembali online, data otomatis disinkronkan ke Google Spreadsheet.

### 📑 8. Laporan PDF Vektor Standar Perbankan Instan
Hanya dengan satu klik atau perintah obrolan (`cetak laporan`), FahKeu mengompilasi laporan keuangan resmi berformat A4 resolusi tinggi lengkap dengan ringkasan finansial, tabel bergaris (*zebra striping*), penomoran halaman otomatis, dan tanda tangan digital berlisensi resmi **by: Faiz_Fahmi_ID**.

### 👑 9. Tiga Mode Tampilan Estetik Termasuk "Luxury Gold"
Mendukung 3 tema visual yang dirancang dengan rasio kontras tinggi dan estetika modern:
- **Light Mode:** Tampilan bersih, profesional, dan segar untuk siang hari.
- **Dark Mode:** Tampilan gelap hemat baterai dengan nuansa *midnight slate*.
- **Luxury Gold (Sultan Mode):** Tampilan mewah eksklusif dengan aksen emas murni (*pure gold gradient*) di atas latar belakang *charcoal obsidian*.

---

## 3. DAFTAR LENGKAP LIBRARY & TUMPUKAN TEKNOLOGI (TECH STACK)

Seluruh pustaka pihak ketiga yang digunakan dalam FahKeu dipilih secara selektif untuk performa tinggi, stabilitas jangka panjang, serta kompatibilitas lintas peramban:

| Kategori | Nama Library / Teknologi | Versi | Fungsi & Peran dalam Aplikasi |
| :--- | :--- | :--- | :--- |
| **Core Framework** | `react` & `react-dom` | `^19.0.1` | Pustaka dasar antarmuka pengguna berbasis komponen reaktif dan performa mutakhir React 19. |
| **Language** | `typescript` | `~5.8.2` | Menjamin keamanan tipe data (*type safety*), autokompresi bug, dan struktur kode yang kokoh. |
| **Bundler & Build Tool** | `vite` & `@vitejs/plugin-react` | `^6.2.3` / `^5.0.4` | Perkakas pengembangan web ultra-cepat dengan Hot Module Reloading & optimasi bundle produksi. |
| **Styling & CSS Engine** | `tailwindcss` & `@tailwindcss/vite` | `^4.1.14` | Kerangka kerja utilitas CSS modern generasi ke-4 untuk desain responsif tanpa file CSS bertumpuk. |
| **Animation Library** | `motion` (Framer Motion) | `^12.23.24` | Menghadirkan transisi antarmuka yang halus, animasi modal masuk/keluar, dan efek micro-interaction. |
| **Vector Icon Pack** | `lucide-react` | `^0.546.0` | Ratusan ikon vektor SVG modern beresolusi tajam dan seragam di seluruh sudut aplikasi. |
| **Data Visualization** | `recharts` | `^3.9.0` | Komponen grafik finansial deklaratif untuk diagram tren arus kas (Area Chart) dan diagram lingkaran pengeluaran (Donut Chart). |
| **In-Browser OCR** | `tesseract.js` | `^7.0.0` | Mesin pengenalan teks optik (OCR) berbasis WebAssembly yang berjalan 100% lokal di browser tanpa server pihak ketiga. |
| **PDF Generation Engine** | `jspdf` | `^4.2.1` | Pembuat berkas dokumen PDF vektor berstandar perbankan langsung di browser sisi klien (*client-side*). |
| **Backend Web Server** | `express` | `^4.21.2` | Server runtime Node.js untuk melayani endpoint API, sistem konfigurasi, dan proxy Google Apps Script. |
| **TypeScript Server Runner** | `tsx` | `^4.21.0` | Eksekutor berkas TypeScript server (`server.ts`) secara instan tanpa proses kompilasi manual di masa dev. |
| **Bundler Server Produksi** | `esbuild` | `^0.25.0` | Kompiler backend berkecepatan tinggi yang menggabungkan server menjadi satu berkas `dist/server.cjs`. |
| **Environment Variable** | `dotenv` | `^17.2.3` | Membaca variabel lingkungan rahasia dari berkas `.env` untuk keamanan kredensial. |
| **Cloud Database** | `Google Apps Script` | *V8 Engine* | Serverless endpoint gratis dari Google untuk membaca dan menulis mutasi kas ke Google Sheets. |
| **Single Sign-On (SSO)** | `Google Identity Services (GSI)` | *v1 (OAuth 2)* | Autentikasi modern satu klik menggunakan akun Google resmi pengguna. |

---

## 4. RINCIAN SELURUH FITUR APLIKASI

### 4.1 Autentikasi Multi-Peran & Google OAuth 2.0
* **Komponen:** `src/components/AuthModal.tsx`, `src/utils/authService.ts`
* **Fitur & Mekanisme:**
  - **Login Mandiri:** Masuk menggunakan Username atau Email dengan validasi sandi aman dan toggle *Show/Hide Password*.
  - **Pendaftaran Akun Baru (Register):** Validasi otomatis keunikan email dan username, pencegahan spasi dan simbol terlarang, serta langsung login secara instan setelah sukses.
  - **Lupa Kata Sandi (Self-Service Password Reset):** Pengguna dapat menyetel ulang kata sandi dengan memverifikasi kepemilikan email yang terdaftar pada sistem.
  - **Masuk dengan Google (Google Sign-In):** Integrasi resmi Google Identity Services. Pengguna cukup memilih akun Google mereka untuk langsung terdaftar dan masuk tanpa mengetik password.
  - **Profil Akun Pengguna:** Pengguna dapat memperbarui Nama Lengkap, Kata Sandi, URL Spreadsheet Pribadi, dan Kredensial Bot Telegram mereka kapan saja.

### 4.2 Natural Language Processing (NLP) Smart Chat
* **Komponen:** `src/components/ChatInterface.tsx`, `src/utils/parser.ts`
* **Fitur & Mekanisme:**
  - **Pencatatan Semudah Mengetik Pesan:** Mengetik `makan soto 18k`, `beli bensin 25rb`, atau `gaji bulanan 7.5jt` otomatis dikenali oleh mesin parser.
  - **Pengenalan Aneka Format Angka:** Mendukung format angka lokal seperti `k` (ribu), `rb` (ribu), `jt` / `juta`, pemisah ribuan titik (`50.000`), hingga notasi mata uang `Rp` dan `IDR`.
  - **Klasifikasi Kategori Otomatis:** Sistem secara cerdas memetakan pengeluaran ke dalam 8 kategori baku berdasarkan kamus kata kunci komprehensif bahasa Indonesia.
  - **Perintah Interaktif Bot:**
    - `saldo` / `cek saldo`: Memunculkan kartu rekap sisa saldo, total uang masuk, dan total uang keluar.
    - `download rekap` / `cetak pdf`: Membuka pemilih periode laporan instan.
    - `hapus chat`: Membersihkan gelembung percakapan di layar.
  - **Suggestion Chips Dinamis:** Tombol cepat di atas kolom input chat untuk mencatat transaksi harian umum hanya dengan 1 ketukan jari.

### 4.3 In-Memory Camera Scanner & Optical Character Recognition (OCR)
* **Komponen:** `src/components/ReceiptScanner.tsx`, `src/utils/receiptParser.ts`
* **Fitur & Mekanisme:**
  - **Akses Kamera Langsung:** Membuka kamera depan atau belakang (*environment*) dengan satu klik tombol kamera di samping bar obrolan.
  - **Peralihan Lensa Cepat:** Tombol putar kamera (*flip*) untuk beralih antara kamera swafoto dan kamera utama.
  - **Pemrosesan di Memori RAM:** Gambar struk di-*capture* ke elemen canvas HTML5 beresolusi tinggi, diolah oleh Tesseract.js WASM, dan langsung dihapus dari memori begitu proses selesai. Tidak ada foto yang tersimpan di memori telepon!
  - **Algoritma Ekstraksi Nominal Cerdas:** Secara pintar mengabaikan nomor transaksi, tanggal, nomor meja, jam, atau nomor antrean, dan memprioritaskan kata kunci kasir: `TOTAL, GRAND TOTAL, TAGIHAN, BAYAR, TUNAI, CASH, SUBTOTAL`.
  - **Modal Verifikasi:** Sebelum disimpan, hasil pembacaan OCR disajikan dalam formulir interaktif agar pengguna dapat menyunting deskripsi, nominal, atau kategori jika diperlukan.

### 4.4 Dashboard Finansial Interaktif & Visualisasi Grafik
* **Komponen:** `src/components/Dashboard.tsx`
* **Fitur & Mekanisme:**
  - **4 Kartu Indikator Finansial Utama (KPI):**
    1. **Sisa Saldo Kas:** Ditampilkan dengan tipografi besar dan warna status saldo dinamis.
    2. **Total Pemasukan:** Akumulasi seluruh uang masuk pada periode yang dipilih.
    3. **Total Pengeluaran:** Akumulasi seluruh pengeluaran pada periode yang dipilih.
    4. **Rasio Tabungan (Savings Ratio):** Persentase kesehatan finansial `((Pemasukan - Pengeluaran) / Pemasukan) * 100%`.
  - **Grafik Tren Arus Kas (Interactive Area Chart):** Menampilkan fluktuasi pemasukan dan pengeluaran harian/mingguan dengan gradasi warna halus dan tooltip interaktif.
  - **Diagram Donat Proporsi Pengeluaran (Interactive Donut Chart):** Menampilkan perbandingan persentase pengeluaran berdasarkan 8 kategori baku lengkap dengan palet warna distingtif dan legenda jelas.
  - **Filter Rentang Waktu Komprehensif:** Pilihan filter *Semua Waktu, Minggu Ini (7 Hari Terakhir), Bulan Ini (30 Hari Terakhir), dan Tahun Ini*.
  - **Tabel Riwayat Mutasi Lengkap:**
    - Pencarian cepat transaksi berdasarkan nama barang, toko, atau kategori.
    - Pengurutan data (Terbaru, Terlama, Terbesar, Terkecil).
    - Paginasi data rapi (10 baris per halaman) untuk performa tetap ringan walau terdapat ribuan transaksi.
    - Tombol penyuntingan (*Edit Modal*) dan penghapusan transaksi dengan konfirmasi perlindungan data.

### 4.5 Generator Laporan PDF Vektor Standar Perbankan
* **Komponen:** `src/utils/pdfGenerator.ts`
* **Fitur & Mekanisme:**
  - **Format Dokumen A4 Portrait Vektor:** Dibuat secara matematis menggunakan library `jspdf` sehingga teks dan garis tabel tetap sangat tajam saat dicetak dalam ukuran kertas apapun.
  - **Header Perusahaan Resmi:** Mencantumkan kop dokumen resmi, nama akun pengguna, periode laporan yang dipilih, serta stempel waktu pembuatan laporan.
  - **Kartu Ringkasan Keuangan:** Kotak rekapitulasi Saldo Akhir, Total Pemasukan, dan Total Pengeluaran dengan warna status yang jelas.
  - **Tabel Transaksi Bergaris Zebra:** Tabel mutasi lengkap dengan pewarnaan teks hijau untuk uang masuk dan merah untuk uang keluar.
  - **Multi-Page Auto Overflow:** Apabila mutasi kas berjumlah puluhan atau ratusan baris, dokumen secara otomatis membuat halaman baru dengan mengulang judul kolom (*header table*) di setiap lembar baru.
  - **Footer & Atribusi Resmi:** Penomoran lembar (*Halaman X dari Y*) dan lisensi resmi `Laporan Keuangan Otomatis FahKeu — by: Faiz_Fahmi_ID since 2026`.

### 4.6 Panel Pengaturan Keuangan Pribadi (Sisi User)
* **Komponen:** `src/components/SettingsPanel.tsx`
* **Fitur & Mekanisme:**
  - **Isolasi Tampilan Khusus Pengguna:** Panel ini bersih dari kode admin sehingga sangat mudah dipahami oleh pengguna umum.
  - **Konfigurasi URL Spreadsheet Transaksi:** Input URL Web App deployment `financeCode.gs`.
  - **Uji Koneksi Real-Time:** Mengetes konektivitas ke Google Sheets dengan indikator warna hijau (sukses) atau merah (gagal) disertai pesan bantuan.
  - **Sakelar Penyimpanan Cloud:** Opsi untuk menyalakan/mematikan sinkronisasi cloud secara mandiri.
  - **Konfigurasi Bot Telegram:** Memasukkan token bot dari `@BotFather` dan Chat ID pengguna, dilengkapi tombol **"Daftarkan Webhook Bot"** yang mengeksekusi registrasi webhook ke server Telegram secara otomatis.
  - **Salin Skrip Transaksi (`financeCode.gs`):** Tombol 1-klik untuk menyalin template Apps Script pencatat transaksi ke papan klip (*clipboard*).
  - **Pusat Unduhan Multi-Platform:** Tautan resmi untuk mengunduh aplikasi Android (.apk) dan installer desktop jika ingin digunakan di luar browser.

### 4.7 Dashboard Super Admin & Master Database Sistem (Sisi Admin)
* **Komponen:** `src/components/AdminDashboard.tsx`
* **Fitur & Mekanisme:**
  - **Keamanan Akses Khusus:** Tab ini hanya muncul di bilah navigasi jika akun yang sedang aktif memiliki peran `role: 'admin'`.
  - **Widget Metrik Global Sistem:**
    - Total seluruh akun pengguna terdaftar.
    - Jumlah akun berstatus Aktif vs Dinonaktifkan (*Suspended*).
    - Total perputaran uang dan akumulasi mutasi seluruh pengguna di dalam sistem.
  - **Konfigurasi Spreadsheet Master Admin:**
    - Input URL Web App khusus master database `adminCode.gs`.
    - Tombol Uji Koneksi yang menembus CORS melalui proxy backend.
    - Tombol Salin Skrip `adminCode.gs` siap tempel.
  - **Konfigurasi Google Auth Client ID:** Input Google OAuth 2.0 Client ID untuk mengaktifkan tombol *Masuk dengan Google* bagi semua pengguna. Tersinkron ke spreadsheet admin dan file server backend secara permanen.
  - **Tabel Manajemen Akun Lengkap (CRUD):**
    - Mencari dan memfilter pengguna berdasarkan nama, username, email, maupun peran.
    - Mengintip kata sandi pengguna untuk kebutuhan pemulihan akun dan audit admin.
    - Mengedit seluruh atribut akun pengguna (Nama, Email, Username, Password, Role, Status Akun, URL Spreadsheet Pribadi User, dan Telegram Bot Token User).
    - Menambah pengguna baru langsung dari panel admin.
    - Mengaktifkan / Menonaktifkan akun pengguna dengan 1 klik.
    - Menghapus akun pengguna dari sistem secara permanen.
    - Sinkronisasi massal seluruh akun ke Google Spreadsheet Master Admin.

### 4.8 Integrasi Bot Telegram 24/7 & Webhook Mandiri
* **Komponen:** `src/utils/financeCode.gs.ts`
* **Fitur & Mekanisme:**
  - **Catat Transaksi Sambil Jalan:** Pengguna cukup membuka aplikasi Telegram di ponsel dan mengirim chat ke bot mereka (misal: `kopi kenangan 22rb` atau `dapat tips 100k`).
  - **Kirim Foto Nota via Telegram:** Bot Telegram secara otomatis mengunduh foto nota yang dikirim pengguna melalui Telegram Bot File API, mengekstrak angka tagihan, dan menyimpannya ke spreadsheet.
  - **Respon Notifikasi Otomatis:** Bot langsung membalas dengan rincian transaksi yang tercatat lengkap dengan informasi sisa saldo terkini.
  - **Tanda Sumber Transaksi:** Setiap mutasi yang berasal dari Telegram diberi label sumber khusus `source: "telegram"` pada tabel riwayat mutasi web.

### 4.9 Sistem 3 Tema Visual (Light, Dark, Luxury Gold)
* **Komponen:** `src/App.tsx`
* **Pilihan Gaya Estetik:**
  1. **☀️ Light Mode:** Dirancang dengan palet netral modern `slate-50` berpadu kartu putih berkilau `border-slate-200/80` yang nyaman di mata untuk pencahayaan terang.
  2. **🌙 Dark Mode:** Dirancang dengan palet gelap premium `slate-950` dan kontras teks tajam `emerald-400` / `indigo-400` untuk kenyamanan visual di malam hari dan efisiensi baterai OLED.
  3. **👑 Luxury Gold (Sultan Mode):** Mahakarya visual rancangan **Faiz_Fahmi_ID** yang memadukan latar belakang hitam obsidian `zinc-950`, kartu berbingkai emas halus `amber-500/30`, tipografi emas metalik, dan tombol gradasi emas murni (*pure gold gradient*).

### 4.10 Server Proxy Backend & Single Source of Truth di GitHub
* **Komponen:** `server.ts`, `src/config.ts`, `/api/sheets-proxy`
* **Fitur & Mekanisme:**
  - **Bypass CORS & HTTP 302 Redirection:** Permintaan ke Google Apps Script diteruskan melalui endpoint server backend Node.js (`/api/sheets-proxy`) sehingga 100% bebas dari pemblokiran browser.
  - **Penyimpanan Persisten Ganda:** Data konfigurasi dan akun pengguna disimpan di memori runtime, file lokal sistem (`data/system_config.json`, `data/users.json`, `data/user_settings.json`), dan Google Spreadsheet Master.
  - **Master Config di GitHub:** Pengembang dan pemilik aplikasi cukup mengisi konstanta `MASTER_CONFIG` di berkas `src/config.ts` untuk memastikan aplikasi selalu terhubung ke spreadsheet tanpa perlu memasukkan link berulang-ulang di setiap perangkat.

---

## 5. PANDUAN LENGKAP CARA PAKAI (STEP-BY-STEP USER & ADMIN GUIDE)

### 5.1 Cara Registrasi & Masuk Akun
1. Buka aplikasi FahKeu di peramban Anda.
2. Jika belum memiliki akun:
   - Klik tab **"Daftar Akun"**.
   - Masukkan Nama Lengkap, Alamat Email, Username (huruf kecil tanpa spasi), dan Kata Sandi (minimal 6 karakter).
   - Klik **"Daftar & Masuk Otomatis"**. Anda akan langsung dialihkan ke ruang obrolan.
3. Jika sudah memiliki akun:
   - Klik tab **"Masuk"**, masukkan Username/Email dan Password Anda, lalu klik **"Masuk ke Akun"**.
4. Atau, gunakan tombol **"Masuk dengan Akun Google"** untuk login instan dalam 1 detik.
5. **Akun Bawaan Super Admin:**
   - **Username:** `admin`
   - **Password:** `admin123`

---

### 5.2 Cara Mencatat Transaksi Lewat Chat
1. Masuk ke tab menu **"💬 Chat"** (atau tampilan utama).
2. Ketik transaksi Anda pada kolom input di bagian bawah layar.
   - Contoh Pengeluaran:
     - `makan sate ayam 25k`
     - `beli pulsa indosat 50rb`
     - `bensin pertamax 30000`
     - `bayar listrik 150rb`
     - `nonton bioskop xxi 45k`
   - Contoh Pemasukan:
     - `gaji bulanan 6.5jt`
     - `dapat komisi freelance 750k`
     - `transferan dari teman 200rb`
3. Tekan tombol **Kirim** (atau tombol Enter di keyboard).
4. Bot akan langsung merespons dengan kartu konfirmasi transaksi yang menampilkan nominal, kategori yang terdeteksi otomatis, serta sisa saldo terkini Anda.
5. Gunakan **Suggestion Chips** di atas kolom input jika ingin mencatat pengeluaran rutin hanya dengan satu klik.

---

### 5.3 Cara Memindai Struk Belanja dengan Kamera
1. Pada tab **"💬 Chat"**, klik ikon **Kamera 📷** di sebelah kiri tombol kirim.
2. Berikan izin akses kamera pada peramban Anda saat diminta.
3. Arahkan lensa kamera ponsel/laptop ke arah struk belanja fisik Anda secara tegak lurus dan pastikan tulisan terbaca jelas.
   - Gunakan tombol **Putar Lensa 🔄** untuk beralih antara kamera belakang dan depan jika diperlukan.
4. Klik tombol bulat **"Ambil Foto & Pindai"**.
5. Mesin OCR WebAssembly Tesseract.js akan memproses struk selama 1–3 detik.
6. Formulir konfirmasi akan muncul menampilkan teks yang terbaca, nominal total belanja, dan kategori yang disarankan.
7. Sesuaikan detail transaksi jika diperlukan, lalu klik **"Simpan Transaksi"**. Struk berhasil dicatat tanpa menyisakan sampah foto di memori galeri ponsel Anda!

---

### 5.4 Cara Membaca Grafik & Menganalisis Pengeluaran
1. Buka tab menu **"📊 Dashboard"**.
2. Perhatikan 4 kartu indikator finansial teratas:
   - **Sisa Saldo:** Menunjukkan kas bersih yang Anda miliki saat ini.
   - **Total Pemasukan & Pengeluaran:** Memantau perputaran uang masuk dan keluar.
   - **Rasio Tabungan:** Indikator apakah Anda surplus (hemat) atau defisit (boros).
3. Analisis **Grafik Area Arus Kas** untuk melihat lonjakan pengeluaran pada tanggal-tanggal tertentu.
4. Periksa **Diagram Donut Pengeluaran** untuk mengetahui pos anggaran mana yang paling banyak menguras kantong Anda (misalnya: apakah terlalu boros di Makanan atau Hiburan).
5. Gunakan tombol filter rentang waktu: **Semua, 7 Hari Terakhir, 30 Hari Terakhir, atau Tahun Ini** untuk mempersempit analisis keuangan Anda.
6. Gulir ke bawah menuju **Tabel Riwayat Mutasi**:
   - Ketik nama transaksi pada bilah cari untuk menemukan mutasi lama.
   - Klik tombol **Edit (Ikon Pensil)** untuk merevisi transaksi.
   - Klik tombol **Hapus (Ikon Tempat Sampah)** untuk membatalkan mutasi.

---

### 5.5 Cara Mengunduh Laporan PDF Transaksi
Ada dua cara mudah untuk mencetak laporan resmi:
* **Cara 1 (Melalui Chat):**
  1. Buka tab **💬 Chat**.
  2. Ketik `cetak laporan` atau `unduh pdf` lalu kirim.
  3. Bot akan menampilkan kartu pilihan periode: *Hari Ini, 7 Hari Terakhir, 30 Hari Terakhir, Bulan Ini, atau Semua Transaksi*.
  4. Klik periode yang Anda inginkan. Berkas PDF vektor akan langsung terunduh ke perangkat Anda.
* **Cara 2 (Melalui Dashboard):**
  1. Buka tab **📊 Dashboard**.
  2. Klik tombol **"Cetak PDF"** di bagian atas tabel transaksi.
  3. Pilih rentang waktu laporan & klik Unduh.

---

### 5.6 Cara Menghubungkan Google Spreadsheet Pribadi
Agar mutasi keuangan Anda tersimpan aman seumur hidup di akun Google Drive pribadi Anda:
1. Buka [Google Sheets](https://sheets.new) di browser Anda dan buat lembar kerja baru (beri nama: *Keuangan Pribadi FahKeu*).
2. Di Google Sheets, klik menu **Ekstensi > Apps Script**.
3. Hapus seluruh isi kode yang ada di editor `Code.gs`.
4. Buka tab **"⚙️ Pengaturan"** di aplikasi FahKeu Anda.
5. Klik tombol **"Salin Script Transaksi"**.
6. Kembali ke editor Google Apps Script, tempelkan kode yang telah disalin, lalu klik Simpan 💾 (ikon disket).
7. Klik tombol biru **Terapkan (Deploy) > Penerapan Baru (New Deployment)**:
   - Pilih jenis: **Aplikasi Web (Web App)**.
   - Deskripsi: `FahKeu v1`.
   - Jalankan sebagai (Execute as): **Saya (email Anda)**.
   - Yang memiliki akses (Who has access): **Siapa saja (Anyone)**. *(Sangat penting agar bot dan web dapat menulis mutasi)*.
8. Klik **Terapkan**, izinkan akses akun Google Anda (*Review Permissions > Advanced > Go to Untitled (unsafe) > Allow*).
9. Salin **URL Aplikasi Web** yang berakhiran `/exec`.
10. Tempelkan URL tersebut ke kolom **URL Google Spreadsheet** di tab Pengaturan FahKeu.
11. Klik **Uji Koneksi** untuk memastikan status berwarna hijau, lalu klik **Simpan Konfigurasi**. Selesai!

---

### 5.7 Cara Mengaktifkan Bot Telegram Pribadi
1. Buka aplikasi Telegram di smartphone atau laptop Anda.
2. Cari akun resmi pembuat bot: **`@BotFather`**.
3. Kirim pesan `/newbot`.
4. Masukkan nama bot Anda (misal: *Keuangan Budi Bot*) dan username bot unik berakhiran `bot` (misal: *BudiKeuBot*).
5. `@BotFather` akan mengirimkan **Bot Token** berupa kombinasi angka dan huruf (contoh: `7123456789:AAHq0XYZ...`). Salin token tersebut.
6. Buka tab **"⚙️ Pengaturan"** di FahKeu:
   - Tempelkan token bot ke kolom **Telegram Bot Token**.
   - Masukkan **Telegram Chat ID** Anda (dapat diperoleh dengan mengirim pesan ke `@userinfobot` di Telegram).
   - Pastikan URL Spreadsheet Transaksi Anda sudah terisi.
   - Klik tombol **"Daftarkan Webhook Bot"**.
7. Buka bot yang baru Anda buat di Telegram, klik **Start** atau ketik `/start`.
8. Anda sekarang bisa mencatat pengeluaran harian kapan saja langsung dari obrolan Telegram!

---

### 5.8 Cara Kerja & Konfigurasi Khusus Super Admin
Jika Anda login sebagai akun berkedudukan Admin (`admin` / `admin123`):
1. Buka tab menu eksklusif **"👑 Admin"**.
2. **Menyiapkan Database Master Pengguna:**
   - Buat spreadsheet baru di Google Drive Anda (beri nama: *Master Database FahKeu Admin*).
   - Masuk ke **Ekstensi > Apps Script**, kosongkan editor.
   - Klik tombol **"Salin Script adminCode.gs"** di panel Admin FahKeu, tempel ke Apps Script, lalu simpan.
   - Terapkan (Deploy) sebagai **Aplikasi Web** dengan akses **Siapa saja (Anyone)**.
   - Salin URL Web App `/exec` tersebut, tempelkan ke kolom **URL Spreadsheet Khusus Admin**, lalu klik **Simpan URL Admin** dan **Uji Koneksi**.
3. **Mengaktifkan Google OAuth Client ID:**
   - Masukkan OAuth 2.0 Web Client ID dari Google Cloud Console ke kolom **Google Auth Client ID**.
   - Klik **Simpan Client ID**. Fitur *Masuk dengan Akun Google* kini aktif untuk semua pengunjung.
4. **Mengelola Akun Pengguna:**
   - Pada tabel pengguna, Admin dapat mengklik tombol **Intip Sandi 👁️** untuk melihat kata sandi pengguna yang lupa.
   - Klik tombol **Edit ✏️** untuk mengubah data profil, peran (*user* atau *admin*), atau memperbarui URL spreadsheet privat mereka.
   - Klik tombol **Suspend / Aktifkan** untuk membekukan akun yang melanggar ketentuan.
   - Klik tombol **Tambah User Baru** untuk membuat akun langsung dari panel.
   - Klik tombol **Sinkronisasi ke Cloud** untuk mem-backup seluruh data pengguna ke Google Sheets Master Admin.

---

### 5.9 Cara Menyimpan Link Master di GitHub (`src/config.ts`)
Agar URL Master Admin Anda bersifat permanen dan tidak akan hilang meskipun browser di-clear cache atau server di-redeploy:
1. Buka berkas **`src/config.ts`** di dalam proyek ini:
   ```typescript
   export const MASTER_CONFIG = {
     // Tempelkan URL Deployment Web App Google Apps Script Admin Anda di sini:
     DEFAULT_ADMIN_SHEET_URL: 'https://script.google.com/macros/s/AKfycb.../exec',

     // Tempelkan Google OAuth Client ID jika menggunakan login Google:
     DEFAULT_GOOGLE_CLIENT_ID: 'xxxxxxxxx.apps.googleusercontent.com'
   };
   ```
2. Ganti nilai string kosong dengan URL Deployment Google Apps Script Admin dan Google Client ID Anda.
3. Lakukan *commit* dan *push* berkas tersebut ke repositori GitHub Anda.
4. **Hasilnya:** Setiap kali aplikasi dibuka oleh siapapun di perangkat manapun, aplikasi akan secara otomatis mengenali database Admin utama tanpa perlu konfigurasi ulang!

---

## 6. ARSITEKTUR SKRIP GOOGLE APPS SCRIPT (`Code.gs`)

Untuk menjaga efisiensi kuota Google dan keamanan data, sistem membagi kode backend Apps Script menjadi dua file terisolasi:

```
                               ┌─────────────────────────────────────────┐
                               │           EKOSISTEM FAHKEU              │
                               │         by: Faiz_Fahmi_ID               │
                               └────────────────────┬────────────────────┘
                                                    │
                      ┌─────────────────────────────┴────────────────────────────┐
                      ▼                                                          ▼
      ┌───────────────────────────────┐                          ┌───────────────────────────────┐
      │   TAB PENGATURAN (USER BIASA) │                          │   TAB 👑 ADMIN (SUPER ADMIN)  │
      │  File: src/utils/financeCode  │                          │   File: src/utils/adminCode   │
      └───────────────┬───────────────┘                          └───────────────┬───────────────┘
                      │                                                          │
                      ▼                                                          ▼
      ┌───────────────────────────────┐                          ┌───────────────────────────────┐
      │ SPREADSHEET TRANSAKSI PRIBADI │                          │   SPREADSHEET MASTER ADMIN    │
      ├───────────────────────────────┤                          ├───────────────────────────────┤
      │ • Lembar 'Transactions'       │                          │ • Lembar 'Users' (Data Akun)  │
      │ • Lembar 'Kategori'           │                          │ • Lembar 'Settings' (OAuth ID)│
      │ • Webhook Bot Telegram        │                          │ • API Auth, Reset PW, & Sync  │
      └───────────────────────────────┘                          └───────────────────────────────┘
```

### 1. `financeCode.gs` (Database Transaksi & Telegram)
* Menangani pencatatan mutasi kredit/debit pribadi pengguna.
* Kolom Lembar `Transactions`: `ID`, `Tanggal`, `Tipe`, `Jumlah`, `Deskripsi`, `Kategori`, `Sumber`, `User_ID`, `Username`.
* Menangani pesan teks obrolan dan foto struk yang masuk dari Webhook Bot Telegram.

### 2. `adminCode.gs` (Database Master Pengguna & Konfigurasi)
* Menangani seluruh operasional autentikasi, registrasi pengguna, validasi login, dan reset sandi.
* Kolom Lembar `Users`: `User_ID`, `Nama`, `Email`, `Username`, `Password`, `Role`, `Tanggal_Daftar`, `Status`, `GoogleSheetUrl`, `TelegramToken`, `TelegramChatId`.
* Lembar `Settings`: Menyimpan variabel global seperti `GOOGLE_CLIENT_ID`.
* Memiliki menu kustom **`⚙️ Pengaturan FahKeu`** di antarmuka Google Sheets untuk memudahkan pengelolaan langsung.

---

## 7. STRUKTUR DIREKTORI & PEMETAAN FILE PROYEK

```
fahkeu/
├── index.html                   # Titik masuk HTML utama, konfigurasi meta SEO, & Google Identity GSI
├── package.json                 # Daftar dependensi modul npm dan script eksekusi
├── tsconfig.json                # Konfigurasi kompilasi TypeScript ketat
├── vite.config.ts               # Konfigurasi bundler Vite dan plugin Tailwind CSS v4
├── metadata.json                # Metadata platform AI Studio & izin kamera WebRTC
├── server.ts                    # Backend Node.js Express: Server SPA, API Proxy, & Persistensi
├── README.md                    # Dokumentasi lengkap & buku panduan resmi aplikasi
├── redmi.md                     # Salinan dokumen panduan resmi FahKeu
├── public/                      # Aset publik statis (favicon, ikon, manifest)
└── src/
    ├── main.tsx                 # Titik awal pemasangan React 19 ke DOM
    ├── App.tsx                  # Komponen induk: state global, routing navigasi, sinkronisasi cloud
    ├── config.ts                # Master Config permanen untuk GitHub (Admin Sheet URL & Client ID)
    ├── index.css                # Berkas CSS global pengimpor Tailwind CSS (@import "tailwindcss";)
    ├── types.ts                 # Skema TypeScript lengkap (User, Transaction, Settings, Message, dll)
    ├── components/
    │   ├── AdminDashboard.tsx   # Panel kendali Super Admin: CRUD User, Konfigurasi, & Audit Sistem
    │   ├── AuthModal.tsx        # Modal Login, Register, Lupa Sandi, & Google OAuth SSO
    │   ├── ChatInterface.tsx    # Antarmuka ruang obrolan cerdas NLP, Suggestion Chips, & Aksi Cepat
    │   ├── Dashboard.tsx        # Dashboard Finansial: KPI Cards, Area Chart, Donut Chart, & Tabel Mutasi
    │   ├── ReceiptScanner.tsx   # Pemindai kamera in-memory & penampil konfirmasi hasil OCR nota
    │   ├── SettingsPanel.tsx    # Panel Pengaturan Keuangan Pengguna, Telegram Webhook, & Download APK
    │   └── UserProfileModal.tsx # Modal edit profil mandiri pengguna (Nama, Sandi, & Kredensial Privat)
    └── utils/
        ├── adminCode.gs.ts      # Template kode Google Apps Script khusus Database Master Admin
        ├── authService.ts       # Service CRUD user, sesi login, Google Auth, sinkronisasi, & proxy
        ├── categories.ts        # Konfigurasi 8 kategori resmi, palet warna, dan kamus kata kunci NLP
        ├── code.gs.ts           # Re-ekspor modul Google Apps Script
        ├── financeCode.gs.ts    # Template kode Google Apps Script khusus Transaksi Keuangan & Telegram
        ├── parser.ts            # Mesin Regex NLP Bahasa Indonesia pemroses kalimat transaksi
        ├── pdfGenerator.ts      # Generator laporan PDF vektor A4 resmi berstandar perbankan via jsPDF
        └── receiptParser.ts     # Algoritma ekstraksi teks struk belanja via Tesseract.js WASM
```

---

## 8. PANDUAN INSTALASI & MENJALANKAN PROYEK SECARA LOKAL

Bagi pengembang yang ingin menjalankan atau mengembangkan aplikasi ini di komputer lokal:

### 1. Prasyarat Sistem
- **Node.js** versi 18.0.0 atau yang lebih baru.
- **npm** (atau `pnpm` / `bun`).

### 2. Pemasangan Dependensi
Buka terminal pada direktori proyek dan jalankan:
```bash
npm install
```

### 3. Menjalankan Server Pengembangan (Dev Mode)
Jalankan dev server yang terintegrasi dengan Vite dan Express (Port 3000):
```bash
npm run dev
```
Buka peramban favorit Anda dan akses:
```
http://localhost:3000
```

### 4. Pemeriksaan Kualitas Kode (Linting)
Jalankan pemeriksaan tipe TypeScript tanpa kompilasi:
```bash
npm run lint
```

### 5. Membangun Proyek Siap Produksi (Production Build)
Lakukan kompilasi aset frontend dan bundling server backend:
```bash
npm run build
```
Hasil build siap produksi akan berada di folder `/dist` dengan bundle server di `dist/server.cjs`. Jalankan dengan:
```bash
npm start
```

---

## 9. ATRIBUSI RESMI & LISENSI

Aplikasi **FahKeu (Faiz Keuangan)** adalah karya perangkat lunak berstandar tinggi yang didesain, dirancang, dan dikembangkan secara teliti dan berdedikasi.

* **Nama Produk:** FahKeu (Faiz Keuangan)
* **Status:** Siap Produksi (Production Ready)
* **Author, Architect, & Lead Engineer:** **`by: Faiz_Fahmi_ID`** *(Faiz Fahmi Id)*
* **Tahun Rilis & Pengembangan:** 2026
* **Hak Cipta:** **© 2026 by: Faiz_Fahmi_ID.** Seluruh hak cipta dilindungi undang-undang (*All Rights Reserved*).
* **Lisensi Penggunaan:** Proyek ini dapat digunakan, dipelajari, dan disebarluaskan untuk kebutuhan pengelolaan keuangan pribadi maupun organisasi dengan tetap mempertahankan atribusi asli kepada **by: Faiz_Fahmi_ID**.

---
*Dibuat dengan segenap ketelitian, cinta teknologi, dan dedikasi penuh untuk kemandirian finansial masyarakat Indonesia — by: Faiz_Fahmi_ID (2026).*
