/**
 * Google Apps Script Khusus Pencatat Keuangan & Bot Telegram (Code.gs Keuangan 24 Jam)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis
 */

export const GOOGLE_APPS_SCRIPT_FINANCE_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - KHUSUS PENCATAT KEUANGAN & BOT TELEGRAM 24 JAM (Code.gs)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis
 * ============================================================================
 * Fitur Unggulan 24 Jam Non-Stop:
 * 1. Webhook Telegram 24/7 Gratis & Cepat (Berjalan di Cloud Server Google).
 * 2. Natural Language Parser Cerdas (beli cimol 3k, gaji masuk 20 juta, kopi 18rb, dll).
 * 3. Menu Interaktif Edit Struk Belanja (Bisa ubah nominal, toko, kategori sebelum simpan).
 * 4. Dukungan OCR AI Vision Opsional (Gemini 2.5 Flash / 1.5 Flash langsung di Apps Script).
 * 5. Integrasi Penuh 3-Arah: Bot Telegram <--> Google Spreadsheet <--> Website Realtime.
 * 6. Perintah Pintar: /start, /saldo, /rekap, /hariini, /bulanini, /hapus, /struk, /reset.
 */

// Token Bot Telegram bawaan (Otomatis terisi jika Anda salin dari Website)
var TELEGRAM_BOT_TOKEN = ""; 

// Chat ID bawaan (Opsional - otomatis terdeteksi saat pertama kali chat bot)
var DEFAULT_CHAT_ID = "";

// Gemini API Key Opsional (Untuk membaca Foto Struk secara otomatis di Google Apps Script)
var GEMINI_API_KEY = "";

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
      .addItem('📋 Buka Lembar Transaksi', 'menuOpenTxSheet')
      .addItem('📈 Rekap Saldo & Ringkasan', 'menuShowBalanceSummary')
      .addSeparator()
      .addItem('⚡ Aktifkan Webhook Bot 24 Jam Otomatis', 'menuSetupWebhook24Jam')
      .addItem('🤖 Status Integrasi Bot Telegram & Webhook', 'menuShowTelegramStatus')
      .addItem('⚙️ Atur Token Bot & Chat ID Manual', 'menuSetTelegramConfig')
      .addItem('🔑 Atur Gemini API Key (Opsional - Scan Struk)', 'menuSetGeminiKey')
      .addSeparator()
      .addItem('ℹ️ Status Database Keuangan', 'menuShowStatus')
      .addToUi();
  } catch (e) {
    Logger.log("onOpen error: " + e.toString());
  }
}

