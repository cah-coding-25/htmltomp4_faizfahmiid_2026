/**
 * Google Apps Script Khusus Pencatat Keuangan & Bot Telegram (Code.gs Keuangan 24 Jam)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis
 * Standar Rekayasa Internasional: Respon Instan (< 500ms), Anti-Timeout, Anti-Queue Lag.
 */

export const GOOGLE_APPS_SCRIPT_FINANCE_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - KHUSUS PENCATAT KEUANGAN & BOT TELEGRAM 24 JAM (Code.gs)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis (100% GRATIS & NONSTOP)
 * ============================================================================
 * 
 * 🚨 PANDUAN PENTING DEPLOYMENT (AGAR TIDAK LEMOT & SELALU TERUPDATE):
 * 1. Saat pertama kali:
 *    Klik "Terapkan" (Deploy) > "Deployment Baru" (New Deployment).
 *    Jenis: "Aplikasi Web" (Web App).
 *    Jalankan sebagai: "Saya" (Me).
 *    Yang memiliki akses: "SIAPA SAJA" (ANYONE) -> WAJIB agar Telegram bisa mengirim pesan!
 * 
 * 2. RAHASIA BESAR APPS SCRIPT: JIKA ANDA MENGEDIT KODE INI:
 *    Hanya klik "Simpan" (Ctrl+S) TIDAK MENGUPDATE Web App yang aktif!
 *    Anda WAJIB klik:
 *    "Terapkan" (Deploy) > "Kelola Penerapan" (Manage deployments) >
 *    Klik ikon PENSIL (Edit) > Pada dropdown Versi: pilih "VERSI BARU" (New version) >
 *    Klik "Terapkan" (Deploy).
 *    Inilah alasan kenapa selama bertahun-tahun bot Apps Script terasa macet atau
 *    masih menjalankan kode lama jika tidak membuat "Versi Baru".
 * 
 * ============================================================================
 */

// Token Bot Telegram bawaan (Otomatis terisi jika Anda salin dari Website)
var TELEGRAM_BOT_TOKEN = ""; 

// Chat ID bawaan (Opsional - otomatis terdeteksi saat pertama kali chat bot)
var DEFAULT_CHAT_ID = "";

var TX_SHEET_NAME = "Transactions";
var CONFIG_SHEET_NAME = "Config";
var DRAFT_SHEET_NAME = "ReceiptDrafts";

/**
 * Menu Kustom di Google Spreadsheet:
 * Otomatis muncul di bar atas saat spreadsheet dibuka.
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('📊 Keuangan FahKeu')
      .addItem('⚡ 1. Aktifkan Webhook Bot 24 Jam Otomatis', 'menuSetupWebhook24Jam')
      .addItem('🧹 2. Bersihkan Antrean Macet (Drop Pending)', 'menuClearPendingUpdates')
      .addItem('🤖 3. Cek Status Webhook Telegram Riil', 'menuShowTelegramStatus')
      .addItem('🧪 4. Uji Coba Kirim Pesan ke Bot', 'menuTestTelegramMessage')
      .addSeparator()
      .addItem('📋 5. Buka Lembar Transaksi', 'menuOpenTxSheet')
      .addItem('📈 6. Rekap Saldo Kas Mutakhir', 'menuShowBalanceSummary')
      .addItem('⚙️ 7. Atur Token Bot & Chat ID Manual', 'menuSetTelegramConfig')
      .addSeparator()
      .addItem('ℹ️ 8. Panduan Deployment Apps Script', 'menuShowDeploymentGuide')
      .addToUi();
  } catch (e) {
    Logger.log("onOpen error: " + e.toString());
  }
}

/**
 * Pasang Webhook Bot Telegram 24 Jam Otomatis langsung dari Google Spreadsheet (1-Klik)
 */
function menuSetupWebhook24Jam() {
  var ui = SpreadsheetApp.getUi();
  var token = getEffectiveBotToken();
  if (!token) {
    var prompt = ui.prompt('⚡ Pengaturan Webhook Bot 24 Jam', 'Masukkan Token Bot dari @BotFather:', ui.ButtonSet.OK_CANCEL);
    if (prompt.getSelectedButton() == ui.Button.OK) {
      token = prompt.getResponseText().trim();
      if (token) {
        handleSetupTelegram({ token: token });
      } else {
        ui.alert('Token tidak boleh kosong.');
        return;
      }
    } else {
      return;
    }
  }

  var webAppUrl = ScriptApp.getService().getUrl();
  if (!webAppUrl) {
    var urlPrompt = ui.prompt(
      '⚡ Masukkan URL Web App Apps Script',
      'Belum mendeteksi URL Web App otomatis.\\nJika sudah deploy: Buka Terapkan > Kelola Deployment > Salin URL Web App (berakhiran /exec):',
      ui.ButtonSet.OK_CANCEL
    );
    if (urlPrompt.getSelectedButton() == ui.Button.OK) {
      webAppUrl = urlPrompt.getResponseText().trim();
    } else {
      ui.alert(
        'Petunjuk Deploy Web App:',
        '1. Klik tombol biru "Terapkan" (Deploy) di kanan atas.\\n' +
        '2. Pilih "Deployment baru" > pilih ikon roda gigi "Aplikasi Web".\\n' +
        '3. Atur "Yang memiliki akses" = "Siapa saja" (Anyone).\\n' +
        '4. Klik "Terapkan" lalu jalankan menu ini kembali.',
        ui.ButtonSet.OK
      );
      return;
    }
  }

  var result = registerTelegramWebhookWithToken(token, webAppUrl);
  if (result.success) {
    ui.alert(
      '🎉 Webhook 24 Jam Berhasil Diaktifkan!',
      'Bot Telegram Anda kini terhubung 100% langsung ke Google Apps Script 24 jam nonstop gratis!\\n\\nTarget URL:\\n' + webAppUrl + '\\n\\nSilakan buka bot Anda di Telegram dan ketik /start atau coba ketik: "beli bakso 25k".',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('⚠️ Gagal Mendaftarkan Webhook: ' + result.message);
  }
}

/**
 * Bersihkan Antrean Pesan yang Tertahan di Telegram (Drop Pending Updates)
 */
function menuClearPendingUpdates() {
  var ui = SpreadsheetApp.getUi();
  var token = getEffectiveBotToken();
  if (!token) {
    ui.alert('⚠️ Token bot belum diatur.');
    return;
  }
  var url = ScriptApp.getService().getUrl() || getConfigValue('WEBHOOK_URL');
  var res = registerTelegramWebhookWithToken(token, url);
  if (res.success) {
    ui.alert(
      '🧹 Antrean Berhasil Dibersihkan!',
      'Seluruh antrean pesan tertunda di server Telegram telah dibersihkan bersih (drop_pending_updates: true) dan webhook telah disegarkan!\\n\\nBot Anda kini kembali cepat dan bebas lemot.',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('⚠️ Hasil:', res.message, ui.ButtonSet.OK);
  }
}

/**
 * Uji Coba Kirim Pesan Langsung dari Spreadsheet
 */
function menuTestTelegramMessage() {
  var ui = SpreadsheetApp.getUi();
  var token = getEffectiveBotToken();
  var chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
  if (!token || !chatId) {
    ui.alert('⚠️ Token atau Chat ID belum ada. Pastikan sudah klik /start di bot Telegram Anda.');
    return;
  }
  try {
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: chatId,
        text: "🧪 <b>Tes Koneksi Google Spreadsheet Berhasil!</b>\\n" +
              "Bot Telegram Anda 100% responsif & aktif 24 jam nonstop terhubung langsung ke Google Sheets.",
        parse_mode: "HTML"
      }),
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    if (d.ok) {
      ui.alert('✅ Tes Berhasil!', 'Pesan uji coba berhasil terkirim ke Telegram Anda!', ui.ButtonSet.OK);
    } else {
      ui.alert('⚠️ Telegram menolak pesan: ' + d.description);
    }
  } catch (err) {
    ui.alert('⚠️ Gagal mengirim: ' + err.toString());
  }
}

