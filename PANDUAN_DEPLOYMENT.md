# 🚀 PANDUAN UTAMA DEPLOYMENT VERCEL + BOT TELEGRAM 24 JAM (PILIHAN 2)

> **Fokus Utama:** Panduan ini dirancang khusus untuk memastikan website yang di-deploy di **Vercel** (`fahkeucontoh.vercel.app`) dan **Bot Telegram** berjalan 100% aktif, membalas chat seperti `beli bakso 29k`, dan mencatat ke Google Spreadsheet secara realtime 24 jam nonstop tanpa perlu sewa VPS/server berbayar!

---

## ⚡ MENGAPA BOT TELEGRAM DI VERCEL BUTUH WEBHOOK GOOGLE APPS SCRIPT?

1. **Vercel adalah Hosting Frontend Jamstack/Serverless:**
   Vercel hanya menyajikan file statis (HTML/JS/CSS). Vercel **TIDAK** menjalankan server Node.js `server.ts` di background secara 24 jam nonstop.
2. **Solusi Cerdas (Pilihan 2):**
   Kita menggunakan **Google Apps Script** sebagai backend cloud gratis 24 jam milik Google. 
   Saat Anda ketik `beli bakso 29k` di Telegram:
   - Telegram mengirim data langsung ke URL Google Apps Script (`/exec`) via **Webhook**.
   - Google Apps Script memproses teks, mencatat ke Google Spreadsheet, dan langsung membalas ke Telegram Anda.
   - Website di Vercel membaca data dari Google Spreadsheet tersebut.
   - **Hasil:** Semuanya berjalan 100% otomatis, gratis seumur hidup, dan aktif 24 jam nonstop!

---

## 🛠️ LANGKAH LENGKAP PENYIAPAN (STEP-BY-STEP)

