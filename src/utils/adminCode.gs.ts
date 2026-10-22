/**
 * Google Apps Script Khusus Admin (Code.gs Database Pengguna & Akun)
 * 
 * PETUNJUK PEMASANGAN UNTUK SPREADSHEET ADMIN:
 * 1. Buka Google Spreadsheet baru (beri nama: "Database Admin FahKeu").
 * 2. Klik menu "Ekstensi" > "Apps Script".
 * 3. Hapus kode bawaan, lalu salin dan tempel SELURUH kode di bawah ini.
 * 4. Klik tombol "Terapkan" (Deploy) di kanan atas > pilih "Deployment baru" (New deployment).
 * 5. Pilih jenis (ikon roda gigi): "Aplikasi Web" (Web App).
 * 6. Atur:
 *    - Deskripsi: "Database Pengguna & Akun FahKeu"
 *    - Jalankan sebagai (Execute as): "Saya" (Me)
 *    - Yang memiliki akses (Who has access): "Siapa saja" (Anyone)
 * 7. Klik "Terapkan" (Deploy), berikan izin akses akun Google Anda.
 * 8. Salin "URL Aplikasi Web" (Web App URL) yang berakhiran "/exec".
 * 9. Tempelkan URL tersebut ke kolom "URL Google Spreadsheet Admin" di Tab Admin FahKeu!
 */

export const GOOGLE_APPS_SCRIPT_ADMIN_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - KHUSUS DATABASE ADMIN & MANAJEMEN PENGGUNA (Code.gs)
 * FahKeu - Aplikasi Pencatat Keuangan & Manajemen Pengguna
 * ============================================================================
 * Lembar yang Dikelola Otomatis:
 * 1. 'Users'    : Menyimpan data akun pengguna (ID, Nama, Email, Username, Password, Role, Tanggal Daftar, Status)
 * 2. 'Settings' : Menyimpan pengaturan master sistem (Google Client ID, dsb)
 */

var USER_SHEET_NAME = "Users";
var SETTINGS_SHEET_NAME = "Settings";

/**
 * Menu Kustom di Google Spreadsheet Admin:
 * Otomatis muncul di baris menu atas saat Spreadsheet dibuka.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('⚙️ Admin FahKeu')
      .addItem('👥 Buka Lembar Pengguna (Users)', 'menuOpenUsersSheet')
      .addItem('🔑 Atur / Periksa Google Auth Client ID', 'menuConfigureGoogleClientId')
      .addSeparator()
      .addItem('📋 Buka Lembar Settings', 'menuOpenSettingsSheet')
      .addItem('🔄 Sinkronkan Struktur Lembar', 'menuSyncSheets')
      .addItem('ℹ️ Status Database Pengguna', 'menuShowSystemStatus')
      .addToUi();
  } catch (e) {
    Logger.log("onOpen notice: " + e.toString());
  }
}

/**
 * Uji Coba Mandiri (Bisa dipilih dan diklik "Jalankan" di Apps Script).
 */
function testAdminDatabase() {
  var uSheet = getOrCreateUsersSheet();
  var sSheet = getOrCreateSettingsSheet();
  var uRows = uSheet.getLastRow();
  var sRows = sSheet.getLastRow();
  var googleId = getSettingValue('GOOGLE_CLIENT_ID');

  Logger.log("✅ Berhasil terhubung ke spreadsheet Admin: " + uSheet.getParent().getName());
  Logger.log("Sheet Pengguna: " + uSheet.getName() + " (" + (uRows - 1) + " akun terdaftar)");
  Logger.log("Sheet Settings: " + sSheet.getName() + " (" + (sRows - 1) + " konfigurasi, Google Auth ID: " + (googleId ? "Terisi" : "Kosong") + ")");

  return "Sukses! Database Admin siap. Total Pengguna: " + (uRows > 1 ? uRows - 1 : 0) + ", Konfigurasi: " + (sRows > 1 ? sRows - 1 : 0);
}