function menuShowDeploymentGuide() {
  SpreadsheetApp.getUi().alert(
    '💡 Rahasia Update Kode Apps Script',
    'Jika Anda baru saja mengganti kode di Editor Apps Script:\\n\\n' +
    '1. Klik "Terapkan" (Deploy) di kanan atas.\\n' +
    '2. Pilih "Kelola Penerapan" (Manage Deployments).\\n' +
    '3. Klik ikon PENSIL (Edit) pada deployment aktif.\\n' +
    '4. Pada pilihan Versi (Version), klik dan pilih "VERSI BARU" (New Version).\\n' +
    '5. Klik "Terapkan" (Deploy).\\n\\n' +
    'PENTING: Jangan hanya klik Simpan (Ctrl+S), karena Web App tidak akan memperbarui kodenya tanpa membuat Versi Baru!',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function registerTelegramWebhookWithToken(token, webAppUrl) {
  try {
    if (!token || !webAppUrl) return { success: false, message: "Token atau URL Web App kosong." };
    var cleanToken = token.trim();
    var cleanUrl = webAppUrl.trim();
    var targetWebhookUrl = cleanUrl + (cleanUrl.indexOf('?') !== -1 ? '&' : '?') + 'token=' + encodeURIComponent(cleanToken);

    // 1. Bersihkan antrean pending updates pada token baru
    try {
      UrlFetchApp.fetch("https://api.telegram.org/bot" + cleanToken + "/deleteWebhook?drop_pending_updates=true", { muteHttpExceptions: true });
    } catch (cleanErr) {}

    // 2. Verifikasi token bot via getMe
    var meRes = UrlFetchApp.fetch("https://api.telegram.org/bot" + cleanToken + "/getMe", { muteHttpExceptions: true });
    var meData = JSON.parse(meRes.getContentText());
    if (!meData.ok) {
      return { success: false, message: "Token ditolak oleh Telegram: " + (meData.description || "Token tidak valid") };
    }

    // 3. Pasang Webhook langsung ke URL Google Apps Script dengan drop_pending_updates: true
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + cleanToken + "/setWebhook", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        url: targetWebhookUrl,
        drop_pending_updates: true,
        allowed_updates: ["message", "edited_message", "callback_query", "channel_post"]
      }),
      muteHttpExceptions: true
    });

    var data = JSON.parse(res.getContentText());
    if (data.ok) {
      PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', cleanToken);
      setConfigValue('TELEGRAM_BOT_TOKEN', cleanToken);
      setConfigValue('WEBHOOK_URL', targetWebhookUrl);

      // Kirim pesan sambutan jika Chat ID sudah tersedia
      var currentChatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
      if (currentChatId) {
        try {
          var welcomeNotice = "⚡ <b>Koneksi Bot Telegram 24 Jam Aktif!</b>\\n" +
                              "───────────────────────────\\n" +
                              "🤖 <b>Bot:</b> @" + (meData.result ? meData.result.username : 'bot') + "\\n" +
                              "☁️ <b>Server:</b> Google Apps Script (Cloud Google)\\n" +
                              "⚡ <b>Mode:</b> Realtime 24/7 Jam Non-Stop Gratis\\n" +
                              "───────────────────────────\\n" +
                              "Ketik contoh: <code>beli kopi 15k</code> atau <b>/saldo</b> untuk memulai!";
          sendTelegramMessage(currentChatId, welcomeNotice, cleanToken);
        } catch (msgErr) {}
      }

      return {
        success: true,
        message: "Webhook 24 Jam berhasil diaktifkan untuk @" + (meData.result ? meData.result.username : 'bot'),
        bot: meData.result,
        webhookUrl: targetWebhookUrl
      };
    } else {
      return { success: false, message: data.description || "Gagal mengatur webhook di Telegram" };
    }
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ----------------------------------------------------------------------------
// GET REQUEST HANDLER (doGet)
// ----------------------------------------------------------------------------
function doGet(e) {
  try {
    e = e || {};
    var action = extractQueryParam(e, 'action') || (e.parameter ? e.parameter.action : '');

    // Diagnostik Webhook Telegram
    if (action === 'check_webhook' || action === 'webhook_status') {
      var botToken = getEffectiveBotToken(e);
      if (!botToken) {
        return jsonResponse({ success: false, message: "Token bot belum diatur." });
      }
      try {
        var infoRes = UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/getWebhookInfo", { muteHttpExceptions: true });
        var infoData = JSON.parse(infoRes.getContentText());
        return jsonResponse(infoData);
      } catch (errTg) {
        return jsonResponse({ success: false, error: errTg.toString() });
      }
    }

    // Ping / Test Koneksi Super Cepat
    if (action === 'ping' || action === 'test' || !action) {
      return jsonResponse({
        success: true,
        status: "online",
        message: "Google Apps Script FahKeu Aktif 24 Jam Non-Stop!",
        timestamp: new Date().toISOString(),
        hasBotToken: Boolean(getEffectiveBotToken(e))
      });
    }

    // Ambil Chat ID
    if (action === 'get_chat_id' || action === 'chat_id') {
      var activeChatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
      var activeUsername = PropertiesService.getScriptProperties().getProperty('TELEGRAM_USERNAME') || getConfigValue('TELEGRAM_USERNAME') || '';
      return jsonResponse({
        success: Boolean(activeChatId),
        chatId: activeChatId,
        username: activeUsername
      });
    }

    // Ambil Data Transaksi
    var sheet = getOrCreateTxSheet();
    var targetUserId = extractQueryParam(e, 'userId') || (e.parameter ? e.parameter.userId : '');
    var targetUsername = extractQueryParam(e, 'username') || (e.parameter ? e.parameter.username : '');
    var rows = sheet.getDataRange().getValues();
    var transactions = [];

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0] || row[0].toString().trim() === '') continue;

      var txUserId = row[7] ? row[7].toString().trim() : '';
      var txUsername = row[8] ? row[8].toString().trim() : '';
      var txSource = row[6] ? row[6].toString().toLowerCase().trim() : '';

      if (targetUserId && targetUserId !== 'all') {
        var isMatch = (txUserId === targetUserId) || 
                      (targetUsername && txUsername === targetUsername) ||
                      (txSource === 'telegram' || txSource.indexOf('telegram') !== -1) ||
                      (!txUserId && !txUsername);
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
        type: row[2] ? row[2].toString().toLowerCase() : 'pengeluaran',
        amount: Number(row[3]) || 0,
        description: row[4] ? row[4].toString() : '',
        category: row[5] ? row[5].toString() : 'Lainnya',
        source: row[6] ? row[6].toString() : 'web',
        userId: txUserId || targetUserId,
        username: row[8] ? row[8].toString() : targetUsername
      });
    }

    transactions.sort(function(a, b) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    var summary = getFastCachedSummary();

    return jsonResponse({
      success: true,
      data: transactions,
      total: transactions.length,
      balance: summary.balance,
      totalIncome: summary.totalIncome,
      totalExpense: summary.totalExpense
    });

  } catch (err) {
    Logger.log("doGet error: " + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// POST REQUEST HANDLER (doPost) - SUPER RESPONSIF & ANTI-TIMEOUT
// ----------------------------------------------------------------------------
function doPost(e) {
  try {
    e = e || {};
    var postData = null;

    if (e.postData && e.postData.contents) {
      try { postData = JSON.parse(e.postData.contents); } catch (parseErr) {}
    }

    if (!postData && e.parameter) {
      postData = e.parameter;
      if (postData.data && typeof postData.data === 'string') {
        try { postData = Object.assign({}, postData, JSON.parse(postData.data)); } catch(err) {}
      }
    }

    // A. WEBHOOK TELEGRAM REALTIME (Pesan, Foto, Callback Button)
    if (postData && (postData.message || postData.channel_post || postData.edited_message || postData.callback_query)) {
      return handleTelegramWebhook(postData, e);
    }

    // B. SETUP TELEGRAM DARI WEBSITE
    if (postData && (postData.action === 'setup_telegram' || postData.action === 'setupTelegram')) {
      return handleSetupTelegram(postData);
    }

    if (postData && postData.action === 'set_webhook') {
      var currentUrl = postData.url || ScriptApp.getService().getUrl();
      var botToken = postData.token || getEffectiveBotToken(e);
      return jsonResponse(registerTelegramWebhookWithToken(botToken, currentUrl));
    }

    // C. AKSI TRANSAKSI DARI WEBSITE
    if (postData && postData.action) {
      return handleTxAction(postData);
    }

    return jsonResponse({ success: false, error: "Payload tidak valid atau kosong" });

  } catch (err) {
    Logger.log("doPost error: " + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER KONFIGURASI BOT TELEGRAM
// ----------------------------------------------------------------------------
function handleSetupTelegram(params) {
  try {
    var token = (params.token || params.botToken || params.telegramBotToken || '').trim();
    var chatId = (params.chatId || params.telegramChatId || '').trim();
    var userId = (params.userId || '').trim();
    var username = (params.username || '').trim();

    if (token) {
      PropertiesService.getScriptProperties().setProperty('TELEGRAM_BOT_TOKEN', token);
      setConfigValue('TELEGRAM_BOT_TOKEN', token);
    }
    if (chatId) {
      PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', chatId);
      setConfigValue('TELEGRAM_CHAT_ID', chatId);
    }
    if (userId) {
      PropertiesService.getScriptProperties().setProperty('USER_ID', userId);
      setConfigValue('USER_ID', userId);
    }
    if (username) {
      PropertiesService.getScriptProperties().setProperty('USERNAME', username);
      setConfigValue('USERNAME', username);
    }

    return jsonResponse({
      success: true,
      message: "Konfigurasi Bot Telegram berhasil disimpan di Google Apps Script!",
      configured: {
        token: Boolean(token),
        chatId: chatId,
        userId: userId,
        username: username
      }
    });
  } catch (e) {
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER TRANSAKSI DARI WEBSITE
// ----------------------------------------------------------------------------
function handleTxAction(payload) {
  var action = (payload.action || '').toLowerCase();
  var sheet = getOrCreateTxSheet();

  try {
    // 1. Tambah Transaksi Tunggal
    if (action === 'create' || action === 'add' || action === 'insert') {
      var tx = payload.transaction || payload;
      var newId = tx.id || ('tx_' + new Date().getTime());
      var dateStr = tx.date ? (tx.date instanceof Date ? tx.date.toISOString() : tx.date.toString()) : new Date().toISOString();
      var type = (tx.type || 'pengeluaran').toLowerCase();
      var amount = Number(tx.amount) || 0;
      var desc = tx.description || 'Transaksi';
      var cat = tx.category || 'Lainnya';
      var source = tx.source || 'web';
      var userId = tx.userId || payload.userId || '';
      var username = tx.username || payload.username || '';

      var lock = LockService.getScriptLock();
      var hasLock = false;
      try {
        hasLock = lock.tryLock(1500);
        sheet.appendRow([newId, dateStr, type, amount, desc, cat, source, userId, username]);
      } finally {
        if (hasLock) lock.releaseLock();
      }

      updateFastCachedSummary(type, amount);

      return jsonResponse({
        success: true,
        message: "Transaksi berhasil dicatat ke Google Spreadsheet",
        id: newId
      });
    }

    // 2. Batch Tambah Transaksi
    if (action === 'batch' || action === 'batch_insert' || action === 'sync') {
      var txList = payload.transactions || payload.data || [];
      if (!Array.isArray(txList) || txList.length === 0) {
        return jsonResponse({ success: true, message: "Tidak ada transaksi untuk disinkronkan", addedCount: 0 });
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
        if (existingIdSet[item.id.toString()]) continue;

        var bId = item.id;
        var bDate = item.date ? (item.date instanceof Date ? item.date.toISOString() : item.date.toString()) : new Date().toISOString();
        var bType = (item.type || 'pengeluaran').toLowerCase();
        var bAmount = Number(item.amount) || 0;
        var bDesc = item.description || 'Transaksi';
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

      invalidateFastCachedSummary();

      return jsonResponse({
        success: true,
        message: "Berhasil menambahkan " + addedCount + " transaksi ke Google Spreadsheet",
        addedCount: addedCount
      });
    }

    // 3. Hapus Transaksi (Delete)
    if (action === 'delete') {
      var targetId = payload.id || (payload.transaction ? payload.transaction.id : '');
      if (!targetId) return jsonResponse({ success: false, error: "ID transaksi diperlukan" });

      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === targetId.toString()) {
          sheet.deleteRow(i + 1);
          invalidateFastCachedSummary();
          return jsonResponse({ success: true, message: "Transaksi berhasil dihapus" });
        }
      }
      return jsonResponse({ success: false, error: "Transaksi tidak ditemukan" });
    }

    // 4. Kosongkan Transaksi (Clear - Reset ke Rp 0)
    if (action === 'clear') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      invalidateFastCachedSummary();
      return jsonResponse({ success: true, message: "Seluruh data transaksi berhasil dikosongkan (Reset Rp 0)" });
    }

    return jsonResponse({ success: false, error: "Aksi tidak dikenal: " + action });

  } catch (e) {
    Logger.log("handleTxAction err: " + e.toString());
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER WEBHOOK BOT TELEGRAM 24 JAM (RESPON KILAT < 500MS)
// ----------------------------------------------------------------------------
function handleTelegramWebhook(update, rawEvent) {
  try {
    update = update || {};
    var webhookStartTime = new Date().getTime();

    // 1. Anti-Spam deduplikasi update_id instan
    var updateId = update.update_id;
    if (updateId) {
      try {
        var cache = CacheService.getScriptCache();
        var cacheKey = "tg_upd_" + updateId;
        if (cache && cache.get(cacheKey)) {
          return telegramWebhookResponse("ok", {});
        }
        if (cache) cache.put(cacheKey, "1", 600);
      } catch (cacheErr) {}
    }

    var token = getEffectiveBotToken(rawEvent);

    // ========================================================================
    // A. PENANGANAN CALLBACK QUERY (TOMBOL INTERAKTIF TELEGRAM)
    // ========================================================================
    if (update.callback_query) {
      return handleTelegramCallbackQuery(update.callback_query, token);
    }

    var msg = update.message || update.channel_post || update.edited_message;
    if (!msg) return telegramWebhookResponse("ok", {});

    var chatId = msg.chat ? msg.chat.id : null;
    if (!chatId) return telegramWebhookResponse("ok", {});

    var rawUserText = (msg.text || msg.caption || '').trim();
    var hasPhoto = (msg.photo && msg.photo.length > 0) || Boolean(msg.document);

    if (!rawUserText && !hasPhoto) return telegramWebhookResponse("ok", {});

    var senderName = msg.from ? (msg.from.first_name || msg.from.username || 'Pengguna') : 'Pengguna';
    var senderUsername = msg.from && msg.from.username ? msg.from.username : '';

    // Simpan Chat ID secara dinamis ke Key-Value Store cepat (2ms)
    if (chatId) {
      try {
        var strChatId = chatId.toString();
        PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', strChatId);
        if (senderUsername) {
          PropertiesService.getScriptProperties().setProperty('TELEGRAM_USERNAME', senderUsername);
        }
      } catch (cErr) {}
    }

    var appUserId = getEffectiveUserId(rawEvent) || chatId.toString();
    var appUsername = getEffectiveUsername(rawEvent) || senderUsername || senderName;

    // ========================================================================
    // B. PENANGANAN STATE EDIT TRANSAKSI (User sedang mengetik koreksi)
    // ========================================================================
    var waitingEditState = getWaitingEditState(chatId);
    if (waitingEditState && waitingEditState.txId) {
      var editRes = handleWaitingEditInput(chatId, waitingEditState, rawUserText, token);
      if (editRes) return telegramWebhookResponse("ok", {});
    }

    // ========================================================================
    // C. PENANGANAN STATE DRAF STRUK (User sedang mengedit draf struk belanja)
    // ========================================================================
    var pendingDraft = getActiveUserDraft(chatId);
    if (pendingDraft && pendingDraft.waitingFor) {
      if (pendingDraft.waitingFor === 'amount') {
        var parsedNewAmt = parseSimpleAmount(rawUserText);
        if (parsedNewAmt && parsedNewAmt > 0) {
          pendingDraft.amount = parsedNewAmt;
          pendingDraft.waitingFor = null;
          saveUserDraft(chatId, pendingDraft);

          if (pendingDraft.messageId) {
            editTelegramMessage(chatId, pendingDraft.messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
          }
          return telegramWebhookResponse("sendMessage", {
            chat_id: chatId,
            text: "✅ <b>Nominal struk diperbarui:</b> Rp " + formatRupiahJs(parsedNewAmt) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan ke Catatan.</i>",
            parse_mode: "HTML"
          });
        } else {
          return telegramWebhookResponse("sendMessage", {
            chat_id: chatId,
            text: "⚠️ <i>Format nominal belum tepat. Masukkan angka contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code></i>",
            parse_mode: "HTML"
          });
        }
      }

      if (pendingDraft.waitingFor === 'desc') {
        if (rawUserText) {
          pendingDraft.description = rawUserText;
          pendingDraft.storeName = rawUserText;
          pendingDraft.waitingFor = null;
          saveUserDraft(chatId, pendingDraft);

          if (pendingDraft.messageId) {
            editTelegramMessage(chatId, pendingDraft.messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
          }
          return telegramWebhookResponse("sendMessage", {
            chat_id: chatId,
            text: "✅ <b>Toko / Keterangan diperbarui:</b> " + escapeHtml(rawUserText) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan ke Catatan.</i>",
            parse_mode: "HTML"
          });
        }
      }
    }

    // ========================================================================
    // D. PENANGANAN FOTO STRUK / NOTA (100% GRATIS TANPA API KEY BERBAYAR)
    // ========================================================================
    if (hasPhoto) {
      var photoCaption = rawUserText;
      var fileId = '';
      if (msg.photo && msg.photo.length > 0) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document) {
        fileId = msg.document.file_id;
      }

      var captionParsed = photoCaption ? parseFinanceText(photoCaption) : null;
      var draftId = "dr_" + new Date().getTime();

      var draftData = {
        id: draftId,
        chatId: chatId,
        userId: appUserId,
        username: appUsername,
        amount: captionParsed ? captionParsed.amount : 0,
        description: captionParsed ? captionParsed.description : "Struk Belanja",
        category: captionParsed ? captionParsed.category : "Belanja & Pribadi",
        type: captionParsed ? captionParsed.type : "pengeluaran",
        storeName: captionParsed ? captionParsed.description : "Nota Toko",
        waitingFor: null
      };

      if (!captionParsed && fileId) {
        sendTelegramChatAction(chatId, "typing", token);
        var freeOcrResult = tryFreeGoogleDriveReceiptOcr(fileId, token);
        if (freeOcrResult && freeOcrResult.amount > 0) {
          draftData.amount = freeOcrResult.amount;
          draftData.description = freeOcrResult.description || freeOcrResult.storeName || "Struk Belanja";
          draftData.storeName = freeOcrResult.storeName || draftData.description;
          draftData.category = freeOcrResult.category || "Belanja & Pribadi";
          draftData.type = freeOcrResult.type || "pengeluaran";
        }
      }

      saveUserDraft(chatId, draftData);
      var previewText = formatDraftPreview(draftData);
      var keyboard = getReceiptPreviewMarkup(draftId);

      var sentMsgId = sendTelegramMessageWithMarkup(chatId, previewText, keyboard, token);
      if (sentMsgId) {
        draftData.messageId = sentMsgId;
        saveUserDraft(chatId, draftData);
      }

      return telegramWebhookResponse("ok", {});
    }

    var lowerText = rawUserText.toLowerCase();

    // ========================================================================
    // E. PERINTAH-PERINTAH CERDAS TELEGRAM
    // ========================================================================

    // 1. Perintah /start atau bantuan
    if (lowerText === '/start' || lowerText.indexOf('/start') === 0 || lowerText === 'bantuan' || lowerText === 'help' || lowerText === '/help') {
      var currentSummary = getFastCachedSummary();
      var welcome = "👋 Halo, <b>" + escapeHtml(senderName) + "</b>! (@" + escapeHtml(senderUsername || 'user') + ")\\n\\n" +
                    "🤖 <b>Bot Keuangan FahKeu Aktif 24 Jam Non-Stop!</b>\\n" +
                    "───────────────────────────\\n" +
                    "🆔 <b>Chat ID Anda:</b> <code>" + chatId + "</code>\\n" +
                    "💰 <b>Saldo Kas Saat Ini:</b> <b>Rp " + formatRupiahJs(currentSummary.balance) + "</b> (" + currentSummary.count + " catatan)\\n\\n" +
                    "🧾 <b>Kirim Foto Struk / Nota (100% Gratis):</b>\\n" +
                    "Kirim foto bon belanja langsung ke sini! Dilengkapi pratinjau & tombol edit sebelum disimpan.\\n\\n" +
                    "✍️ <b>Contoh Mencatat Transaksi Cepat:</b>\\n" +
                    "• <code>beli cimol 3k</code> (Pengeluaran)\\n" +
                    "• <code>kopi kenangan 18rb</code> (Pengeluaran)\\n" +
                    "• <code>makan bakso 25k</code> (Pengeluaran)\\n" +
                    "• <code>isi bensin 35.000</code> (Pengeluaran)\\n" +
                    "• <code>gaji masuk 20 juta</code> (Pemasukan)\\n" +
                    "• <code>terima freelance 1.5jt</code> (Pemasukan)\\n\\n" +
                    "📊 <b>Perintah Praktis:</b>\\n" +
                    "• <b>/saldo</b> : Cek sisa uang riil & kas saat ini\\n" +
                    "• <b>/rekap</b> : Laporan transaksi terakhir\\n" +
                    "• <b>/edit</b> : Edit transaksi terakhir (ubah nominal/kategori/ket)\\n" +
                    "• <b>/hapus</b> : Batalkan transaksi terakhir\\n" +
                    "• <b>/hariini</b> : Mutasi kas khusus hari ini\\n" +
                    "• <b>/bulanini</b> : Mutasi kas bulan ini\\n\\n" +
                    "✅ <i>Tersinkronisasi 100% otomatis ke Google Spreadsheet & Website FahKeu!</i>";

      var startKeyboard = {
        inline_keyboard: [
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
            { text: "📊 Rekap Kas", callback_data: "cmd_rekap" }
          ],
          [
            { text: "✏️ Edit Terakhir", callback_data: "cmd_edit_last" },
            { text: "🗑️ Batalkan Terakhir", callback_data: "cmd_hapus" }
          ]
        ]
      };

      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: welcome,
        parse_mode: "HTML",
        reply_markup: startKeyboard
      });
    }

    // 2. Perintah /id atau /chatid
    if (lowerText === '/id' || lowerText === '/chatid' || lowerText === 'id') {
      var idInfo = "🆔 <b>Informasi Telegram Chat ID:</b>\\n" +
                   "───────────────────────────\\n" +
                   "Chat ID Anda: <code>" + chatId + "</code>\\n" +
                   "Nama: <b>" + escapeHtml(senderName) + "</b>\\n" +
                   "Username: @" + escapeHtml(senderUsername || '-') + "\\n\\n" +
                   "✅ <i>Chat ID ini telah otomatis tersimpan & terhubung 24 jam nonstop ke Google Apps Script dan Website Anda.</i>";
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: idInfo,
        parse_mode: "HTML"
      });
    }

    // 3. Perintah /saldo atau cek saldo
    if (lowerText === '/saldo' || lowerText === 'saldo' || lowerText === 'cek saldo' || lowerText === 'sisa saldo' || lowerText === 'uang saya') {
      var summarySaldo = getFastCachedSummary();
      var defNotice = "";
      if (summarySaldo.totalIncome === 0 && summarySaldo.totalExpense > 0) {
        defNotice = "\\n💡 <i>Catatan: Belum ada pemasukan dicatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar saldo bernilai positif.</i>";
      } else if (summarySaldo.balance < 0) {
        defNotice = "\\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit).</i>";
      }

      var saldoReply = "💰 <b>RINGKASAN SALDO KAS TERKINI</b>\\n" +
                       "───────────────────────────\\n" +
                       "📥 Total Pemasukan   : <b>Rp " + formatRupiahJs(summarySaldo.totalIncome) + "</b>\\n" +
                       "📤 Total Pengeluaran : <b>Rp " + formatRupiahJs(summarySaldo.totalExpense) + "</b>\\n" +
                       "───────────────────────────\\n" +
                       "💵 <b>SISA SALDO KAS  : Rp " + formatRupiahJs(summarySaldo.balance) + "</b>" + defNotice + "\\n\\n" +
                       "📊 Total Transaksi   : " + summarySaldo.count + " catatan\\n" +
                       "✅ <i>Terupdate realtime 24 jam di Google Spreadsheet.</i>";

      var saldoKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 Rekap Transaksi", callback_data: "cmd_rekap" },
            { text: "✏️ Koreksi Kas", callback_data: "cmd_edit_last" }
          ]
        ]
      };

      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: saldoReply,
        parse_mode: "HTML",
        reply_markup: saldoKeyboard
      });
    }

    // 4. Perintah /rekap atau laporan
    if (lowerText === '/rekap' || lowerText === 'rekap' || lowerText === 'laporan' || lowerText === 'history') {
      var rekapText = generateRekapMessage();
      var rekapKeyboard = {
        inline_keyboard: [
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
            { text: "📅 Hari Ini", callback_data: "cmd_hariini" }
          ]
        ]
      };
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: rekapText,
        parse_mode: "HTML",
        reply_markup: rekapKeyboard
      });
    }

    // 5. Perintah /hariini atau /bulanini
    if (lowerText === '/hariini' || lowerText === 'hari ini' || lowerText === '/today') {
      var todaySummary = calculateDateFilteredSummary(new Date(), 'day');
      var todayText = "📅 <b>MUTASI KAS KHUSUS HARI INI</b>\\n" +
                      "───────────────────────────\\n" +
                      "📥 Pemasukan   : Rp " + formatRupiahJs(todaySummary.income) + "\\n" +
                      "📤 Pengeluaran : Rp " + formatRupiahJs(todaySummary.expense) + "\\n" +
                      "💵 <b>Net Hari Ini : Rp " + formatRupiahJs(todaySummary.income - todaySummary.expense) + "</b> (" + todaySummary.count + " transaksi)\\n" +
                      "───────────────────────────";
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: todayText,
        parse_mode: "HTML"
      });
    }

    // 6. Perintah /edit (Edit Transaksi Terakhir)
    if (lowerText === '/edit' || lowerText === 'edit' || lowerText === 'koreksi') {
      var lastTx = getLastTransaction();
      if (!lastTx) {
        return telegramWebhookResponse("sendMessage", {
          chat_id: chatId,
          text: "⚠️ <i>Belum ada transaksi yang dapat diedit. Silakan catat transaksi terlebih dahulu.</i>",
          parse_mode: "HTML"
        });
      }
      var editPrompt = formatTxEditPreview(lastTx);
      var editKeyboard = getTxEditMarkup(lastTx.id);
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: editPrompt,
        parse_mode: "HTML",
        reply_markup: editKeyboard
      });
    }

    // 7. Perintah /hapus (Batalkan Transaksi Terakhir)
    if (lowerText === '/hapus' || lowerText === 'hapus' || lowerText === 'batal' || lowerText === '/undo') {
      var deletedItem = deleteLastTransaction();
      if (deletedItem) {
        invalidateFastCachedSummary();
        var newSummary = getFastCachedSummary();
        var undoNotice = "🗑️ <b>Transaksi Terakhir Dibatalkan:</b>\\n\\n" +
                         "• Keterangan : <b>" + escapeHtml(deletedItem.description) + "</b>\\n" +
                         "• Nominal    : Rp " + formatRupiahJs(deletedItem.amount) + "\\n" +
                         "• Sisa Saldo : <b>Rp " + formatRupiahJs(newSummary.balance) + "</b>\\n\\n" +
                         "✅ <i>Baris data telah dihapus dari Google Spreadsheet & Website.</i>";
        return telegramWebhookResponse("sendMessage", {
          chat_id: chatId,
          text: undoNotice,
          parse_mode: "HTML"
        });
      } else {
        return telegramWebhookResponse("sendMessage", {
          chat_id: chatId,
          text: "⚠️ Belum ada transaksi yang dapat dibatalkan.",
          parse_mode: "HTML"
        });
      }
    }

    // 8. Perintah /reset (Kosongkan kas ke Rp 0)
    if (lowerText === '/reset' || lowerText === 'reset kas' || lowerText === 'reset data') {
      var confirmResetKeyboard = {
        inline_keyboard: [
          [
            { text: "⚠️ Ya, Kosongkan ke Rp 0", callback_data: "cmd_confirm_reset" },
            { text: "❌ Batal", callback_data: "cmd_cancel_reset" }
          ]
        ]
      };
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: "⚠️ <b>Konfirmasi Pengosongan Data:</b>\\n\\nApakah Anda yakin ingin mengosongkan seluruh data transaksi kas menjadi <b>Rp 0</b>?",
        parse_mode: "HTML",
        reply_markup: confirmResetKeyboard
      });
    }

    // ========================================================================
    // F. NATURAL LANGUAGE PARSER BAHASA INDONESIA SUPER PINTAR & CEPAT
    // ========================================================================
    var parsedTx = parseFinanceText(rawUserText);
    if (parsedTx && parsedTx.amount > 0) {
      var txSheet = getOrCreateTxSheet();
      var newTxId = 'tg_' + new Date().getTime();
      var nowIso = new Date().toISOString();

      var lock = LockService.getScriptLock();
      var hasLock = false;
      try {
        hasLock = lock.tryLock(1500);
        txSheet.appendRow([
          newTxId,
          nowIso,
          parsedTx.type,
          parsedTx.amount,
          parsedTx.description,
          parsedTx.category,
          'telegram',
          appUserId,
          appUsername
        ]);
      } finally {
        if (hasLock) lock.releaseLock();
      }

      var postSummary = updateFastCachedSummary(parsedTx.type, parsedTx.amount);
      var isIncome = parsedTx.type === 'pemasukan';
      var typeBadge = isIncome ? '🟢 Pemasukan' : '🔴 Pengeluaran';
      var signSymbol = isIncome ? '+ ' : '- ';

      var noticeDef = "";
      if (postSummary.totalIncome === 0 && postSummary.totalExpense > 0) {
        noticeDef = "\\n💡 <i>Catatan: Belum ada pemasukan dicatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar saldo bernilai positif.</i>";
      } else if (postSummary.balance < 0) {
        noticeDef = "\\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit).</i>";
      }

      var elapsedMs = Math.max(1, new Date().getTime() - webhookStartTime);
      var exactSecondWib = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm:ss 'WIB'");

      var recordReply = "🧾 ═══════════════════════\\n" +
                        "     <b>STRUK TRANSAKSI RESMI FAHKEU</b>\\n" +
                        "═══════════════════════════\\n" +
                        "🟢 <b>STATUS : BERHASIL TERCATAT</b>\\n" +
                        "⚡ <b>Respon :</b> " + (elapsedMs / 1000).toFixed(2) + " detik • Realtime 24 Jam\\n" +
                        "📅 <b>Waktu  :</b> " + exactSecondWib + "\\n" +
                        "🆔 <b>Struk  :</b> <code>#" + newTxId + "</code>\\n" +
                        "───────────────────────────\\n" +
                        "🏪 <b>Keterangan :</b> <b>" + escapeHtml(parsedTx.description) + "</b>\\n" +
                        "📂 <b>Kategori   :</b> " + escapeHtml(parsedTx.category) + "\\n" +
                        "🏷️ <b>Jenis      :</b> " + typeBadge + "\\n" +
                        "💵 <b>Nominal    :</b> <b>" + signSymbol + "Rp " + formatRupiahJs(parsedTx.amount) + "</b>\\n" +
                        "───────────────────────────\\n" +
                        "📊 <b>REKAP SALDO KAS MUTAKHIR:</b>\\n" +
                        "📥 Pemasukan   : Rp " + formatRupiahJs(postSummary.totalIncome) + "\\n" +
                        "📤 Pengeluaran : Rp " + formatRupiahJs(postSummary.totalExpense) + "\\n" +
                        "💰 <b>Sisa Kas : Rp " + formatRupiahJs(postSummary.balance) + "</b>" + noticeDef + "\\n" +
                        "───────────────────────────\\n" +
                        "✅ <i>Tersimpan otomatis di Google Spreadsheet &amp; Website FahKeu!</i>\\n" +
                        "═══════════════════════════";

      var actionKeyboard = {
        inline_keyboard: [
          [
            { text: "✏️ Edit Transaksi Ini", callback_data: "tx_edit:" + newTxId },
            { text: "🗑️ Batalkan / Hapus", callback_data: "tx_del:" + newTxId }
          ],
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
            { text: "📊 Rekap Kas", callback_data: "cmd_rekap" }
          ]
        ]
      };

      // Respon langsung dalam satu siklus webhook (Standar Resmi Telegram Webhook Response)
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: recordReply,
        parse_mode: "HTML",
        reply_markup: actionKeyboard
      });

    } else {
      var helpPrompt = "🤔 Format belum terbaca sebagai transaksi.\\n\\n" +
                       "💡 <b>Coba ketik seperti ini:</b>\\n" +
                       "• <code>beli cimol 3k</code>\\n" +
                       "• <code>makan bakso 25k</code>\\n" +
                       "• <code>kopi 15rb</code>\\n" +
                       "• <code>gaji masuk 20 juta</code>\\n" +
                       "• <code>bensin motor 25.000</code>\\n" +
                       "• Atau kirim <b>foto struk / nota belanja</b> 🧾\\n\\n" +
                       "Ketik <b>/saldo</b> untuk cek saldo, <b>/edit</b> untuk ubah transaksi, atau <b>/bantuan</b>.";
      return telegramWebhookResponse("sendMessage", {
        chat_id: chatId,
        text: helpPrompt,
        parse_mode: "HTML"
      });
    }

  } catch (err) {
    Logger.log("handleTelegramWebhook error: " + err.toString());
    return telegramWebhookResponse("ok", {});
  }
}