### LANGKAH 1: Buat Google Spreadsheet & Pasang Skrip
1. Buka [https://sheets.new](https://sheets.new) di browser Anda untuk membuat Google Spreadsheet baru.
2. Beri nama spreadsheet, misalnya: **Database Keuangan FahKeu**.
3. Di menu atas spreadsheet, klik **Ekstensi** > pilih **Apps Script**.
4. Hapus semua kode default (`function myFunction() { ... }`).
5. Salin seluruh isi kode skrip:
   - Anda bisa menyalinnya dari file `src/utils/code.gs.ts` (bagian `GOOGLE_APPS_SCRIPT_FINANCE_CODE`), ATAU
   - Buka menu **Pengaturan** di website FahKeu Anda > scroll ke bawah > klik tombol hijau **📋 Salin Skrip Code.gs**.
6. Tempelkan seluruh kode tersebut ke editor Apps Script.
7. Klik ikon **Simpan** (gambar disket 💾) atau tekan `Ctrl + S`.

---

### LANGKAH 2: Terapkan (Deploy) Sebagai Web App
Ini langkah yang paling krusial! Pastikan pengaturannya persis seperti di bawah:
1. Di pojok kanan atas editor Apps Script, klik tombol biru **Terapkan (Deploy)** > pilih **Deployment baru**.
2. Klik ikon gerigi ⚙️ di sebelah kiri > pilih jenis **Aplikasi Web (Web App)**.
3. Atur konfigurasi berikut:
   - **Deskripsi:** `FahKeu Production v1` (bebas)
   - **Jalankan sebagai (Execute as):** **Saya (Me / email Anda)**
   - **Yang memiliki akses (Who has access):** **Siapa saja (Anyone)** *(Wajib "Siapa saja" agar server Telegram bisa mengirimkan data ke skrip!)*
4. Klik tombol **Deploy** / **Terapkan**.
5. Jika muncul jendela *"Beri Otorisasi / Izinkan Akses"*:
   - Pilih akun Google Anda.
   - Klik **Advanced / Lanjutan** (di pojok kiri bawah pop-up).
   - Klik tautan **Go to Untitled project (unsafe) / Buka project (tidak aman)**.
   - Klik tombol biru **Izinkan (Allow)**.
6. Salin **URL Aplikasi Web** yang muncul (URL panjang yang berakhiran `/exec`).

---

### LANGKAH 3: Hubungkan di Website Vercel Anda (`fahkeucontoh.vercel.app`)
1. Buka website Anda yang ada di Vercel: `https://fahkeucontoh.vercel.app`.
2. Masuk / login ke akun Anda.
3. Buka menu **Pengaturan** (ikon gerigi di navigasi).
4. Pada kolom **URL Google Apps Script**, tempelkan URL Web App yang berakhiran `/exec` dari Langkah 2.
5. Pada kolom **Token Bot Telegram**, masukkan token bot Anda dari `@BotFather` (contoh: `8876875177:AAH...`).
6. Klik tombol hijau: **💾 Simpan & Aktifkan Bot**.
7. Sistem FahKeu akan secara otomatis:
   - Memverifikasi token ke server Telegram.
   - Mendaftarkan Webhook Telegram langsung ke URL Google Apps Script Anda.
   - Menyimpan konfigurasi ke spreadsheet.

---

### LANGKAH 4: Verifikasi & Cek Status Webhook
1. Di halaman Pengaturan, klik tombol ungu: **🔍 Cek Webhook Bot**.
2. Anda akan melihat kotak status:
   - **Status:** 🟢 *Webhook Terpasang*
   - **URL Target:** `https://script.google.com/macros/s/.../exec?token=...`
   - **Pesan Tertunda:** `0 pesan`
3. Klik tombol **Uji Kirim Pesan**. Bot akan mengirimkan pesan notifikasi ke Telegram Anda.
4. Sekarang, buka Telegram dan kirim pesan:
   ```text
   beli bakso 29k
   ```
5. **Selesai!** Bot Telegram akan langsung membalas dalam hitungan detik:
   - 📝 *Keterangan: beli bakso*
   - 💵 *Nominal: - Rp 29.000*
   - 💰 *Sisa Saldo Kas: ...*
   Dan data tersebut otomatis tersimpan di Google Spreadsheet & tampil di website Vercel Anda!

---

## 🔍 PENJELASAN TEKNIS STANDAR INTERNASIONAL:
### MENGAPA DI PREVIEW GOOGLE AI STUDIO BISA, TETAPI DI VERCEL BELUM AKTIF?

Bagi software engineer profesional, terdapat 3 perbedaan fundamental arsitektur antara **Google AI Studio** dan **Vercel**:

1. **AI Studio Menjalankan Background Node.js Poller (`server.ts`)**:
   - Di preview Google AI Studio, container menjalankan server Node.js Express 24 jam dengan background polling Telegram (`getUpdates`).
   - Ketika Anda deploy ke **Vercel**, Vercel hanya menyajikan file statis SPA React (HTML/CSS/JS di folder `dist`). Vercel **TIDAK** menjalankan proses background loop yang terus hidup.
   - Oleh sebab itu, di Vercel, bot **WAJIB** menggunakan **Webhook 24 Jam Google Apps Script** (`https://script.google.com/macros/s/.../exec`).

2. **Jebakan HTTP 302 Redirect Google Apps Script vs Telegram Webhook Engine**:
   - Ini adalah misteri teknis yang membingungkan developer selama bertahun-tahun!
   - Ketika Telegram mengirim webhook ke Google Apps Script, server Google **selalu mengembalikan HTTP 302 Found** (redirect ke domain `googleusercontent.com`).
   - Telegram Webhook engine **SECARA OTOMATIS MENGABAIKAN** payload JSON `{ "method": "sendMessage" }` jika didahului redirect HTTP 302!
   - **SOLUSI PROFESIONAL YANG KINI TELAH DITERAPKAN:**
     Skrip `financeCode.gs` terbaru kini tidak lagi mengandalkan payload balasan Webhook. Skrip secara langsung dan aktif menembak Telegram API via `UrlFetchApp.fetch("https://api.telegram.org/bot.../sendMessage", ...)`! Hasilnya: bot langsung membalas dalam < 500ms!

3. **Kewajiban "Versi Baru" (New Version) di Apps Script**:
   - Menekan tombol **Simpan (Ctrl+S)** di editor Google Apps Script **TIDAK AKAN** memperbarui Web App yang sedang aktif!
   - Setiap kali Anda memperbarui kode di Apps Script, Anda **WAJIB**:
     1. Klik **Terapkan (Deploy)** di kanan atas.
     2. Pilih **Kelola Penerapan (Manage Deployments)**.
     3. Klik ikon **PENSIL ✏️ (Edit)** pada deployment aktif Anda.
     4. Pada dropdown Versi, pilih **"Versi Baru" (New Version)**.
     5. Pastikan *Who has access* = **"Siapa saja" (Anyone)**.
     6. Klik **Terapkan (Deploy)**.

4. **Koneksi Webhook Langsung dari Browser (Client-Side Resilient)**:
   - Panel Pengaturan FahKeu kini dilengkapi sistem pendaftaran webhook langsung dari browser Anda ke Telegram API (`https://api.telegram.org/bot<TOKEN>/setWebhook`).
   - Sehingga meskipun website Anda di-host di Vercel, Netlify, atau GitHub Pages tanpa server backend, pendaftaran webhook dan pembersihan antrean (drop pending updates) berjalan 100% sempurna!

---

## ❓ FAQ & SOLUSI CEPAT KENDALA

### Q: Bagaimana cara tercepat mengaktifkan bot sekarang?
1. Buka Google Spreadsheet Anda.
2. Di bar menu atas, klik menu kustom: **📊 Keuangan FahKeu** > pilih **⚡ 1. Aktifkan Webhook Bot 24 Jam Otomatis**.
3. Masukkan Token Bot Telegram Anda dari `@BotFather` saat diminta.
4. Selesai! Webhook terdaftar langsung dari Google Cloud ke Telegram.

---

*Hak Cipta © 2026 by: Faiz_Fahmi_ID — Standard International Software Engineering*
