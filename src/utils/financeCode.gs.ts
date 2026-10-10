/**
 * Google Apps Script Khusus Pencatat Keuangan & Bot Telegram (Code.gs Keuangan 24 Jam)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis
 */

export const GOOGLE_APPS_SCRIPT_FINANCE_CODE = `/**
 * ============================================================================
 * GOOGLE APPS SCRIPT - KHUSUS PENCATAT KEUANGAN & BOT TELEGRAM 24 JAM (Code.gs)
 * FahKeu - Aplikasi Pencatat Keuangan Pribadi & Bisnis (100% GRATIS & NONSTOP)
 * ============================================================================
 * Fitur Unggulan 24 Jam Non-Stop Tanpa Ketergantungan Server/Vercel:
 * 1. Webhook Telegram 24/7 Gratis & Cepat (Berjalan langsung di Server Google Cloud).
 * 2. Natural Language Parser Cerdas (beli cimol 3k, gaji masuk 20 juta, kopi 18rb, dll).
 * 3. Menu Interaktif Edit Transaksi Lengkap (Bisa ubah nominal, keterangan, kategori, jenis, atau hapus).
 * 4. Scan Foto Struk / Nota 100% GRATIS (Menggunakan Google Drive OCR bawaan - TANPA API KEY BERBAYAR).
 * 5. Menu Otomatis 1-Klik di Google Spreadsheet: "📊 Keuangan FahKeu" -> "⚡ Aktifkan Webhook Bot 24 Jam Otomatis".
 * 6. Perintah Pintar: /start, /saldo, /rekap, /hariini, /bulanini, /edit, /hapus, /struk, /reset.
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
      .addItem('⚡ Aktifkan Webhook Bot 24 Jam Otomatis', 'menuSetupWebhook24Jam')
      .addItem('🤖 Cek Status Webhook Telegram Riil', 'menuShowTelegramStatus')
      .addSeparator()
      .addItem('📋 Buka Lembar Transaksi', 'menuOpenTxSheet')
      .addItem('📈 Rekap Saldo & Kas Terkini', 'menuShowBalanceSummary')
      .addItem('⚙️ Atur Token Bot & Chat ID Manual', 'menuSetTelegramConfig')
      .addSeparator()
      .addItem('ℹ️ Status Database Keuangan', 'menuShowStatus')
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

    // 3. Pasang Webhook langsung ke URL Google Apps Script
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
    var sheet = getOrCreateTxSheet();
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

    // Ping / Test Koneksi
    if (action === 'ping' || action === 'test') {
      return jsonResponse({
        success: true,
        message: "Google Apps Script FahKeu Aktif 24 Jam!",
        timestamp: new Date().toISOString()
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
// HANDLER AKSI TRANSAKSI DARI WEBSITE
// ----------------------------------------------------------------------------
function handleTxAction(payload) {
  try {
    var sheet = getOrCreateTxSheet();
    var action = payload.action;

    // 1. Tambah Transaksi (Add)
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

      sheet.appendRow([txId, dateStr, typeStr, amountNum, descStr, catStr, srcStr, uIdStr, uNameStr]);

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

    // 2. Edit Transaksi (Edit / Update)
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

    // 3. Batch Add / Sinkronisasi Dua Arah
    if (action === 'batch_add' || action === 'sync_all') {
      var txList = payload.transactions || payload.data || [];
      if (typeof txList === 'string') {
        try { txList = JSON.parse(txList); } catch(e) {}
      }

      if (!Array.isArray(txList) || txList.length === 0) {
        return jsonResponse({ success: true, message: "Tidak ada transaksi yang perlu ditambahkan", addedCount: 0 });
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

    // 4. Hapus Transaksi (Delete)
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

    // 5. Kosongkan Transaksi (Clear - Reset ke Rp 0)
    if (action === 'clear') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.deleteRows(2, lastRow - 1);
      }
      return jsonResponse({ success: true, message: "Seluruh data transaksi berhasil dikosongkan (Reset Rp 0)" });
    }

    return jsonResponse({ success: false, error: "Aksi tidak dikenal: " + action });

  } catch (e) {
    Logger.log("handleTxAction err: " + e.toString());
    return jsonResponse({ success: false, error: e.toString() });
  }
}

// ----------------------------------------------------------------------------
// HANDLER WEBHOOK BOT TELEGRAM 24 JAM (SUPER CERDAS)
// ----------------------------------------------------------------------------
function handleTelegramWebhook(update, rawEvent) {
  try {
    update = update || {};
    var webhookStartTime = new Date().getTime();

    // 1. Anti-Spam deduplikasi update_id
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
    // A. PENANGANAN CALLBACK QUERY (TOMBOL INTERAKTIF TELEGRAM)
    // ========================================================================
    if (update.callback_query) {
      return handleTelegramCallbackQuery(update.callback_query, token);
    }

    var msg = update.message || update.channel_post || update.edited_message;
    if (!msg) return jsonResponse({ success: true, note: "empty update ignored" });

    var chatId = msg.chat ? msg.chat.id : null;
    if (!chatId) return jsonResponse({ success: true, note: "no chat id" });

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
      } catch (cErr) {}
    }

    sendTelegramChatAction(chatId, "typing", token);

    var appUserId = getEffectiveUserId(rawEvent) || chatId.toString();
    var appUsername = getEffectiveUsername(rawEvent) || senderUsername || senderName;

    // ========================================================================
    // B. PENANGANAN STATE EDIT TRANSAKSI (User sedang mengetik koreksi)
    // ========================================================================
    var waitingEditState = getWaitingEditState(chatId);
    if (waitingEditState && waitingEditState.txId) {
      var editRes = handleWaitingEditInput(chatId, waitingEditState, rawUserText, token);
      if (editRes) return jsonResponse({ success: true, action: "edit_applied" });
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
          sendTelegramMessage(chatId, "✅ <b>Nominal struk diperbarui:</b> Rp " + formatRupiahJs(parsedNewAmt) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan ke Catatan.</i>", token);
          return jsonResponse({ success: true, action: "amount_updated" });
        } else {
          sendTelegramMessage(chatId, "⚠️ <i>Format nominal belum tepat. Masukkan angka contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code></i>", token);
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
          sendTelegramMessage(chatId, "✅ <b>Toko / Keterangan diperbarui:</b> " + escapeHtml(rawUserText) + "\\n<i>Periksa pratinjau di atas lalu klik Simpan ke Catatan.</i>", token);
          return jsonResponse({ success: true, action: "desc_updated" });
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

      // 1. Coba baca caption jika user menyertakan teks (misal: "indomaret 45k")
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

      // 2. Jika tidak ada caption, lakukan OCR 100% GRATIS via Google Drive OCR
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

      // Simpan draf struk dan kirim pratinjau interaktif dengan tombol edit lengkap
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
    // E. PERINTAH-PERINTAH CERDAS TELEGRAM
    // ========================================================================

    // 1. Perintah /start atau bantuan
    if (lowerText === '/start' || lowerText.indexOf('/start') === 0 || lowerText === 'bantuan' || lowerText === 'help' || lowerText === '/help') {
      var currentSummary = calculateSummaryMetrics();
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

      sendTelegramMessageWithMarkup(chatId, welcome, startKeyboard, token);
      return jsonResponse({ success: true, chatId: chatId });
    }

    // 2. Perintah /id atau /chatid
    if (lowerText === '/id' || lowerText === '/chatid' || lowerText === 'id') {
      var idInfo = "🆔 <b>Informasi Telegram Chat ID:</b>\\n" +
                   "───────────────────────────\\n" +
                   "Chat ID Anda: <code>" + chatId + "</code>\\n" +
                   "Nama: <b>" + escapeHtml(senderName) + "</b>\\n" +
                   "Username: @" + escapeHtml(senderUsername || '-') + "\\n\\n" +
                   "✅ <i>Chat ID ini telah otomatis tersimpan & terhubung 24 jam nonstop ke Google Apps Script dan Website Anda.</i>";
      sendTelegramMessage(chatId, idInfo, token);
      return jsonResponse({ success: true });
    }

    // 3. Perintah /saldo atau cek saldo
    if (lowerText === '/saldo' || lowerText === 'saldo' || lowerText === 'cek saldo' || lowerText === 'sisa saldo' || lowerText === 'uang saya') {
      var summarySaldo = calculateSummaryMetrics();
      var defNotice = "";
      if (summarySaldo.totalIncome === 0 && summarySaldo.totalExpense > 0) {
        defNotice = "\\n💡 <i>Catatan: Belum ada pemasukan dicatat. Ketik contoh: <code>saldo awal 500rb</code> atau <code>gaji 3jt</code> agar saldo bernilai positif.</i>";
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
                     "<i>Sinkron realtime langsung dengan Google Spreadsheet & Website.</i>";

      var saldoKeyboard = {
        inline_keyboard: [
          [
            { text: "📊 Rekap Transaksi", callback_data: "cmd_rekap" },
            { text: "✏️ Edit Terakhir", callback_data: "cmd_edit_last" }
          ],
          [
            { text: "🗑️ Batalkan Terakhir", callback_data: "cmd_hapus" }
          ]
        ]
      };

      sendTelegramMessageWithMarkup(chatId, saldoMsg, saldoKeyboard, token);
      return jsonResponse({ success: true });
    }

    // 4. Perintah /rekap atau laporan
    if (lowerText === '/rekap' || lowerText === 'rekap' || lowerText === 'laporan' || lowerText === 'ringkasan') {
      sendTelegramMessage(chatId, generateRekapMessage(), token);
      return jsonResponse({ success: true });
    }

    // 4b. Perintah /hariini (Mutasi khusus hari ini)
    if (lowerText === '/hariini' || lowerText === 'hari ini' || lowerText === 'mutasi hari ini') {
      sendTelegramMessage(chatId, generateTodaySummaryMessage(), token);
      return jsonResponse({ success: true });
    }

    // 4c. Perintah /bulanini (Mutasi bulan ini)
    if (lowerText === '/bulanini' || lowerText === 'bulan ini') {
      sendTelegramMessage(chatId, generateMonthSummaryMessage(), token);
      return jsonResponse({ success: true });
    }

    // 5. Perintah /edit (Fitur Edit Transaksi Interaktif)
    if (lowerText === '/edit' || lowerText.indexOf('/edit') === 0 || lowerText === 'edit') {
      var lastTx = getLastUserTransaction(chatId);
      if (!lastTx) {
        sendTelegramMessage(chatId, "⚠️ Belum ada transaksi yang dapat diedit. Silakan catat transaksi terlebih dahulu.", token);
        return jsonResponse({ success: true });
      }

      var editPreview = formatTxEditPreview(lastTx);
      var editKeyboard = getTxEditMarkup(lastTx.id);
      sendTelegramMessageWithMarkup(chatId, editPreview, editKeyboard, token);
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
    // F. NATURAL LANGUAGE PARSER BAHASA INDONESIA SUPER PINTAR
    // ========================================================================
    var parsedTx = parseFinanceText(rawUserText);
    if (parsedTx && parsedTx.amount > 0) {
      sendTelegramChatAction(chatId, "typing", token);

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

      // Tombol aksi interaktif: BISA EDIT LANGSUNG DARI TELEGRAM!
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

      sendTelegramMessageWithMarkup(chatId, recordReply, actionKeyboard, token);
      return jsonResponse({ success: true, recorded: parsedTx });
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

    // A. Perintah Cepat
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

    if (cbData === 'cmd_edit_last') {
      answerTelegramCallback(cbId, "Membuka menu edit...", token);
      var lastTx = getLastUserTransaction(chatId);
      if (lastTx) {
        sendTelegramMessageWithMarkup(chatId, formatTxEditPreview(lastTx), getTxEditMarkup(lastTx.id), token);
      } else {
        sendTelegramMessage(chatId, "⚠️ Belum ada transaksi yang dapat diedit.", token);
      }
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

    // ========================================================================
    // B. FITUR EDIT TRANSAKSI INTERAKTIF (tx_edit:*)
    // ========================================================================

    // 1. Tampilkan Menu Edit
    if (cbData.indexOf('tx_edit:') === 0) {
      var txId = cbData.split(':')[1];
      var txData = getTransactionById(txId);
      if (!txData) {
        answerTelegramCallback(cbId, "Transaksi tidak ditemukan.", token);
        return jsonResponse({ success: true });
      }
      answerTelegramCallback(cbId, "Menu edit dibuka", token);
      editTelegramMessage(chatId, messageId, formatTxEditPreview(txData), getTxEditMarkup(txId), token);
      return jsonResponse({ success: true });
    }

    // 2. Edit Nominal
    if (cbData.indexOf('tx_edit_amt:') === 0) {
      var txId = cbData.split(':')[1];
      setWaitingEditState(chatId, { txId: txId, field: 'amount', messageId: messageId });
      answerTelegramCallback(cbId, "Ketik nominal baru di chat", token);
      sendTelegramMessage(chatId, "✏️ <b>Ubah Nominal Transaksi:</b>\\n\\nKetikkan angka nominal baru di chat, contoh: <code>35k</code>, <code>35000</code>, atau <code>1.5jt</code>.", token);
      return jsonResponse({ success: true });
    }

    // 3. Edit Keterangan
    if (cbData.indexOf('tx_edit_desc:') === 0) {
      var txId = cbData.split(':')[1];
      setWaitingEditState(chatId, { txId: txId, field: 'desc', messageId: messageId });
      answerTelegramCallback(cbId, "Ketik keterangan baru di chat", token);
      sendTelegramMessage(chatId, "✏️ <b>Ubah Keterangan / Toko:</b>\\n\\nKetikkan keterangan baru di chat, contoh: <code>Kopi Kenangan</code> atau <code>Bensin Pertamax</code>.", token);
      return jsonResponse({ success: true });
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
      return jsonResponse({ success: true });
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
      return jsonResponse({ success: true });
    }

    // 6. Ganti Jenis (Pengeluaran <-> Pemasukan)
    if (cbData.indexOf('tx_toggle_type:') === 0) {
      var txId = cbData.split(':')[1];
      var txData = getTransactionById(txId);
      if (txData) {
        var newType = txData.type === 'pengeluaran' ? 'pemasukan' : 'pengeluaran';
        updateTransactionField(txId, 'type', newType);
        var updatedTx = getTransactionById(txId);
        answerTelegramCallback(cbId, "Jenis diubah ke " + newType, token);
        editTelegramMessage(chatId, messageId, formatTxEditPreview(updatedTx), getTxEditMarkup(txId), token);
      }
      return jsonResponse({ success: true });
    }

    // 7. Hapus Transaksi Tertentu
    if (cbData.indexOf('tx_del:') === 0) {
      var txId = cbData.split(':')[1];
      var delRes = deleteTransactionById(txId);
      if (delRes.success) {
        answerTelegramCallback(cbId, "Transaksi berhasil dihapus!", token);
        var newMetrics = calculateSummaryMetrics();
        var delMsg = "🗑️ <b>Transaksi #" + txId + " Berhasil Dihapus!</b>\\n\\n" +
                     "• Keterangan: <b>" + escapeHtml(delRes.description) + "</b>\\n" +
                     "• Nominal: Rp " + formatRupiahJs(delRes.amount) + "\\n" +
                     "• Sisa Saldo Kas: <b>Rp " + formatRupiahJs(newMetrics.balance) + "</b>\\n\\n" +
                     "✅ <i>Telah dihapus dari Google Spreadsheet & Website.</i>";
        editTelegramMessage(chatId, messageId, delMsg, { inline_keyboard: [] }, token);
      } else {
        answerTelegramCallback(cbId, "Transaksi tidak ditemukan.", token);
      }
      return jsonResponse({ success: true });
    }

    // 8. Selesai Edit
    if (cbData.indexOf('tx_done:') === 0) {
      var txId = cbData.split(':')[1];
      var finalTx = getTransactionById(txId);
      answerTelegramCallback(cbId, "Edit selesai", token);
      var doneKeyboard = {
        inline_keyboard: [
          [
            { text: "✏️ Edit Lagi", callback_data: "tx_edit:" + txId },
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" }
          ]
        ]
      };
      editTelegramMessage(chatId, messageId, "✅ <b>Transaksi #" + txId + " Tersimpan:</b>\\n\\n" + formatTxSummaryLine(finalTx), doneKeyboard, token);
      return jsonResponse({ success: true });
    }

    // ========================================================================
    // C. INTERAKSI DRAF STRUK BELANJA (dr_*)
    // ========================================================================
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
                      "✅ <i>Tersimpan di Google Spreadsheet & Website FahKeu!</i>";

      var postSaveKeyboard = {
        inline_keyboard: [
          [
            { text: "✏️ Edit Transaksi Ini", callback_data: "tx_edit:" + txId },
            { text: "🗑️ Batalkan", callback_data: "tx_del:" + txId }
          ],
          [
            { text: "💰 Cek Saldo", callback_data: "cmd_saldo" }
          ]
        ]
      };

      editTelegramMessage(chatId, messageId, savedText, postSaveKeyboard, token);
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

    // 3. Ubah Nominal Draf Struk
    if (cbData.indexOf('dr_edit_amt:') === 0) {
      if (pendingDraft) {
        pendingDraft.waitingFor = 'amount';
        pendingDraft.messageId = messageId;
        saveUserDraft(chatId, pendingDraft);
        answerTelegramCallback(cbId, "Ketik nominal baru di chat.", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Nominal Struk:</b>\\n\\nKetikkan angka nominal yang benar di chat, contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code>.", token);
      }
      return jsonResponse({ success: true });
    }

    // 4. Ubah Toko / Keterangan Draf Struk
    if (cbData.indexOf('dr_edit_desc:') === 0) {
      if (pendingDraft) {
        pendingDraft.waitingFor = 'desc';
        pendingDraft.messageId = messageId;
        saveUserDraft(chatId, pendingDraft);
        answerTelegramCallback(cbId, "Ketik nama toko di chat.", token);
        sendTelegramMessage(chatId, "✏️ <b>Ubah Toko / Keterangan:</b>\\n\\nKetikkan nama toko atau keterangan pengganti di chat, contoh: <code>Indomaret</code> atau <code>Kopi Kenangan</code>.", token);
      }
      return jsonResponse({ success: true });
    }

    // 5. Menu Ganti Kategori Draf Struk
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

    // 6. Pilih Kategori Draf Struk
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

    // 7. Ganti Jenis Draf Struk
    if (cbData.indexOf('dr_toggle_type:') === 0) {
      if (pendingDraft) {
        pendingDraft.type = pendingDraft.type === 'pengeluaran' ? 'pemasukan' : 'pengeluaran';
        saveUserDraft(chatId, pendingDraft);
        var label = pendingDraft.type === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan';
        answerTelegramCallback(cbId, "Jenis: " + label, token);
        editTelegramMessage(chatId, messageId, formatDraftPreview(pendingDraft), getReceiptPreviewMarkup(pendingDraft.id), token);
      }
      return jsonResponse({ success: true });
    }

    // 8. Kembali ke Pratinjau Draf
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
// HELPER EDIT TRANSAKSI (Fungsi Pendukung Edit di Telegram)
// ----------------------------------------------------------------------------
function formatTxEditPreview(tx) {
  if (!tx) return "⚠️ Data transaksi tidak ditemukan.";
  var typeBadge = tx.type === 'pemasukan' ? '🟢 Pemasukan' : '🔴 Pengeluaran';
  var sign = tx.type === 'pemasukan' ? '+ ' : '- ';
  return "✏️ <b>MENU EDIT TRANSAKSI</b>\\n" +
         "───────────────────────────\\n" +
         "🆔 <b>ID Struk  :</b> <code>#" + tx.id + "</code>\\n" +
         "🏪 <b>Keterangan:</b> <b>" + escapeHtml(tx.description) + "</b>\\n" +
         "💵 <b>Nominal   :</b> <b>" + sign + "Rp " + formatRupiahJs(tx.amount) + "</b>\\n" +
         "📂 <b>Kategori  :</b> " + escapeHtml(tx.category) + "\\n" +
         "🏷️ <b>Jenis     :</b> " + typeBadge + "\\n" +
         "───────────────────────────\\n" +
         "<i>Pilih tombol di bawah untuk mengubah field yang diinginkan:</i>";
}

function getTxEditMarkup(txId) {
  return {
    inline_keyboard: [
      [
        { text: "💵 Ubah Nominal", callback_data: "tx_edit_amt:" + txId },
        { text: "🏪 Ubah Keterangan", callback_data: "tx_edit_desc:" + txId }
      ],
      [
        { text: "📂 Ganti Kategori", callback_data: "tx_edit_cat:" + txId },
        { text: "🔄 Beralih Jenis (+/-)", callback_data: "tx_toggle_type:" + txId }
      ],
      [
        { text: "🗑️ Hapus Transaksi Ini", callback_data: "tx_del:" + txId },
        { text: "✅ Selesai", callback_data: "tx_done:" + txId }
      ]
    ]
  };
}

function formatTxSummaryLine(tx) {
  if (!tx) return "";
  var sign = tx.type === 'pemasukan' ? '+' : '-';
  return "• <b>" + escapeHtml(tx.description) + "</b> (" + sign + " Rp " + formatRupiahJs(tx.amount) + ") [" + escapeHtml(tx.category) + "]";
}

function getWaitingEditState(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get("edit_wait_" + chatId);
    if (val) return JSON.parse(val);
  } catch (e) {}
  return null;
}

function setWaitingEditState(chatId, stateObj) {
  try {
    var cache = CacheService.getScriptCache();
    cache.put("edit_wait_" + chatId, JSON.stringify(stateObj), 900);
  } catch (e) {}
}

function clearWaitingEditState(chatId) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove("edit_wait_" + chatId);
  } catch (e) {}
}

function handleWaitingEditInput(chatId, state, rawText, token) {
  try {
    var txId = state.txId;
    var field = state.field;
    var messageId = state.messageId;

    if (field === 'amount') {
      var newAmt = parseSimpleAmount(rawText);
      if (newAmt && newAmt > 0) {
        updateTransactionField(txId, 'amount', newAmt);
        clearWaitingEditState(chatId);
        var updated = getTransactionById(txId);
        if (messageId) {
          editTelegramMessage(chatId, messageId, formatTxEditPreview(updated), getTxEditMarkup(txId), token);
        }
        sendTelegramMessage(chatId, "✅ <b>Nominal berhasil diubah menjadi:</b> Rp " + formatRupiahJs(newAmt), token);
        return true;
      } else {
        sendTelegramMessage(chatId, "⚠️ Format nominal belum tepat. Masukkan angka contoh: <code>45k</code>, <code>45000</code>, atau <code>1.5jt</code>.", token);
        return true;
      }
    }

    if (field === 'desc') {
      if (rawText) {
        updateTransactionField(txId, 'description', rawText);
        clearWaitingEditState(chatId);
        var updated = getTransactionById(txId);
        if (messageId) {
          editTelegramMessage(chatId, messageId, formatTxEditPreview(updated), getTxEditMarkup(txId), token);
        }
        sendTelegramMessage(chatId, "✅ <b>Keterangan berhasil diubah menjadi:</b> " + escapeHtml(rawText), token);
        return true;
      }
    }
  } catch (e) {
    Logger.log("handleWaitingEditInput err: " + e.toString());
  }
  return false;
}

function getTransactionById(txId) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString() === txId.toString()) {
      return {
        id: rows[i][0].toString(),
        date: rows[i][1],
        type: rows[i][2] ? rows[i][2].toString().toLowerCase() : 'pengeluaran',
        amount: Number(rows[i][3]) || 0,
        description: rows[i][4] ? rows[i][4].toString() : '',
        category: rows[i][5] ? rows[i][5].toString() : 'Lainnya',
        source: rows[i][6] ? rows[i][6].toString() : 'telegram',
        rowIndex: i + 1
      };
    }
  }
  return null;
}

function getLastUserTransaction(chatId) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (rows[i][0]) {
      return {
        id: rows[i][0].toString(),
        date: rows[i][1],
        type: rows[i][2] ? rows[i][2].toString().toLowerCase() : 'pengeluaran',
        amount: Number(rows[i][3]) || 0,
        description: rows[i][4] ? rows[i][4].toString() : '',
        category: rows[i][5] ? rows[i][5].toString() : 'Lainnya',
        source: rows[i][6] ? rows[i][6].toString() : 'telegram',
        rowIndex: i + 1
      };
    }
  }
  return null;
}

function updateTransactionField(txId, field, value) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString() === txId.toString()) {
      var row = i + 1;
      if (field === 'amount') sheet.getRange(row, 4).setValue(Number(value) || 0);
      if (field === 'description') sheet.getRange(row, 5).setValue(String(value));
      if (field === 'category') sheet.getRange(row, 6).setValue(String(value));
      if (field === 'type') sheet.getRange(row, 3).setValue(String(value).toLowerCase());
      return true;
    }
  }
  return false;
}

function deleteTransactionById(txId) {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] && rows[i][0].toString() === txId.toString()) {
      var desc = rows[i][4] || 'Transaksi';
      var amt = Number(rows[i][3]) || 0;
      sheet.deleteRow(i + 1);
      return { success: true, description: desc, amount: amt };
    }
  }
  return { success: false };
}

// ----------------------------------------------------------------------------
// HELPER DRAF STRUK & PRATINJAU
// ----------------------------------------------------------------------------
function formatDraftPreview(d) {
  var typeTxt = d.type === 'pengeluaran' ? '🔴 Pengeluaran' : '🟢 Pemasukan';
  var nominalTxt = d.amount > 0 ? ("Rp " + formatRupiahJs(d.amount)) : "<i>(Belum terdeteksi - klik Ubah Nominal)</i>";

  return "🧾 <b>PRATINJAU STRUK BELANJA (100% GRATIS)</b>\\n" +
         "<i>Periksa dan edit data sebelum disimpan ke catatan kas:</i>\\n" +
         "───────────────────────────\\n" +
         "🏪 <b>Toko / Ket:</b> <b>" + escapeHtml(d.description || d.storeName || 'Struk Belanja') + "</b>\\n" +
         "💵 <b>Nominal:</b> <b>" + nominalTxt + "</b>\\n" +
         "📂 <b>Kategori:</b> " + escapeHtml(d.category || 'Belanja & Pribadi') + "\\n" +
         "🏷️ <b>Jenis:</b> " + typeTxt + "\\n" +
         "───────────────────────────\\n" +
         "<i>Klik tombol di bawah untuk mengoreksi data atau simpan:</i>";
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
  var type = 'pengeluaran';

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
  var amountRegex = /(?:rp\\.?\\s*)?(\\d+[\\d.,]*)\\s*(juta|miliar|jt|ribu|rb|k|m|r)?\\b/gi;
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

  // Fallback sebutan kata angka: satu juta, dua juta, seratus ribu, dll
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

  var category = detectCategory(clean, type);

  return {
    amount: parsedAmount,
    type: type,
    description: cleanedDesc,
    category: category
  };
}

function parseSimpleAmount(text) {
  if (!text) return 0;
  var res = parseFinanceText("bayar " + text);
  return res ? res.amount : 0;
}

function detectCategory(cleanText, type) {
  var t = cleanText.toLowerCase();

  if (type === 'pemasukan') {
    if (t.indexOf('gaji') !== -1 || t.indexOf('salary') !== -1) return 'Gaji & Pendapatan';
    if (t.indexOf('freelance') !== -1 || t.indexOf('proyek') !== -1 || t.indexOf('klien') !== -1) return 'Bisnis & Operasional';
    if (t.indexOf('jual') !== -1 || t.indexOf('dagang') !== -1 || t.indexOf('laba') !== -1 || t.indexOf('omset') !== -1) return 'Bisnis & Operasional';
    if (t.indexOf('investasi') !== -1 || t.indexOf('dividen') !== -1 || t.indexOf('crypto') !== -1 || t.indexOf('reksadana') !== -1) return 'Investasi & Tabungan';
    if (t.indexOf('bonus') !== -1 || t.indexOf('thr') !== -1 || t.indexOf('hadiah') !== -1) return 'Bonus & Hadiah';
    if (t.indexOf('saldo awal') !== -1 || t.indexOf('modal') !== -1) return 'Saldo Awal';
    return 'Pemasukan Lainnya';
  }

  if (t.indexOf('makan') !== -1 || t.indexOf('minum') !== -1 || t.indexOf('kopi') !== -1 || 
      t.indexOf('bakso') !== -1 || t.indexOf('nasgor') !== -1 || t.indexOf('ayam') !== -1 || 
      t.indexOf('cafe') !== -1 || t.indexOf('warteg') !== -1 || t.indexOf('cimol') !== -1 ||
      t.indexOf('cilok') !== -1 || t.indexOf('seblak') !== -1 || t.indexOf('jajan') !== -1) {
    return 'Makanan & Minuman';
  }

  if (t.indexOf('bensin') !== -1 || t.indexOf('pertamax') !== -1 || t.indexOf('pertalite') !== -1 || 
      t.indexOf('parkir') !== -1 || t.indexOf('tol') !== -1 || t.indexOf('gojek') !== -1 || 
      t.indexOf('grab') !== -1 || t.indexOf('ojol') !== -1 || t.indexOf('servis') !== -1 || 
      t.indexOf('cuci motor') !== -1 || t.indexOf('cuci mobil') !== -1) {
    return 'Transportasi';
  }

  if (t.indexOf('listrik') !== -1 || t.indexOf('pln') !== -1 || t.indexOf('pulsa') !== -1 || 
      t.indexOf('kuota') !== -1 || t.indexOf('wifi') !== -1 || t.indexOf('indihome') !== -1 || 
      t.indexOf('air') !== -1 || t.indexOf('pdam') !== -1 || t.indexOf('bpjs') !== -1 || 
      t.indexOf('kos') !== -1 || t.indexOf('kontrakan') !== -1 || t.indexOf('cicilan') !== -1) {
    return 'Tagihan & Utilitas';
  }

  if (t.indexOf('indomaret') !== -1 || t.indexOf('alfamart') !== -1 || t.indexOf('belanja') !== -1 || 
      t.indexOf('shopee') !== -1 || t.indexOf('tokopedia') !== -1 || t.indexOf('baju') !== -1 || 
      t.indexOf('celana') !== -1 || t.indexOf('sabun') !== -1 || t.indexOf('supermarket') !== -1) {
    return 'Belanja & Pribadi';
  }

  if (t.indexOf('nonton') !== -1 || t.indexOf('bioskop') !== -1 || t.indexOf('game') !== -1 || 
      t.indexOf('steam') !== -1 || t.indexOf('liburan') !== -1 || t.indexOf('wisata') !== -1) {
    return 'Hiburan & Liburan';
  }

  if (t.indexOf('obat') !== -1 || t.indexOf('apotek') !== -1 || t.indexOf('dokter') !== -1 || 
      t.indexOf('rumah sakit') !== -1 || t.indexOf('vitamin') !== -1) {
    return 'Kesehatan';
  }

  if (t.indexOf('sedekah') !== -1 || t.indexOf('infaq') !== -1 || t.indexOf('zakat') !== -1 || 
      t.indexOf('donasi') !== -1 || t.indexOf('sumbangan') !== -1) {
    return 'Sedekah & Sosial';
  }

  return 'Lain-lain';
}

// ----------------------------------------------------------------------------
// OCR STRUK 100% GRATIS MENGGUNAKAN GOOGLE DRIVE OCR (TANPA BIAYA / API KEY)
// ----------------------------------------------------------------------------
function tryFreeGoogleDriveReceiptOcr(fileId, botToken) {
  try {
    if (!fileId || !botToken) return null;
    var fileInfoRes = UrlFetchApp.fetch("https://api.telegram.org/bot" + botToken + "/getFile?file_id=" + fileId, { muteHttpExceptions: true });
    var fileInfo = JSON.parse(fileInfoRes.getContentText());
    if (!fileInfo.ok || !fileInfo.result || !fileInfo.result.file_path) return null;

    var filePath = fileInfo.result.file_path;
    var fileUrl = "https://api.telegram.org/file/bot" + botToken + "/" + filePath;
    var imageBytes = UrlFetchApp.fetch(fileUrl).getBlob();

    var metadata = {
      title: "Temp_FahKeu_OCR_" + Date.now(),
      mimeType: imageBytes.getContentType() || "image/jpeg"
    };

    var payload = {
      metadata: Utilities.newBlob(JSON.stringify(metadata), "application/json"),
      file: imageBytes
    };

    var driveUploadRes = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v2/files?uploadType=multipart&ocr=true&ocrLanguage=id", {
      method: "post",
      headers: {
        "Authorization": "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: payload,
      muteHttpExceptions: true
    });

    var uploadData = JSON.parse(driveUploadRes.getContentText());
    if (uploadData && uploadData.id) {
      var extractedText = "";
      try {
        var doc = DocumentApp.openById(uploadData.id);
        extractedText = doc.getBody().getText();
      } catch (docErr) {
        try {
          var exportRes = UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + uploadData.id + "/export?mimeType=text/plain", {
            headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
          });
          extractedText = exportRes.getContentText();
        } catch (exErr) {}
      }

      // Hapus file temporary agar Google Drive tetap bersih
      try {
        UrlFetchApp.fetch("https://www.googleapis.com/drive/v2/files/" + uploadData.id, {
          method: "delete",
          headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true
        });
      } catch (delErr) {}

      if (extractedText && extractedText.trim()) {
        return parseReceiptTextInScript(extractedText);
      }
    }
  } catch (ocrErr) {
    Logger.log("tryFreeGoogleDriveReceiptOcr error: " + ocrErr.toString());
  }
  return null;
}

function parseReceiptTextInScript(text) {
  var lines = text.split('\\n');
  var detectedAmount = 0;
  var detectedDescription = 'Struk Belanja';
  var detectedCategory = 'Belanja & Pribadi';

  var totalKeywords = ['total', 'grand total', 'subtotal', 'jumlah', 'netto', 'nett', 'amount', 'bayar', 'cash', 'tunai', 'debit', 'total bayar', 'jml'];
  var excludeKeywords = ['kembali', 'change', 'diskon', 'discount', 'promo', 'tax', 'pajak', 'ppn', 'service', 'ongkir'];

  var potentialAmounts = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var lowerLine = line.toLowerCase();

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

      if (numVal > 100 && numVal < 50000000) {
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

  // Pilih total belanja terbaik
  var totalLineMatches = potentialAmounts.filter(function(p) { return p.isTotalLine; });
  if (totalLineMatches.length > 0) {
    var maxVal = 0;
    for (var n = 0; n < totalLineMatches.length; n++) {
      if (totalLineMatches[n].value > maxVal) maxVal = totalLineMatches[n].value;
    }
    detectedAmount = maxVal;
  } else if (potentialAmounts.length > 0) {
    var sorted = potentialAmounts.filter(function(p) { return p.value < 10000000; });
    sorted.sort(function(a, b) { return b.value - a.value; });
    if (sorted.length > 0) {
      detectedAmount = sorted[0].value;
    }
  }

  // Deteksi Nama Toko
  var storeKeywords = ['mart', 'cafe', 'coffee', 'restoran', 'resto', 'pertamina', 'apotek', 'laundry', 'trans', 'supermarket', 'indomaret', 'alfamart', 'kopi', 'bakso'];
  var foundStoreName = '';
  for (var i = 0; i < Math.min(6, lines.length); i++) {
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

  var fullLower = text.toLowerCase();
  if (fullLower.indexOf('kopi') !== -1 || fullLower.indexOf('coffee') !== -1 || fullLower.indexOf('cafe') !== -1 || fullLower.indexOf('makan') !== -1 || fullLower.indexOf('resto') !== -1) {
    detectedCategory = 'Makanan & Minuman';
  } else if (fullLower.indexOf('bensin') !== -1 || fullLower.indexOf('pertamina') !== -1 || fullLower.indexOf('spbu') !== -1 || fullLower.indexOf('parkir') !== -1) {
    detectedCategory = 'Transportasi';
  } else if (fullLower.indexOf('listrik') !== -1 || fullLower.indexOf('pln') !== -1 || fullLower.indexOf('pulsa') !== -1 || fullLower.indexOf('kuota') !== -1) {
    detectedCategory = 'Tagihan & Utilitas';
  } else if (fullLower.indexOf('obat') !== -1 || fullLower.indexOf('apotek') !== -1) {
    detectedCategory = 'Kesehatan';
  } else {
    detectedCategory = 'Belanja & Pribadi';
  }

  return {
    amount: detectedAmount || 0,
    description: detectedDescription,
    storeName: detectedDescription,
    category: detectedCategory,
    type: 'pengeluaran'
  };
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
    count: count,
    totalIncome: income,
    totalExpense: expense,
    balance: income - expense
  };
}

function generateRekapMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var summary = calculateSummaryMetrics();

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
         "📥 <b>Total Pemasukan  :</b> Rp " + formatRupiahJs(summary.totalIncome) + "\\n" +
         "📤 <b>Total Pengeluaran:</b> Rp " + formatRupiahJs(summary.totalExpense) + "\\n" +
         "💰 <b>Sisa Saldo Kas   :</b> <b>Rp " + formatRupiahJs(summary.balance) + "</b>\\n" +
         "📝 <b>Total Transaksi  :</b> " + summary.count + " catatan";
}

function generateTodaySummaryMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var todayDateStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  var todayIncome = 0;
  var todayExpense = 0;
  var countToday = 0;

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var dVal = rows[i][1];
    var txDateStr = "";
    if (dVal instanceof Date) {
      txDateStr = Utilities.formatDate(dVal, "Asia/Jakarta", "yyyy-MM-dd");
    } else if (dVal) {
      txDateStr = dVal.toString().substring(0, 10);
    }

    if (txDateStr === todayDateStr) {
      var tType = (rows[i][2] || 'pengeluaran').toString().toLowerCase();
      var tAmt = Number(rows[i][3]) || 0;
      if (tType === 'pemasukan') todayIncome += tAmt;
      else todayExpense += tAmt;
      countToday++;
    }
  }

  return "📅 <b>MUTASI KAS HARI INI (" + todayDateStr + ")</b>\\n" +
         "───────────────────────────\\n" +
         "📥 <b>Pemasukan Hari Ini  :</b> Rp " + formatRupiahJs(todayIncome) + "\\n" +
         "📤 <b>Pengeluaran Hari Ini:</b> Rp " + formatRupiahJs(todayExpense) + "\\n" +
         "💵 <b>Arus Kas Bersih     :</b> Rp " + formatRupiahJs(todayIncome - todayExpense) + "\\n" +
         "📝 <b>Transaksi Hari Ini  :</b> " + countToday + " catatan";
}

function generateMonthSummaryMessage() {
  var sheet = getOrCreateTxSheet();
  var rows = sheet.getDataRange().getValues();
  var currentMonthStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM");

  var monthIncome = 0;
  var monthExpense = 0;
  var countMonth = 0;

  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var dVal = rows[i][1];
    var txMonthStr = "";
    if (dVal instanceof Date) {
      txMonthStr = Utilities.formatDate(dVal, "Asia/Jakarta", "yyyy-MM");
    } else if (dVal) {
      txMonthStr = dVal.toString().substring(0, 7);
    }

    if (txMonthStr === currentMonthStr) {
      var tType = (rows[i][2] || 'pengeluaran').toString().toLowerCase();
      var tAmt = Number(rows[i][3]) || 0;
      if (tType === 'pemasukan') monthIncome += tAmt;
      else monthExpense += tAmt;
      countMonth++;
    }
  }

  return "🗓️ <b>MUTASI KAS BULAN INI (" + currentMonthStr + ")</b>\\n" +
         "───────────────────────────\\n" +
         "📥 <b>Pemasukan Bulan Ini  :</b> Rp " + formatRupiahJs(monthIncome) + "\\n" +
         "📤 <b>Pengeluaran Bulan Ini:</b> Rp " + formatRupiahJs(monthExpense) + "\\n" +
         "💵 <b>Arus Kas Bersih      :</b> Rp " + formatRupiahJs(monthIncome - monthExpense) + "\\n" +
         "📝 <b>Total Transaksi      :</b> " + countMonth + " catatan";
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
    if (res.getResponseCode() !== 200) {
      delete payloadObj.parse_mode;
      payloadObj.text = text.replace(/<[^>]*>/g, '');
      var fbRes = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payloadObj),
        muteHttpExceptions: true
      });
      var fbd = JSON.parse(fbRes.getContentText());
      if (fbd.ok && fbd.result) return fbd.result.message_id;
    }
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
    if (res.getResponseCode() !== 200) {
      delete payloadObj.parse_mode;
      payloadObj.text = text.replace(/<[^>]*>/g, '');
      var fbRes = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payloadObj),
        muteHttpExceptions: true
      });
      var fbd = JSON.parse(fbRes.getContentText());
      if (fbd.ok && fbd.result) return fbd.result.message_id;
    }
  } catch (e) {}
  return null;
}

function editTelegramMessage(chatId, messageId, text, replyMarkup, customToken) {
  var token = customToken || getEffectiveBotToken();
  if (!token || !chatId || !messageId) return false;
  var url = "https://api.telegram.org/bot" + token + "/editMessageText";
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
    var d = JSON.parse(res.getContentText());
    if (d.ok) return true;
    if (res.getResponseCode() !== 200) {
      delete payloadObj.parse_mode;
      payloadObj.text = text.replace(/<[^>]*>/g, '');
      var fbRes = UrlFetchApp.fetch(url, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payloadObj),
        muteHttpExceptions: true
      });
      var fbd = JSON.parse(fbRes.getContentText());
      return Boolean(fbd.ok);
    }
  } catch (e) {}
  return false;
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
// MENU ACTIONS GOOGLE SPREADSHEET
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