// ----------------------------------------------------------------------------
// HANDLER CALLBACK QUERY (TOMBOL INLINE TELEGRAM)
// ----------------------------------------------------------------------------
function handleTelegramCallbackQuery(callbackQuery, token) {
  try {
    var cbId = callbackQuery.id;
    var chatId = callbackQuery.message ? callbackQuery.message.chat.id : null;
    var messageId = callbackQuery.message ? callbackQuery.message.message_id : null;
    var cbData = callbackQuery.data || '';

    if (!chatId) return telegramWebhookResponse("ok", {});

    // Perintah Saldo
    if (cbData === 'cmd_saldo') {
      var sum = getFastCachedSummary();
      answerTelegramCallback(cbId, "Saldo: Rp " + formatRupiahJs(sum.balance), token);
      var saldoMsg = "💰 <b>SALDO KAS SAAT INI:</b>\\n\\n" +
                     "📥 Pemasukan: Rp " + formatRupiahJs(sum.totalIncome) + "\\n" +
                     "📤 Pengeluaran: Rp " + formatRupiahJs(sum.totalExpense) + "\\n" +
                     "💵 <b>Sisa Kas: Rp " + formatRupiahJs(sum.balance) + "</b>";
      sendTelegramMessage(chatId, saldoMsg, token);
      return telegramWebhookResponse("ok", {});
    }

    // Perintah Rekap
    if (cbData === 'cmd_rekap') {
      answerTelegramCallback(cbId, "Memuat rekap...", token);
      sendTelegramMessage(chatId, generateRekapMessage(), token);
      return telegramWebhookResponse("ok", {});
    }

    // Perintah Hari Ini
    if (cbData === 'cmd_hariini') {
      answerTelegramCallback(cbId, "Mutasi hari ini", token);
      var todaySummary = calculateDateFilteredSummary(new Date(), 'day');
      var todayText = "📅 <b>MUTASI KAS HARI INI:</b>\\n\\n" +
                      "📥 Pemasukan: Rp " + formatRupiahJs(todaySummary.income) + "\\n" +
                      "📤 Pengeluaran: Rp " + formatRupiahJs(todaySummary.expense) + "\\n" +
                      "💵 <b>Net: Rp " + formatRupiahJs(todaySummary.income - todaySummary.expense) + "</b>";
      sendTelegramMessage(chatId, todayText, token);
      return telegramWebhookResponse("ok", {});
    }

    // Perintah Hapus Transaksi Terakhir
    if (cbData === 'cmd_hapus') {
      var del = deleteLastTransaction();
      if (del) {
        invalidateFastCachedSummary();
        var nSum = getFastCachedSummary();
        answerTelegramCallback(cbId, "Transaksi dibatalkan", token);
        sendTelegramMessage(chatId, "🗑️ Transaksi <b>" + escapeHtml(del.description) + "</b> (Rp " + formatRupiahJs(del.amount) + ") berhasil dibatalkan.\\nSisa Saldo: <b>Rp " + formatRupiahJs(nSum.balance) + "</b>", token);
      } else {
        answerTelegramCallback(cbId, "Tidak ada transaksi", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    // Menu Edit Transaksi Terakhir
    if (cbData === 'cmd_edit_last') {
      var lTx = getLastTransaction();
      if (lTx) {
        answerTelegramCallback(cbId, "Buka menu edit", token);
        sendTelegramMessageWithMarkup(chatId, formatTxEditPreview(lTx), getTxEditMarkup(lTx.id), token);
      } else {
        answerTelegramCallback(cbId, "Tidak ada transaksi", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    // Buka Menu Edit Transaksi Berdasarkan ID
    if (cbData.indexOf('tx_edit:') === 0) {
      var txId = cbData.split(':')[1];
      var txData = getTransactionById(txId);
      if (txData) {
        answerTelegramCallback(cbId, "Buka menu edit", token);
        editTelegramMessage(chatId, messageId, formatTxEditPreview(txData), getTxEditMarkup(txId), token);
      } else {
        answerTelegramCallback(cbId, "Transaksi tidak ditemukan", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    // 2. Edit Nominal
    if (cbData.indexOf('tx_edit_amt:') === 0) {
      var txId = cbData.split(':')[1];
      setWaitingEditState(chatId, { txId: txId, field: 'amount', messageId: messageId });
      answerTelegramCallback(cbId, "Ketik nominal baru di chat", token);
      sendTelegramMessage(chatId, "✏️ <b>Ubah Nominal Transaksi:</b>\\n\\nKetikkan nominal angka baru di chat, contoh: <code>45k</code>, <code>50000</code>, atau <code>1.5jt</code>.", token);
      return telegramWebhookResponse("ok", {});
    }

    // 3. Edit Keterangan
    if (cbData.indexOf('tx_edit_desc:') === 0) {
      var txId = cbData.split(':')[1];
      setWaitingEditState(chatId, { txId: txId, field: 'desc', messageId: messageId });
      answerTelegramCallback(cbId, "Ketik keterangan baru di chat", token);
      sendTelegramMessage(chatId, "✏️ <b>Ubah Keterangan / Toko:</b>\\n\\nKetikkan keterangan baru di chat, contoh: <code>Kopi Kenangan</code> atau <code>Bensin Pertamax</code>.", token);
      return telegramWebhookResponse("ok", {});
    }

    // 4. Menu Ubah Kategori
    if (cbData.indexOf('tx_edit_cat:') === 0) {
      var txId = cbData.split(':')[1];
      var catMarkup = {
        inline_keyboard: [
          [
            { text: "🍽️ Makanan & Minum", callback_data: "tx_set_cat:" + txId + ":Makanan & Minuman" },
            { text: "🛒 Belanja & Pribadi", callback_data: "tx_set_cat:" + txId + ":Belanja & Pribadi" }
          ],
          [
            { text: "🚗 Transportasi", callback_data: "tx_set_cat:" + txId + ":Transportasi" },
            { text: "💡 Tagihan & Utilitas", callback_data: "tx_set_cat:" + txId + ":Tagihan & Utilitas" }
          ],
          [
            { text: "💼 Bisnis & Usaha", callback_data: "tx_set_cat:" + txId + ":Bisnis & Operasional" },
            { text: "📦 Lainnya", callback_data: "tx_set_cat:" + txId + ":Lainnya" }
          ],
          [
            { text: "🔙 Kembali", callback_data: "tx_edit:" + txId }
          ]
        ]
      };
      answerTelegramCallback(cbId, "Pilih kategori", token);
      editTelegramMessage(chatId, messageId, "📂 <b>Pilih Kategori Baru untuk Transaksi #" + txId + ":</b>", catMarkup, token);
      return telegramWebhookResponse("ok", {});
    }

    // 5. Simpan Kategori Baru
    if (cbData.indexOf('tx_set_cat:') === 0) {
      var parts = cbData.split(':');
      var txId = parts[1];
      var newCat = parts.slice(2).join(':') || 'Lainnya';
      updateTransactionField(txId, 'category', newCat);
      var updatedTx = getTransactionById(txId);
      answerTelegramCallback(cbId, "Kategori: " + newCat, token);
      editTelegramMessage(chatId, messageId, formatTxEditPreview(updatedTx), getTxEditMarkup(txId), token);
      return telegramWebhookResponse("ok", {});
    }

    // 6. Ganti Jenis (Pengeluaran <-> Pemasukan)
    if (cbData.indexOf('tx_toggle_type:') === 0) {
      var txId = cbData.split(':')[1];
      var txData = getTransactionById(txId);
      if (txData) {
        var newType = txData.type === 'pengeluaran' ? 'pemasukan' : 'pengeluaran';
        updateTransactionField(txId, 'type', newType);
        invalidateFastCachedSummary();
        var updatedTx = getTransactionById(txId);
        answerTelegramCallback(cbId, "Jenis diubah ke " + newType, token);
        editTelegramMessage(chatId, messageId, formatTxEditPreview(updatedTx), getTxEditMarkup(txId), token);
      }
      return telegramWebhookResponse("ok", {});
    }

    // 7. Hapus Transaksi Tertentu
    if (cbData.indexOf('tx_del:') === 0) {
      var txId = cbData.split(':')[1];
      var delRes = deleteTransactionById(txId);
      if (delRes.success) {
        invalidateFastCachedSummary();
        answerTelegramCallback(cbId, "Transaksi berhasil dihapus!", token);
        var newMetrics = getFastCachedSummary();
        var delMsg = "🗑️ <b>Transaksi #" + txId + " Berhasil Dihapus!</b>\\n\\n" +
                     "• Keterangan: <b>" + escapeHtml(delRes.description) + "</b>\\n" +
                     "• Nominal: Rp " + formatRupiahJs(delRes.amount) + "\\n" +
                     "• Sisa Saldo Kas: <b>Rp " + formatRupiahJs(newMetrics.balance) + "</b>\\n\\n" +
                     "✅ <i>Telah dihapus dari Google Spreadsheet & Website.</i>";
        editTelegramMessage(chatId, messageId, delMsg, { inline_keyboard: [] }, token);
      } else {
        answerTelegramCallback(cbId, "Transaksi tidak ditemukan.", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    // ========================================================================
    // DRAF STRUK CALLBACK QUERY
    // ========================================================================
    if (cbData.indexOf('dr_save:') === 0) {
      var draftId = cbData.split(':')[1];
      var draft = getUserDraftById(chatId, draftId);
      if (draft) {
        var txSheet = getOrCreateTxSheet();
        var newTxId = 'tg_' + new Date().getTime();
        var nowIso = new Date().toISOString();

        var lock = LockService.getScriptLock();
        var hasLock = false;
        try {
          hasLock = lock.tryLock(1500);
          txSheet.appendRow([
            newTxId,
            nowIso,
            draft.type || 'pengeluaran',
            draft.amount,
            draft.description || 'Struk Belanja',
            draft.category || 'Belanja & Pribadi',
            'telegram_ocr',
            draft.userId || chatId.toString(),
            draft.username || 'telegram_user'
          ]);
        } finally {
          if (hasLock) lock.releaseLock();
        }

        updateFastCachedSummary(draft.type || 'pengeluaran', draft.amount);
        clearUserDraft(chatId);
        answerTelegramCallback(cbId, "Struk tersimpan!", token);

        var curSum = getFastCachedSummary();
        var savedText = "🧾 <b>STRUK RESMI BERHASIL DICATAT KE BUKU KAS</b>\\n" +
                        "───────────────────────────\\n" +
                        "🏪 Toko/Nota : <b>" + escapeHtml(draft.description) + "</b>\\n" +
                        "📂 Kategori  : " + escapeHtml(draft.category) + "\\n" +
                        "💵 Nominal   : <b>- Rp " + formatRupiahJs(draft.amount) + "</b>\\n" +
                        "💰 <b>Sisa Kas : Rp " + formatRupiahJs(curSum.balance) + "</b>\\n" +
                        "───────────────────────────\\n" +
                        "✅ <i>Tersimpan otomatis di Google Spreadsheet & Website FahKeu!</i>";

        var actionAfterSave = {
          inline_keyboard: [
            [
              { text: "✏️ Edit Struk Ini", callback_data: "tx_edit:" + newTxId },
              { text: "🗑️ Batalkan", callback_data: "tx_del:" + newTxId }
            ]
          ]
        };
        editTelegramMessage(chatId, messageId, savedText, actionAfterSave, token);
      } else {
        answerTelegramCallback(cbId, "Draf struk kedaluwarsa.", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    if (cbData.indexOf('dr_cancel:') === 0) {
      clearUserDraft(chatId);
      answerTelegramCallback(cbId, "Draf dibatalkan.", token);
      editTelegramMessage(chatId, messageId, "❌ <i>Pencatatan struk foto telah dibatalkan.</i>", { inline_keyboard: [] }, token);
      return telegramWebhookResponse("ok", {});
    }

    if (cbData.indexOf('dr_edit_amt:') === 0) {
      var draftId = cbData.split(':')[1];
      var draft = getUserDraftById(chatId, draftId);
      if (draft) {
        draft.waitingFor = 'amount';
        draft.messageId = messageId;
        saveUserDraft(chatId, draft);
        answerTelegramCallback(cbId, "Ketik nominal baru di chat", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Nominal Struk:</b>\\n\\nKetikkan total belanja yang benar di chat, contoh: <code>45k</code>, <code>45000</code>, atau <code>150rb</code>.", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    if (cbData.indexOf('dr_edit_desc:') === 0) {
      var draftId = cbData.split(':')[1];
      var draft = getUserDraftById(chatId, draftId);
      if (draft) {
        draft.waitingFor = 'desc';
        draft.messageId = messageId;
        saveUserDraft(chatId, draft);
        answerTelegramCallback(cbId, "Ketik nama toko di chat", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Nama Toko / Keterangan:</b>\\n\\nKetikkan nama toko atau keterangan di chat, contoh: <code>Indomaret</code> atau <code>Superindo</code>.", token);
      }
      return telegramWebhookResponse("ok", {});
    }

    if (cbData.indexOf('dr_set_cat:') === 0) {
      var parts = cbData.split(':');
      var draftId = parts[1];
      var catName = parts.slice(2).join(':') || 'Lainnya';
      var draft = getUserDraftById(chatId, draftId);
      if (draft) {
        draft.category = catName;
        saveUserDraft(chatId, draft);
        answerTelegramCallback(cbId, "Kategori: " + catName, token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(draft), getReceiptPreviewMarkup(draftId), token);
      }
      return telegramWebhookResponse("ok", {});
    }

    answerTelegramCallback(cbId, "Perintah diproses", token);
    return telegramWebhookResponse("ok", {});

  } catch (cbErr) {
    Logger.log("Callback query error: " + cbErr.toString());
    return telegramWebhookResponse("ok", {});
  }
}

// ----------------------------------------------------------------------------
// FORMATTER & HELPER EDIT TRANSAKSI
// ----------------------------------------------------------------------------
function formatTxEditPreview(tx) {
  if (!tx) return "⚠️ <i>Transaksi tidak ditemukan.</i>";
  var isInc = tx.type === 'pemasukan';
  var badge = isInc ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  var sign = isInc ? '+' : '-';

  return "✏️ <b>MENU EDIT TRANSAKSI #" + tx.id + "</b>\\n" +
         "───────────────────────────\\n" +
         "🏪 <b>Keterangan :</b> " + escapeHtml(tx.description) + "\\n" +
         "📂 <b>Kategori   :</b> " + escapeHtml(tx.category) + "\\n" +
         "🏷️ <b>Jenis      :</b> " + badge + "\\n" +
         "💵 <b>Nominal    :</b> <b>" + sign + " Rp " + formatRupiahJs(tx.amount) + "</b>\\n" +
         "📅 <b>Waktu      :</b> " + (tx.date ? tx.date.substring(0, 16).replace('T', ' ') : '-') + "\\n" +
         "───────────────────────────\\n" +
         "<i>Pilih tombol di bawah untuk mengubah rincian transaksi ini:</i>";
}

function getTxEditMarkup(txId) {
  return {
    inline_keyboard: [
      [
        { text: "💵 Ubah Nominal", callback_data: "tx_edit_amt:" + txId },
        { text: "🏪 Ubah Toko / Ket", callback_data: "tx_edit_desc:" + txId }
      ],
      [
        { text: "📂 Ubah Kategori", callback_data: "tx_edit_cat:" + txId },
        { text: "🔄 Tukar Jenis", callback_data: "tx_toggle_type:" + txId }
      ],
      [
        { text: "🗑️ Hapus Transaksi Ini", callback_data: "tx_del:" + txId },
        { text: "✅ Selesai", callback_data: "cmd_saldo" }
      ]
    ]
  };
}

function formatDraftPreview(draft) {
  var isInc = draft.type === 'pemasukan';
  var badge = isInc ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  var sign = isInc ? '+' : '-';

  return "🧾 <b>HASIL PEMINDAIAN STRUK BELANJA</b>\\n" +
         "───────────────────────────\\n" +
         "🏪 <b>Toko / Keterangan :</b> <b>" + escapeHtml(draft.description) + "</b>\\n" +
         "📂 <b>Kategori          :</b> " + escapeHtml(draft.category) + "\\n" +
         "🏷️ <b>Jenis             :</b> " + badge + "\\n" +
         "💵 <b>Total Belanja     :</b> <b>" + sign + " Rp " + formatRupiahJs(draft.amount) + "</b>\\n" +
         "───────────────────────────\\n" +
         "💡 <i>Periksa rincian di atas. Jika sudah sesuai, klik <b>Simpan ke Catatan</b>. Jika nominal belum pas, klik <b>Ubah Nominal</b>.</i>";
}

function getReceiptPreviewMarkup(draftId) {
  return {
    inline_keyboard: [
      [
        { text: "💾 Simpan ke Catatan", callback_data: "dr_save:" + draftId },
        { text: "❌ Batalkan", callback_data: "dr_cancel:" + draftId }
      ],
      [
        { text: "✏️ Ubah Nominal", callback_data: "dr_edit_amt:" + draftId },
        { text: "🏪 Ubah Toko / Ket", callback_data: "dr_edit_desc:" + draftId }
      ],
      [
        { text: "🍽️ Makanan", callback_data: "dr_set_cat:" + draftId + ":Makanan & Minuman" },
        { text: "🛒 Belanja", callback_data: "dr_set_cat:" + draftId + ":Belanja & Pribadi" },
        { text: "🚗 Bensin", callback_data: "dr_set_cat:" + draftId + ":Transportasi" }
      ]
    ]
  };
}

// ----------------------------------------------------------------------------
// PENYIMPANAN DRAF STRUK & STATE DI CACHE/PROPERTIES
// ----------------------------------------------------------------------------
function saveUserDraft(chatId, draftData) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put("draft_" + chatId, JSON.stringify(draftData), 1800);
  } catch (e) {}
}

function getActiveUserDraft(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get("draft_" + chatId);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return null;
}

function getUserDraftById(chatId, draftId) {
  var d = getActiveUserDraft(chatId);
  if (d && d.id === draftId) return d;
  return null;
}

function clearUserDraft(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("draft_" + chatId);
  } catch (e) {}
}

function setWaitingEditState(chatId, stateData) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put("wait_edit_" + chatId, JSON.stringify(stateData), 600);
  } catch (e) {}
}

function getWaitingEditState(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get("wait_edit_" + chatId);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return null;
}

function clearWaitingEditState(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("wait_edit_" + chatId);
  } catch (e) {}
}

function handleWaitingEditInput(chatId, state, inputText, token) {
  try {
    var txId = state.txId;
    var field = state.field;
    var messageId = state.messageId;

    if (field === 'amount') {
      var newAmt = parseSimpleAmount(inputText);
      if (newAmt && newAmt > 0) {
        updateTransactionField(txId, 'amount', newAmt);
        invalidateFastCachedSummary();
        clearWaitingEditState(chatId);
        var upTx = getTransactionById(txId);
        sendTelegramMessage(chatId, "✅ <b>Nominal Transaksi Berhasil Diperbarui:</b> Rp " + formatRupiahJs(newAmt), token);
        if (messageId && upTx) {
          editTelegramMessage(chatId, messageId, formatTxEditPreview(upTx), getTxEditMarkup(txId), token);
        }
        return true;
      } else {
        sendTelegramMessage(chatId, "⚠️ <i>Format nominal belum tepat. Ketik angka contoh: <code>45k</code>, <code>50000</code>, atau <code>1.5jt</code></i>", token);
        return true;
      }
    }

    if (field === 'desc') {
      if (inputText) {
        updateTransactionField(txId, 'description', inputText);
        clearWaitingEditState(chatId);
        var upTx = getTransactionById(txId);
        sendTelegramMessage(chatId, "✅ <b>Keterangan Transaksi Diperbarui:</b> " + escapeHtml(inputText), token);
        if (messageId && upTx) {
          editTelegramMessage(chatId, messageId, formatTxEditPreview(upTx), getTxEditMarkup(txId), token);
        }
        return true;
      }
    }
  } catch (e) {
    Logger.log("handleWaitingEditInput err: " + e.toString());
  }
  return false;
}

// ----------------------------------------------------------------------------
// GOOGLE DRIVE OCR 100% GRATIS (TANPA API KEY BERBAYAR)
// ----------------------------------------------------------------------------
function tryFreeGoogleDriveReceiptOcr(fileId, botToken) {
  try {
    if (!fileId || !botToken) return null;

    // 1. Dapatkan file path dari Telegram Bot API
    var getFileUrl = "https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + fileId;
    var fileRes = UrlFetchApp.fetch(getFileUrl, { muteHttpExceptions: true });
    var fileData = JSON.parse(fileRes.getContentText());
    if (!fileData.ok || !fileData.result || !fileData.result.file_path) return null;

    // 2. Download foto struk
    var downloadUrl = "https://api.telegram.org/file/bot" + botToken + "/" + fileData.result.file_path;
    var photoBlob = UrlFetchApp.fetch(downloadUrl, { muteHttpExceptions: true }).getBlob();
    photoBlob.setName("receipt_ocr_" + new Date().getTime() + ".jpg");

    // 3. OCR via Google Drive API v2
    var textOcr = ocrImageBlobViaDriveApi(photoBlob);
    if (!textOcr) return null;

    // 4. Parsing teks struk dengan Heuristic Parser Indonesia Cerdas
    return parseReceiptOcrText(textOcr);

  } catch (ocrErr) {
    Logger.log("Free Drive OCR Error: " + ocrErr.toString());
    return null;
  }
}

function ocrImageBlobViaDriveApi(imageBlob) {
  try {
    var boundary = "-------314159265358979323846";
    var delimiter = "\\r\\n--" + boundary + "\\r\\n";
    var closeDelim = "\\r\\n--" + boundary + "--";

    var metadata = {
      title: "Temp_OCR_" + new Date().getTime(),
      mimeType: imageBlob.getContentType()
    };

    var base64Data = Utilities.base64Encode(imageBlob.getBytes());
    var multipartRequestBody =
      delimiter +
      'Content-Type: application/json\\r\\n\\r\\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + imageBlob.getContentType() + '\\r\\n' +
      'Content-Transfer-Encoding: base64\\r\\n\\r\\n' +
      base64Data +
      closeDelim;

    var oauthToken = ScriptApp.getOAuthToken();
    var uploadUrl = "https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&ocr=true&ocrLanguage=id";
    var response = UrlFetchApp.fetch(uploadUrl, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + oauthToken,
        "Content-Type": "multipart/related; boundary=" + boundary
      },
      payload: multipartRequestBody,
      muteHttpExceptions: true
    });

    var result = JSON.parse(response.getContentText());
    if (result && result.id) {
      var extractedText = "";
      try {
        var doc = DocumentApp.openById(result.id);
        extractedText = doc.getBody().getText();
      } catch (docErr) {
        try {
          var exportRes = UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + result.id + "/export?mimeType=text/plain", {
            headers: { "Authorization": "Bearer " + oauthToken },
            muteHttpExceptions: true
          });
          extractedText = exportRes.getContentText();
        } catch (exErr) {}
      }

      // Hapus file temporary
      try {
        UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + result.id, {
          method: "delete",
          headers: { "Authorization": "Bearer " + oauthToken },
          muteHttpExceptions: true
        });
      } catch (delErr) {}

      return extractedText;
    }
  } catch (err) {
    Logger.log("Drive API OCR err: " + err.toString());
  }
  return null;
}

function parseReceiptOcrText(rawText) {
  if (!rawText) return null;
  var lines = rawText.split('\\n').map(function(l) { return l.trim(); }).filter(Boolean);
  if (lines.length === 0) return null;

  var detectedStore = "Struk Belanja";
  for (var i = 0; i < Math.min(lines.length, 5); i++) {
    var line = lines[i];
    if (line.length >= 3 && line.length <= 40 && !/\\d{5,}/.test(line) && !/tanggal|waktu|kasir|struk|nota|jam/i.test(line)) {
      detectedStore = line;
      break;
    }
  }

  var maxAmount = 0;
  var totalKeywords = /total|subtotal|tagihan|bayar|grand\\s*total|tunai|cash|debit|gopay|qris|shopeepay|ovo/i;

  for (var j = 0; j < lines.length; j++) {
    var l = lines[j];
    var isTotalLine = totalKeywords.test(l);
    var matches = l.match(/(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?|\\d+)/g);
    if (matches) {
      for (var k = 0; k < matches.length; k++) {
        var numStr = matches[k].replace(/[^0-9]/g, '');
        var num = parseInt(numStr, 10);
        if (num >= 500 && num <= 500000000) {
          if (isTotalLine) {
            if (num > maxAmount) maxAmount = num;
          } else if (num > maxAmount && maxAmount === 0) {
            maxAmount = num;
          }
        }
      }
    }
  }

  var detectedCat = "Belanja & Pribadi";
  var lowerAll = rawText.toLowerCase();
  if (/makan|resto|cafe|kopi|bakso|ayam|mie|warung|minum|boga/i.test(lowerAll)) {
    detectedCat = "Makanan & Minuman";
  } else if (/spbu|pertamina|shell|bensin|pertalite|pertamax|parkir|toll|ojol|grab|gojek/i.test(lowerAll)) {
    detectedCat = "Transportasi";
  } else if (/pln|listrik|pdam|wifi|indihome|pulsa|paket|token/i.test(lowerAll)) {
    detectedCat = "Tagihan & Utilitas";
  }

  return {
    amount: maxAmount,
    description: detectedStore,
    storeName: detectedStore,
    category: detectedCat,
    type: "pengeluaran"
  };
}

// ----------------------------------------------------------------------------
// PARSER BAHASA INDONESIA SUPER PINTAR & NATURAL
// ----------------------------------------------------------------------------
function parseFinanceText(text) {
  if (!text) return null;
  var raw = text.trim();
  var lower = raw.toLowerCase();

  // Bersihkan karakter awalan seperti - / +
  lower = lower.replace(/^[\\+\\-\\s]+/, '');

  var isIncome = false;
  var incomeKeywords = [
    'gaji', 'gajian', 'income', 'masuk', 'terima', 'dapat', 'bonus', 'fee', 
    'freelance', 'omset', 'penjualan', 'untung', 'profit', 'laba', 'transfer masuk',
    'saldo awal', 'kembalian', 'sedekah masuk', 'hadiah', 'klaim', 'cair', 'piutang dibayar'
  ];

  for (var i = 0; i < incomeKeywords.length; i++) {
    var kw = incomeKeywords[i];
    var re = new RegExp('\\\\b' + kw + '\\\\b', 'i');
    if (re.test(lower)) {
      isIncome = true;
      break;
    }
  }

  // Ekstraksi Nominal
  var amount = 0;
  var amountPattern = /(?:rp\\.?\\s*)?(\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)\\s*(jt|juta|k|rb|ribu|m|miliar)?\\b/i;
  var match = lower.match(amountPattern);

  if (match) {
    var numPart = match[1];
    var unit = match[2] ? match[2].toLowerCase() : '';

    var cleanNum = numPart.replace(/\\./g, '').replace(/,/g, '.');
    var baseVal = parseFloat(cleanNum);

    if (!isNaN(baseVal) && baseVal > 0) {
      if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
        amount = Math.round(baseVal * 1000);
      } else if (unit === 'jt' || unit === 'juta') {
        amount = Math.round(baseVal * 1000000);
      } else if (unit === 'm' || unit === 'miliar') {
        amount = Math.round(baseVal * 1000000000);
      } else {
        amount = Math.round(baseVal);
      }
    }
  }

  if (amount <= 0) return null;

  // Ekstraksi Deskripsi & Kategori
  var descClean = raw;
  if (match && match[0]) {
    descClean = descClean.replace(new RegExp(escapeRegExp(match[0]), 'i'), '');
  }

  descClean = descClean.replace(/\\b(beli|bayar|buat|untuk|ke|dari|di|oleh|sebesar|rp|seharga)\\b/gi, '');
  descClean = descClean.replace(/\\s+/g, ' ').trim();

  if (!descClean || descClean.length < 2) {
    descClean = isIncome ? "Pemasukan Kas" : "Pengeluaran Kas";
  }

  // Deteksi Kategori Cerdas
  var category = isIncome ? "Gaji & Pemasukan" : "Lainnya";
  var descLower = descClean.toLowerCase();

  if (isIncome) {
    if (/gaji|gajian|kantor|perusahaan/i.test(descLower)) category = "Gaji Utama";
    else if (/freelance|proyek|project|jasa|side/i.test(descLower)) category = "Freelance & Jasa";
    else if (/omset|toko|jual|dagang|bisnis/i.test(descLower)) category = "Usaha & Bisnis";
    else if (/invest|dividen|reksa|crypto|saham/i.test(descLower)) category = "Investasi";
    else category = "Pemasukan Lainnya";
  } else {
    if (/makan|minum|kopi|bakso|ayam|mie|nasi|soto|cimol|cilok|snack|jajan|sarapan|lunch|dinner|resto|kafe|cafe/i.test(descLower)) {
      category = "Makanan & Minuman";
    } else if (/bensin|pertalite|pertamax|solar|parkir|toll|tol|ojol|grab|gojek|maxim|angkot|busway|kereta|krl|servis|tambal/i.test(descLower)) {
      category = "Transportasi";
    } else if (/belanja|baju|sepatu|tas|kaos|sabun|odol|shampoo|skincare|indomaret|alfamart|supermarket|mall|tokopedia|shopee|lazada/i.test(descLower)) {
      category = "Belanja & Pribadi";
    } else if (/listrik|pln|token|air|pdam|wifi|indihome|kuota|pulsa|iuran|kos|kontrakan|sewa|tagihan|bpjs|asuransi/i.test(descLower)) {
      category = "Tagihan & Utilitas";
    } else if (/obat|dokter|apotek|klinik|rumah sakit|vitamin|paracetamol/i.test(descLower)) {
      category = "Kesehatan & Medis";
    } else if (/buku|kursus|seminar|sekolah|kuliah|spp|les/i.test(descLower)) {
      category = "Pendidikan";
    } else if (/nonton|bioskop|game|topup|netflix|spotify|hiburan|liburan|wisata/i.test(descLower)) {
      category = "Hiburan & Rekreasi";
    } else if (/sedekah|infaq|zakat|donasi|masjid|gereja|yatim/i.test(descLower)) {
      category = "Sedekah & Donasi";
    } else {
      category = "Lainnya";
    }
  }

  // Kapitalisasi nama keterangan agar rapi
  descClean = descClean.charAt(0).toUpperCase() + descClean.slice(1);

  return {
    amount: amount,
    description: descClean,
    category: category,
    type: isIncome ? 'pemasukan' : 'pengeluaran'
  };
}

function parseSimpleAmount(text) {
  if (!text) return 0;
  var match = text.trim().toLowerCase().match(/(\\d+(?:[.,]\\d+)?)\\s*(k|rb|ribu|jt|juta)?/i);
  if (!match) return 0;
  var num = parseFloat(match[1].replace(/,/g, '.'));
  var unit = match[2] ? match[2].toLowerCase() : '';
  if (isNaN(num)) return 0;
  if (unit === 'k' || unit === 'rb' || unit === 'ribu') return Math.round(num * 1000);
  if (unit === 'jt' || unit === 'juta') return Math.round(num * 1000000);
  return Math.round(num);
}

// ----------------------------------------------------------------------------
// REKAP, LAPORAN & CACHING METRICS SUPER CEPAT
// ----------------------------------------------------------------------------
function getFastCachedSummary(forceFresh) {
  var cache = CacheService.getScriptCache();
  if (!forceFresh) {
    try {
      var cachedStr = cache.get('fahkeu_metrics_summary');
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }
    } catch (e) {}
  }

  var metrics = calculateSummaryMetrics();
  try {
    cache.put('fahkeu_metrics_summary', JSON.stringify(metrics), 600);
  } catch (e) {}
  return metrics;
}

function updateFastCachedSummary(addedType, addedAmount) {
  var metrics = getFastCachedSummary(false);
  var isIncome = (addedType === 'pemasukan' || addedType === 'income');
  var amt = Number(addedAmount) || 0;
  if (isIncome) {
    metrics.totalIncome = (Number(metrics.totalIncome) || 0) + amt;
  } else {
    metrics.totalExpense = (Number(metrics.totalExpense) || 0) + amt;
  }
  metrics.balance = metrics.totalIncome - metrics.totalExpense;
  metrics.count = (Number(metrics.count) || 0) + 1;
  try {
    CacheService.getScriptCache().put('fahkeu_metrics_summary', JSON.stringify(metrics), 600);
  } catch (e) {}
  return metrics;
}

function invalidateFastCachedSummary() {
  try {
    CacheService.getScriptCache().remove('fahkeu_metrics_summary');
  } catch (e) {}
}

function calculateSummaryMetrics() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var income = 0;
  var expense = 0;
  var count = 0;

  for (var i = 1; i < rows.length; i++) {
    var id = rows[i][0];
    if (!id || id.toString().trim() === '') continue;

    var type = (rows[i][2] || '').toString().toLowerCase().trim();
    var amt = Number(rows[i][3]) || 0;
    if (isNaN(amt) || amt <= 0) continue;

    if (type === 'pemasukan' || type === 'income') {
      income += amt;
      count++;
    } else if (type === 'pengeluaran' || type === 'expense') {
      expense += amt;
      count++;
    }
  }

  return {
    count: count,
    totalIncome: income,
    totalExpense: expense,
    balance: income - expense
  };
}

function calculateDateFilteredSummary(targetDate, filterType) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var targetYMD = Utilities.formatDate(targetDate, "Asia/Jakarta", filterType === 'day' ? "yyyy-MM-dd" : "yyyy-MM");

  var inc = 0;
  var exp = 0;
  var cnt = 0;

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var dVal = rows[i][1];
    var dObj = (dVal instanceof Date) ? dVal : new Date(dVal);
    if (isNaN(dObj.getTime())) continue;

    var rowYMD = Utilities.formatDate(dObj, "Asia/Jakarta", filterType === 'day' ? "yyyy-MM-dd" : "yyyy-MM");
    if (rowYMD === targetYMD) {
      var t = (rows[i][2] || '').toString().toLowerCase().trim();
      var a = Number(rows[i][3]) || 0;
      if (t === 'pemasukan') inc += a;
      else if (t === 'pengeluaran') exp += a;
      cnt++;
    }
  }

  return { income: inc, expense: exp, count: cnt };
}

function generateRekapMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var summary = getFastCachedSummary();

  var lines = [];
  var takeCount = 0;

  for (var i = rows.length - 1; i >= 1 && takeCount < 5; i--) {
    if (!rows[i][0]) continue;
    var tType = (rows[i][2] || 'pengeluaran').toString().toLowerCase();
    var tAmt = Number(rows[i][3]) || 0;
    var tDesc = rows[i][4] || 'Transaksi';
    var tCat = rows[i][5] || 'Lainnya';
    var sign = tType === 'pemasukan' ? '+' : '-';
    var icon = tType === 'pemasukan' ? '🟢' : '🔴';

    lines.push(icon + " <b>" + escapeHtml(tDesc) + "</b>\\n   " + sign + " Rp " + formatRupiahJs(tAmt) + " (" + escapeHtml(tCat) + ")");
    takeCount++;
  }

  var listText = lines.length > 0 ? lines.join('\\n\\n') : "<i>Belum ada transaksi dicatat.</i>";

  return "📊 <b>REKAP 5 TRANSAKSI TERAKHIR</b>\\n" +
         "───────────────────────────\\n" +
         listText + "\\n" +
         "───────────────────────────\\n" +
         "📥 Total Pemasukan   : Rp " + formatRupiahJs(summary.totalIncome) + "\\n" +
         "📤 Total Pengeluaran : Rp " + formatRupiahJs(summary.totalExpense) + "\\n" +
         "💵 <b>Sisa Kas : Rp " + formatRupiahJs(summary.balance) + "</b> (" + summary.count + " data)\\n" +
         "───────────────────────────";
}

// ----------------------------------------------------------------------------
// DATABASE OPERATIONS (GET, UPDATE, DELETE)
// ----------------------------------------------------------------------------
function getLastTransaction() {
  var sheet = getOrCreateTxSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  var row = sheet.getRange(lastRow, 1, 1, 9).getValues()[0];
  if (!row[0]) return null;

  return {
    id: row[0].toString(),
    date: row[1] instanceof Date ? row[1].toISOString() : (row[1] || '').toString(),
    type: (row[2] || 'pengeluaran').toString().toLowerCase(),
    amount: Number(row[3]) || 0,
    description: (row[4] || '').toString(),
    category: (row[5] || 'Lainnya').toString(),
    source: (row[6] || 'telegram').toString()
  };
}

function getTransactionById(txId) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString() === txId.toString()) {
      return {
        rowIndex: i + 1,
        id: rows[i][0].toString(),
        date: rows[i][1] instanceof Date ? rows[i][1].toISOString() : (rows[i][1] || '').toString(),
        type: (rows[i][2] || 'pengeluaran').toString().toLowerCase(),
        amount: Number(rows[i][3]) || 0,
        description: (rows[i][4] || '').toString(),
        category: (rows[i][5] || 'Lainnya').toString()
      };
    }
  }
  return null;
}

