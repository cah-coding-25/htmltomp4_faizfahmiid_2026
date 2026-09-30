/**
 * KONFIGURASI UTAMA APLIKASI (PERMANEN DI GITHUB / KODE SUMBER)
 * 
 * Sesuai prinsip "Single Source of Truth":
 * Anda cukup menempelkan 1 Link Utama Google Apps Script Admin di sini.
 * 
 * Semua data lainnya (daftar user, link spreadsheet transaksi masing-masing user,
 * token bot telegram, chat ID, dll.) akan otomatis ditarik dari spreadsheet Admin tersebut.
 * 
 * Dengan menyimpannya di file ini (dan di-push ke GitHub), link tidak akan pernah
 * hilang meskipun browser di-clear cache atau server di-restart!
 */

export const MASTER_CONFIG = {
  // Tempelkan URL Deployment Web App Google Apps Script Admin Anda di sini:
  // Contoh: 'https://script.google.com/macros/s/AKfycbx.../exec'
  DEFAULT_ADMIN_SHEET_URL: 'https://script.google.com/macros/s/AKfycbzE9SmADUJFOMHyoPEkzh4R-RB4nfRov4iZRh6CQVz096s77T3aroUHtS1D-HRFB6-o/exec',

  // Tempelkan Google OAuth Client ID jika Anda menggunakan login Google:
  // Contoh: 'xxxxxxxxx.apps.googleusercontent.com'
  DEFAULT_GOOGLE_CLIENT_ID: '1006289227027-j4dubpan7jl62tn6k42qui20g8kdevf4.apps.googleusercontent.com'
};