// ----------------------------------------------------------------------------
// GET REQUEST HANDLER (doGet)
// ----------------------------------------------------------------------------
function doGet(e) {
  try {
    e = e || {};
    var parameter = e.parameter || {};

    // 1. Ambil Pengaturan (Settings)
    if (parameter.action === 'get_settings') {
      var allSets = getAllSettings();
      return jsonResponse({
        success: true,
        settings: allSets
      });
    }

    // 2. Ambil Daftar Seluruh Pengguna (get_users)
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
          status: rowU[7] ? rowU[7].toString() : 'active',
          googleSheetUrl: rowU[8] ? rowU[8].toString() : '',
          telegramBotToken: rowU[9] ? rowU[9].toString() : '',
          telegramChatId: rowU[10] ? rowU[10].toString() : ''
        });
      }
      return jsonResponse({
        success: true,
        users: usersList
      });
    }

    // 3. Fallback GET untuk aksi aksi CRUD jika POST terkendala CORS
    if (parameter.action) {
      var payload = { action: parameter.action };
      if (parameter.data) {
        try {
          payload = Object.assign(payload, JSON.parse(parameter.data));
        } catch (err) {}
      }
      if (parameter.key) payload.key = parameter.key;
      if (parameter.value !== undefined) payload.value = parameter.value;
      if (parameter.description) payload.description = parameter.description;
      if (parameter.userId) payload.userId = parameter.userId;
      if (parameter.email) payload.email = parameter.email;
      if (parameter.newPassword) payload.newPassword = parameter.newPassword;
      if (parameter.identifier) payload.identifier = parameter.identifier;
      if (parameter.password) payload.password = parameter.password;
      if (parameter.user) {
        try {
          payload.user = typeof parameter.user === 'string' ? JSON.parse(parameter.user) : parameter.user;
        } catch (e) {}
      }
      if (parameter.users) {
        try {
          payload.users = typeof parameter.users === 'string' ? JSON.parse(parameter.users) : parameter.users;
        } catch (e) {}
      }

      return handleAdminAction(payload);
    }

    // Default status jika diakses langsung lewat browser
    return jsonResponse({
      success: true,
      service: "FahKeu Admin User Management & Auth Service",
      status: "online",
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// POST REQUEST HANDLER (doPost)
// ----------------------------------------------------------------------------
function doPost(e) {
  try {
    e = e || {};
    var payload = null;

    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        Logger.log("Parse postData err: " + parseErr.toString());
      }
    }

    if (!payload && e.parameter) {
      payload = e.parameter;
      if (payload.data && typeof payload.data === 'string') {
        try {
          payload = Object.assign({}, payload, JSON.parse(payload.data));
        } catch(err) {}
      }
    }

    if (!payload) {
      return jsonResponse({ success: false, error: "Tidak ada payload yang diterima" });
    }

    return handleAdminAction(payload);

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER AKSI DATABASE ADMIN (USERS & SETTINGS)
// ----------------------------------------------------------------------------
function handleAdminAction(payload) {
  try {
    var userSheet = getOrCreateUsersSheet();
    var settingsSheet = getOrCreateSettingsSheet();
    var action = payload.action;

    // A. PENGATURAN (SETTINGS)
    if (action === 'get_settings') {
      return jsonResponse({ success: true, settings: getAllSettings() });
    }

    if (action === 'save_setting') {
      var keyName = payload.key || (payload.data ? payload.data.key : '');
      var keyValue = payload.value !== undefined ? payload.value : '';
      var keyDesc = payload.description || payload.keterangan || '';
      if (!keyName) return jsonResponse({ success: false, error: "Key wajib diisi" });
      setSettingValue(keyName, keyValue, keyDesc);
      return jsonResponse({ success: true, message: "Pengaturan berhasil disimpan", key: keyName, value: keyValue });
    }

    if (action === 'save_settings') {
      var setsMap = payload.settings || {};
      if (payload.googleClientId !== undefined) setsMap['GOOGLE_CLIENT_ID'] = payload.googleClientId;
      for (var sKey in setsMap) {
        if (setsMap.hasOwnProperty(sKey)) {
          setSettingValue(sKey, setsMap[sKey]);
        }
      }
      return jsonResponse({ success: true, message: "Pengaturan berhasil diperbarui" });
    }

    // B. PENDAFTARAN PENGGUNA (REGISTER)
    if (action === 'register') {
      var u = payload.user || payload;
      if (!u || !u.username || !u.password) {
        return jsonResponse({ success: false, error: "Data pendaftaran tidak lengkap" });
      }

      var uRows = userSheet.getDataRange().getValues();
      var cleanEmail = (u.email || '').toLowerCase().trim();
      var cleanUser = (u.username || '').toLowerCase().trim();

      for (var r = 1; r < uRows.length; r++) {
        var existingEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
        var existingUsername = (uRows[r][3] || '').toString().toLowerCase().trim();
        if (existingEmail && existingEmail === cleanEmail) {
          return jsonResponse({ success: false, error: "Email sudah terdaftar" });
        }
        if (existingUsername && existingUsername === cleanUser) {
          return jsonResponse({ success: false, error: "Username sudah digunakan orang lain" });
        }
      }

      var newUserId = u.id || ('usr_' + new Date().getTime());
      var newName = u.name || u.username;
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
        newStatus,
        u.googleSheetUrl || '',
        u.telegramBotToken || '',
        u.telegramChatId || ''
      ]);

      return jsonResponse({
        success: true,
        message: "Pengguna berhasil didaftarkan di database Admin",
        user: {
          id: newUserId,
          name: newName,
          email: cleanEmail,
          username: cleanUser,
          role: newRole,
          createdAt: newDate,
          status: newStatus,
          googleSheetUrl: u.googleSheetUrl || '',
          telegramBotToken: u.telegramBotToken || '',
          telegramChatId: u.telegramChatId || ''
        }
      });
    }

    // C. LOGIN USER
    if (action === 'login') {
      var identifier = (payload.identifier || '').toLowerCase().trim();
      var pass = payload.password || '';
      if (!identifier || !pass) return jsonResponse({ success: false, error: "Username dan kata sandi wajib diisi" });

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        var row = uRows[r];
        var rowEmail = (row[2] || '').toString().toLowerCase().trim();
        var rowUser = (row[3] || '').toString().toLowerCase().trim();
        var rowPass = (row[4] || '').toString();
        var rowStatus = (row[7] || '').toString().toLowerCase();

        if (rowEmail === identifier || rowUser === identifier) {
          if (rowStatus === 'suspended') {
            return jsonResponse({ success: false, error: "Akun Anda dinonaktifkan oleh Administrator" });
          }
          if (rowPass === pass) {
            return jsonResponse({
              success: true,
              user: {
                id: row[0].toString(),
                name: row[1].toString(),
                email: row[2].toString(),
                username: row[3].toString(),
                role: row[5].toString(),
                createdAt: row[6].toString(),
                status: row[7].toString(),
                googleSheetUrl: row[8] ? row[8].toString() : '',
                telegramBotToken: row[9] ? row[9].toString() : '',
                telegramChatId: row[10] ? row[10].toString() : ''
              }
            });
          } else {
            return jsonResponse({ success: false, error: "Kata sandi salah" });
          }
        }
      }
      return jsonResponse({ success: false, error: "Pengguna tidak ditemukan" });
    }

    // D. RESET PASSWORD
    if (action === 'reset_password') {
      var emailTarget = (payload.email || '').toLowerCase().trim();
      var newPass = payload.newPassword || '';
      if (!emailTarget || !newPass) return jsonResponse({ success: false, error: "Email dan kata sandi baru wajib diisi" });

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        var rowEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
        if (rowEmail === emailTarget) {
          userSheet.getRange(r + 1, 5).setValue(newPass);
          return jsonResponse({ success: true, message: "Kata sandi berhasil diperbarui" });
        }
      }
      return jsonResponse({ success: false, error: "Akun dengan email tersebut tidak ditemukan" });
    }

    // E. UPDATE USER (ADMIN)
    if (action === 'update_user') {
      var u = payload.user || payload;
      if (!u || !u.id) return jsonResponse({ success: false, error: "ID pengguna diperlukan" });

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0].toString() === u.id.toString()) {
          var rowNum = r + 1;
          if (u.name) userSheet.getRange(rowNum, 2).setValue(u.name);
          if (u.email) userSheet.getRange(rowNum, 3).setValue(u.email);
          if (u.username) userSheet.getRange(rowNum, 4).setValue(u.username);
          if (u.password) userSheet.getRange(rowNum, 5).setValue(u.password);
          if (u.role) userSheet.getRange(rowNum, 6).setValue(u.role);
          if (u.status) userSheet.getRange(rowNum, 8).setValue(u.status);
          if (u.googleSheetUrl !== undefined) userSheet.getRange(rowNum, 9).setValue(u.googleSheetUrl || '');
          if (u.telegramBotToken !== undefined) userSheet.getRange(rowNum, 10).setValue(u.telegramBotToken || '');
          if (u.telegramChatId !== undefined) userSheet.getRange(rowNum, 11).setValue(u.telegramChatId || '');
          return jsonResponse({ success: true, message: "Data pengguna berhasil diperbarui" });
        }
      }
      return jsonResponse({ success: false, error: "Pengguna tidak ditemukan" });
    }

    // F. DELETE USER (ADMIN)
    if (action === 'delete_user') {
      var targetId = payload.userId || payload.id;
      if (!targetId) return jsonResponse({ success: false, error: "ID pengguna diperlukan" });

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0].toString() === targetId.toString()) {
          userSheet.deleteRow(r + 1);
          return jsonResponse({ success: true, message: "Pengguna berhasil dihapus" });
        }
      }
      return jsonResponse({ success: false, error: "Pengguna tidak ditemukan" });
    }

    // G. SINKRONISASI MASSAL PENGGUNA (SYNC ALL USERS)
    if (action === 'sync_all_users') {
      var allUsers = payload.users || [];
      if (!Array.isArray(allUsers) || allUsers.length === 0) {
        return jsonResponse({ success: false, error: "Tidak ada data pengguna" });
      }

      var uRows = userSheet.getDataRange().getValues();
      var existingMap = {};
      for (var r = 1; r < uRows.length; r++) {
        var id = uRows[r][0] ? uRows[r][0].toString() : '';
        if (id) existingMap[id] = r + 1; // baris di spreadsheet
      }

      for (var i = 0; i < allUsers.length; i++) {
        var cur = allUsers[i];
        if (!cur.id) continue;

        if (existingMap[cur.id]) {
          var rowN = existingMap[cur.id];
          userSheet.getRange(rowN, 2).setValue(cur.name || '');
          userSheet.getRange(rowN, 3).setValue(cur.email || '');
          userSheet.getRange(rowN, 4).setValue(cur.username || '');
          if (cur.password) userSheet.getRange(rowN, 5).setValue(cur.password);
          userSheet.getRange(rowN, 6).setValue(cur.role || 'user');
          userSheet.getRange(rowN, 8).setValue(cur.status || 'active');
          if (cur.googleSheetUrl !== undefined) userSheet.getRange(rowN, 9).setValue(cur.googleSheetUrl || '');
          if (cur.telegramBotToken !== undefined) userSheet.getRange(rowN, 10).setValue(cur.telegramBotToken || '');
          if (cur.telegramChatId !== undefined) userSheet.getRange(rowN, 11).setValue(cur.telegramChatId || '');
        } else {
          userSheet.appendRow([
            cur.id,
            cur.name || '',
            cur.email || '',
            cur.username || '',
            cur.password || '',
            cur.role || 'user',
            cur.createdAt || new Date().toISOString(),
            cur.status || 'active',
            cur.googleSheetUrl || '',
            cur.telegramBotToken || '',
            cur.telegramChatId || ''
          ]);
        }
      }

      return jsonResponse({ success: true, message: "Seluruh pengguna berhasil disinkronkan ke database Admin" });
    }

    // H. UPDATE KREDENSIAL PRIVAT PENGGUNA (Spreadsheet Transaksi & Bot Telegram)
    if (action === 'update_user_credentials') {
      var u = payload.user || payload;
      if (!u || !u.id) return jsonResponse({ success: false, error: "ID pengguna diperlukan" });

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0].toString() === u.id.toString()) {
          var rowNum = r + 1;
          if (u.name && !uRows[r][1]) userSheet.getRange(rowNum, 2).setValue(u.name);
          if (u.email && !uRows[r][2]) userSheet.getRange(rowNum, 3).setValue(u.email);
          if (u.username && !uRows[r][3]) userSheet.getRange(rowNum, 4).setValue(u.username);
          if (u.googleSheetUrl !== undefined) userSheet.getRange(rowNum, 9).setValue(u.googleSheetUrl || '');
          if (u.telegramBotToken !== undefined) userSheet.getRange(rowNum, 10).setValue(u.telegramBotToken || '');
          if (u.telegramChatId !== undefined) userSheet.getRange(rowNum, 11).setValue(u.telegramChatId || '');
          return jsonResponse({ success: true, message: "Kredensial pengguna berhasil diperbarui di spreadsheet Admin" });
        }
      }

      // Jika user belum terdaftar di sheet Admin, otomatis daftarkan agar data tidak hilang!
      userSheet.appendRow([
        u.id,
        u.name || u.username || 'Pengguna',
        u.email || '',
        u.username || ('user_' + u.id),
        u.password || '',
        u.role || 'user',
        new Date().toISOString(),
        'active',
        u.googleSheetUrl || '',
        u.telegramBotToken || '',
        u.telegramChatId || ''
      ]);

      return jsonResponse({ success: true, message: "Akun dan kredensial pengguna baru berhasil ditambahkan ke spreadsheet Admin" });
    }

    // I. UPDATE PROFIL MANDIRI PENGGUNA
    if (action === 'update_profile') {
      var uId = payload.userId || payload.id;
      var cleanEmail = (payload.email || '').toLowerCase().trim();
      var newUsername = (payload.newUsername || '').toLowerCase().trim();
      var newPass = payload.newPassword;

      var uRows = userSheet.getDataRange().getValues();
      for (var r = 1; r < uRows.length; r++) {
        if (uRows[r][0].toString() === uId.toString()) {
          var existingEmail = (uRows[r][2] || '').toString().toLowerCase().trim();
          if (existingEmail !== cleanEmail) {
            return jsonResponse({ success: false, error: "Email verifikasi tidak cocok" });
          }
          userSheet.getRange(r + 1, 4).setValue(newUsername);
          if (newPass) userSheet.getRange(r + 1, 5).setValue(newPass);
          return jsonResponse({ success: true, message: "Profil berhasil diperbarui" });
        }
      }
      return jsonResponse({ success: false, error: "Pengguna tidak ditemukan" });
    }

    return jsonResponse({ success: false, error: "Aksi tidak dikenali: " + action });

  } catch (e) {
    Logger.log("handleAdminAction err: " + e.toString());
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// ----------------------------------------------------------------------------
// STRUKTUR TABEL & HELPER FUNCTIONS
// ----------------------------------------------------------------------------
function getOrCreateUsersSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(USER_SHEET_NAME);
  var fullHeaders = [
    ["User_ID", "Nama", "Email", "Username", "Password", "Role", "Tanggal_Daftar", "Status", "GoogleSheetUrl", "TelegramToken", "TelegramChatId"]
  ];
  if (!sheet) {
    sheet = ss.insertSheet(USER_SHEET_NAME);
    sheet.getRange(1, 1, 1, fullHeaders[0].length).setValues(fullHeaders);
    sheet.getRange(1, 1, 1, fullHeaders[0].length)
      .setBackground("#1E1B4B")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
    
    // Tambahkan admin bawaan jika kosong
    sheet.appendRow([
      "usr_admin_01",
      "Administrator Utama",
      "admin@fahkeu.id",
      "admin",
      "admin123",
      "admin",
      new Date().toISOString(),
      "active",
      "",
      "",
      ""
    ]);
  } else {
    // Jika lembar sudah ada, pastikan kolom 9, 10, 11 terpasang
    var lastCol = sheet.getLastColumn();
    if (lastCol < 11) {
      sheet.getRange(1, 1, 1, fullHeaders[0].length).setValues(fullHeaders);
      sheet.getRange(1, 1, 1, fullHeaders[0].length)
        .setBackground("#1E1B4B")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold")
        .setHorizontalAlignment("center");
    }
  }
  return sheet;
}

function getOrCreateSettingsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET_NAME);
    var headers = [["Key", "Value", "Keterangan", "Terakhir_Diperbarui"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length)
      .setBackground("#064E3B")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
    sheet.setFrozenRows(1);

    // Kunci konfigurasi standar
    sheet.appendRow(["GOOGLE_CLIENT_ID", "", "OAuth 2.0 Web Client ID untuk tombol Masuk dengan Google", new Date().toISOString()]);
    sheet.appendRow(["APP_NAME", "FahKeu Multi-User", "Nama aplikasi", new Date().toISOString()]);
  }
  return sheet;
}

function getAllSettings() {
  var sheet = getOrCreateSettingsSheet();
  var rows = sheet.getDataRange().getValues();
  var settings = {};
  for (var i = 1; i < rows.length; i++) {
    var key = rows[i][0] ? rows[i][0].toString().trim() : '';
    if (key) {
      settings[key] = rows[i][1] !== undefined ? rows[i][1].toString() : '';
    }
  }
  return settings;
}

function getSettingValue(keyName) {
  var all = getAllSettings();
  return all[keyName] || '';
}

function setSettingValue(keyName, val, desc) {
  var sheet = getOrCreateSettingsSheet();
  var rows = sheet.getDataRange().getValues();
  var cleanKey = (keyName || '').toString().trim();
  if (!cleanKey) return;

  var updatedTime = new Date().toISOString();
  for (var i = 1; i < rows.length; i++) {
    var currentKey = rows[i][0] ? rows[i][0].toString().trim() : '';
    if (currentKey === cleanKey) {
      sheet.getRange(i + 1, 2).setValue(val);
      if (desc) sheet.getRange(i + 1, 3).setValue(desc);
      sheet.getRange(i + 1, 4).setValue(updatedTime);
      return;
    }
  }

  sheet.appendRow([cleanKey, val, desc || '', updatedTime]);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------
// MENU ACTIONS
// ----------------------------------------------------------------------------
function menuOpenUsersSheet() {
  var sheet = getOrCreateUsersSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function menuOpenSettingsSheet() {
  var sheet = getOrCreateSettingsSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function menuConfigureGoogleClientId() {
  var ui = SpreadsheetApp.getUi();
  var currentVal = getSettingValue('GOOGLE_CLIENT_ID');
  var promptMsg = "Masukkan Google OAuth 2.0 Web Client ID (akhiran .apps.googleusercontent.com):";
  if (currentVal) promptMsg += "\\n\\nNilai saat ini:\\n" + currentVal;

  var response = ui.prompt('🔑 Konfigurasi Google Auth Client ID', promptMsg, ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() == ui.Button.OK) {
    var inputVal = response.getResponseText().trim();
    setSettingValue('GOOGLE_CLIENT_ID', inputVal, 'OAuth 2.0 Web Client ID untuk tombol Masuk dengan Google');
    ui.alert('✅ Berhasil', 'Google Client ID berhasil disimpan di lembar Settings!', ui.ButtonSet.OK);
  }
}

function menuSyncSheets() {
  getOrCreateUsersSheet();
  getOrCreateSettingsSheet();
  SpreadsheetApp.getUi().alert('✅ Berhasil', 'Seluruh lembar Admin (Users & Settings) berhasil disinkronkan!', SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuShowSystemStatus() {
  var uSheet = getOrCreateUsersSheet();
  var sSheet = getOrCreateSettingsSheet();
  var googleId = getSettingValue('GOOGLE_CLIENT_ID');
  var msg = "Status Database Admin:\\n" +
            "• Total Akun Pengguna: " + (uSheet.getLastRow() - 1) + "\\n" +
            "• Total Pengaturan: " + (sSheet.getLastRow() - 1) + "\\n" +
            "• Google Auth ID: " + (googleId ? "Aktif (" + googleId.substring(0, 15) + "...)" : "Belum diisi");
  SpreadsheetApp.getUi().alert('ℹ️ Status Database Admin', msg, SpreadsheetApp.getUi().ButtonSet.OK);
}
`;