function updateTransactionField(txId, fieldName, newValue) {
  var tx = getTransactionById(txId);
  if (!tx) return false;
  var sheet = getOrCreateTxSheet();
  var colIndex = 5; // default description

  if (fieldName === 'amount') colIndex = 4;
  else if (fieldName === 'description') colIndex = 5;
  else if (fieldName === 'category') colIndex = 6;
  else if (fieldName === 'type') colIndex = 3;

  sheet.getRange(tx.rowIndex, colIndex).setValue(newValue);
  invalidateFastCachedSummary();
  return true;
}

function deleteTransactionById(txId) {
  var tx = getTransactionById(txId);
  if (!tx) return { success: false };
  var sheet = getOrCreateTxSheet();
  sheet.deleteRow(tx.rowIndex);
  invalidateFastCachedSummary();
  return {
    success: true,
    amount: tx.amount,
    description: tx.description
  };
}

function deleteLastTransaction() {
  var sheet = getOrCreateTxSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  var lastData = sheet.getRange(lastRow, 1, 1, 6).getValues()[0];
  var desc = lastData[4] ? lastData[4].toString() : 'Transaksi';
  var amt = Number(lastData[3]) || 0;

  sheet.deleteRow(lastRow);
  invalidateFastCachedSummary();

  return {
    description: desc,
    amount: amt
  };
}