/**
 * Pasang Webhook Bot Telegram 24 Jam Otomatis langsung dari Google Spreadsheet!
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
    ui.alert(
      '⚠️ Belum Ada Deployment Web App',
      'Silakan klik tombol "Terapkan" (Deploy) > "Deployment baru" > pilih "Aplikasi Web" (Web App) > Yang memiliki akses: "Siapa saja (Anyone)".\\n\\nSetelah itu, jalankan menu ini kembali.',
      ui.ButtonSet.OK
    );
    return;
  }

  var result = registerTelegramWebhookWithToken(token, webAppUrl);
  if (result.success) {
    ui.alert(
      '🎉 Webhook 24 Jam Berhasil Diaktifkan!',
      'Bot Telegram Anda kini terhubung 100% dan aktif 24 jam nonstop ke Google Spreadsheet ini!\\n\\nTarget URL: ' + webAppUrl + '\\n\\nSilakan buka bot Anda di Telegram dan ketik /start atau catat transaksi langsung!',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert('⚠️ Gagal Mendaftarkan Webhook: ' + result.message);
  }
}

function registerTelegramWebhookWithToken(token, webAppUrl) {
  try {
    if (!token || !webAppUrl) return { success: false, message: "Token atau URL Web App kosong." };
    var cleanToken = token.trim();
    var cleanUrl = webAppUrl.trim();
    var targetWebhookUrl = cleanUrl + (cleanUrl.indexOf('?') !== -1 ? '&' : '?') + 'token=' + encodeURIComponent(cleanToken);

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
      return { success: true, message: data.description || "Webhook berhasil dipasang." };
    } else {
      return { success: false, message: data.description || "Ditolak oleh Telegram API." };
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
    var parameter = e.parameter || {};
    var action = (parameter.action || '').toLowerCase().trim();

    // 1. Setup & Pendaftaran Webhook Telegram
    if (action === 'setup_telegram') {
      return handleSetupTelegram(parameter);
    }

    if (action === 'set_webhook') {
      var tokenToSet = parameter.token || getEffectiveBotToken(e);
      var currentUrl = parameter.url || ScriptApp.getService().getUrl();
      var regResult = registerTelegramWebhookWithToken(tokenToSet, currentUrl);
      return jsonResponse(regResult);
    }

    // 2. Info Status Webhook & Chat ID untuk Website
    if (action === 'get_chat_id' || action === 'get_config' || action === 'get_telegram_status') {
      var storedChatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID || '';
      var storedUsername = PropertiesService.getScriptProperties().getProperty('TELEGRAM_USERNAME') || getConfigValue('TELEGRAM_USERNAME') || '';
      var storedName = PropertiesService.getScriptProperties().getProperty('TELEGRAM_NAME') || getConfigValue('TELEGRAM_NAME') || '';
      var hasToken = Boolean(getEffectiveBotToken(e));
      return jsonResponse({
        success: true,
        chatId: storedChatId,
        username: storedUsername,
        name: storedName,
        configured: Boolean(storedChatId),
        hasToken: hasToken,
        webAppUrl: ScriptApp.getService().getUrl() || ''
      });
    }

    if (action === 'get_webhook_info') {
      var botToken = getEffectiveBotToken(e);
      if (!botToken) return jsonResponse({ success: false, message: "Bot token belum diatur." });
      var infoRes = UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/getWebhookInfo", { muteHttpExceptions: true });
      return ContentService.createTextOutput(infoRes.getContentText()).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'test_message') {
      var tToken = getEffectiveBotToken(e);
      var tChatId = parameter.chatId || PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || getConfigValue('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
      if (!tToken || !tChatId) return jsonResponse({ success: false, message: "Token atau Chat ID belum tersedia." });
      var testTxt = parameter.text || "🔔 <b>Tes Koneksi FahKeu:</b>\\n\\n✅ Bot Telegram & Google Apps Script berfungsi normal 100%!";
      sendTelegramMessage(tChatId, testTxt, tToken);
      return jsonResponse({ success: true, message: "Pesan tes berhasil dikirim ke Telegram." });
    }

    // 3. Fallback Mutasi Transaksi via GET jika POST terkena pembatasan CORS browser
    if (action === 'add' || action === 'edit' || action === 'update' || action === 'delete' || action === 'clear' || action === 'batch_add' || action === 'sync_all') {
      var payload = { action: action };
      if (parameter.data) {
        try { payload = Object.assign(payload, JSON.parse(parameter.data)); } catch (err) {}
      }
      if (parameter.transactions) {
        try { payload.transactions = typeof parameter.transactions === 'string' ? JSON.parse(parameter.transactions) : parameter.transactions; } catch(err) {}
      }
      if (parameter.transaction) {
        try { payload.transaction = typeof parameter.transaction === 'string' ? JSON.parse(parameter.transaction) : parameter.transaction; } catch(err) {}
      }
      if (parameter.id) payload.id = parameter.id;
      if (parameter.userId) payload.userId = parameter.userId;
      if (parameter.username) payload.username = parameter.username;
      return handleTxAction(payload);
    }

    // 4. Ambil Seluruh Daftar Transaksi (Sync ke Website)
    var sheet = getOrCreateTxSheet();
    var rows = sheet.getDataRange().getValues();
    var transactions = [];
    var targetUserId = parameter.userId || '';
    var targetUsername = parameter.username ? parameter.username.toLowerCase().trim() : '';

    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[0]) continue;

      var txUserId = row[7] ? row[7].toString().trim() : '';
      var txUsername = row[8] ? row[8].toString().toLowerCase().trim() : '';
      var txSource = row[6] ? row[6].toString().toLowerCase().trim() : '';

      // Tampilkan seluruh transaksi milik pengguna
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

    // Urutkan transaksi dari yang paling baru
    transactions.sort(function(a, b) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    var summary = calculateSummaryMetrics();

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
// POST REQUEST HANDLER (doPost)
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

    // A. WEBHOOK DARI TELEGRAM (Pesan, Foto, Callback Query Tombol Interaktif)
    if (postData && (postData.message || postData.channel_post || postData.edited_message || postData.callback_query)) {
      return handleTelegramWebhook(postData, e);
    }

    // B. SETUP OTOMATIS TELEGRAM DARI WEBSITE
    if (postData && (postData.action === 'setup_telegram' || postData.action === 'setupTelegram')) {
      return handleSetupTelegram(postData);
    }

    if (postData && postData.action === 'set_webhook') {
      var currentUrl = postData.url || ScriptApp.getService().getUrl();
      var botToken = postData.token || getEffectiveBotToken(e);
      return jsonResponse(registerTelegramWebhookWithToken(botToken, currentUrl));
    }

    // C. AKSI MUTASI TRANSAKSI DARI WEBSITE
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
        token: token ? (token.substring(0, 8) + "...") : "tersimpan",
        chatId: chatId || "belum diset",
        userId: userId || "",
        username: username || ""
      }
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER AKSI TRANSAKSI DARI APLIKASI WEB
// ----------------------------------------------------------------------------
function handleTxAction(payload) {
  try {
    var sheet = getOrCreateTxSheet();
    var action = payload.action;

    // 1. TAMBAH TRANSAKSI (ADD)
    if (action === 'add') {
      var tx = payload.transaction || payload;
      if (!tx || !tx.amount) {
        return jsonResponse({ success: false, error: "Data transaksi tidak valid" });
      }

      var txId = tx.id || ('tx_' + new Date().getTime());
      var dateStr = tx.date ? new Date(tx.date).toISOString() : new Date().toISOString();
      var typeStr = (tx.type || 'pengeluaran').toLowerCase();
      var amountNum = Number(tx.amount) || 0;
      var descStr = tx.description || 'Transaksi';
      var catStr = tx.category || 'Lainnya';
      var srcStr = tx.source || 'web';
      var uIdStr = tx.userId || getEffectiveUserId();
      var uNameStr = tx.username || getEffectiveUsername();

      sheet.appendRow([
        txId,
        dateStr,
        typeStr,
        amountNum,
        descStr,
        catStr,
        srcStr,
        uIdStr,
        uNameStr
      ]);

      return jsonResponse({
        success: true,
        message: "Transaksi berhasil disimpan ke Google Spreadsheet",
        transaction: {
          id: txId,
          date: dateStr,
          type: typeStr,
          amount: amountNum,
          description: descStr,
          category: catStr,
          source: srcStr,
          userId: uIdStr,
          username: uNameStr
        }
      });
    }

    // 2. UBAH TRANSAKSI (EDIT / UPDATE)
    if (action === 'edit' || action === 'update') {
      var editTx = payload.transaction || payload;
      var editTargetId = editTx.id || payload.id;
      if (!editTargetId) return jsonResponse({ success: false, error: "ID transaksi diperlukan untuk edit" });

      var editRows = sheet.getDataRange().getValues();
      for (var e = 1; e < editRows.length; e++) {
        if (editRows[e][0].toString() === editTargetId.toString()) {
          var targetRow = e + 1;
          if (editTx.date) sheet.getRange(targetRow, 2).setValue(new Date(editTx.date).toISOString());
          if (editTx.type) sheet.getRange(targetRow, 3).setValue(String(editTx.type).toLowerCase());
          if (editTx.amount !== undefined) sheet.getRange(targetRow, 4).setValue(Number(editTx.amount) || 0);
          if (editTx.description) sheet.getRange(targetRow, 5).setValue(String(editTx.description));
          if (editTx.category) sheet.getRange(targetRow, 6).setValue(String(editTx.category));
          return jsonResponse({ success: true, message: "Transaksi berhasil diperbarui di Google Spreadsheet" });
        }
      }
      return jsonResponse({ success: false, error: "Transaksi dengan ID tersebut tidak ditemukan" });
    }

    // 3. TAMBAH BANYAK TRANSAKSI (BATCH ADD / DUA ARAH)
    if (action === 'batch_add' || action === 'sync_all') {
      var txList = payload.transactions || payload.data || [];
      if (typeof txList === 'string') {
        try { txList = JSON.parse(txList); } catch(e) {}
      }

      if (!Array.isArray(txList) || txList.length === 0) {
        return jsonResponse({
          success: true,
          message: "Tidak ada transaksi yang perlu ditambahkan",
          addedCount: 0
        });
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

      return jsonResponse({
        success: true,
        message: "Berhasil menambahkan " + addedCount + " transaksi ke Google Spreadsheet",
        addedCount: addedCount
      });
    }

    // 4. HAPUS TRANSAKSI (DELETE)
    if (action === 'delete') {
      var targetId = payload.id || (payload.transaction ? payload.transaction.id : '');
      if (!targetId) return jsonResponse({ success: false, error: "ID transaksi diperlukan" });

      var rows = sheet.getDataRange().getValues();
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0].toString() === targetId.toString()) {
          sheet.deleteRow(i + 1);
          return jsonResponse({ success: true, message: "Transaksi berhasil dihapus" });
        }
      }
      return jsonResponse({ success: false, error: "Transaksi tidak ditemukan" });
    }

    // 5. KOSONGKAN TRANSAKSI (CLEAR - RESET KE RP 0)
    if (action === 'clear') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var sheet1 = ss.getSheetByName("Sheet1");
        if (sheet1 && sheet1.getLastRow() > 1) {
          sheet1.deleteRows(2, sheet1.getLastRow() - 1);
        }
      } catch (s1Err) {}

      // Beritahu Bot Telegram bahwa seluruh data transaksi telah dibersihkan
      try {
        var botToken = getEffectiveBotToken(payload);
        var activeChatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || 
                           getConfigValue('TELEGRAM_CHAT_ID') || 
                           DEFAULT_CHAT_ID;
        if (botToken && activeChatId) {
          var resetNotice = "🗑️ <b>Pemberitahuan Sistem FahKeu:</b>\\n\\n" +
                            "Seluruh data transaksi telah <b>dikosongkan dari Website!</b>\\n\\n" +
                            "📊 <b>Rekap Saldo Kas Baru:</b>\\n" +
                            "📥 <b>Total Pemasukan:</b> Rp 0\\n" +
                            "📤 <b>Total Pengeluaran:</b> Rp 0\\n" +
                            "💰 <b>Sisa Saldo Kas:</b> <b>Rp 0</b>\\n" +
                            "───────────────────────────\\n" +
                            "✅ <i>Bot Telegram, Website, & Google Spreadsheet kini kembali sinkron dari nol (Rp 0).</i>";
          sendTelegramMessage(activeChatId, resetNotice, botToken);
        }
      } catch (tgNotifyErr) {}

      return jsonResponse({ success: true, message: "Seluruh data transaksi berhasil dikosongkan (Reset Rp 0)" });
    }

    return jsonResponse({ success: false, error: "Aksi tidak dikenal: " + action });

  } catch (e) {
    Logger.log("handleTxAction err: " + e.toString());
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER WEBHOOK BOT TELEGRAM 24 JAM
// ----------------------------------------------------------------------------
function handleTelegramWebhook(update, rawEvent) {
  try {
    update = update || {};

    // 1. Anti-Spam: Deduplikasi update_id
    var updateId = update.update_id;
    if (updateId) {
      try {
        var cache = CacheService.getScriptCache();
        var cacheKey = "tg_upd_" + updateId;
        if (cache && cache.get(cacheKey)) {
          return jsonResponse({ success: true, note: "duplicate ignored" });
        }
        if (cache) cache.put(cacheKey, "1", 600);
      } catch (cacheErr) {}
    }

    var token = getEffectiveBotToken(rawEvent);

    // ========================================================================
    // A. PENANGANAN CALLBACK QUERY (TOMBOL INTERAKTIF DI TELEGRAM)
    // ========================================================================
    if (update.callback_query) {
      return handleTelegramCallbackQuery(update.callback_query, token);
    }

    var msg = update.message || update.channel_post || update.edited_message;
    if (!msg) return jsonResponse({ success: true, note: "empty update ignored" });

    var chatId = msg.chat ? msg.chat.id : null;
    if (!chatId) return jsonResponse({ success: true, note: "no chat id" });

    // Abaikan pesan lama (> 180 detik)
    var nowSeconds = Math.floor(new Date().getTime() / 1000);
    if (msg.date && (nowSeconds - msg.date > 180)) {
      return jsonResponse({ success: true, note: "stale message ignored" });
    }

    var rawUserText = (msg.text || msg.caption || '').trim();
    var hasPhoto = (msg.photo && msg.photo.length > 0) || Boolean(msg.document);

    if (!rawUserText && !hasPhoto) return jsonResponse({ success: true, note: "non-text ignored" });

    var senderName = msg.from ? (msg.from.first_name || msg.from.username || 'Pengguna') : 'Pengguna';
    var senderUsername = msg.from && msg.from.username ? msg.from.username : '';

    // Simpan Chat ID secara dinamis
    if (chatId) {
      try {
        var strChatId = chatId.toString();
        PropertiesService.getScriptProperties().setProperty('TELEGRAM_CHAT_ID', strChatId);
        setConfigValue('TELEGRAM_CHAT_ID', strChatId);
        if (senderUsername) {
          PropertiesService.getScriptProperties().setProperty('TELEGRAM_USERNAME', senderUsername);
          setConfigValue('TELEGRAM_USERNAME', senderUsername);
        }
        if (senderName) {
          PropertiesService.getScriptProperties().setProperty('TELEGRAM_NAME', senderName);
          setConfigValue('TELEGRAM_NAME', senderName);
        }
      } catch (cErr) {}
    }

    // Berikan status mengetik instan
    sendTelegramChatAction(chatId, "typing", token);

    var appUserId = getEffectiveUserId(rawEvent) || chatId.toString();
    var appUsername = getEffectiveUsername(rawEvent) || senderUsername || senderName;

    // ========================================================================
    // B. PENANGANAN INPUT PENGGUNA YANG SEDANG MENGEDIT DRAF STRUK
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
          sendTelegramMessage(chatId, "✅ <b>Nominal diperbarui:</b> Rp " + formatRupiahJs(parsedNewAmt) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan.</i>", token);
          return jsonResponse({ success: true, action: "amount_updated" });
        } else {
          sendTelegramMessage(chatId, "⚠️ <i>Format nominal belum tepat. Masukkan angka nominal yang benar, contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code></i>", token);
          return jsonResponse({ success: true, action: "amount_retry" });
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
          sendTelegramMessage(chatId, "✅ <b>Toko / Keterangan diperbarui:</b> " + escapeHtml(rawUserText) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan.</i>", token);
          return jsonResponse({ success: true, action: "desc_updated" });
        }
      }
    }

    // ========================================================================
    // C. PENANGANAN FOTO / STRUK BELANJA DARI TELEGRAM
    // ========================================================================
    if (hasPhoto) {
      var photoCaption = rawUserText;
      var fileId = '';
      if (msg.photo && msg.photo.length > 0) {
        fileId = msg.photo[msg.photo.length - 1].file_id;
      } else if (msg.document) {
        fileId = msg.document.file_id;
      }

      // 1. Coba baca caption jika ada (misal "indomaret 45k" atau "bensin 25rb")
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

      // 2. Jika tidak ada caption, coba Gemini Vision API jika key tersedia
      var geminiKey = getEffectiveGeminiKey();
      if (!captionParsed && geminiKey && fileId) {
        sendTelegramMessage(chatId, "⏳ <i>Membaca struk menggunakan AI Vision...</i>", token);
        var visionResult = tryGeminiReceiptOcr(fileId, geminiKey, token);
        if (visionResult && visionResult.amount > 0) {
          draftData.amount = visionResult.amount;
          draftData.description = visionResult.description || visionResult.storeName || "Struk Belanja";
          draftData.storeName = visionResult.storeName || draftData.description;
          draftData.category = visionResult.category || "Belanja & Pribadi";
          draftData.type = visionResult.type || "pengeluaran";
        }
      }

      // Simpan draf struk dan kirim pratinjau dengan tombol edit
      saveUserDraft(chatId, draftData);
      var previewText = formatDraftPreview(draftData);
      var keyboard = getReceiptPreviewMarkup(draftId);

      var sentMsgId = sendTelegramMessageWithMarkup(chatId, previewText, keyboard, token);
      if (sentMsgId) {
        draftData.messageId = sentMsgId;
        saveUserDraft(chatId, draftData);
      }

      return jsonResponse({ success: true, action: "receipt_preview" });
    }

    var lowerText = rawUserText.toLowerCase();

    // ========================================================================
    // D. PERINTAH-PERINTAH CERDAS TELEGRAM
    // ========================================================================

    // 1. Perintah /start atau bantuan
    if (lowerText === '/start' || lowerText.indexOf('/start') === 0 || lowerText === 'bantuan' || lowerText === 'help' || lowerText === '/help') {
      var currentSummary = calculateSummaryMetrics();
      var welcome = "👋 Halo, <b>" + escapeHtml(senderName) + "</b>! (@" + escapeHtml(senderUsername || 'user') + ")\\n\\n" +
                    "🤖 <b>Bot FahKeu Aktif 24 Jam Non-Stop!</b>\\n" +
                    "───────────────────────────\\n" +
                    "🆔 <b>Chat ID Anda:</b> <code>" + chatId + "</code>\\n" +
                    "💰 <b>Saldo Kas Saat Ini:</b> <b>Rp " + formatRupiahJs(currentSummary.balance) + "</b> (" + currentSummary.count + " catatan)\\n\\n" +
                    "🧾 <b>Kirim Foto Struk / Nota:</b>\\n" +
                    "Kirim foto bon belanja langsung ke sini! Dilengkapi menu pratinjau & bisa diedit sebelum disimpan.\\n\\n" +
                    "✍️ <b>Contoh Mencatat Transaksi Teks:</b>\\n" +
                    "• <code>beli cimol 3k</code> (Pengeluaran)\\n" +
                    "• <code>kopi kenangan 18rb</code> (Pengeluaran)\\n" +
                    "• <code>makan bakso 25k</code> (Pengeluaran)\\n" +
                    "• <code>isi bensin 35.000</code> (Pengeluaran)\\n" +
                    "• <code>gaji masuk 20 juta</code> (Pemasukan)\\n" +
                    "• <code>terima freelance 1.5jt</code> (Pemasukan)\\n\\n" +
                    "📊 <b>Perintah Praktis:</b>\\n" +
                    "• <b>/saldo</b> : Cek sisa uang riil & kas saat ini\\n" +
                    "• <b>/rekap</b> : Laporan 5 transaksi terakhir\\n" +
                    "• <b>/hariini</b> : Mutasi kas khusus hari ini\\n" +
                    "• <b>/bulanini</b> : Mutasi kas bulan ini\\n" +
                    "• <b>/hapus</b> : Batalkan transaksi yang baru dicatat\\n" +
                    "• <b>/struk</b> : Panduan kirim struk belanja\\n\\n" +
                    "✅ <i>Tersinkronisasi 100% otomatis ke Website & Google Spreadsheet Anda!</i>";

      var startKeyboard = {
        inline_keyboard: [
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
            { text: "📊 Rekap Kas", callback_data: "cmd_rekap" }
          ],
          [
            { text: "🧾 Panduan Struk", callback_data: "cmd_struk" },
            { text: "🗑️ Batalkan Terakhir", callback_data: "cmd_hapus" }
          ]
        ]
      };

      sendTelegramMessageWithMarkup(chatId, welcome, startKeyboard, token);
      return jsonResponse({ success: true, chatId: chatId });
    }

    // 2. Perintah /id atau /chatid
    if (lowerText === '/id' || lowerText === '/chatid' || lowerText === 'id' || lowerText === 'chat id') {
      var idInfo = "🆔 <b>Informasi Telegram Chat ID:</b>\\n" +
                   "───────────────────────────\\n" +
                   "Chat ID Anda: <code>" + chatId + "</code>\\n" +
                   "Nama: <b>" + escapeHtml(senderName) + "</b>\\n" +
                   "Username: @" + escapeHtml(senderUsername || '-') + "\\n\\n" +
                   "✅ <i>Chat ID ini telah otomatis tersimpan & terhubung ke Google Apps Script dan Website Anda.</i>";
      sendTelegramMessage(chatId, idInfo, token);
      return jsonResponse({ success: true });
    }

    // 3. Perintah /saldo atau cek saldo
    if (lowerText === '/saldo' || lowerText === 'saldo' || lowerText === 'cek saldo' || lowerText === 'sisa saldo' || lowerText === 'uang saya') {
      var summarySaldo = calculateSummaryMetrics();
      var defNotice = "";
      if (summarySaldo.totalIncome === 0 && summarySaldo.totalExpense > 0) {
        defNotice = "\\n💡 <i>Catatan: Belum ada pemasukan/saldo awal dicatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar sisa kas riil Anda bernilai positif.</i>";
      } else if (summarySaldo.balance < 0) {
        defNotice = "\\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit Rp " + formatRupiahJs(Math.abs(summarySaldo.balance)) + ").</i>";
      }

      var saldoMsg = "📊 <b>Rekap Saldo Kas FahKeu</b>\\n" +
                     "───────────────────────────\\n" +
                     "🟢 <b>Total Pemasukan:</b> Rp " + formatRupiahJs(summarySaldo.totalIncome) + "\\n" +
                     "🔴 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(summarySaldo.totalExpense) + "\\n" +
                     "───────────────────────────\\n" +
                     "💵 <b>Sisa Saldo Kas (Uang Riil):</b> <b>Rp " + formatRupiahJs(summarySaldo.balance) + "</b>" + defNotice + "\\n\\n" +
                     "📝 <b>Total Transaksi:</b> " + summarySaldo.count + " catatan\\n" +
                     "<i>Sinkron realtime dengan Website & Google Spreadsheet.</i>";

      var saldoKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 Rekap Transaksi", callback_data: "cmd_rekap" },
            { text: "🗑️ Batalkan Terakhir", callback_data: "cmd_hapus" }
          ]
        ]
      };

      sendTelegramMessageWithMarkup(chatId, saldoMsg, saldoKeyboard, token);
      return jsonResponse({ success: true });
    }

    // 4. Perintah /rekap atau laporan
    if (lowerText === '/rekap' || lowerText === 'rekap' || lowerText === 'laporan' || lowerText === 'ringkasan') {
      var rekapMsg = generateRekapMessage();
      sendTelegramMessage(chatId, rekapMsg, token);
      return jsonResponse({ success: true });
    }

    // 4b. Perintah /hariini (Mutasi khusus hari ini)
    if (lowerText === '/hariini' || lowerText === 'hari ini' || lowerText === 'mutasi hari ini') {
      var todayMsg = generateTodaySummaryMessage();
      sendTelegramMessage(chatId, todayMsg, token);
      return jsonResponse({ success: true });
    }

    // 4c. Perintah /bulanini (Mutasi bulan ini)
    if (lowerText === '/bulanini' || lowerText === 'bulan ini') {
      var monthMsg = generateMonthSummaryMessage();
      sendTelegramMessage(chatId, monthMsg, token);
      return jsonResponse({ success: true });
    }

    // 5. Perintah /struk atau /nota (Panduan Kirim & Edit Struk)
    if (lowerText === '/struk' || lowerText === '/nota' || lowerText === 'struk' || lowerText === 'nota') {
      var strukGuide = "🧾 <b>Panduan Kirim &amp; Edit Struk Belanja:</b>\\n" +
                       "───────────────────────────\\n" +
                       "Anda dapat mengirim <b>foto struk, nota belanja, atau bon kasir</b> langsung ke chat bot ini!\\n\\n" +
                       "💡 <b>Fitur Edit Sebelum Simpan:</b>\\n" +
                       "Saat foto struk dikirim, bot otomatis menampilkan pratinjau disertai tombol:\\n" +
                       "• <b>💾 Simpan ke Catatan:</b> Langsung simpan ke sheet & website.\\n" +
                       "• <b>✏️ Ubah Nominal:</b> Koreksi nominal jika ada salah baca.\\n" +
                       "• <b>✏️ Ubah Toko / Ket:</b> Ganti nama toko atau keterangan.\\n" +
                       "• <b>🏷️ Ganti Kategori:</b> Pilih kategori yang sesuai.\\n" +
                       "• <b>🔄 Ganti Jenis:</b> Beralih Pengeluaran atau Pemasukan.\\n" +
                       "• <b>❌ Batal:</b> Batalkan pemindaian struk.\\n\\n" +
                       "👉 Anda juga dapat mengirim foto disertai keterangan & nominal pada caption, contoh:\\n" +
                       "<code>indomaret 45k</code> atau <code>kopi kenangan 18rb</code>.";
      sendTelegramMessage(chatId, strukGuide, token);
      return jsonResponse({ success: true });
    }

    // 6. Perintah /hapus atau /batal (Undo)
    if (lowerText === '/hapus' || lowerText === 'hapus' || lowerText === 'batal' || lowerText === 'undo' || lowerText === '/batal') {
      var delRes = deleteLastTransaction();
      if (delRes.success) {
        var undoNotice = "🗑️ <b>Transaksi Terakhir Berhasil Dibatalkan!</b>\\n\\n" +
                         "• Transaksi: <b>" + escapeHtml(delRes.description) + "</b>\\n" +
                         "• Nominal: Rp " + formatRupiahJs(delRes.amount) + "\\n" +
                         "• Saldo Kas Sekarang: <b>Rp " + formatRupiahJs(calculateTotalBalance()) + "</b>\\n\\n" +
                         "✅ <i>Telah dihapus dari Google Spreadsheet & Website.</i>";
        sendTelegramMessage(chatId, undoNotice, token);
      } else {
        sendTelegramMessage(chatId, "⚠️ Belum ada transaksi yang dapat dibatalkan.", token);
      }
      return jsonResponse({ success: true });
    }

    // 7. Perintah /reset (Kosongkan kas ke Rp 0)
    if (lowerText === '/reset' || lowerText === 'reset kas' || lowerText === 'reset data') {
      var confirmResetKeyboard = {
        inline_keyboard: [
          [
            { text: "⚠️ Ya, Kosongkan ke Rp 0", callback_data: "cmd_confirm_reset" },
            { text: "❌ Batal", callback_data: "cmd_cancel_reset" }
          ]
        ]
      };
      sendTelegramMessageWithMarkup(
        chatId,
        "⚠️ <b>Konfirmasi Pengosongan Data:</b>\\n\\nApakah Anda yakin ingin mengosongkan seluruh data transaksi kas menjadi <b>Rp 0</b>?",
        confirmResetKeyboard,
        token
      );
      return jsonResponse({ success: true });
    }

    // ========================================================================
    // E. NATURAL LANGUAGE PARSER BAHASA INDONESIA SUPER PINTAR
    // ========================================================================
    var parsedTx = parseFinanceText(rawUserText);
    if (parsedTx && parsedTx.amount > 0) {
      var txSheet = getOrCreateTxSheet();
      var newTxId = 'tg_' + new Date().getTime();
      var nowIso = new Date().toISOString();

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

      var postSummary = calculateSummaryMetrics();
      var isIncome = parsedTx.type === 'pemasukan';
      var typeBadge = isIncome ? '🟢 Pemasukan' : '🔴 Pengeluaran';
      var signSymbol = isIncome ? '+ ' : '- ';

      var noticeDef = "";
      if (postSummary.totalIncome === 0 && postSummary.totalExpense > 0) {
        noticeDef = "\\n💡 <i>Catatan: Belum ada pemasukan/saldo awal dicatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar sisa kas riil Anda bernilai positif.</i>";
      } else if (postSummary.balance < 0) {
        noticeDef = "\\n⚠️ <i>Total pengeluaran melebihi pemasukan (Defisit).</i>";
      }

      var recordReply = "📋 <b>Ringkasan Pencatatan:</b>\\n" +
                        "📝 <b>Keterangan:</b> " + escapeHtml(parsedTx.description) + "\\n" +
                        "📂 <b>Kategori:</b> " + escapeHtml(parsedTx.category) + "\\n" +
                        "🏷️ <b>Jenis:</b> " + typeBadge + "\\n" +
                        "💵 <b>Nominal:</b> <b>" + signSymbol + "Rp " + formatRupiahJs(parsedTx.amount) + "</b>\\n" +
                        "───────────────────────────\\n" +
                        "📊 <b>Rekap Saldo Kas:</b>\\n" +
                        "📥 <b>Total Pemasukan:</b> Rp " + formatRupiahJs(postSummary.totalIncome) + "\\n" +
                        "📤 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(postSummary.totalExpense) + "\\n" +
                        "💰 <b>Sisa Saldo Kas (Uang Riil):</b> <b>Rp " + formatRupiahJs(postSummary.balance) + "</b>" + noticeDef + "\\n" +
                        "───────────────────────────\\n" +
                        "✅ <i>Tersimpan otomatis di Google Spreadsheet & Website FahKeu!</i>";

      var actionKeyboard = {
        inline_keyboard: [
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" },
            { text: "🗑️ Batalkan", callback_data: "cmd_hapus" }
          ]
        ]
      };

      sendTelegramMessageWithMarkup(chatId, recordReply, actionKeyboard, token);
      return jsonResponse({ success: true, recorded: parsedTx });
    } else {
      // Bantuan santai jika format belum terbaca
      var helpPrompt = "🤔 Format belum terbaca sebagai transaksi.\\n\\n" +
                       "💡 <b>Coba ketik seperti ini:</b>\\n" +
                       "• <code>beli cimol 3k</code>\\n" +
                       "• <code>makan bakso 25k</code>\\n" +
                       "• <code>kopi 15rb</code>\\n" +
                       "• <code>gaji masuk 20 juta</code>\\n" +
                       "• <code>bensin motor 25.000</code>\\n" +
                       "• Atau kirim <b>foto struk / nota belanja</b> 🧾\\n\\n" +
                       "Ketik <b>/saldo</b> untuk cek uang atau <b>/bantuan</b> untuk panduan.";
      sendTelegramMessage(chatId, helpPrompt, token);
      return jsonResponse({ success: true });
    }

  } catch (err) {
    Logger.log("Telegram Webhook err: " + err.toString());
    return jsonResponse({ success: true, error: err.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER TOMBOL INTERAKTIF TELEGRAM (CALLBACK QUERY)
// ----------------------------------------------------------------------------
function handleTelegramCallbackQuery(cb, token) {
  try {
    var cbData = (cb.data || '').trim();
    var cbId = cb.id;
    var message = cb.message;
    if (!message || !message.chat) return jsonResponse({ success: true });
    var chatId = message.chat.id;
    var messageId = message.message_id;

    // Perintah Cepat
    if (cbData === 'cmd_saldo') {
      answerTelegramCallback(cbId, "Mengambil saldo terkini...", token);
      var sumSaldo = calculateSummaryMetrics();
      var msgSaldo = "📊 <b>Rekap Saldo Kas:</b>\\n" +
                     "📥 <b>Total Pemasukan:</b> Rp " + formatRupiahJs(sumSaldo.totalIncome) + "\\n" +
                     "📤 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(sumSaldo.totalExpense) + "\\n" +
                     "💰 <b>Sisa Saldo Kas:</b> <b>Rp " + formatRupiahJs(sumSaldo.balance) + "</b>";
      sendTelegramMessage(chatId, msgSaldo, token);
      return jsonResponse({ success: true });
    }

    if (cbData === 'cmd_rekap') {
      answerTelegramCallback(cbId, "Mengambil rekap...", token);
      sendTelegramMessage(chatId, generateRekapMessage(), token);
      return jsonResponse({ success: true });
    }

    if (cbData === 'cmd_hapus') {
      answerTelegramCallback(cbId, "Membatalkan...", token);
      var undoRes = deleteLastTransaction();
      if (undoRes.success) {
        sendTelegramMessage(chatId, "🗑️ Transaksi <b>" + escapeHtml(undoRes.description) + "</b> (Rp " + formatRupiahJs(undoRes.amount) + ") berhasil dibatalkan.", token);
      } else {
        sendTelegramMessage(chatId, "⚠️ Tidak ada transaksi yang dapat dibatalkan.", token);
      }
      return jsonResponse({ success: true });
    }

    if (cbData === 'cmd_struk') {
      answerTelegramCallback(cbId, "Panduan struk...", token);
      sendTelegramMessage(chatId, "🧾 Kirim foto struk belanja Anda langsung ke sini untuk pencatatan otomatis!", token);
      return jsonResponse({ success: true });
    }

    if (cbData === 'cmd_confirm_reset') {
      handleTxAction({ action: 'clear' });
      answerTelegramCallback(cbId, "Data kas direset!", token);
      editTelegramMessage(chatId, messageId, "🗑️ <b>Seluruh data transaksi telah dikosongkan (Rp 0)!</b>", { inline_keyboard: [] }, token);
      return jsonResponse({ success: true });
    }

    if (cbData === 'cmd_cancel_reset') {
      answerTelegramCallback(cbId, "Dibatalkan", token);
      editTelegramMessage(chatId, messageId, "ℹ️ <i>Pengosongan data dibatalkan. Transaksi Anda tetap aman.</i>", { inline_keyboard: [] }, token);
      return jsonResponse({ success: true });
    }

    // Interaksi Draf Struk Belanja
    var pendingDraft = getActiveUserDraft(chatId);

    // 1. Simpan Draf Struk
    if (cbData.indexOf('dr_save:') === 0) {
      if (!pendingDraft || !pendingDraft.amount) {
        answerTelegramCallback(cbId, "Data struk sudah disimpan atau kedaluwarsa.", token);
        editTelegramMessage(chatId, messageId, "ℹ️ <i>Data struk ini sudah tersimpan atau kedaluwarsa.</i>", { inline_keyboard: [] }, token);
        return jsonResponse({ success: true });
      }

      var txSheet = getOrCreateTxSheet();
      var txId = 'tg_ocr_' + new Date().getTime();
      var nowIso = new Date().toISOString();

      txSheet.appendRow([
        txId,
        nowIso,
        pendingDraft.type || 'pengeluaran',
        pendingDraft.amount,
        pendingDraft.description || pendingDraft.storeName || 'Struk Belanja',
        pendingDraft.category || 'Belanja & Pribadi',
        'telegram',
        pendingDraft.userId || chatId.toString(),
        pendingDraft.username || 'Telegram User'
      ]);

      var postSum = calculateSummaryMetrics();
      var savedText = "✅ <b>Struk Belanja Berhasil Disimpan!</b>\\n" +
                      "───────────────────────────\\n" +
                      "🏪 <b>Toko / Ket:</b> " + escapeHtml(pendingDraft.description || pendingDraft.storeName) + "\\n" +
                      "💵 <b>Nominal:</b> <b>- Rp " + formatRupiahJs(pendingDraft.amount) + "</b>\\n" +
                      "📂 <b>Kategori:</b> " + escapeHtml(pendingDraft.category) + "\\n" +
                      "───────────────────────────\\n" +
                      "📊 <b>Rekap Saldo Kas:</b>\\n" +
                      "📥 <b>Total Pemasukan:</b> Rp " + formatRupiahJs(postSum.totalIncome) + "\\n" +
                      "📤 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(postSum.totalExpense) + "\\n" +
                      "💰 <b>Sisa Saldo Kas:</b> <b>Rp " + formatRupiahJs(postSum.balance) + "</b>\\n" +
                      "───────────────────────────\\n" +
                      "✅ <i>Tersimpan di Google Spreadsheet & Website FahKeu!</i>\\n\\n" +
                      "💡 <i>Ketik <b>/hapus</b> jika ingin membatalkan transaksi ini.</i>";

      editTelegramMessage(chatId, messageId, savedText, { inline_keyboard: [] }, token);
      answerTelegramCallback(cbId, "✅ Struk tersimpan!", token);
      clearUserDraft(chatId);
      return jsonResponse({ success: true });
    }

    // 2. Batal Draf Struk
    if (cbData.indexOf('dr_cancel:') === 0) {
      clearUserDraft(chatId);
      answerTelegramCallback(cbId, "Scan struk dibatalkan.", token);
      editTelegramMessage(chatId, messageId, "❌ <i>Pencatatan struk dibatalkan. Tidak ada data yang disimpan.</i>", { inline_keyboard: [] }, token);
      return jsonResponse({ success: true });
    }

    // 3. Ubah Nominal
    if (cbData.indexOf('dr_edit_amt:') === 0) {
      if (pendingDraft) {
        pendingDraft.waitingFor = 'amount';
        pendingDraft.messageId = messageId;
        saveUserDraft(chatId, pendingDraft);
        answerTelegramCallback(cbId, "Ketik nominal baru di chat.", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Nominal:</b>\\n\\nKetikkan angka nominal yang benar di chat ini, contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code>.", token);
      }
      return jsonResponse({ success: true });
    }

    // 4. Ubah Toko / Keterangan
    if (cbData.indexOf('dr_edit_desc:') === 0) {
      if (pendingDraft) {
        pendingDraft.waitingFor = 'desc';
        pendingDraft.messageId = messageId;
        saveUserDraft(chatId, pendingDraft);
        answerTelegramCallback(cbId, "Ketik nama toko di chat.", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Toko / Keterangan:</b>\\n\\nKetikkan nama toko atau keterangan pengganti di chat ini, contoh: <code>Indomaret</code> atau <code>Kopi Kenangan</code>.", token);
      }
      return jsonResponse({ success: true });
    }

    // 5. Menu Ganti Kategori
    if (cbData.indexOf('dr_cat_menu:') === 0) {
      if (pendingDraft) {
        var catMarkup = {
          inline_keyboard: [
            [
              { text: "🍽️ Makanan & Minum", callback_data: "dr_set_cat:" + pendingDraft.id + ":Makanan & Minuman" },
              { text: "🛒 Belanja & Pribadi", callback_data: "dr_set_cat:" + pendingDraft.id + ":Belanja & Pribadi" }
            ],
            [
              { text: "🚗 Transportasi", callback_data: "dr_set_cat:" + pendingDraft.id + ":Transportasi" },
              { text: "💡 Tagihan & Utilitas", callback_data: "dr_set_cat:" + pendingDraft.id + ":Tagihan & Utilitas" }
            ],
            [
              { text: "💼 Bisnis & Usaha", callback_data: "dr_set_cat:" + pendingDraft.id + ":Bisnis & Operasional" },
              { text: "📦 Lainnya", callback_data: "dr_set_cat:" + pendingDraft.id + ":Lainnya" }
            ],
            [
              { text: "🔙 Kembali ke Pratinjau", callback_data: "dr_back:" + pendingDraft.id }
            ]
          ]
        };
        answerTelegramCallback(cbId, "Pilih kategori", token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(pendingDraft) + "\\n\\n📂 <b>Silakan pilih kategori di bawah:</b>", catMarkup, token);
      }
      return jsonResponse({ success: true });
    }

    // 6. Pilih Kategori
    if (cbData.indexOf('dr_set_cat:') === 0) {
      var parts = cbData.split(':');
      var newCat = parts.slice(2).join(':') || 'Belanja & Pribadi';
      if (pendingDraft) {
        pendingDraft.category = newCat;
        saveUserDraft(chatId, pendingDraft);
        answerTelegramCallback(cbId, "Kategori: " + newCat, token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
      }
      return jsonResponse({ success: true });
    }

    // 7. Ganti Jenis (Pengeluaran <-> Pemasukan)
    if (cbData.indexOf('dr_toggle_type:') === 0) {
      if (pendingDraft) {
        pendingDraft.type = pendingDraft.type === 'pengeluaran' ? 'pemasukan' : 'pengeluaran';
        saveUserDraft(chatId, pendingDraft);
        var label = pendingDraft.type === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan';
        answerTelegramCallback(cbId, "Jenis diubah: " + label, token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
      }
      return jsonResponse({ success: true });
    }

    // 8. Kembali ke Pratinjau
    if (cbData.indexOf('dr_back:') === 0) {
      if (pendingDraft) {
        answerTelegramCallback(cbId, "", token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
      }
      return jsonResponse({ success: true });
    }

    answerTelegramCallback(cbId, "", token);
    return jsonResponse({ success: true });

  } catch (cbErr) {
    Logger.log("handleTelegramCallbackQuery err: " + cbErr.toString());
    return jsonResponse({ success: true, error: cbErr.toString() });
  }
}

// ----------------------------------------------------------------------------
// HELPER PRATINJAU DRAF STRUK & KEYBOARD
// ----------------------------------------------------------------------------
function formatDraftPreview(d) {
  var typeTxt = d.type === 'pengeluaran' ? '🔴 Pengeluaran' : '🟢 Pemasukan';
  var nominalTxt = d.amount > 0 ? ("Rp " + formatRupiahJs(d.amount)) : "<i>(Belum terdeteksi - klik Ubah Nominal)</i>";

  return "🧾 <b>PRATINJAU STRUK BELANJA</b>\\n" +
         "<i>Periksa dan edit data sebelum disimpan ke catatan kas:</i>\\n" +
         "───────────────────────────\\n" +
         "🏪 <b>Toko / Ket:</b> <b>" + escapeHtml(d.description || d.storeName || 'Struk') + "</b>\\n" +
         "💵 <b>Nominal:</b> <b>" + nominalTxt + "</b>\\n" +
         "📂 <b>Kategori:</b> <b>" + escapeHtml(d.category || 'Belanja & Pribadi') + "</b>\\n" +
         "🏷️ <b>Jenis:</b> " + typeTxt + "\\n" +
         "───────────────────────────\\n" +
         "💡 <i>Klik tombol di bawah jika ingin mengoreksi nominal atau nama toko:</i>";
}

function getReceiptPreviewMarkup(draftId) {
  return {
    inline_keyboard: [
      [
        { text: "💾 Simpan ke Catatan", callback_data: "dr_save:" + draftId }
      ],
      [
        { text: "✏️ Ubah Nominal", callback_data: "dr_edit_amt:" + draftId },
        { text: "✏️ Ubah Toko/Ket", callback_data: "dr_edit_desc:" + draftId }
      ],
      [
        { text: "🏷️ Ganti Kategori", callback_data: "dr_cat_menu:" + draftId },
        { text: "🔄 Ganti Jenis", callback_data: "dr_toggle_type:" + draftId }
      ],
      [
        { text: "❌ Batalkan", callback_data: "dr_cancel:" + draftId }
      ]
    ]
  };
}

function getActiveUserDraft(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get("draft_" + chatId);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return null;
}

function saveUserDraft(chatId, draftData) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put("draft_" + chatId, JSON.stringify(draftData), 1800);
  } catch (e) {}
}

function clearUserDraft(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("draft_" + chatId);
  } catch (e) {}
}

// ----------------------------------------------------------------------------
// PARSER BAHASA INDONESIA NATURAL UNTUK KEUANGAN (SUPER CERDAS)
// ----------------------------------------------------------------------------
function parseFinanceText(text) {
  var clean = text.toLowerCase().trim();
  var amount = 0;
  var type = 'pengeluaran'; // default

  // 1. Deteksi Tipe Transaksi (+ / - atau Kata Kunci)
  if (clean.indexOf('+') === 0) {
    type = 'pemasukan';
  } else if (clean.indexOf('-') === 0) {
    type = 'pengeluaran';
  } else {
    var incomeKeywords = [
      'gaji', 'salary', 'masuk', 'terima', 'pemasukan', 'transfer', 'freelance', 
      'sampingan', 'bonus', 'thr', 'untung', 'dapat', 'cuan', 'laba', 'plus',
      'jualan', 'dagang', 'dividen', 'bunga', 'reksadana', 'crypto', 'hadiah',
      'angpao', 'uang jajan dari', 'nemu uang', 'nemu duit', 'saldo awal', 'modal awal'
    ];
    var expenseKeywords = [
      'pengeluaran', 'beli', 'bayar', 'untuk', 'makan', 'bakso', 'kopi', 
      'bensin', 'pertalite', 'pertamax', 'pulsa', 'kuota', 'listrik', 'pln',
      'air', 'pdam', 'belanja', 'jajan', 'ongkir', 'kos', 'kontrakan', 'cicilan',
      'tiket', 'nonton', 'keluar', 'minum', 'gojek', 'grab', 'shopee', 'tokopedia', 
      'cimol', 'cilok', 'seblak', 'minus', 'parkir', 'tol', 'obat', 'dokter'
    ];

    var hasIncome = incomeKeywords.some(function(k) { return clean.indexOf(k) !== -1; });
    var hasExpense = expenseKeywords.some(function(k) { return clean.indexOf(k) !== -1; });

    if (hasIncome && !hasExpense) {
      type = 'pemasukan';
    } else if (hasExpense && !hasIncome) {
      type = 'pengeluaran';
    } else if (hasIncome && hasExpense) {
      var incIdx = 9999;
      var expIdx = 9999;
      for (var i = 0; i < incomeKeywords.length; i++) {
        var idx = clean.indexOf(incomeKeywords[i]);
        if (idx !== -1 && idx < incIdx) incIdx = idx;
      }
      for (var j = 0; j < expenseKeywords.length; j++) {
        var edx = clean.indexOf(expenseKeywords[j]);
        if (edx !== -1 && edx < expIdx) expIdx = edx;
      }
      type = incIdx < expIdx ? 'pemasukan' : 'pengeluaran';
    }
  }

  // 2. Ekstraksi Nominal Uang
  var amountRegex = /(?:rp\.?\s*)?(\d+[\d.,]*)\s*(juta|miliar|jt|ribu|rb|k|m|r)?\b/gi;
  var match;
  var parsedAmount = 0;
  var originalAmountText = '';
  var highestVal = 0;

  while ((match = amountRegex.exec(clean)) !== null) {
    var rawNumber = match[1];
    var suffix = match[2] ? match[2].toLowerCase() : '';
    var numVal = 0;

    if (suffix) {
      var normalizedNum = rawNumber.replace(/,/g, '.');
      numVal = parseFloat(normalizedNum);
    } else {
      var hasMultipleDots = (rawNumber.match(/\\./g) || []).length > 1;
      var hasCommas = rawNumber.indexOf(',') !== -1;

      if (hasMultipleDots) {
        numVal = parseFloat(rawNumber.replace(/\\./g, ''));
      } else if (hasCommas) {
        numVal = parseFloat(rawNumber.replace(/\\./g, '').replace(/,/g, '.'));
      } else {
        var dotIndex = rawNumber.indexOf('.');
        if (dotIndex !== -1) {
          var digitsAfterDot = rawNumber.length - 1 - dotIndex;
          if (digitsAfterDot === 3) {
            numVal = parseFloat(rawNumber.replace(/\\./g, ''));
          } else {
            numVal = parseFloat(rawNumber);
          }
        } else {
          numVal = parseFloat(rawNumber);
        }
      }
    }

    if (isNaN(numVal) || numVal <= 0) continue;

    var multiplier = 1;
    if (suffix === 'k' || suffix === 'rb' || suffix === 'ribu' || suffix === 'r') {
      multiplier = 1000;
    } else if (suffix === 'jt' || suffix === 'juta') {
      multiplier = 1000000;
    } else if (suffix === 'm' || suffix === 'miliar') {
      multiplier = 1000000000;
    }

    var finalVal = Math.round(numVal * multiplier);
    if (finalVal > highestVal) {
      highestVal = finalVal;
      parsedAmount = finalVal;
      originalAmountText = match[0];
    }
  }

  // Fallback sebutan kata angka: setengah juta, satu juta, dua juta, seratus ribu
  if (parsedAmount <= 0) {
    if (clean.indexOf('setengah juta') !== -1) { parsedAmount = 500000; originalAmountText = 'setengah juta'; }
    else if (clean.indexOf('satu juta') !== -1) { parsedAmount = 1000000; originalAmountText = 'satu juta'; }
    else if (clean.indexOf('dua juta') !== -1) { parsedAmount = 2000000; originalAmountText = 'dua juta'; }
    else if (clean.indexOf('tiga juta') !== -1) { parsedAmount = 3000000; originalAmountText = 'tiga juta'; }
    else if (clean.indexOf('lima juta') !== -1) { parsedAmount = 5000000; originalAmountText = 'lima juta'; }
    else if (clean.indexOf('sepuluh juta') !== -1) { parsedAmount = 10000000; originalAmountText = 'sepuluh juta'; }
    else if (clean.indexOf('dua puluh juta') !== -1) { parsedAmount = 20000000; originalAmountText = 'dua puluh juta'; }
    else if (clean.indexOf('seratus ribu') !== -1) { parsedAmount = 100000; originalAmountText = 'seratus ribu'; }
    else if (clean.indexOf('dua ratus ribu') !== -1) { parsedAmount = 200000; originalAmountText = 'dua ratus ribu'; }
    else if (clean.indexOf('lima puluh ribu') !== -1) { parsedAmount = 50000; originalAmountText = 'lima puluh ribu'; }
  }

  if (parsedAmount <= 0) return null;

  // 3. Bersihkan Deskripsi dari Kata Gangguan (Noise)
  var description = clean;
  if (originalAmountText) {
    description = description.replace(originalAmountText, '');
  }

  var noiseWords = [
    'sebesar', 'untuk', 'beli', 'bayar', 'pemasukan', 'pengeluaran', 
    'nominal', 'sebanyak', 'harga', 'rupiah', 'rp', 'buat', 'jajan', 
    'uang', 'masuk', 'keluar', 'dapat', 'terima', 'plus', 'minus', '+', '-'
  ];

  var words = description.split(/\\s+/);
  var filteredWords = [];
  for (var w = 0; w < words.length; w++) {
    var rawWord = words[w].replace(/[^a-z0-9]/g, '');
    if (rawWord && noiseWords.indexOf(rawWord) === -1) {
      filteredWords.push(rawWord);
    }
  }

  var cleanedDesc = filteredWords.join(' ');
  if (cleanedDesc) {
    cleanedDesc = cleanedDesc.replace(/\\b\\w/g, function(l) { return l.toUpperCase(); });
  } else {
    cleanedDesc = type === 'pemasukan' ? 'Pemasukan Kas' : 'Pengeluaran Kas';
  }

  var category = detectCategory(cleanedDesc, type);

  return {
    type: type,
    amount: parsedAmount,
    description: cleanedDesc,
    category: category
  };
}

function parseSimpleAmount(input) {
  if (!input) return null;
  var res = parseFinanceText(input);
  return res ? res.amount : null;
}

function detectCategory(desc, type) {
  var d = desc.toLowerCase();

  if (type === 'pemasukan') {
    if (d.match(/(gaji|salary|bulanan|upah|tunjangan|thr)/i)) return 'Gaji & Pendapatan Tetap';
    if (d.match(/(freelance|sampingan|proyek|project|desain|coding|jasa)/i)) return 'Freelance & Sampingan';
    if (d.match(/(investasi|saham|reksadana|crypto|cuan|bunga|dividen)/i)) return 'Investasi & Cuan';
    if (d.match(/(jualan|dagang|bisnis|laba|omset|olshop|toko|warung)/i)) return 'Penjualan & Bisnis';
    if (d.match(/(transfer|kiriman|orang tua|hadiah|angpao|gift)/i)) return 'Pemberian & Transfer';
    return 'Pemasukan Kas';
  }

  // Pengeluaran
  if (d.match(/(cimol|cilok|cilor|seblak|batagor|siomay|gorengan|martabak|bakso|makan|kopi|minum|sate|nasgor|nasi|warteg|mie|jajan|boba|roti|cafe|resto|restoran|kuliner|ayam|bebek|soto|rawon|snack|cemilan|es|jus|teh|burger|pizza|donat|tahu|tempe)/i)) {
    return 'Makanan & Minuman';
  }
  if (d.match(/(bensin|ojek|gojek|grab|mobil|motor|toll|tol|parkir|tiket|kereta|pesawat|bus|travel|pertalite|pertamax|spbu|tambal ban)/i)) {
    return 'Transportasi';
  }
  if (d.match(/(belanja|baju|shopee|tokped|tokopedia|celana|sepatu|skincare|makeup|salon|potong rambut|mall|supermarket|indomaret|alfamart)/i)) {
    return 'Belanja & Pribadi';
  }
  if (d.match(/(kos|kontrakan|listrik|pln|air|pdam|wifi|indihome|internet|pulsa|kuota|langganan|netflix|spotify|asuransi|bpjs|pajak|cicilan)/i)) {
    return 'Tagihan & Utilitas';
  }
  if (d.match(/(nonton|bioskop|xxi|game|topup|steam|liburan|hotel|wisata|konser|karaoke|healing)/i)) {
    return 'Hiburan & Liburan';
  }
  if (d.match(/(obat|dokter|rs|rumah sakit|klinik|vitamin|apotek|sakit|gigi)/i)) {
    return 'Kesehatan';
  }
  if (d.match(/(sedekah|infaq|zakat|masjid|donasi)/i)) {
    return 'Sedekah & Sosial';
  }

  return 'Lain-lain';
}

// ----------------------------------------------------------------------------
// FUNGSI OCR GEMINI VISION DI GOOGLE APPS SCRIPT (OPSIONAL 24 JAM)
// ----------------------------------------------------------------------------
function tryGeminiReceiptOcr(fileId, apiKey, botToken) {
  try {
    if (!fileId || !apiKey || !botToken) return null;
    var fileInfoRes = UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + fileId, { muteHttpExceptions: true });
    var fileInfo = JSON.parse(fileInfoRes.getContentText());
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) return null;

    var filePath = fileInfo.result.file_path;
    var fileBytes = UrlFetchApp.fetch("https://api.telegram.org/file/bot" + botToken + "/" + filePath).getContent();
    var base64Img = Utilities.base64Encode(fileBytes);

    var geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + apiKey;
    var payload = {
      contents: [{
        parts: [
          { text: "Ekstrak struk belanja ini dalam format JSON: { storeName: string, amount: number (total belanja tanpa titik/koma), category: string, description: string, type: 'pengeluaran' }" },
          { inline_data: { mime_type: "image/jpeg", data: base64Img } }
        ]
      }],
      generationConfig: { response_mime_type: "application/json" }
    };

    var geminiRes = UrlFetchApp.fetch(geminiUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var geminiData = JSON.parse(geminiRes.getContentText());
    if (geminiData.candidates && geminiData.candidates[0].content && geminiData.candidates[0].content.parts) {
      var rawJson = geminiData.candidates[0].content.parts[0].text;
      return JSON.parse(rawJson);
    }
  } catch (ocrErr) {
    Logger.log("tryGeminiReceiptOcr error: " + ocrErr.toString());
  }
  return null;
}

// ----------------------------------------------------------------------------
// REKAP & LAPORAN KEUANGAN
// ----------------------------------------------------------------------------
function calculateTotalBalance() {
  var summary = calculateSummaryMetrics();
  return summary.balance;
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
    totalIncome: income,
    totalExpense: expense,
    balance: income - expense,
    count: count
  };
}

function generateRekapMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var metrics = calculateSummaryMetrics();

  var msg = "📊 <b>Rekap &amp; Laporan Keuangan FahKeu</b>\\n" +
            "───────────────────────────\\n" +
            "🟢 <b>Total Pemasukan:</b> Rp " + formatRupiahJs(metrics.totalIncome) + "\\n" +
            "🔴 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(metrics.totalExpense) + "\\n" +
            "💵 <b>Sisa Saldo Kas:</b> <b>Rp " + formatRupiahJs(metrics.balance) + "</b>\\n" +
            "───────────────────────────\\n" +
            "📋 <b>5 Transaksi Terakhir:</b>\\n";

  var recentCount = 0;
  for (var i = rows.length - 1; i >= 1 && recentCount < 5; i--) {
    if (!rows[i][0]) continue;
    recentCount++;
    var type = (rows[i][2] || '').toString().toLowerCase();
    var amt = Number(rows[i][3]) || 0;
    var desc = rows[i][4] || 'Transaksi';
    var icon = type === 'pemasukan' ? '🟢' : '🔴';
    msg += icon + " <b>" + escapeHtml(desc) + "</b>: Rp " + formatRupiahJs(amt) + "\\n";
  }

  if (recentCount === 0) {
    msg += "<i>(Belum ada transaksi tercatat)</i>\\n";
  }

  msg += "───────────────────────────\\n" +
         "💡 <i>Ketik <b>/saldo</b> untuk cek ringkasan saldo kas.</i>";

  return msg;
}

function generateTodaySummaryMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var todayStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  var incomeToday = 0;
  var expenseToday = 0;
  var countToday = 0;
  var items = [];

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var dVal = rows[i][1];
    var rowDateStr = "";
    if (dVal instanceof Date) {
      rowDateStr = Utilities.formatDate(dVal, "Asia/Jakarta", "yyyy-MM-dd");
    } else if (dVal) {
      try {
        rowDateStr = Utilities.formatDate(new Date(dVal), "Asia/Jakarta", "yyyy-MM-dd");
      } catch(e) {}
    }

    if (rowDateStr === todayStr) {
      countToday++;
      var type = (rows[i][2] || '').toString().toLowerCase();
      var amt = Number(rows[i][3]) || 0;
      var desc = rows[i][4] || 'Transaksi';
      if (type === 'pemasukan') incomeToday += amt;
      else expenseToday += amt;
      items.push({ type: type, amt: amt, desc: desc });
    }
  }

  var msg = "📅 <b>Laporan Mutasi Hari Ini (" + todayStr + ")</b>\\n" +
            "───────────────────────────\\n" +
            "🟢 Pemasukan: Rp " + formatRupiahJs(incomeToday) + "\\n" +
            "🔴 Pengeluaran: Rp " + formatRupiahJs(expenseToday) + "\\n" +
            "💵 Selisih Hari Ini: <b>Rp " + formatRupiahJs(incomeToday - expenseToday) + "</b>\\n" +
            "───────────────────────────\\n";

  if (items.length > 0) {
    for (var k = Math.max(0, items.length - 5); k < items.length; k++) {
      var it = items[k];
      msg += (it.type === 'pemasukan' ? '🟢' : '🔴') + " " + escapeHtml(it.desc) + ": Rp " + formatRupiahJs(it.amt) + "\\n";
    }
  } else {
    msg += "<i>Belum ada transaksi dicatat hari ini.</i>\\n";
  }

  return msg;
}

function generateMonthSummaryMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var monthStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM");

  var incomeMonth = 0;
  var expenseMonth = 0;
  var countMonth = 0;

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var dVal = rows[i][1];
    var rowDateStr = "";
    if (dVal instanceof Date) {
      rowDateStr = Utilities.formatDate(dVal, "Asia/Jakarta", "yyyy-MM");
    } else if (dVal) {
      try {
        rowDateStr = Utilities.formatDate(new Date(dVal), "Asia/Jakarta", "yyyy-MM");
      } catch(e) {}
    }

    if (rowDateStr === monthStr) {
      countMonth++;
      var type = (rows[i][2] || '').toString().toLowerCase();
      var amt = Number(rows[i][3]) || 0;
      if (type === 'pemasukan') incomeMonth += amt;
      else expenseMonth += amt;
    }
  }

  return "🗓️ <b>Rekap Mutasi Bulan Ini (" + monthStr + ")</b>\\n" +
         "───────────────────────────\\n" +
         "🟢 <b>Pemasukan:</b> Rp " + formatRupiahJs(incomeMonth) + "\\n" +
         "🔴 <b>Pengeluaran:</b> Rp " + formatRupiahJs(expenseMonth) + "\\n" +
         "💵 <b>Surplus / Defisit:</b> <b>Rp " + formatRupiahJs(incomeMonth - expenseMonth) + "</b>\\n" +
         "📝 <b>Total Transaksi:</b> " + countMonth + " catatan";
}

function deleteLastTransaction() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { success: false };

  for (var i = rows.length - 1; i >= 1; i--) {
    if (!rows[i][0]) continue;
    var desc = rows[i][4] || 'Transaksi';
    var amount = Number(rows[i][3]) || 0;
    sheet.deleteRow(i + 1);
    return { success: true, description: desc, amount: amount };
  }

  return { success: false };
}

// ----------------------------------------------------------------------------
// TELEGRAM API CLIENT UTILITIES
// ----------------------------------------------------------------------------
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
  if (!token || !chatId) return;
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "HTML" }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({ chat_id: chatId, text: text.replace(/<[^>]*>/g, '') }),
        muteHttpExceptions: true
      });
    }
  } catch (e) {}
}

function sendTelegramMessageWithMarkup(chatId, text, replyMarkup, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId) return null;
  var url = "https://api.telegram.org/bot" + token + "/sendMessage";
  try {
    var res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }),
      muteHttpExceptions: true
    });
    var d = JSON.parse(res.getContentText());
    return (d.ok && d.result) ? d.result.message_id : null;
  } catch (e) {
    return null;
  }
}

function editTelegramMessage(chatId, messageId, text, replyMarkup, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId || !messageId) return;
  var url = "https://api.telegram.org/bot" + token + "/editMessageText";
  try {
    UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: "HTML",
        reply_markup: replyMarkup
      }),
      muteHttpExceptions: true
    });
  } catch (e) {}
}

function answerTelegramCallback(cbId, textAlert, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !cbId) return;
  try {
    UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/answerCallbackQuery", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ callback_query_id: cbId, text: textAlert || '' }),
      muteHttpExceptions: true
    });
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

function getEffectiveGeminiKey() {
  var prop = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (prop) return prop;
  var sheetVal = getConfigValue('GEMINI_API_KEY');
  if (sheetVal) return sheetVal;
  return GEMINI_API_KEY || "";
}

function getEffectiveUserId(e) {
  var paramId = extractQueryParam(e, 'userId');
  if (paramId) return paramId;
  var prop = PropertiesService.getScriptProperties().getProperty('USER_ID');
  if (prop) return prop;
  return getConfigValue('USER_ID') || "";
}

function getEffectiveUsername(e) {
  var paramU = extractQueryParam(e, 'username');
  if (paramU) return paramU;
  var prop = PropertiesService.getScriptProperties().getProperty('USERNAME');
  if (prop) return prop;
  return getConfigValue('USERNAME') || "";
}

function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRupiahJs(number) {
  return (number || 0).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".");
}

// ----------------------------------------------------------------------------
// STRUKTUR TABEL TRANSAKSI & CONFIG SHEET
// ----------------------------------------------------------------------------
function getOrCreateTxSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TX_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TX_SHEET_NAME);
    var headers = [
      ["ID", "Tanggal", "Tipe", "Jumlah", "Deskripsi", "Kategori", "Sumber", "User_ID", "Username"]
    ];
    sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    sheet.getRange(1, 1, 1, headers[0].length)
      .setBackground("#064E3B")
      .setFontColor("#FFFFFF")
      .setFontWeight("bold")
      .setHorizontalAlignment("center");
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
    var sheet = getOrCreateConfigSheet();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString() === key) {
        return rows[i][1] ? rows[i][1].toString() : '';
      }
    }
  } catch (e) {}
  return '';
}

function setConfigValue(key, value) {
  try {
    var sheet = getOrCreateConfigSheet();
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toString() === key) {
        sheet.getRange(i + 1, 2).setValue(value);
        sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
        return;
      }
    }
    sheet.appendRow([key, value, new Date().toISOString()]);
  } catch (e) {}
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------------
// MENU ACTIONS
// ----------------------------------------------------------------------------
function menuOpenTxSheet() {
  var sheet = getOrCreateTxSheet();
  SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);
}

function menuShowBalanceSummary() {
  var metrics = calculateSummaryMetrics();
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
  var chatId = getConfigValue('TELEGRAM_CHAT_ID') || PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID') || DEFAULT_CHAT_ID;
  var webhookUrl = getConfigValue('WEBHOOK_URL');
  SpreadsheetApp.getUi().alert(
    '🤖 Status Bot Telegram',
    'Token Bot: ' + (token ? '✅ Terpasang (' + token.substring(0, 10) + '...)' : '❌ Belum Diatur') + '\\n' +
    'Chat ID: ' + (chatId ? '✅ ' + chatId : '⚠️ Belum Terhubung (Buka bot & ketik /start)') + '\\n' +
    'Status Webhook: ' + (webhookUrl ? '✅ 24 Jam Aktif' : 'ℹ️ Klik menu "Aktifkan Webhook Bot 24 Jam Otomatis"'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
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

function menuSetGeminiKey() {
  var ui = SpreadsheetApp.getUi();
  var prompt = ui.prompt('🔑 Pengaturan Gemini API Key', 'Masukkan Gemini API Key untuk membaca foto struk secara otomatis:', ui.ButtonSet.OK_CANCEL);
  if (prompt.getSelectedButton() == ui.Button.OK) {
    var key = prompt.getResponseText().trim();
    if (key) {
      PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
      setConfigValue('GEMINI_API_KEY', key);
      ui.alert('✅ Berhasil', 'Gemini API Key tersimpan.', ui.ButtonSet.OK);
    }
  }
}

function menuShowStatus() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getLastRow() - 1;
  SpreadsheetApp.getUi().alert('ℹ️ Status Database', 'Database Keuangan aktif dengan ' + (rows > 0 ? rows : 0) + ' transaksi.', SpreadsheetApp.getUi().ButtonSet.OK);
}
`;
