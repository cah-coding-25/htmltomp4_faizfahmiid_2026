export { GOOGLE_APPS_SCRIPT_ADMIN_CODE } from './adminCode.gs';
export { GOOGLE_APPS_SCRIPT_FINANCE_CODE } from './financeCode.gs';

export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script (Code.gs)
 * Salin dan tempel kode ini di Editor Google Apps Script Anda (Ekstensi > Apps Script).
 * Deploy sebagai "Web App" (Aplikasi Web):
 * - Jalankan sebagai: "Saya" (Me)
 * - Yang memiliki akses: "Siapa saja" (Anyone)
 */

// Konfigurasi Bot Telegram (Opsional, bisa juga diatur via Webhook atau Web App)
// Jika Anda ingin Bot Telegram merespon otomatis, isi token bot di sini atau kirimkan via Webhook.
var TELEGRAM_BOT_TOKEN = ""; 

/**
 * Menu Kustom di Google Spreadsheet:
 * Otomatis muncul saat Google Spreadsheet dibuka.
 * Menyediakan tombol menu interaktif untuk mengelola lembar Settings, Users, dan Google Auth ID.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('⚙️ Pengaturan FahKeu')
      .addItem('📋 Buka Lembar Settings (Pengaturan)', 'menuOpenSettingsSheet')
      .addItem('🔑 Atur / Periksa Google Auth ID', 'menuConfigureGoogleClientId')
      .addSeparator()
      .addItem('👥 Buka Lembar Pengguna (Users)', 'menuOpenUsersSheet')
      .addItem('📊 Buka Lembar Transaksi', 'menuOpenTxSheet')
      .addSeparator()
      .addItem('🔄 Sinkronkan Seluruh Struktur Lembar', 'menuSyncSheets')
      .addItem('ℹ️ Status Koneksi & Database', 'menuShowSystemStatus')
      .addToUi();
  } catch (e) {
    Logger.log("onOpen menu note: " + e.toString());
  }
}

/**
 * Fungsi Pengujian Mandiri (Bisa dipilih dan diklik "Jalankan" di Editor Apps Script).
 * Memastikan skrip terhubung dengan benar ke spreadsheet aktif.
 */
function testSheet() {
  var txSheet = getOrCreateSheet();
  var userSheet = getOrCreateUsersSheet();
  var settingsSheet = getOrCreateSettingsSheet();
  var txRows = txSheet.getLastRow();
  var userRows = userSheet.getLastRow();
  var settingsRows = settingsSheet.getLastRow();
  var googleId = getSettingValue('GOOGLE_CLIENT_ID');

  Logger.log("✅ Berhasil terhubung ke spreadsheet: " + txSheet.getParent().getName());
  Logger.log("Sheet Transaksi: " + txSheet.getName() + " (" + txRows + " baris)");
  Logger.log("Sheet Pengguna: " + userSheet.getName() + " (" + userRows + " baris)");
  Logger.log("Sheet Settings: " + settingsSheet.getName() + " (" + settingsRows + " baris, Google Auth ID: " + (googleId ? "Terisi" : "Kosong") + ")");

  return "Sukses! Terhubung ke spreadsheet. Total User: " + (userRows - 1) + ", Transaksi: " + (txRows - 1) + ", Settings: " + (settingsRows - 1);
}