// ----------------------------------------------------------------------------
// UTILITY SPREADSHEET SHEETS & FAST CONFIG
// ----------------------------------------------------------------------------
function getOrCreateTxSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TX_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TX_SHEET_NAME);
    var headers = [["ID_Transaksi", "Tanggal", "Jenis", "Nominal", "Keterangan", "Kategori", "Sumber", "User_ID", "Username"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length)
      .setBackground("#0F172A")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET_NAME);
    var headers = [["Kunci_Pengaturan", "Nilai", "Terakhir_Diperbarui"]];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length)
      .setBackground("#1E293B")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getConfigValue(key) {
  try {
    var propVal = PropertiesService.getScriptProperties().getProperty(key);
    if (propVal) return propVal;

    var cache = CacheService.getScriptCache();
    var cached = cache.get("cfg_" + key);
    if (cached) return cached;

    var sheet = getOrCreateConfigSheet();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString() === key) {
        var v = rows[i][1] ? rows[i][1].toString() : '';
        if (v) {
          PropertiesService.getScriptProperties().setProperty(key, v);
          cache.put("cfg_" + key, v, 600);
        }
        return v;
      }
    }
  } catch (e) {}
  return '';
}

function setConfigValue(key, value) {
  try {
    var strVal = String(value);
    PropertiesService.getScriptProperties().setProperty(key, strVal);
    CacheService.getScriptCache().put("cfg_" + key, strVal, 600);
  } catch (e) {}
}

function extractQueryParam(e, paramName) {
  try {
    if (e && e.parameter && e.parameter[paramName]) return e.parameter[paramName];
    if (e && e.queryString) {
      var re = new RegExp('[?&]' + paramName + '=([^&]+)');
      var match = e.queryString.match(re);
      if (match && match[1]) return decodeURIComponent(match[1]);
    }
  } catch (err) {}
  return '';
}

function getEffectiveBotToken(e) {
  var paramToken = extractQueryParam(e, 'token');
  if (paramToken) return paramToken;
  var propToken = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (propToken) return propToken;
  var sheetToken = getConfigValue('TELEGRAM_BOT_TOKEN');
  if (sheetToken) return sheetToken;
  return TELEGRAM_BOT_TOKEN || "";
}

function getEffectiveUserId(e) {
  var paramId = extractQueryParam(e, 'userId');
  if (paramId) return paramId;
  var prop = PropertiesService.getScriptProperties().getProperty('USER_ID');
  if (prop) return prop;
  return getConfigValue('USER_ID') || "";
}

function getEffectiveUsername(e) {
  var paramUser = extractQueryParam(e, 'username');
  if (paramUser) return paramUser;
  var prop = PropertiesService.getScriptProperties().getProperty('USERNAME');
  if (prop) return prop;
  return getConfigValue('USERNAME') || "";
}