function doGet(e) {
  try {
    // Pengamanan parameter agar tidak error saat diuji langsung via tombol 'Jalankan'
    e = e || {};
    var parameter = e.parameter || {};
    
    // 1. Dukungan Aksi dari Web App via GET (Fallback handal jika POST terkendala jaringan/CORS)
    if (parameter.action === 'add' || parameter.action === 'delete' || parameter.action === 'clear' || 
        parameter.action === 'register' || parameter.action === 'login' || parameter.action === 'reset_password' || 
        parameter.action === 'update_profile' ||
        parameter.action === 'get_users' || parameter.action === 'update_user' || parameter.action === 'delete_user' ||
        parameter.action === 'get_settings' || parameter.action === 'save_settings' || parameter.action === 'save_setting' ||
        parameter.action === 'setup_telegram') {
      var payload = { action: parameter.action };
      if (parameter.data) {
        try {
          var parsedData = JSON.parse(parameter.data);
          payload = Object.assign(payload, parsedData);
        } catch (err) {}
      }
      if (parameter.settings) {
        try {
          payload.settings = typeof parameter.settings === 'string' ? JSON.parse(parameter.settings) : parameter.settings;
        } catch(err) {}
      }
      if (parameter.googleClientId) payload.googleClientId = parameter.googleClientId;
      if (parameter.key) payload.key = parameter.key;
      if (parameter.value !== undefined) payload.value = parameter.value;
      if (parameter.description) payload.description = parameter.description;
      if (parameter.token) payload.token = parameter.token;
      if (parameter.botToken) payload.botToken = parameter.botToken;
      if (parameter.chatId) payload.chatId = parameter.chatId;
      if (parameter.username) payload.username = parameter.username;
      if (parameter.transaction) {
        try {
          payload.transaction = typeof parameter.transaction === 'string' ? JSON.parse(parameter.transaction) : parameter.transaction;
        } catch(err) {}
      }
      if (parameter.user) {
        try {
          payload.user = typeof parameter.user === 'string' ? JSON.parse(parameter.user) : parameter.user;
        } catch(err) {}
      }
      if (parameter.id) payload.id = parameter.id;
      if (parameter.userId) payload.userId = parameter.userId;
      if (parameter.email) payload.email = parameter.email;
      if (parameter.newPassword) payload.newPassword = parameter.newPassword;
      if (parameter.identifier) payload.identifier = parameter.identifier;
      if (parameter.password) payload.password = parameter.password;

      return handleWebAppAction(payload);
    }

    // 2. Action khusus: Ambil daftar seluruh pengguna (untuk Admin)
    if (parameter.action === 'get_users') {
      var uSheet = getOrCreateUsersSheet();
      var uRows = uSheet.getDataRange().getValues();
      var usersList = [];
      for (var u = 1; u < uRows.length; u++) {
        var rowU = uRows[u];
        if (!rowU[0]) continue;
        usersList.push({
          id: rowU[0].toString(),
          name: rowU[1] ? rowU[1].toString() : '',
          email: rowU[2] ? rowU[2].toString() : '',
          username: rowU[3] ? rowU[3].toString() : '',
          password: rowU[4] ? rowU[4].toString() : '',
          role: rowU[5] ? rowU[5].toString() : 'user',
          createdAt: rowU[6] ? rowU[6].toString() : new Date().toISOString(),
          status: rowU[7] ? rowU[7].toString() : 'active'
        });
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        users: usersList
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 3. Ambil Transaksi (Dengan isolasi per pengguna / userId)
    var sheet = getOrCreateSheet();
    var rows = sheet.getDataRange().getValues();
    var transactions = [];
    var targetUserId = parameter.userId || '';
    var targetUsername = parameter.username ? parameter.username.toLowerCase() : '';
    
    // Lewati baris pertama (header)
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0]) continue; // Skip jika ID kosong

      var txUserId = row[7] ? row[7].toString() : '';
      var txUsername = row[8] ? row[8].toString().toLowerCase() : '';

      // Jika ada targetUserId & bukan 'all', saring hanya transaksi milik pengguna tersebut
      if (targetUserId && targetUserId !== 'all') {
        var isMatch = (txUserId === targetUserId) || 
                      (targetUsername && txUsername === targetUsername) ||
                      (!txUserId && !txUsername); // toleransi data lama
        if (!isMatch) continue;
      }

      var dateVal = row[1];
      if (dateVal instanceof Date) {
        dateVal = dateVal.toISOString();
      } else if (dateVal) {
        dateVal = dateVal.toString();
      } else {
        dateVal = new Date().toISOString();
      }

      transactions.push({
        id: row[0].toString(),
        date: dateVal,
        type: row[2] ? row[2].toString() : 'pengeluaran',
        amount: Number(row[3]) || 0,
        description: row[4] ? row[4].toString() : '',
        category: row[5] ? row[5].toString() : 'Lainnya',
        source: row[6] ? row[6].toString() : 'web',
        userId: txUserId,
        username: row[8] ? row[8].toString() : ''
      });
    }
    
    // 4. Handle PDF Export Page Request
    if (parameter.action === 'pdf') {
      var period = parameter.period || 'all';
      var filtered = [];
      var periodTitle = 'Semua Transaksi';
      var now = new Date();

      if (period === 'week') {
        var sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = transactions.filter(function(t) {
          return new Date(t.date) >= sevenDaysAgo;
        });
        periodTitle = '7 Hari Terakhir (Minggu Ini)';
      } else if (period === 'month') {
        var thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filtered = transactions.filter(function(t) {
          return new Date(t.date) >= thirtyDaysAgo;
        });
        periodTitle = '30 Hari Terakhir (Bulan Ini)';
      } else if (period === 'year') {
        var currentYear = now.getFullYear();
        filtered = transactions.filter(function(t) {
          return new Date(t.date).getFullYear() === currentYear;
        });
        periodTitle = 'Tahun ' + currentYear;
      } else {
        filtered = transactions;
        periodTitle = 'Semua Transaksi';
      }

      var htmlTemplate = getPdfHtmlTemplate(filtered, periodTitle);
      return HtmlService.createHtmlOutput(htmlTemplate)
        .setTitle("Unduh Rekap PDF - FahKeu")
        .setXObjectHeaderMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    
    // 5. Urutkan berdasarkan tanggal terbaru
    transactions.sort(function(a, b) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      data: transactions
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    e = e || {};
    var postData = null;
    
    // 1. Coba baca dari e.postData.contents
    if (e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        Logger.log("Bukan JSON langsung: " + parseErr.toString());
      }
    }
    
    // 2. Coba baca dari e.parameter (jika dikirim sebagai URL-encoded form atau query)
    if (!postData && e.parameter) {
      postData = e.parameter;
      if (postData.data && typeof postData.data === 'string') {
        try {
          var parsedData = JSON.parse(postData.data);
          postData = Object.assign({}, postData, parsedData);
        } catch (err) {}
      }
      if (postData.transaction && typeof postData.transaction === 'string') {
        try {
          postData.transaction = JSON.parse(postData.transaction);
        } catch (err) {}
      }
      if (postData.user && typeof postData.user === 'string') {
        try {
          postData.user = JSON.parse(postData.user);
        } catch (err) {}
      }
      if (postData.users && typeof postData.users === 'string') {
        try {
          postData.users = JSON.parse(postData.users);
        } catch (err) {}
      }
      if (postData.settings && typeof postData.settings === 'string') {
        try {
          postData.settings = JSON.parse(postData.settings);
        } catch (err) {}
      }
    }
    
    if (!postData) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Payload kosong atau tidak dapat di-parse"
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // CASE A: Request dari Aplikasi Web (Web App)
    if (postData.action) {
      return handleWebAppAction(postData);
    }
    
    // CASE B: Request dari Webhook Telegram
    if (postData.message) {
      return handleTelegramMessage(postData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Payload tidak dikenali"
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    Logger.log("doPost error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler untuk aksi dari Web App (CRUD Transaksi, Multi-User, & Settings)
function handleWebAppAction(payload) {
  try {
    var sheet = getOrCreateSheet();
    var userSheet = getOrCreateUsersSheet();
    var settingsSheet = getOrCreateSettingsSheet();

    // --- AKSI PENGATURAN SISTEM (SETTINGS) ---

    // A. Ambil Semua Pengaturan Tersimpan
    if (payload.action === 'get_settings') {
      var allSets = getAllSettings();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        settings: allSets
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // B. Simpan Satu Kunci Pengaturan (e.g. GOOGLE_CLIENT_ID)
    if (payload.action === 'save_setting') {
      var keyName = payload.key || (payload.data ? payload.data.key : '');
      var keyValue = payload.value !== undefined ? payload.value : (payload.data && payload.data.value !== undefined ? payload.data.value : '');
      var keyDesc = payload.description || payload.keterangan || (payload.data ? (payload.data.description || payload.data.keterangan) : '');

      if (!keyName) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Key pengaturan tidak boleh kosong"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      setSettingValue(keyName, keyValue, keyDesc);
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Pengaturan '" + keyName + "' berhasil disimpan di lembar Settings",
        key: keyName,
        value: keyValue
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // C. Simpan Sekaligus Berbagai Pengaturan (Batch Settings)
    if (payload.action === 'save_settings') {
      var setsMap = payload.settings || {};
      if (payload.googleClientId !== undefined) {
        setsMap['GOOGLE_CLIENT_ID'] = payload.googleClientId;
      }
      for (var sKey in setsMap) {
        if (setsMap.hasOwnProperty(sKey)) {
          var sVal = setsMap[sKey];
          if (typeof sVal === 'object') sVal = JSON.stringify(sVal);
          setSettingValue(sKey, sVal);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Pengaturan berhasil diperbarui di lembar Settings",
        settings: getAllSettings()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // D. SETUP BOT TELEGRAM OTOMATIS
    if (payload.action === 'setup_telegram') {
      var tgToken = (payload.token || payload.botToken || payload.telegramBotToken || '').trim();
      var tgChatId = (payload.chatId || payload.telegramChatId || '').trim();
      var tgUserId = (payload.userId || '').trim();
      var tgUsername = (payload.username || '').trim();

      if (tgToken) {
        PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', tgToken);
        setSettingValue('TELEGRAM_BOT_TOKEN', tgToken, 'Token Bot Telegram');
      }
      if (tgChatId) {
        PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', tgChatId);
        setSettingValue('TELEGRAM_CHAT_ID', tgChatId, 'Chat ID Telegram');
      }
      if (tgUserId) {
        setSettingValue('TELEGRAM_USER_ID', tgUserId, 'User ID Pemilik Bot Telegram');
      }
      if (tgUsername) {
        setSettingValue('TELEGRAM_USERNAME', tgUsername, 'Username Pemilik Bot Telegram');
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Konfigurasi Bot Telegram berhasil disimpan di Google Apps Script!",
        configured: {
          token: tgToken ? (tgToken.substring(0, 8) + "...") : "tidak berubah",
          chatId: tgChatId || "belum diset",
          userId: tgUserId || "",
          username: tgUsername || ""
        }
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- AKSI PENGGUNA (USERS) ---

    // 1. REGISTER USER
    if (payload.action === 'register') {
      var u = payload.user || payload;
      if (!u || !u.username || !u.password) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Data pengguna tidak lengkap"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRows = userSheet.getDataRange().getValues();
      var cleanEmail = (u.email || '').toLowerCase().trim();
      var cleanUser = (u.username || '').toLowerCase().trim();

      // Cek duplikasi
      for (var r = 1; r < uRows.length; r++) {
        var existingEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
        var existingUsername = (uRows[r][3] || '').toString().toLowerCase().trim();
        if (existingEmail && existingEmail === cleanEmail) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: "Email sudah terdaftar"
          })).setMimeType(ContentService.MimeType.JSON);
        }
        if (existingUsername && existingUsername === cleanUser) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: "Username sudah digunakan orang lain"
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      var newUserId = u.id || ("usr_" + Date.now());
      var newName = u.name || cleanUser;
      var newRole = u.role || 'user';
      var newDate = u.createdAt || new Date().toISOString();
      var newStatus = u.status || 'active';

      userSheet.appendRow([
        newUserId,
        newName,
        cleanEmail,
        cleanUser,
        u.password,
        newRole,
        newDate,
        newStatus
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Akun pengguna berhasil didaftarkan di spreadsheet",
        userId: newUserId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. LOGIN USER
    if (payload.action === 'login') {
      var ident = (payload.identifier || '').toLowerCase().trim();
      var pass = (payload.password || '').trim();

      // Admin shortcut
      if ((ident === 'admin' || ident === 'admin@fahkeu.id' || ident === 'admin123') && pass === 'admin123') {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          user: {
            id: 'usr_admin_01',
            name: 'Administrator Utama',
            email: 'admin@fahkeu.id',
            username: 'admin',
            role: 'admin',
            status: 'active'
          }
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        var rowEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
        var rowUser = (uRows[r][3] || '').toString().toLowerCase().trim();
        var rowPass = (uRows[r][4] || '').toString().trim();
        var rowStatus = (uRows[r][7] || 'active').toString();

        if ((rowEmail === ident || rowUser === ident) && rowPass === pass) {
          if (rowStatus === 'suspended') {
            return ContentService.createTextOutput(JSON.stringify({
              success: false,
              error: "Akun Anda saat ini dinonaktifkan oleh Administrator"
            })).setMimeType(ContentService.MimeType.JSON);
          }
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            user: {
              id: uRows[r][0].toString(),
              name: uRows[r][1].toString(),
              email: uRows[r][2].toString(),
              username: uRows[r][3].toString(),
              role: uRows[r][5].toString(),
              status: rowStatus
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Username/Email atau kata sandi tidak cocok"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. RESET PASSWORD (Lupa Sandi)
    if (payload.action === 'reset_password') {
      var targetEmail = (payload.email || '').toLowerCase().trim();
      var newPass = (payload.newPassword || '').trim();

      if (!targetEmail || !newPass) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Email dan kata sandi baru wajib diisi"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRows = userSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < uRows.length; r++) {
        var rowEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
        if (rowEmail === targetEmail) {
          foundRow = r + 1;
          break;
        }
      }

      if (foundRow !== -1) {
        userSheet.getRange(foundRow, 5).setValue(newPass); // Kolom ke-5 adalah Password
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Kata sandi berhasil diperbarui di spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Email tidak ditemukan di basis data pengguna"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 3b. UPDATE PROFIL PENGGUNA (Khusus Edit Username & Password, Wajib Email Cocok)
    if (payload.action === 'update_profile') {
      var uid = (payload.userId || payload.id || '').toString().trim();
      var inputEmail = (payload.email || '').toString().toLowerCase().trim();
      var newUsername = (payload.username || '').toString().trim();
      var newPassword = (payload.password || '').toString().trim();

      if (!inputEmail) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Alamat email wajib sama persis dengan email terdaftar"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRows = userSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < uRows.length; r++) {
        var rowId = (uRows[r][0] || '').toString();
        var rowEmail = (uRows[r][2] || '').toString().toLowerCase().trim();

        if ((uid && rowId === uid) || rowEmail === inputEmail) {
          if (rowEmail !== inputEmail) {
            return ContentService.createTextOutput(JSON.stringify({
              success: false,
              error: "Email verifikasi tidak cocok dengan akun terdaftar"
            })).setMimeType(ContentService.MimeType.JSON);
          }
          foundRow = r + 1;
          break;
        }
      }

      if (foundRow !== -1) {
        if (newUsername) userSheet.getRange(foundRow, 4).setValue(newUsername); // Kolom 4: Username
        if (newPassword) userSheet.getRange(foundRow, 5).setValue(newPassword); // Kolom 5: Password

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Username dan kata sandi berhasil diperbarui di spreadsheet!"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Akun pengguna tidak ditemukan di spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 4. UPDATE USER (Oleh Admin)
    if (payload.action === 'update_user') {
      var uData = payload.user || payload;
      var uid = uData.id;
      if (!uid) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "ID pengguna tidak ditemukan"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRows = userSheet.getDataRange().getValues();
      var foundRow = -1;
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0] && uRows[r][0].toString() === uid.toString()) {
          foundRow = r + 1;
          break;
        }
      }

      if (foundRow !== -1) {
        if (uData.name) userSheet.getRange(foundRow, 2).setValue(uData.name);
        if (uData.email) userSheet.getRange(foundRow, 3).setValue(uData.email);
        if (uData.username) userSheet.getRange(foundRow, 4).setValue(uData.username);
        if (uData.password) userSheet.getRange(foundRow, 5).setValue(uData.password);
        if (uData.role) userSheet.getRange(foundRow, 6).setValue(uData.role);
        if (uData.status) userSheet.getRange(foundRow, 8).setValue(uData.status);
        if (uData.googleSheetUrl !== undefined) userSheet.getRange(foundRow, 9).setValue(uData.googleSheetUrl || '');
        if (uData.telegramBotToken !== undefined) userSheet.getRange(foundRow, 10).setValue(uData.telegramBotToken || '');
        if (uData.telegramChatId !== undefined) userSheet.getRange(foundRow, 11).setValue(uData.telegramChatId || '');

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Data pengguna berhasil diperbarui di spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Pengguna tidak ditemukan di spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 4b. UPDATE USER CREDENTIALS (Spreadsheet Transaksi & Bot Telegram Privat)
    if (payload.action === 'update_user_credentials') {
      var uCred = payload.user || payload;
      var uidCred = uCred.id;
      if (!uidCred) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "ID pengguna tidak ditemukan"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var uRowsCred = userSheet.getDataRange().getValues();
      var foundRowCred = -1;
      for (var rc = 1; rc < uRowsCred.length; rc++) {
        if (uRowsCred[rc][0] && uRowsCred[rc][0].toString() === uidCred.toString()) {
          foundRowCred = rc + 1;
          break;
        }
      }

      if (foundRowCred !== -1) {
        if (uCred.googleSheetUrl !== undefined) userSheet.getRange(foundRowCred, 9).setValue(uCred.googleSheetUrl || '');
        if (uCred.telegramBotToken !== undefined) userSheet.getRange(foundRowCred, 10).setValue(uCred.telegramBotToken || '');
        if (uCred.telegramChatId !== undefined) userSheet.getRange(foundRowCred, 11).setValue(uCred.telegramChatId || '');
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Kredensial pengguna berhasil diperbarui"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        userSheet.appendRow([
          uCred.id,
          uCred.name || uCred.username || 'Pengguna',
          uCred.email || '',
          uCred.username || ('user_' + uCred.id),
          uCred.password || '',
          uCred.role || 'user',
          new Date().toISOString(),
          'active',
          uCred.googleSheetUrl || '',
          uCred.telegramBotToken || '',
          uCred.telegramChatId || ''
        ]);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Akun dan kredensial pengguna baru berhasil ditambahkan"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // 5. DELETE USER (Oleh Admin)
    if (payload.action === 'delete_user') {
      var uid = payload.userId || payload.id;
      if (!uid) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "ID pengguna tidak ditemukan"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Hapus dari sheet Users
      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0] && uRows[r][0].toString() === uid.toString()) {
          userSheet.deleteRow(r + 1);
          break;
        }
      }

      // Hapus transaksi milik pengguna tersebut dari sheet Transactions
      var txRows = sheet.getDataRange().getValues();
      for (var t = txRows.length - 1; t >= 1; t--) {
        if (txRows[t][7] && txRows[t][7].toString() === uid.toString()) {
          sheet.deleteRow(t + 1);
        }
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Akun dan riwayat transaksi pengguna berhasil dihapus dari spreadsheet"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 6. SYNC ALL USERS
    if (payload.action === 'sync_all_users') {
      var usersArray = payload.users || [];
      if (Array.isArray(usersArray) && usersArray.length > 0) {
        // Hapus data lama kecuali header
        var last = userSheet.getLastRow();
        if (last > 1) {
          userSheet.deleteRows(2, last - 1);
        }
        for (var k = 0; k < usersArray.length; k++) {
          var item = usersArray[k];
          userSheet.appendRow([
            item.id || ('usr_' + k),
            item.name || '',
            item.email || '',
            item.username || '',
            item.password || '',
            item.role || 'user',
            item.createdAt || new Date().toISOString(),
            item.status || 'active',
            item.googleSheetUrl || '',
            item.telegramBotToken || '',
            item.telegramChatId || ''
          ]);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Sinkronisasi seluruh akun pengguna berhasil"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- AKSI TRANSAKSI KEUANGAN ---

    if (payload.action === 'add') {
      var t = payload.transaction;
      if (!t && payload.data) {
        t = payload.data;
      }
      if (typeof t === 'string') {
        try { t = JSON.parse(t); } catch(e) {}
      }
      if (!t) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Data transaksi tidak ditemukan dalam payload"
        })).setMimeType(ContentService.MimeType.JSON);
      }
      
      var txId = t.id || ("tx_" + Date.now());
      var txDate = t.date || new Date().toISOString();
      var txType = t.type || 'pengeluaran';
      var txAmount = Number(t.amount) || 0;
      var txDesc = t.description || '';
      var txCat = t.category || 'Lainnya';
      var txSource = t.source || 'web';
      var txUserId = t.userId || payload.userId || '';
      var txUsername = t.username || payload.username || '';

      sheet.appendRow([
        txId,
        txDate,
        txType,
        txAmount,
        txDesc,
        txCat,
        txSource,
        txUserId,
        txUsername
      ]);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Transaksi berhasil dicatat ke spreadsheet",
        id: txId
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. UBAH TRANSAKSI (EDIT / UPDATE)
    if (payload.action === 'edit' || payload.action === 'update') {
      var editTx = payload.transaction || payload.data || payload;
      var editTargetId = editTx.id || payload.id;
      if (!editTargetId) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "ID transaksi diperlukan untuk edit"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var editRows = sheet.getDataRange().getValues();
      for (var e = 1; e < editRows.length; e++) {
        if (editRows[e][0] && editRows[e][0].toString() === editTargetId.toString()) {
          var targetRow = e + 1;
          if (editTx.date) sheet.getRange(targetRow, 2).setValue(new Date(editTx.date).toISOString());
          if (editTx.type) sheet.getRange(targetRow, 3).setValue(String(editTx.type).toLowerCase());
          if (editTx.amount !== undefined) sheet.getRange(targetRow, 4).setValue(Number(editTx.amount) || 0);
          if (editTx.description) sheet.getRange(targetRow, 5).setValue(String(editTx.description));
          if (editTx.category) sheet.getRange(targetRow, 6).setValue(String(editTx.category));
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: "Transaksi berhasil diperbarui di spreadsheet"
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: "Transaksi tidak ditemukan di spreadsheet"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 3. TAMBAH BANYAK TRANSAKSI SEKALIGUS (BATCH ADD / DUA ARAH)
    if (payload.action === 'batch_add' || payload.action === 'sync_all') {
      var txList = payload.transactions || payload.data || [];
      if (typeof txList === 'string') {
        try { txList = JSON.parse(txList); } catch(e) {}
      }
      if (!Array.isArray(txList) || txList.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Tidak ada transaksi yang perlu ditambahkan",
          addedCount: 0
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var existingRows = sheet.getDataRange().getValues();
      var existingIdSet = {};
      for (var r = 1; r < existingRows.length; r++) {
        if (existingRows[r][0]) {
          existingIdSet[existingRows[r][0].toString()] = true;
        }
      }

      var addedCount = 0;
      var rowsToAppend = [];
      for (var b = 0; b < txList.length; b++) {
        var item = txList[b];
        if (!item || !item.id) continue;
        if (existingIdSet[item.id.toString()]) continue; // Hindari duplikasi

        var bId = item.id;
        var bDate = item.date ? (item.date instanceof Date ? item.date.toISOString() : item.date.toString()) : new Date().toISOString();
        var bType = (item.type || 'pengeluaran').toLowerCase();
        var bAmount = Number(item.amount) || 0;
        var bDesc = item.description || '';
        var bCat = item.category || 'Lainnya';
        var bSource = item.source || 'web';
        var bUserId = item.userId || payload.userId || '';
        var bUsername = item.username || payload.username || '';

        rowsToAppend.push([bId, bDate, bType, bAmount, bDesc, bCat, bSource, bUserId, bUsername]);
        existingIdSet[bId.toString()] = true;
        addedCount++;
      }

      if (rowsToAppend.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, rowsToAppend.length, 9).setValues(rowsToAppend);
      }

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Berhasil menambahkan " + addedCount + " transaksi ke spreadsheet",
        addedCount: addedCount
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (payload.action === 'delete') {
      var idToDelete = payload.id;
      var rows = sheet.getDataRange().getValues();
      var foundIndex = -1;
      
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] && rows[i][0].toString() === idToDelete.toString()) {
          foundIndex = i + 1; // +1 karena baris di spreadsheet mulai dari 1 dan lompati header
          break;
        }
      }
      
      if (foundIndex !== -1) {
        sheet.deleteRow(foundIndex);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Transaksi berhasil dihapus dari spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: "Transaksi tidak ditemukan di spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    if (payload.action === 'clear') {
      var clearUserId = (payload.userId || '').toString().trim();
      var forceClearAll = payload.clearAll === true || clearUserId === 'all' || clearUserId === 'guest' || !clearUserId;
      if (forceClearAll) {
        // Hapus semua baris transaksi kecuali baris header
        var lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Seluruh data transaksi di spreadsheet berhasil dibersihkan (Rp 0)"
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // Hapus transaksi milik user tersebut ATAU jika baris tanpa userId pada spreadsheet personal ini
        var allRows = sheet.getDataRange().getValues();
        for (var c = allRows.length - 1; c >= 1; c--) {
          var rowUId = allRows[c][7] ? allRows[c][7].toString() : '';
          if (!rowUId || rowUId === clearUserId.toString()) {
            sheet.deleteRow(c + 1);
          }
        }
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: "Data transaksi pengguna berhasil dibersihkan dari spreadsheet"
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Aksi tidak dikenal: " + payload.action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(err) {
    Logger.log("handleWebAppAction error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Handler untuk Pesan dari Bot Telegram
function handleTelegramMessage(payload) {
  var webhookStartTime = new Date().getTime();
  var message = payload.message || payload.channel_post || payload.edited_message;
  if (!message) return ContentService.createTextOutput(JSON.stringify({ success: true, note: "empty" })).setMimeType(ContentService.MimeType.JSON);
  var chatId = message.chat ? message.chat.id : null;
  if (!chatId) return ContentService.createTextOutput(JSON.stringify({ success: true, note: "no chat id" })).setMimeType(ContentService.MimeType.JSON);
  
  var senderUsername = message.from && message.from.username ? message.from.username : '';
  var senderName = message.from ? (message.from.first_name || senderUsername || 'Pengguna') : 'Pengguna';
  var appUserId = getSettingValue('TELEGRAM_USER_ID') || chatId.toString();
  var appUsername = getSettingValue('TELEGRAM_USERNAME') || senderUsername || senderName;

  // A. Handle Foto / Struk Belanja (Offline OCR)
  if (message.photo && message.photo.length > 0) {
    sendTelegramMessage(chatId, "⏳ <i>Sedang menganalisis foto struk belanja Anda... Mohon tunggu sebentar.</i>");
    try {
      var photoObj = message.photo[message.photo.length - 1]; // Resolusi tertinggi
      var fileId = photoObj.file_id;
      
      var token = getBotToken();
      var fileUrl = "https://api.telegram.org/bot" + token + "/getFile?file_id=" + fileId;
      var fileResponse = UrlFetchApp.fetch(fileUrl);
      var fileResult = JSON.parse(fileResponse.getContentText());
      
      if (fileResult.ok) {
        var filePath = fileResult.result.file_path;
        var downloadUrl = "https://api.telegram.org/file/bot" + token + "/" + filePath;
        var imageBlob = UrlFetchApp.fetch(downloadUrl).getBlob();
        
        // OCR menggunakan Google Drive API
        var scannedText = ocrImageFromBlob(imageBlob);
        
        // Parse hasil teks struk
        var parsed = parseReceiptTextInScript(scannedText);
        
        // Simpan ke Google Sheet
        var sheet = getOrCreateSheet();
        var id = "tg_ocr_" + Date.now();
        var dateIso = new Date().toISOString();
        
        sheet.appendRow([
          id,
          dateIso,
          parsed.type,
          parsed.amount,
          parsed.description,
          parsed.category,
          'telegram_ocr',
          appUserId,
          appUsername
        ]);
        
        var totals = calculateBalance(sheet);
        
        var reply = "🧾 <b>Struk Berhasil Di-scan &amp; Dicatat!</b>\\n\\n" +
                    "• Keterangan: <b>" + parsed.description + "</b>\\n" +
                    "• Nominal: <b>" + formatRupiah(parsed.amount) + "</b>\\n" +
                    "• Kategori: <b>" + parsed.category + "</b>\\n" +
                    "• Jenis: <b>Pengeluaran (Uang Keluar)</b>\\n\\n" +
                    "💰 Sisa Saldo Anda: <b>" + formatRupiah(totals.balance) + "</b>";
                    
        sendTelegramMessage(chatId, reply);
      } else {
        sendTelegramMessage(chatId, "⚠️ Gagal mengambil file foto dari server Telegram.");
      }
    } catch (err) {
      Logger.log(err.toString());
      sendTelegramMessage(chatId, "⚠️ Gagal membaca struk belanja: " + err.toString());
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  var text = message.text || "";
  var cleanText = text.toLowerCase().trim();
  
  // Cek apakah user meminta PDF / rekapitulasi download
  var pdfTriggers = [
    'download rekap', 'unduh rekap', 'rekap pdf', 'pdf rekap', 
    'rekap keuangan', 'laporan keuangan', 'export pdf', 'pdf report', 
    'download laporan', 'unduh laporan', 'rekap bulanan', 'rekap harian',
    'pdf rekapitulasi', 'cetak rekap', 'download pdf', 'cetak pdf', 'buat pdf',
    'rekap minggu', 'rekap tahun', 'rekap'
  ];
  var matchesPdf = false;
  for (var p = 0; p < pdfTriggers.length; p++) {
    if (cleanText.indexOf(pdfTriggers[p]) !== -1) {
      matchesPdf = true;
      break;
    }
  }
  if (!matchesPdf && ((cleanText.indexOf('pdf') !== -1 && cleanText.indexOf('unduh') !== -1) || 
                      (cleanText.indexOf('rekap') !== -1 && cleanText.indexOf('cetak') !== -1))) {
    matchesPdf = true;
  }

  if (matchesPdf) {
    var webAppUrl = "";
    try {
      webAppUrl = ScriptApp.getService().getUrl();
    } catch (e) {
      Logger.log("Gagal mendapatkan URL: " + e.toString());
    }

    if (!webAppUrl) {
      sendTelegramMessage(chatId, "⚠️ <b>Gagal Mendeteksi URL Web App</b>\\n\\nPastikan Anda telah melakukan <b>Deploy > New Deployment > Web App</b> dengan konfigurasi:\\n• Execute as: <b>Me</b>\\n• Who has access: <b>Anyone</b>\\n\\nSilakan deploy kembali agar tautan rekap PDF Anda aktif secara otomatis!");
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    var replyText = "📄 <b>Laporan Keuangan PDF (FahKeu)</b>\\n\\n" +
                    "Saya bisa membuatkan berkas laporan PDF rekapitulasi transaksi Anda secara otomatis, rapi, dan siap diunduh!\\n\\n" +
                    "Silakan klik link di bawah ini untuk mengunduh rekap keuangan sesuai jangka waktu pilihan Anda:\\n\\n" +
                    "📂 <a href='" + webAppUrl + "?action=pdf&period=all'><b>Unduh Rekap Semua Transaksi</b></a>\\n" +
                    "📅 <a href='" + webAppUrl + "?action=pdf&period=week'><b>Unduh Rekap Minggu Ini (7 Hari)</b></a>\\n" +
                    "📆 <a href='" + webAppUrl + "?action=pdf&period=month'><b>Unduh Rekap Bulan Ini (30 Hari)</b></a>\\n" +
                    "🗓️ <a href='" + webAppUrl + "?action=pdf&period=year'><b>Unduh Rekap Tahun Ini</b></a>\\n\\n" +
                    "<i>Tautan di atas akan langsung mengunduh berkas PDF ke perangkat Anda secara otomatis dan aman.</i>";

    sendTelegramMessage(chatId, replyText);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  // Jika ini perintah /start atau bantuan
  if (text.startsWith('/start') || text.toLowerCase() === 'help' || text.toLowerCase() === 'bantuan') {
    var welcomeText = "👋 <b>Halo! Saya Bot Pencatat Keuangan Pintar.</b>\\n\\n" +
                      "Anda bisa mencatat keuangan langsung lewat chat ini!\\n\\n" +
                      "<b>Contoh Input:</b>\\n" +
                      "• <code>gaji masuk 3juta</code> (Pemasukan)\\n" +
                      "• <code>beli bakso 15k</code> (Pengeluaran)\\n" +
                      "• <code>bayar kos 1.5jt</code> (Pengeluaran)\\n" +
                      "• <code>sisa saldo</code> (Melihat saldo saat ini)\\n" +
                      "• <code>download rekap</code> (Mendapatkan rekap PDF instan)\\n\\n" +
                      "<b>📷 Scan Nota / Struk Belanja:</b>\\n" +
                      "Kirim foto nota/struk belanja Anda langsung ke chat ini. Saya akan mendeteksi nominal dan toko secara otomatis (100% Offline OCR tanpa API key) dan menyimpannya!\\n\\n" +
                      "Ketik apa saja, saya akan mencoba memahaminya menggunakan logika pintar!";
    sendTelegramMessage(chatId, welcomeText);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = getOrCreateSheet();
  
  // Cek apakah user hanya meminta sisa saldo
  var cleanText = text.toLowerCase().trim();
  if (cleanText === 'sisa saldo' || cleanText === 'saldo' || cleanText === 'cek saldo') {
    var totals = calculateBalance(sheet);
    var balanceText = "📊 <b>Status Keuangan Anda saat ini:</b>\\n\\n" +
                      "• Sisa Saldo: <b>" + formatRupiah(totals.balance) + "</b>\\n" +
                      "• Total Pemasukan: " + formatRupiah(totals.income) + "\\n" +
                      "• Total Pengeluaran: " + formatRupiah(totals.expense);
    sendTelegramMessage(chatId, balanceText);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }

  // Parse Pesan Keuangan menggunakan logika regex mirip di React Web App
  var parsed = parseTransactionTextInScript(text);
  
  if (!parsed.success) {
    var errorReply = "⚠️ Maaf, saya tidak dapat memahami format transaksi tersebut.\\n\\n" +
                     "Pastikan Anda memasukkan keterangan dan nominal, contoh:\\n" +
                     "• <i>gaji masuk 3juta</i>\\n" +
                     "• <i>bakso 4k</i>";
    sendTelegramMessage(chatId, errorReply);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 0. Kirim status loading realtime ke chat bot
  var loadingMsgId = sendTelegramMessage(chatId, "⏳ <b>Mencatat Transaksi...</b>\\n🧾 <i>Memverifikasi format &amp; menyiapkan struk realtime...</i>");

  // Simpan ke Google Sheet
  var id = "tg_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  var dateIso = new Date().toISOString();
  
  sheet.appendRow([
    id,
    dateIso,
    parsed.type,
    parsed.amount,
    parsed.description,
    parsed.category,
    'telegram',
    appUserId,
    appUsername
  ]);
  
  // Hitung saldo terbaru
  var totals = calculateBalance(sheet);
  
  // Hitung kecepatan respon & waktu presisi detik WIB
  var elapsedMs = Math.max(1, new Date().getTime() - webhookStartTime);
  var elapsedSec = (elapsedMs / 1000).toFixed(2);
  var exactSecondWib = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss 'WIB'");
  var isIncome = parsed.type === 'pemasukan';
  var typeBadge = isIncome ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  var signSymbol = isIncome ? '+ ' : '- ';

  // Buat balasan struk transaksi resmi
  var receipt = "🧾 ═══════════════════════\\n" +
                "     <b>STRUK BUKTI TRANSAKSI RESMI</b>\\n" +
                "═══════════════════════════\\n" +
                "🟢 <b>STATUS : BERHASIL TERCATAT</b>\\n" +
                "⚡ <b>Respon :</b> " + elapsedSec + " detik (" + elapsedMs + " ms) • Realtime\\n" +
                "📅 <b>Waktu  :</b> " + exactSecondWib + "\\n" +
                "🆔 <b>Struk  :</b> <code>#" + id + "</code>\\n" +
                "───────────────────────────\\n" +
                "🏪 <b>Keterangan :</b> <b>" + parsed.description + "</b>\\n" +
                "📂 <b>Kategori   :</b> " + parsed.category + "\\n" +
                "🏷️ <b>Jenis      :</b> " + typeBadge + "\\n" +
                "💵 <b>Nominal    :</b> <b>" + signSymbol + "Rp " + formatRupiah(parsed.amount) + "</b>\\n" +
                "───────────────────────────\\n" +
                "📊 <b>REKAP SALDO KAS MUTAKHIR:</b>\\n" +
                "📥 Pemasukan   : Rp " + formatRupiah(totals.income) + "\\n" +
                "📤 Pengeluaran : Rp " + formatRupiah(totals.expense) + "\\n" +
                "💰 <b>Sisa Kas : Rp " + formatRupiah(totals.balance) + "</b>\\n" +
                "───────────────────────────\\n" +
                "✅ <i>Tersimpan realtime di Google Spreadsheet &amp; Website FahKeu!</i>\\n" +
                "═══════════════════════════";

  if (loadingMsgId) {
    var edited = editTelegramMessage(chatId, loadingMsgId, receipt);
    if (!edited) {
      sendTelegramMessage(chatId, receipt);
    }
  } else {
    sendTelegramMessage(chatId, reply);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi bantuan mengambil instance Spreadsheet aktif atau via SPREADSHEET_ID
function getSpreadsheetInstance() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    Logger.log("getActiveSpreadsheet error: " + e.toString());
  }

  if (!ss) {
    var sheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (sheetId) {
      try {
        ss = SpreadsheetApp.openById(sheetId.trim());
      } catch (openErr) {
        Logger.log("openById error: " + openErr.toString());
      }
    }
  }

  if (!ss) {
    throw new Error("Spreadsheet aktif tidak ditemukan! Pastikan skrip ini dibuat langsung dari Google Spreadsheet Anda (menu Ekstensi > Apps Script). Jika membuat skrip terpisah, tambahkan SPREADSHEET_ID di Pengaturan Proyek > Properti Script.");
  }
  return ss;
}

// Fungsi untuk membuat / mengambil Sheet 'Users' (Manajemen Multi-User)
function getOrCreateUsersSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = ss.getSheetByName('Users');
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    // Set Header
    sheet.appendRow(['User_ID', 'Nama', 'Email', 'Username', 'Password', 'Role', 'Tanggal_Daftar', 'Status']);
    // Format Header
    sheet.getRange("A1:H1").setFontWeight("bold").setBackground("#EEF2FF");
    // Default Super Admin User
    sheet.appendRow([
      'usr_admin_01',
      'Administrator Utama',
      'admin@fahkeu.id',
      'admin',
      'admin123',
      'admin',
      new Date().toISOString(),
      'active'
    ]);
  }
  return sheet;
}

// Fungsi untuk membuat / mengambil Sheet 'Transactions' (Tersimpan Privat per Akun)
function getOrCreateSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = ss.getSheetByName('Transactions');
  if (!sheet) {
    sheet = ss.insertSheet('Transactions');
    // Set Header
    sheet.appendRow(['ID', 'Tanggal', 'Tipe', 'Jumlah', 'Deskripsi', 'Kategori', 'Sumber', 'User_ID', 'Username']);
    // Format Header
    sheet.getRange("A1:I1").setFontWeight("bold").setBackground("#F3F4F6");
    // Format kolom Jumlah sebagai angka
    sheet.getRange("D2:D").setNumberFormat("#,##0");
  } else {
    // Pastikan kolom ke-8 (User_ID) dan ke-9 (Username) ada jika sebelumnya menggunakan format lama
    if (sheet.getLastColumn() < 8) {
      sheet.getRange(1, 8).setValue('User_ID').setFontWeight("bold");
      sheet.getRange(1, 9).setValue('Username').setFontWeight("bold");
    }
  }
  return sheet;
}

// Fungsi untuk membuat / mengambil Sheet 'Settings' (Pengaturan Sistem & Kunci Rahasia)
function getOrCreateSettingsSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = ss.getSheetByName('Settings');
  if (!sheet) {
    sheet = ss.insertSheet('Settings');
    // Set Header
    sheet.appendRow(['Key', 'Value', 'Keterangan', 'Terakhir_Diperbarui']);
    // Format Header: font bold, background warna gelap/slate elegan, teks putih
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#0F172A").setFontColor("#F8FAFC");
    
    // Default konfigurasi sistem & keamanan
    sheet.appendRow([
      'GOOGLE_CLIENT_ID',
      '',
      'OAuth 2.0 Web Client ID untuk fitur Masuk dengan Akun Google (Domain Web App harus didaftarkan di Authorized Origins Google Cloud)',
      new Date().toISOString()
    ]);
    sheet.appendRow([
      'APP_NAME',
      'FahKeu',
      'Nama Aplikasi Catatan Keuangan Pribadi & Multi-User',
      new Date().toISOString()
    ]);
    sheet.appendRow([
      'ADMIN_EMAIL',
      'admin@fahkeu.id',
      'Alamat email Super Administrator sistem',
      new Date().toISOString()
    ]);
    sheet.appendRow([
      'ALLOW_PUBLIC_REGISTRATION',
      'true',
      'Izinkan pengunjung mendaftar akun mandiri melalui formulir login web app (true/false)',
      new Date().toISOString()
    ]);
    sheet.appendRow([
      'DATABASE_VERSION',
      '2.2.0',
      'Versi struktur lembar Google Spreadsheet FahKeu',
      new Date().toISOString()
    ]);

    // Atur lebar kolom agar tampilan data rapi dan mudah dibaca
    try {
      sheet.setColumnWidth(1, 230); // Kolom Key
      sheet.setColumnWidth(2, 380); // Kolom Value
      sheet.setColumnWidth(3, 420); // Kolom Keterangan
      sheet.setColumnWidth(4, 200); // Kolom Terakhir Diperbarui
    } catch(e) {}
  }
  return sheet;
}

// Mengambil nilai pengaturan berdasarkan nama kunci (Key)
function getSettingValue(key) {
  if (!key) return '';
  var sSheet = getOrCreateSettingsSheet();
  var rows = sSheet.getDataRange().getValues();
  var searchKey = key.toString().toLowerCase().trim();
  for (var i = 1; i < rows.length; i++) {
    var k = (rows[i][0] || '').toString().toLowerCase().trim();
    if (k === searchKey) {
      return rows[i][1] !== undefined && rows[i][1] !== null ? rows[i][1].toString() : '';
    }
  }
  return '';
}

// Menyimpan atau memperbarui nilai pengaturan di lembar 'Settings'
function setSettingValue(key, value, description) {
  if (!key) return;
  var sSheet = getOrCreateSettingsSheet();
  var rows = sSheet.getDataRange().getValues();
  var searchKey = key.toString().toLowerCase().trim();
  var foundRow = -1;
  
  for (var i = 1; i < rows.length; i++) {
    var k = (rows[i][0] || '').toString().toLowerCase().trim();
    if (k === searchKey) {
      foundRow = i + 1; // baris ke-i+1 di spreadsheet
      break;
    }
  }

  var valStr = value !== undefined && value !== null ? value.toString() : '';
  var nowIso = new Date().toISOString();

  if (foundRow !== -1) {
    sSheet.getRange(foundRow, 2).setValue(valStr); // Kolom 2: Value
    if (description) {
      sSheet.getRange(foundRow, 3).setValue(description); // Kolom 3: Keterangan
    }
    sSheet.getRange(foundRow, 4).setValue(nowIso); // Kolom 4: Terakhir_Diperbarui
  } else {
    sSheet.appendRow([
      key.toString().trim(),
      valStr,
      description || 'Pengaturan Konfigurasi Sistem',
      nowIso
    ]);
  }
}

// Mengambil semua pengaturan dalam bentuk Object key-value
function getAllSettings() {
  var sSheet = getOrCreateSettingsSheet();
  var rows = sSheet.getDataRange().getValues();
  var result = {};
  for (var i = 1; i < rows.length; i++) {
    var k = rows[i][0];
    if (!k) continue;
    var keyStr = k.toString().trim();
    var valStr = rows[i][1] !== undefined && rows[i][1] !== null ? rows[i][1].toString() : '';
    result[keyStr] = valStr;
  }
  // Alias camelCase agar serasi dengan props aplikasi React
  if (result['GOOGLE_CLIENT_ID'] !== undefined) {
    result.googleClientId = result['GOOGLE_CLIENT_ID'];
  }
  if (result['APP_NAME'] !== undefined) {
    result.appName = result['APP_NAME'];
  }
  return result;
}

// --- FUNGSI MENU KUSTOM SPREADSHEET (⚙️ Pengaturan FahKeu) ---

function menuOpenSettingsSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = getOrCreateSettingsSheet();
  ss.setActiveSheet(sheet);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Lembar 'Settings' siap dikelola!", "FahKeu Settings", 4);
  } catch(e) {}
}

function menuConfigureGoogleClientId() {
  var ui = SpreadsheetApp.getUi();
  var currentVal = getSettingValue('GOOGLE_CLIENT_ID') || '';
  var promptMsg = 'Masukkan Google OAuth 2.0 Web Client ID Anda (contoh: 123456-xxxx.apps.googleusercontent.com).\\n\\nNilai saat ini:\\n' + (currentVal ? currentVal : '(Belum dikonfigurasi)');
  var res = ui.prompt('🔑 Konfigurasi Google Auth ID', promptMsg, ui.ButtonSet.OK_CANCEL);
  
  if (res.getSelectedButton() === ui.Button.OK) {
    var inputVal = res.getResponseText().trim();
    setSettingValue('GOOGLE_CLIENT_ID', inputVal, 'OAuth 2.0 Web Client ID untuk fitur Masuk dengan Akun Google');
    ui.alert(
      '✅ Berhasil Disimpan!',
      'Google Auth Client ID telah tersimpan rapi dan aman di lembar Settings:\\n\\n' + (inputVal ? inputVal : '(Dikosongkan)') + '\\n\\nPengguna dan admin kini bisa langsung login menggunakan akun Google di Web App!',
      ui.ButtonSet.OK
    );
  }
}

function menuOpenUsersSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = getOrCreateUsersSheet();
  ss.setActiveSheet(sheet);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Lembar 'Users' siap dikelola!", "FahKeu Users", 4);
  } catch(e) {}
}

function menuOpenTxSheet() {
  var ss = getSpreadsheetInstance();
  var sheet = getOrCreateSheet();
  ss.setActiveSheet(sheet);
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast("Lembar 'Transactions' siap dikelola!", "FahKeu Transaksi", 4);
  } catch(e) {}
}

function menuSyncSheets() {
  getOrCreateSheet();
  getOrCreateUsersSheet();
  getOrCreateSettingsSheet();
  SpreadsheetApp.getUi().alert(
    '✅ Inisialisasi Berhasil!',
    'Seluruh lembar spreadsheet berhasil diperiksa dan dirapikan:\\n\\n' +
    '1. Lembar Transactions (Catatan Transaksi)\\n' +
    '2. Lembar Users (Daftar Akun Pengguna & Admin)\\n' +
    '3. Lembar Settings (Pengaturan Sistem & Google Auth ID)',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowSystemStatus() {
  var txSheet = getOrCreateSheet();
  var userSheet = getOrCreateUsersSheet();
  var setSheet = getOrCreateSettingsSheet();
  var googleId = getSettingValue('GOOGLE_CLIENT_ID');
  var msg = "📊 Status Basis Data FahKeu:\\n\\n" +
            "• Total Akun Pengguna: " + Math.max(0, userSheet.getLastRow() - 1) + " akun\\n" +
            "• Total Transaksi: " + Math.max(0, txSheet.getLastRow() - 1) + " transaksi\\n" +
            "• Lembar Settings: " + Math.max(0, setSheet.getLastRow() - 1) + " pengaturan tersimpan\\n" +
            "• Google Auth ID: " + (googleId ? "✅ Aktif (" + googleId.substring(0, 16) + "...)" : "⚠️ Belum dikonfigurasi");
  SpreadsheetApp.getUi().alert('ℹ️ Status Database & Pengaturan FahKeu', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// Hitung saldo dan rekap pemasukan/pengeluaran
function calculateBalance(sheet) {
  var rows = sheet.getDataRange().getValues();
  var totalIncome = 0;
  var totalExpense = 0;
  
  for (var i = 1; i < rows.length; i++) {
    var type = rows[i][2];
    var amount = Number(rows[i][3]);
    if (isNaN(amount)) continue;
    
    if (type === 'pemasukan') {
      totalIncome += amount;
    } else if (type === 'pengeluaran') {
      totalExpense += amount;
    }
  }
  
  return {
    income: totalIncome,
    expense: totalExpense,
    balance: totalIncome - totalExpense
  };
}

// Kirim pesan kembali ke Telegram
function sendTelegramMessage(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    // Ambil token dari script properties sebagai alternatif
    TELEGRAM_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || "";
  }
  
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    Logger.log("TELEGRAM_BOT_TOKEN belum diset.");
    return null;
  }
  
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage";
  var payload = {
    "chat_id": chatId,
    "text": text,
    "parse_mode": "HTML"
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  try {
    var res = UrlFetchApp.fetch(url, options);
    var d = JSON.parse(res.getContentText());
    if (d.ok && d.result) return d.result.message_id;
  } catch (e) {}
  return null;
}

// Edit pesan Telegram yang sudah terkirim (untuk mengubah status loading menjadi struk resmi)
function editTelegramMessage(chatId, messageId, text, replyMarkup) {
  if (!TELEGRAM_BOT_TOKEN) {
    TELEGRAM_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || "";
  }
  if (!TELEGRAM_BOT_TOKEN || !chatId || !messageId) return false;
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/editMessageText";
  try {
    var payloadObj = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "HTML"
    };
    if (replyMarkup) payloadObj.reply_markup = replyMarkup;
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true
    });
    return JSON.parse(res.getContentText()).ok || false;
  } catch (e) {}
  return false;
}

// Fungsi bantu mendaftarkan webhook dari Web App dengan pemutusan cerdas bot lama
function setTelegramWebhook(botToken, webAppUrl) {
  if (!botToken || !webAppUrl) return JSON.stringify({ success: false, message: "Token atau URL Web App kosong" });
  var clean = botToken.trim();
  
  // 1. Putuskan bot lama jika token berbeda
  var oldToken = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (oldToken && oldToken.trim() !== clean) {
    try {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + oldToken.trim() + "/deleteWebhook?drop_pending_updates=true", { muteHttpExceptions: true });
    } catch (e) {}
  }
  
  // 2. Bersihkan pending updates pada token baru
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + clean + "/deleteWebhook?drop_pending_updates=true", { muteHttpExceptions: true });
  } catch (e) {}

  var targetUrl = webAppUrl + (webAppUrl.indexOf('?') !== -1 ? '&' : '?') + 'token=' + encodeURIComponent(clean);
  var url = "https://api.telegram.org/bot" + clean + "/setWebhook";
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      url: targetUrl,
      drop_pending_updates: true
    }),
    muteHttpExceptions: true
  });
  PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', clean);
  return response.getContentText();
}

// Logika parser di Google Apps Script (Javascript murni)
function parseTransactionTextInScript(text) {
  var cleanText = text.trim().toLowerCase();
  var type = 'pengeluaran'; // Default
  
  var incomeKeywords = ['gaji', 'masuk', 'terima', 'pemasukan', 'transfer', 'freelance', 'sampingan', 'bonus', 'untung', 'dapat', 'cuan', 'laba', 'plus', '+'];
  var expenseKeywords = ['pengeluaran', 'beli', 'bayar', 'untuk', 'makan', 'bakso', 'kopi', 'bensin', 'pulsa', 'listrik', 'belanja', 'jajan', 'ongkir', 'kos', 'tiket', 'nonton', 'keluar', 'minum', 'gojek', 'grab', 'shopee', 'tokopedia', 'minus', '-'];
  
  if (cleanText.indexOf('+') === 0) {
    type = 'pemasukan';
  } else if (cleanText.indexOf('-') === 0) {
    type = 'pengeluaran';
  } else {
    var hasIncome = false;
    for (var i = 0; i < incomeKeywords.length; i++) {
      if (cleanText.indexOf(incomeKeywords[i]) !== -1) { hasIncome = true; break; }
    }
    var hasExpense = false;
    for (var j = 0; j < expenseKeywords.length; j++) {
      if (cleanText.indexOf(expenseKeywords[j]) !== -1) { hasExpense = true; break; }
    }
    
    if (hasIncome && !hasExpense) {
      type = 'pemasukan';
    } else {
      type = 'pengeluaran';
    }
  }
  
  // Extract amount
  var amountRegex = /(?:rp\\.?\\s*)?(\\d+[\\d.,]*)\\s*(juta|miliar|jt|ribu|rb|k|m|r)?\\b/gi;
  var match = amountRegex.exec(cleanText);
  
  if (!match) {
    return { success: false };
  }
  
  var rawNumber = match[1];
  var suffix = match[2] ? match[2].toLowerCase() : "";
  var numVal = 0;
  
  if (suffix) {
    var normalizedNum = rawNumber.replace(/,/g, '.');
    numVal = parseFloat(normalizedNum);
  } else {
    var dotCount = (rawNumber.match(/\\./g) || []).length;
    if (dotCount > 1) {
      numVal = parseFloat(rawNumber.replace(/\\./g, ''));
    } else if (rawNumber.indexOf(',') !== -1) {
      numVal = parseFloat(rawNumber.replace(/\\./g, '').replace(/,/g, '.'));
    } else {
      var dotIndex = rawNumber.indexOf('.');
      if (dotIndex !== -1) {
        var digitsAfter = rawNumber.length - 1 - dotIndex;
        if (digitsAfter === 3) {
          numVal = parseFloat(rawNumber.replace(/\\./g, ''));
        } else {
          numVal = parseFloat(rawNumber);
        }
      } else {
        numVal = parseFloat(rawNumber);
      }
    }
  }
  
  if (isNaN(numVal)) return { success: false };
  
  var multiplier = 1;
  if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu' || suffix === 'r') {
    multiplier = 1000;
  } else if (suffix === 'jt' || suffix === 'juta') {
    multiplier = 1000000;
  } else if (suffix === 'm' || suffix === 'miliar') {
    multiplier = 1000000000;
  }
  
  var amount = numVal * multiplier;
  
  // Clean description
  var originalAmountText = match[0];
  var description = text.replace(new RegExp(escapeRegExp(originalAmountText), 'i'), '');
  
  var noiseWords = ['sebesar', 'untuk', 'beli', 'bayar', 'pemasukan', 'pengeluaran', 'nominal', 'sebanyak', 'harga', 'rupiah', 'rp', 'buat', 'jajan', 'uang', 'masuk', 'keluar', 'dapat', 'terima', 'plus', 'minus', '+', '-'];
  var words = description.split(/\\s+/);
  var filteredWords = [];
  
  for (var k = 0; k < words.length; k++) {
    var cleanWord = words[k].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanWord.length > 0 && noiseWords.indexOf(cleanWord) === -1) {
      // Capitalize first letter
      var word = words[k];
      var capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      filteredWords.push(capitalized);
    }
  }
  
  var cleanedDesc = filteredWords.join(' ').trim();
  if (!cleanedDesc) {
    cleanedDesc = type === 'pemasukan' ? 'Pemasukan Umum' : 'Pengeluaran Umum';
  }
  
  // Simple category assignment
  var category = type === 'pemasukan' ? 'Pemasukan Lain' : 'Lain-lain';
  var descLower = cleanedDesc.toLowerCase();
  
  var categoriesList = [
    { name: 'Makanan & Minuman', keywords: ['bakso', 'makan', 'kopi', 'minum', 'sate', 'nasgor', 'warteg', 'mie', 'jajan', 'boba', 'roti', 'cafe', 'restoran', 'kuliner'] },
    { name: 'Transportasi', keywords: ['bensin', 'ojek', 'gojek', 'grab', 'mobil', 'motor', 'toll', 'tol', 'parkir', 'tiket', 'kereta', 'pesawat', 'bus', 'travel'] },
    { name: 'Belanja & Pribadi', keywords: ['belanja', 'baju', 'shopee', 'tokopedia', 'celana', 'sepatu', 'skincare', 'makeup', 'salon', 'potong rambut', 'mall', 'supermarket'] },
    { name: 'Tagihan & Utilitas', keywords: ['kos', 'kontrakan', 'listrik', 'air', 'pdam', 'wifi', 'internet', 'pulsa', 'kuota', 'langganan', 'netflix', 'spotify', 'asuransi', 'pajak'] },
    { name: 'Hiburan & Liburan', keywords: ['nonton', 'bioskop', 'game', 'topup', 'liburan', 'hotel', 'wisata', 'konser', 'karaoke', 'healing'] },
    { name: 'Kesehatan', keywords: ['obat', 'dokter', 'rs', 'rumah sakit', 'klinik', 'vitamin', 'apotek', 'sakit', 'gigi'] }
  ];
  
  if (type === 'pemasukan') {
    categoriesList = [
      { name: 'Gaji & Pendapatan Tetap', keywords: ['gaji', 'salary', 'bulanan', 'upah', 'pemasukan utama'] },
      { name: 'Freelance & Sampingan', keywords: ['freelance', 'sampingan', 'proyek', 'project', 'desain', 'coding', 'jasa'] },
      { name: 'Hasil Investasi & Cuan', keywords: ['investasi', 'saham', 'reksadana', 'crypto', 'cuan', 'bunga', 'dividen', 'untung'] },
      { name: 'Penjualan & Bisnis', keywords: ['jualan', 'dagang', 'bisnis', 'laba', 'omset', 'olshop', 'toko'] },
      { name: 'Pemberian & Transfer', keywords: ['transfer', 'kiriman', 'orang tua', 'hadiah', 'angpao', 'thr', 'gift'] }
    ];
  }
  
  for (var m = 0; m < categoriesList.length; m++) {
    var cat = categoriesList[m];
    var matchFound = false;
    for (var n = 0; n < cat.keywords.length; n++) {
      if (descLower.indexOf(cat.keywords[n]) !== -1) {
        matchFound = true;
        break;
      }
    }
    if (matchFound) {
      category = cat.name;
      break;
    }
  }
  
  return {
    success: true,
    type: type,
    amount: amount,
    description: cleanedDesc,
    category: category
  };
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^\\\\\${}()|[\\]\\\\]/g, '\\\\$&');
}

function formatRupiah(amount) {
  // Format manual Rupiah tanpa Intl jika locale id-ID tidak didukung penuh di GAS
  var str = Math.round(amount).toString();
  var result = "";
  var count = 0;
  for (var i = str.length - 1; i >= 0; i--) {
    result = str.charAt(i) + result;
    count++;
    if (count % 3 === 0 && i !== 0) {
      result = "." + result;
    }
  }
  return "Rp " + result;
}

function getBotToken() {
  if (!TELEGRAM_BOT_TOKEN) {
    TELEGRAM_BOT_TOKEN = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN') || "";
  }
  return TELEGRAM_BOT_TOKEN;
}

function ocrImageFromBlob(blob) {
  var metadata = {
    title: "Temp_OCR_" + Date.now(),
    mimeType: blob.getContentType()
  };
  var payload = {
    metadata: Utilities.newBlob(JSON.stringify(metadata), "application/json"),
    file: blob
  };
  
  var response = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&ocr=true&ocrLanguage=en", {
    method: "post",
    headers: {
      "Authorization": "Bearer " + ScriptApp.getOAuthToken()
    },
    payload: payload,
    muteHttpExceptions: true
  });
  
  var result = JSON.parse(response.getContentText());
  if (result && result.id) {
    var text = "";
    try {
      var doc = DocumentApp.openById(result.id);
      text = doc.getBody().getText();
    } catch (docErr) {
      try {
        var exportRes = UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + result.id + "/export?mimeType=text/plain", {
          headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true
        });
        text = exportRes.getContentText();
      } catch (exErr) {}
    }
    
    // Hapus file temporary agar Google Drive tetap rapi
    try {
      UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + result.id, {
        method: "delete",
        headers: {
          "Authorization": "Bearer " + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      });
    } catch (delErr) {}
    
    return text || "";
  }
  return "";
}

function parseReceiptTextInScript(text) {
  var lines = text.split('\\n');
  var detectedAmount = 0;
  var detectedDescription = 'Belanja Nota';
  var detectedCategory = 'Lain-lain';

  var totalKeywords = ['total', 'grand total', 'subtotal', 'jumlah', 'netto', 'nett', 'amount', 'bayar', 'cash', 'tunai', 'debit', 'total bayar', 'jml'];
  var excludeKeywords = ['kembali', 'change', 'diskon', 'discount', 'promo', 'tax', 'pajak', 'ppn', 'service', 'ongkir'];

  var potentialAmounts = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var lowerLine = line.toLowerCase();

    // Extract numbers
    var cleanLine = lowerLine.replace(/rp\\.?/g, '').replace(/\\s+/g, '');
    var matches = cleanLine.match(/\\d+[\\d.,]*/g) || [];
    
    for (var j = 0; j < matches.length; j++) {
      var m = matches[j];
      var hasMultipleDots = (m.match(/\\./g) || []).length > 1;
      var hasCommas = m.indexOf(',') !== -1;
      var hasDots = m.indexOf('.') !== -1;
      var numVal = 0;

      if (hasMultipleDots) {
        numVal = parseFloat(m.replace(/\\./g, ''));
      } else if (hasCommas && hasDots) {
        numVal = parseFloat(m.replace(/[^0-9]/g, ''));
      } else if (hasCommas) {
        var parts = m.split(',');
        if (parts[1] && parts[1].length === 3) {
          numVal = parseFloat(m.replace(/,/g, ''));
        } else {
          numVal = parseFloat(parts[0].replace(/\\./g, ''));
        }
      } else if (hasDots) {
        var parts = m.split('.');
        if (parts[1] && parts[1].length === 3) {
          numVal = parseFloat(m.replace(/\\./g, ''));
        } else {
          numVal = parseFloat(parts[0]);
        }
      } else {
        numVal = parseFloat(m);
      }

      if (numVal > 100 && numVal < 10000000) {
        var isTotalLine = false;
        for (var k = 0; k < totalKeywords.length; k++) {
          if (lowerLine.indexOf(totalKeywords[k]) !== -1) {
            isTotalLine = true;
            break;
          }
        }
        var isExcludedLine = false;
        for (var l = 0; l < excludeKeywords.length; l++) {
          if (lowerLine.indexOf(excludeKeywords[l]) !== -1) {
            isExcludedLine = true;
            break;
          }
        }
        potentialAmounts.push({
          value: numVal,
          isTotalLine: isTotalLine && !isExcludedLine
        });
      }
    }
  }

  // Find total amount
  var totalLineMatches = potentialAmounts.filter(function(p) { return p.isTotalLine; });
  if (totalLineMatches.length > 0) {
    var maxVal = 0;
    for (var n = 0; n < totalLineMatches.length; n++) {
      if (totalLineMatches[n].value > maxVal) maxVal = totalLineMatches[n].value;
    }
    detectedAmount = maxVal;
  } else if (potentialAmounts.length > 0) {
    var sorted = potentialAmounts.filter(function(p) { return p.value < 5000000; });
    sorted.sort(function(a, b) { return b.value - a.value; });
    if (sorted.length > 0) {
      detectedAmount = sorted[0].value;
    }
  }

  // Detect Store Name / Description
  var storeKeywords = ['mart', 'cafe', 'coffee', 'restoran', 'resto', 'pertamina', 'apotek', 'laundry', 'trans', 'supermarket', 'indomaret', 'alfamart', 'kopi', 'bakso'];
  var foundStoreName = '';
  for (var i = 0; i < Math.min(5, lines.length); i++) {
    var line = lines[i].trim();
    if (line.length > 3 && line.length < 35 && !/\\d{4,}/.test(line)) {
      var isStore = false;
      for (var s = 0; s < storeKeywords.length; s++) {
        if (line.toLowerCase().indexOf(storeKeywords[s]) !== -1) {
          isStore = true;
          break;
        }
      }
      if (isStore) {
        foundStoreName = line;
        break;
      }
      if (!foundStoreName && /[a-zA-Z]{4,}/.test(line)) {
        foundStoreName = line;
      }
    }
  }

  if (foundStoreName) {
    detectedDescription = 'Nota ' + foundStoreName.replace(/[^a-zA-Z0-9\\s-]/g, '').trim();
  } else {
    detectedDescription = 'Nota Belanja';
  }

  // Assign category
  var fullLower = text.toLowerCase();
  var detectedCategory = 'Lain-lain';
  if (fullLower.indexOf('kopi') !== -1 || fullLower.indexOf('coffee') !== -1 || fullLower.indexOf('cafe') !== -1 || fullLower.indexOf('teh') !== -1) {
    detectedCategory = 'Makanan & Minuman';
  } else if (fullLower.indexOf('makan') !== -1 || fullLower.indexOf('bakso') !== -1 || fullLower.indexOf('resto') !== -1 || fullLower.indexOf('mie') !== -1 || fullLower.indexOf('nasi') !== -1 || fullLower.indexOf('sate') !== -1) {
    detectedCategory = 'Makanan & Minuman';
  } else if (fullLower.indexOf('bensin') !== -1 || fullLower.indexOf('pertamina') !== -1 || fullLower.indexOf('spbu') !== -1 || fullLower.indexOf('shell') !== -1 || fullLower.indexOf('parkir') !== -1 || fullLower.indexOf('tol') !== -1) {
    detectedCategory = 'Transportasi';
  } else if (fullLower.indexOf('listrik') !== -1 || fullLower.indexOf('pln') !== -1 || fullLower.indexOf('token') !== -1 || fullLower.indexOf('pulsa') !== -1 || fullLower.indexOf('kuota') !== -1 || fullLower.indexOf('wifi') !== -1) {
    detectedCategory = 'Tagihan & Utilitas';
  } else if (fullLower.indexOf('indomaret') !== -1 || fullLower.indexOf('alfamart') !== -1 || fullLower.indexOf('belanja') !== -1 || fullLower.indexOf('supermarket') !== -1) {
    detectedCategory = 'Belanja & Pribadi';
  } else if (fullLower.indexOf('nonton') !== -1 || fullLower.indexOf('bioskop') !== -1 || fullLower.indexOf('game') !== -1 || fullLower.indexOf('liburan') !== -1) {
    detectedCategory = 'Hiburan & Liburan';
  } else if (fullLower.indexOf('obat') !== -1 || fullLower.indexOf('apotek') !== -1 || fullLower.indexOf('klinik') !== -1 || fullLower.indexOf('sehat') !== -1) {
    detectedCategory = 'Kesehatan';
  }

  return {
    amount: detectedAmount || 15000,
    description: detectedDescription,
    category: detectedCategory,
    type: 'pengeluaran'
  };
}

function getPdfHtmlTemplate(transactions, periodTitle) {
  var htmlString = '<!DOCTYPE html>\\n' +
'<html>\\n' +
'<head>\\n' +
'  <meta charset="utf-8">\\n' +
'  <title>Unduh Rekap PDF - FahKeu</title>\\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">\\n' +
'  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>\\n' +
'  <script src="https://cdn.tailwindcss.com"></script>\\n' +
'  <style>\\n' +
'    @import url(\"https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap\");\\n' +
'    body { font-family: \"Inter\", sans-serif; }\\n' +
'  </style>\\n' +
'</head>\\n' +
'<body class="bg-slate-900 flex items-center justify-center min-h-screen text-slate-100 p-4 antialiased">\\n' +
'  <div class="w-full max-w-md bg-slate-950 rounded-2xl border border-slate-800 p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">\\n' +
'    <div class="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>\\n' +
'    <div class="flex justify-center">\\n' +
'      <div id="spinner" class="relative flex items-center justify-center w-20 h-20">\\n' +
'        <div class="absolute inset-0 rounded-full border-4 border-slate-800"></div>\\n' +
'        <div class="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"></div>\\n' +
'        <span class="text-2xl text-emerald-500 font-black">FK</span>\\n' +
'      </div>\\n' +
'      <div id="success-icon" class="hidden flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30">\\n' +
'        <span class="text-3xl text-emerald-400">✨</span>\\n' +
'      </div>\\n' +
'    </div>\\n' +
'    <div class="space-y-2">\\n' +
'      <h1 class="text-2xl font-bold tracking-tight text-emerald-400">FahKeu PDF</h1>\\n' +
'      <p id="status-message" class="text-sm text-slate-400 font-medium">Menghubungkan ke database dan mengumpulkan transaksi Anda...</p>\\n' +
'    </div>\\n' +
'    <div id="download-container" class="hidden transition-all duration-300 transform scale-95 opacity-0">\\n' +
'      <button id="download-btn" class="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/10 transition cursor-pointer flex items-center justify-center space-x-2">\\n' +
'        <span>📥</span>\\n' +
'        <span>Unduh File PDF Manual</span>\\n' +
'      </button>\\n' +
'      <p class="text-xs text-slate-500 mt-3">Laporan PDF sudah diunduh secara otomatis. Jika tidak ada respon, silakan klik tombol di atas.</p>\\n' +
'    </div>\\n' +
'    <div class="border-t border-slate-900 pt-4 text-[10px] text-slate-600 font-medium">\\n' +
'      Laporan Keuangan Otomatis FahKeu — by Faiz_Fahmi_Id since 2026\\n' +
'    </div>\\n' +
'  </div>\\n' +
'  <script>\\n' +
'    const transactions = JSON_DATA_HERE;\\n' +
'    const periodTitle = "PERIOD_TITLE_HERE";\\n' +
'    function formatRupiah(amount) {\\n' +
'      const str = Math.round(amount).toString();\\n' +
'      let result = "";\\n' +
'      let count = 0;\\n' +
'      for (let i = str.length - 1; i >= 0; i--) {\\n' +
'        result = str.charAt(i) + result;\\n' +
'        count++;\\n' +
'        if (count % 3 === 0 && i !== 0) {\\n' +
'          result = "." + result;\\n' +
'        }\\n' +
'      }\\n' +
'      return "Rp " + result;\\n' +
'    }\\n' +
'    function generateAndDownload() {\\n' +
'      try {\\n' +
'        const { jsPDF } = window.jspdf;\\n' +
'        const doc = new jsPDF({\\n' +
'          orientation: \"portrait\",\\n' +
'          unit: \"mm\",\\n' +
'          format: \"a4\",\\n' +
'        });\\n' +
'        const pageWidth = doc.internal.pageSize.getWidth();\\n' +
'        const pageHeight = doc.internal.pageSize.getHeight();\\n' +
'        const margin = 15;\\n' +
'        const contentWidth = pageWidth - margin * 2;\\n' +
'        let currentY = 15;\\n' +
'        function drawFooter(pdf, w, h, m) {\\n' +
'          pdf.saveGraphicsState();\\n' +
'          pdf.setFont(\"helvetica\", \"italic\");\\n' +
'          pdf.setFontSize(8);\\n' +
'          pdf.setTextColor(148, 163, 184);\\n' +
'          pdf.setDrawColor(241, 245, 249);\\n' +
'          pdf.line(m, h - 12, w - m, h - 12);\\n' +
'          pdf.text(\"Laporan Keuangan Otomatis FahKeu — by Faiz_Fahmi_Id since 2026\", m, h - 8);\\n' +
'          const pageNum = pdf.getNumberOfPages();\\n' +
'          pdf.text("Halaman " + pageNum, w - m - pdf.getTextWidth("Halaman " + pageNum), h - 8);\\n' +
'          pdf.restoreGraphicsState();\\n' +
'        }\\n' +
'        function checkPageOverflow(heightNeeded, isTableSection) {\\n' +
'          if (currentY + heightNeeded > pageHeight - 15) {\\n' +
'            doc.addPage();\\n' +
'            currentY = 15;\\n' +
'            drawFooter(doc, pageWidth, pageHeight, margin);\\n' +
'            if (isTableSection) {\\n' +
'              drawTableHeader(currentY);\\n' +
'              currentY += 8;\\n' +
'            }\\n' +
'            return true;\\n' +
'          }\\n' +
'          return false;\\n' +
'        }\\n' +
'        doc.setFillColor(15, 23, 42);\\n' +
'        doc.rect(0, 0, pageWidth, 5, \"F\");\\n' +
'        currentY = 14;\\n' +
'        doc.setFillColor(16, 185, 129);\\n' +
'        doc.roundedRect(margin, currentY - 5, 8, 8, 1.5, 1.5, \"F\");\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(10);\\n' +
'        doc.setTextColor(255, 255, 255);\\n' +
'        doc.text(\"FK\", margin + 1.5, currentY + 0.5);\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(20);\\n' +
'        doc.setTextColor(15, 23, 42);\\n' +
'        doc.text(\"FahKeu\", margin + 11, currentY + 1.5);\\n' +
'        doc.setFont(\"helvetica\", \"normal\");\\n' +
'        doc.setFontSize(7.5);\\n' +
'        doc.setTextColor(100, 116, 139);\\n' +
'        doc.text(\"PENCATAT KEUANGAN PINTAR & INTERAKTIF\", margin, currentY + 6.5);\\n' +
'        const filterStr = "PERIODE REKAP: " + periodTitle.toUpperCase();\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(9);\\n' +
'        doc.setTextColor(15, 23, 42);\\n' +
'        doc.text(filterStr, pageWidth - margin - doc.getTextWidth(filterStr), currentY - 1);\\n' +
'        const dateStr = "Tanggal Cetak: " + new Date().toLocaleDateString(\"id-ID\", {\\n' +
'          day: \"2-digit\",\\n' +
'          month: \"long\",\\n' +
'          year: \"numeric\",\\n' +
'          hour: \"2-digit\",\\n' +
'          minute: \"2-digit\",\\n' +
'        }) + " WIB";\\n' +
'        doc.setFont(\"helvetica\", \"normal\");\\n' +
'        doc.setFontSize(7.5);\\n' +
'        doc.setTextColor(100, 116, 139);\\n' +
'        doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), currentY + 3.5);\\n' +
'        currentY += 10;\\n' +
'        doc.setDrawColor(226, 232, 240);\\n' +
'        doc.setLineWidth(0.5);\\n' +
'        doc.line(margin, currentY, pageWidth - margin, currentY);\\n' +
'        currentY += 8;\\n' +
'        const sortedTransactions = [...transactions].sort(function(a, b) {\\n' +
'          return new Date(a.date).getTime() - new Date(b.date).getTime();\\n' +
'        });\\n' +
'        let totalIncome = 0;\\n' +
'        let totalExpense = 0;\\n' +
'        sortedTransactions.forEach(function(t) {\\n' +
'          if (t.type === \"pemasukan\") {\\n' +
'            totalIncome += t.amount;\\n' +
'          } else {\\n' +
'            totalExpense += t.amount;\\n' +
'          }\\n' +
'        });\\n' +
'        const balance = totalIncome - totalExpense;\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(11);\\n' +
'        doc.setTextColor(15, 23, 42);\\n' +
'        doc.text(\"RINGKASAN LAPORAN KEUANGAN\", margin, currentY);\\n' +
'        currentY += 4;\\n' +
'        const cardWidth = contentWidth / 3 - 3;\\n' +
'        const cardHeight = 22;\\n' +
'        const card1X = margin;\\n' +
'        doc.setFillColor(248, 250, 252);\\n' +
'        doc.setDrawColor(226, 232, 240);\\n' +
'        doc.roundedRect(card1X, currentY, cardWidth, cardHeight, 3, 3, \"FD\");\\n' +
'        doc.setFillColor(79, 70, 229);\\n' +
'        doc.rect(card1X, currentY, 1.5, cardHeight, \"F\");\\n' +
'        doc.setFont(\"helvetica\", \"normal\");\\n' +
'        doc.setFontSize(7.5);\\n' +
'        doc.setTextColor(100, 116, 139);\\n' +
'        doc.text(\"SISA SALDO\", card1X + 4, currentY + 6);\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(11);\\n' +
'        doc.setTextColor(15, 23, 42);\\n' +
'        doc.text(formatRupiah(balance), card1X + 4, currentY + 14);\\n' +
'        const card2X = margin + cardWidth + 4.5;\\n' +
'        doc.setFillColor(248, 250, 252);\\n' +
'        doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 3, 3, \"FD\");\\n' +
'        doc.setFillColor(16, 185, 129);\\n' +
'        doc.rect(card2X, currentY, 1.5, cardHeight, \"F\");\\n' +
'        doc.setFont(\"helvetica\", \"normal\");\\n' +
'        doc.setFontSize(7.5);\\n' +
'        doc.setTextColor(100, 116, 139);\\n' +
'        doc.text(\"TOTAL PEMASUKAN\", card2X + 4, currentY + 6);\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(11);\\n' +
'        doc.setTextColor(16, 185, 129);\\n' +
'        doc.text("+ " + formatRupiah(totalIncome), card2X + 4, currentY + 14);\\n' +
'        const card3X = margin + (cardWidth * 2) + 9;\\n' +
'        doc.setFillColor(248, 250, 252);\\n' +
'        doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 3, 3, \"FD\");\\n' +
'        doc.setFillColor(244, 63, 94);\\n' +
'        doc.rect(card3X, currentY, 1.5, cardHeight, \"F\");\\n' +
'        doc.setFont(\"helvetica\", \"normal\");\\n' +
'        doc.setFontSize(7.5);\\n' +
'        doc.setTextColor(100, 116, 139);\\n' +
'        doc.text(\"TOTAL PENGELUARAN\", card3X + 4, currentY + 6);\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(11);\\n' +
'        doc.setTextColor(225, 29, 72);\\n' +
'        doc.text("- " + formatRupiah(totalExpense), card3X + 4, currentY + 14);\\n' +
'        currentY += cardHeight + 10;\\n' +
'        doc.setFont(\"helvetica\", \"bold\");\\n' +
'        doc.setFontSize(11);\\n' +
'        doc.setTextColor(15, 23, 42);\\n' +
'        doc.text(\"RIWAYAT TRANSAKSI LENGKAP (\" + sortedTransactions.length + \" item)\", margin, currentY);\\n' +
'        currentY += 5;\\n' +
'        const colWidths = {\\n' +
'          no: 8,\\n' +
'          tanggal: 32,\\n' +
'          tipe: 22,\\n' +
'          kategori: 26,\\n' +
'          deskripsi: 54,\\n' +
'          nominal: 38,\\n' +
'        };\\n' +
'        function drawTableHeader(y) {\\n' +
'          doc.setFillColor(15, 23, 42);\\n' +
'          doc.rect(margin, y, contentWidth, 8, \"F\");\\n' +
'          doc.setFont(\"helvetica\", \"bold\");\\n' +
'          doc.setFontSize(8.5);\\n' +
'          doc.setTextColor(255, 255, 255);\\n' +
'          let currentX = margin;\\n' +
'          doc.text(\"No\", currentX + 2, y + 5.5);\\n' +
'          currentX += colWidths.no;\\n' +
'          doc.text(\"Tanggal & Waktu\", currentX + 2, y + 5.5);\\n' +
'          currentX += colWidths.tanggal;\\n' +
'          doc.text(\"Jenis Aliran\", currentX + 2, y + 5.5);\\n' +
'          currentX += colWidths.tipe;\\n' +
'          doc.text(\"Kategori\", currentX + 2, y + 5.5);\\n' +
'          currentX += colWidths.kategori;\\n' +
'          doc.text(\"Deskripsi / Catatan\", currentX + 2, y + 5.5);\\n' +
'          currentX += colWidths.deskripsi;\\n' +
'          doc.text(\"Nominal (Rp)\", currentX + colWidths.nominal - doc.getTextWidth(\"Nominal (Rp)\") - 2, y + 5.5);\\n' +
'        }\\n' +
'        drawTableHeader(currentY);\\n' +
'        currentY += 8;\\n' +
'        if (sortedTransactions.length === 0) {\\n' +
'          doc.setFillColor(248, 250, 252);\\n' +
'          doc.rect(margin, currentY, contentWidth, 12, \"F\");\\n' +
'          doc.setDrawColor(226, 232, 240);\\n' +
'          doc.rect(margin, currentY, contentWidth, 12, \"D\");\\n' +
'          doc.setFont(\"helvetica\", \"italic\");\\n' +
'          doc.setFontSize(9);\\n' +
'          doc.setTextColor(148, 163, 184);\\n' +
'          doc.text(\"Tidak ada data transaksi pada periode ini.\", pageWidth / 2, currentY + 7.5, { align: \"center\" });\\n' +
'          currentY += 12;\\n' +
'        } else {\\n' +
'          doc.setFont(\"helvetica\", \"normal\");\\n' +
'          doc.setFontSize(8);\\n' +
'          sortedTransactions.forEach(function(t, index) {\\n' +
'            const dateObj = new Date(t.date);\\n' +
'            const formattedDate = dateObj.toLocaleDateString(\"id-ID\", {\\n' +
'              day: \"2-digit\",\\n' +
'              month: \"short\",\\n' +
'              year: \"numeric\",\\n' +
'            }) + \" \" + dateObj.toLocaleTimeString(\"id-ID\", {\\n' +
'              hour: \"2-digit\",\\n' +
'              minute: \"2-digit\",\\n' +
'            });\\n' +
'            const splitCategory = doc.splitTextToSize(t.category || \"-\", colWidths.kategori - 4);\\n' +
'            const splitDesc = doc.splitTextToSize(t.description || \"-\", colWidths.deskripsi - 4);\\n' +
'            const numLines = Math.max(1, splitCategory.length, splitDesc.length);\\n' +
'            const rowHeight = 6 + (numLines * 3.5);\\n' +
'            checkPageOverflow(rowHeight, true);\\n' +
'            if (index % 2 === 0) {\\n' +
'              doc.setFillColor(255, 255, 255);\\n' +
'            } else {\\n' +
'              doc.setFillColor(248, 250, 252);\\n' +
'            }\\n' +
'            doc.rect(margin, currentY, contentWidth, rowHeight, \"F\");\\n' +
'            doc.setDrawColor(241, 245, 249);\\n' +
'            doc.setLineWidth(0.3);\\n' +
'            doc.line(margin, currentY + rowHeight, pageWidth - margin, currentY + rowHeight);\\n' +
'            let currentX = margin;\\n' +
'            doc.setTextColor(51, 65, 85);\\n' +
'            doc.text((index + 1).toString(), currentX + 2, currentY + 5.5);\\n' +
'            currentX += colWidths.no;\\n' +
'            doc.text(formattedDate, currentX + 2, currentY + 5.5);\\n' +
'            currentX += colWidths.tanggal;\\n' +
'            if (t.type === \"pemasukan\") {\\n' +
'              doc.setTextColor(16, 185, 129);\\n' +
'              doc.setFont(\"helvetica\", \"bold\");\\n' +
'              doc.text(\"PEMASUKAN\", currentX + 2, currentY + 5.5);\\n' +
'            } else {\\n' +
'              doc.setTextColor(225, 29, 72);\\n' +
'              doc.setFont(\"helvetica\", \"bold\");\\n' +
'              doc.text(\"PENGELUARAN\", currentX + 2, currentY + 5.5);\\n' +
'            }\\n' +
'            doc.setFont(\"helvetica\", \"normal\");\\n' +
'            doc.setTextColor(51, 65, 85);\\n' +
'            currentX += colWidths.tipe;\\n' +
'            splitCategory.forEach(function(line, i) {\\n' +
'              doc.text(line, currentX + 2, currentY + 5.5 + (i * 3.5));\\n' +
'            });\\n' +
'            currentX += colWidths.kategori;\\n' +
'            splitDesc.forEach(function(line, i) {\\n' +
'              doc.text(line, currentX + 2, currentY + 5.5 + (i * 3.5));\\n' +
'            });\\n' +
'            currentX += colWidths.deskripsi;\\n' +
'            const amountSign = t.type === \"pemasukan\" ? \"+\" : \"-\";\\n' +
'            const amountVal = amountSign + " Rp " + t.amount.toLocaleString(\"id-ID\");\\n' +
'            if (t.type === \"pemasukan\") {\\n' +
'              doc.setTextColor(5, 150, 105);\\n' +
'              doc.setFont(\"helvetica\", \"bold\");\\n' +
'            } else {\\n' +
'              doc.setTextColor(220, 38, 38);\\n' +
'              doc.setFont(\"helvetica\", \"bold\");\\n' +
'            }\\n' +
'            doc.text(amountVal, currentX + colWidths.nominal - doc.getTextWidth(amountVal) - 2, currentY + 5.5);\\n' +
'            doc.setFont(\"helvetica\", \"normal\");\\n' +
'            currentY += rowHeight;\\n' +
'          });\\n' +
'        }\\n' +
'        drawFooter(doc, pageWidth, pageHeight, margin);\\n' +
'        const sanitizedPeriod = periodTitle.toLowerCase().replace(/\\\\s+/g, \"_\");\\n' +
'        doc.save(\"fahkeu_rekap_\" + sanitizedPeriod + \"_\" + new Date().toISOString().split(\"T\")[0] + \".pdf\");\\n' +
'        document.getElementById(\"spinner\").classList.add(\"hidden\");\\n' +
'        document.getElementById(\"success-icon\").classList.remove(\"hidden\");\\n' +
'        document.getElementById(\"status-message\").innerText = "Selesai! Laporan PDF Anda berhasil diunduh secara otomatis.";\\n' +
'        document.getElementById(\"status-message\").classList.remove(\"text-slate-400\");\\n' +
'        document.getElementById(\"status-message\").classList.add(\"text-emerald-400\");\\n' +
'        document.getElementById(\"download-container\").classList.remove(\"hidden\");\\n' +
'        setTimeout(() => {\\n' +
'          document.getElementById(\"download-container\").classList.remove(\"scale-95\", \"opacity-0\");\\n' +
'        }, 100);\\n' +
'      } catch (e) {\\n' +
'        document.getElementById(\"status-message\").innerText = "Gagal membuat PDF: " + e.toString();\\n' +
'        document.getElementById(\"status-message\").classList.add(\"text-rose-500\");\\n' +
'      }\\n' +
'    }\\n' +
'    document.getElementById(\"download-btn\").addEventListener(\"click\", function() {\\n' +
'      generateAndDownload();\\n' +
'    });\\n' +
'    window.addEventListener(\"DOMContentLoaded\", function() {\\n' +
'      setTimeout(function() {\\n' +
'        document.getElementById(\"status-message\").innerText = "Mengompilasi desain laporan dan mengekspor ke berkas PDF...";\\n' +
'        setTimeout(function() {\\n' +
'          generateAndDownload();\\n' +
'        }, 800);\\n' +
'      }, 1000);\\n' +
'    });\\n' +
'  </script>\\n' +
'</body>\\n' +
'</html>';

  return htmlString
    .replace('JSON_DATA_HERE', JSON.stringify(transactions))
    .replace('PERIOD_TITLE_HERE', periodTitle);
}

function dummyReferences() {
  // Dipanggil agar Apps Script otomatis mendeteksi scope Google Drive & Google Docs
  try {
    DriveApp.getRootFolder();
    DocumentApp.create("Dummy_OCR");
  } catch (e) {}
}
`;