// ----------------------------------------------------------------------------
// TELEGRAM API CLIENT & WEBHOOK DIRECT RESPONSE
// ----------------------------------------------------------------------------
function telegramWebhookResponse(method, payload) {
  var body = Object.assign({ method: method }, payload || {});
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sendTelegramChatAction(chatId, action, customToken) {
  try {
    var token = customToken || getEffectiveBotToken();
    if (!token || !chatId) return;
    action = action || "typing";
    UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendChatAction", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, action: action }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function sendTelegramMessage(chatId, text, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId) return null;
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  try {
    var payloadObj = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    };
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    if (d.ok && d.result) return d.result.message_id;
  } catch (e) {}
  return null;
}

function sendTelegramMessageWithMarkup(chatId, text, replyMarkup, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId) return null;
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  try {
    var payloadObj = {
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      reply_markup: replyMarkup
    };
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    if (d.ok && d.result) return d.result.message_id;
  } catch (e) {}
  return null;
}

function editTelegramMessage(chatId, messageId, newText, replyMarkup, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId || !messageId) return false;
  try {
    var payloadObj = {
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: "HTML"
    };
    if (replyMarkup) payloadObj.reply_markup = replyMarkup;
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/editMessageText", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payloadObj),
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    return Boolean(d.ok);
  } catch (e) {}
  return false;
}

function answerTelegramCallback(callbackQueryId, text, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !callbackQueryId) return;
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/answerCallbackQuery", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function formatRupiahJs(amount) {
  var n = Number(amount) || 0;
  var isNeg = n < 0;
  var absVal = Math.abs(n);
  var parts = absVal.toFixed(0).split('.');
  var formatted = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  return (isNeg ? '-' : '') + formatted;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&');
}

// ----------------------------------------------------------------------------
// MENU ACTIONS GOOGLE SPREADSHEET
// ----------------------------------------------------------------------------
function menuOpenTxSheet() {
  var sheet = getOrCreateTxSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function menuShowBalanceSummary() {
  var metrics = getFastCachedSummary();
  SpreadsheetApp.getUi().alert(
    '📈 Ringkasan Keuangan FahKeu',
    'Total Transaksi: ' + metrics.count + ' baris\\n' +
    'Total Pemasukan: Rp ' + formatRupiahJs(metrics.totalIncome) + '\\n' +
    'Total Pengeluaran: Rp ' + formatRupiahJs(metrics.totalExpense) + '\\n' +
    'Sisa Saldo Kas: Rp ' + formatRupiahJs(metrics.balance),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function menuShowTelegramStatus() {
  var token = getEffectiveBotToken();
  var chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
  var webhookUrl = getConfigValue('WEBHOOK_URL');
  
  var statusText = 'Token Bot: ' + (token ? '✅ Terpasang (' + token.substring(0, 10) + '...)' : '❌ Belum Diatur') + '\\n' +
                   'Chat ID: ' + (chatId ? '✅ ' + chatId : '⚠️ Belum Terhubung (Ketik /start di bot)') + '\\n' +
                   'Target Webhook: ' + (webhookUrl ? '✅ ' + webhookUrl : '❌ Belum Terpasang') + '\\n\\n';
                   
  if (token) {
    try {
      var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/getWebhookInfo", { muteHttpExceptions: true });
      var d = JSON.parse(res.getContentText());
      if (d.ok && d.result) {
        statusText += '--- Status Riil Telegram ---\\n' +
                      'URL Telegram: ' + (d.result.url || 'Tidak Ada Webhook') + '\\n' +
                      'Pending Updates: ' + (d.result.pending_update_count || 0) + '\\n' +
                      'Status: ' + (d.result.url ? '🟢 24 Jam Aktif' : '🔴 Non-Aktif');
        if (d.result.last_error_message) {
          statusText += '\\nPesan Error: ' + d.result.last_error_message;
        }
      }
    } catch(e) {}
  }

  SpreadsheetApp.getUi().alert('🤖 Status Integrasi Bot Telegram 24 Jam', statusText, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuSetTelegramConfig() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt('🤖 Pengaturan Bot Telegram', 'Masukkan Token Bot dari @BotFather:', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() == ui.Button.OK) {
    var token = prompt.getResponseText().trim();
    if (token) {
      handleSetupTelegram({ token: token });
      ui.alert('✅ Berhasil', 'Token bot berhasil disimpan ke sistem.', ui.ButtonSet.OK);
    }
  }
}

function menuShowStatus() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getLastRow() - 1;
  SpreadsheetApp.getUi().alert('ℹ️ Status Database', 'Database Keuangan aktif 24 jam dengan ' + (rows > 0 ? rows : 0) + ' transaksi.', SpreadsheetApp.getUi().ButtonSet.OK);
}
`;
