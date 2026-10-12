package com.example.ui.screens

import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddPhotoAlternate
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Android
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.DesktopWindows
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.RocketLaunch
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.example.data.local.AdminConfigEntity
import com.example.domain.AppConfigGenerator
import com.example.domain.ImageUtil
import com.example.domain.ValidationUtil
import com.example.domain.WebsiteAnalyzer
import com.example.ui.components.AppConfigViewerDialog
import com.example.ui.components.FaizFooter
import com.example.ui.components.PhonePreview
import com.example.ui.theme.CyberCyan
import com.example.ui.theme.EmeraldGreen
import com.example.ui.theme.StatusError

@Composable
fun BuilderScreen(
    onTriggerBuild: (
        webUrl: String,
        appName: String,
        packageName: String,
        iconUrl: String,
        iconBase64: String?,
        localIconUri: String?,
        orientation: String,
        buildType: String,
        fullscreen: Boolean,
        showUrlBar: Boolean,
        javascript: Boolean,
        pullToRefresh: Boolean,
        externalIntents: Boolean,
        offlinePwa: Boolean,
        desktopMode: Boolean,
        nativeShare: Boolean,
        fileUpload: Boolean,
        downloads: Boolean,
        splash: Boolean,
        splashDurationMs: Long,
        splashBgColor: String
    ) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    // Form inputs state
    var webUrl by remember { mutableStateOf("https://") }
    var appName by remember { mutableStateOf("") }
    var packageName by remember { mutableStateOf("") }
    var iconUrl by remember { mutableStateOf("") }
    var showUrlBar by remember { mutableStateOf(false) } // false = Tersembunyi (Mode App Native), true = Nampak (URL Bar Terlihat)
    var isAutoConfiguring by remember { mutableStateOf(false) }
    var autoConfigFeedback by remember { mutableStateOf<String?>(null) }

    // LOCAL IMAGE UPLOAD STATE (Manual Lokal Upload)
    var selectedLocalIconUri by remember { mutableStateOf<Uri?>(null) }
    var localIconBase64 by remember { mutableStateOf<String?>(null) }
    var localIconSizeText by remember { mutableStateOf<String?>(null) }
    var localIconError by remember { mutableStateOf<String?>(null) }
    var iconInputMode by remember { mutableStateOf("LOCAL") } // "LOCAL" or "URL"

    // Photo picker launcher (Android Photo Picker - Zero Permissions)
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            selectedLocalIconUri = uri
            val processResult = ImageUtil.processLocalImage(context, uri)
            if (processResult.isSuccess) {
                localIconBase64 = processResult.base64Data
                localIconSizeText = "${processResult.width}×${processResult.height}px • ${processResult.sizeBytes / 1024} KB"
                localIconError = null
            } else {
                localIconBase64 = null
                localIconSizeText = null
                localIconError = processResult.errorMessage
            }
        }
    }

    // Validation error messages
    var urlError by remember { mutableStateOf<String?>(null) }
    var appNameError by remember { mutableStateOf<String?>(null) }
    var packageError by remember { mutableStateOf<String?>(null) }
    var iconError by remember { mutableStateOf<String?>(null) }

    // Display & Orientation
    var orientation by remember { mutableStateOf("portrait") } // portrait, landscape, sensor
    var buildType by remember { mutableStateOf("apk") } // apk, aab, both
    var fullscreen by remember { mutableStateOf(false) }

    // WebView Settings
    var javascript by remember { mutableStateOf(true) }
    var pullToRefresh by remember { mutableStateOf(true) }
    var externalIntents by remember { mutableStateOf(true) }
    var desktopMode by remember { mutableStateOf(false) }
    var offlinePwa by remember { mutableStateOf(false) }
    var nativeShare by remember { mutableStateOf(true) }

    // Advanced Permissions
    var fileUpload by remember { mutableStateOf(true) }
    var downloads by remember { mutableStateOf(true) }
    var cameraPermission by remember { mutableStateOf(false) }
    var notificationPermission by remember { mutableStateOf(false) }

    // Splash screen
    var splashEnabled by remember { mutableStateOf(true) }
    var splashDurationSeconds by remember { mutableFloatStateOf(1.8f) }
    var splashBgColor by remember { mutableStateOf("#0B132B") }

    // Dialog state
    var showAppConfigDialog by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        // Hero Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(Color(0xFF0F2A4A), Color(0xFF131D2E))
                    )
                )
                .border(1.dp, CyberCyan.copy(alpha = 0.3f), RoundedCornerShape(20.dp))
                .padding(18.dp)
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.RocketLaunch,
                        contentDescription = null,
                        tint = CyberCyan,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "CONVERT ANY WEBSITE TO ANDROID APK",
                        style = MaterialTheme.typography.labelMedium.copy(
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        ),
                        color = CyberCyan
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "Kompilasi website responsif, PWA, atau SaaS Anda menjadi aplikasi Android native siap instal dengan arsitektur WebView modern & GitHub Actions.",
                    style = MaterialTheme.typography.bodySmall.copy(lineHeight = 18.sp),
                    color = Color(0xFFCBD5E1)
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 1: WEBSITE & IDENTITY
        SectionHeader(icon = Icons.Default.Language, title = "1. Website & Identitas Aplikasi")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Website URL
                OutlinedTextField(
                    value = webUrl,
                    onValueChange = {
                        webUrl = it
                        urlError = null
                    },
                    label = { Text("Website URL (Harus http:// atau https://)") },
                    placeholder = { Text("https://mywebsite.com") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Link, contentDescription = null, tint = CyberCyan)
                    },
                    isError = urlError != null,
                    supportingText = {
                        if (urlError != null) {
                            Text(text = urlError!!, color = StatusError)
                        } else {
                            Text(text = "Contoh: https://portofolio.id", color = Color(0xFF64748B))
                        }
                    },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("website_url_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(8.dp))

                // AUTO CONFIGURE BUTTON (Sesuai Website)
                Button(
                    onClick = {
                        val validation = ValidationUtil.validateWebUrl(webUrl)
                        if (!validation.isValid) {
                            urlError = validation.errorMessage
                            return@Button
                        }
                        urlError = null
                        isAutoConfiguring = true
                        autoConfigFeedback = null
                        coroutineScope.launch {
                            val result = WebsiteAnalyzer.analyzeUrl(webUrl)
                            appName = result.appName
                            packageName = result.packageName
                            splashBgColor = result.themeColorHex
                            pullToRefresh = result.pullToRefresh
                            showUrlBar = result.showUrlBar
                            fullscreen = result.fullscreen
                            fileUpload = result.fileUpload
                            downloads = result.downloads
                            offlinePwa = result.offlinePwa
                            if (result.iconUrl != null && selectedLocalIconUri == null) {
                                iconUrl = result.iconUrl
                                iconInputMode = "URL"
                            }
                            appNameError = null
                            packageError = null
                            isAutoConfiguring = false
                            autoConfigFeedback = result.summaryMessage
                        }
                    },
                    enabled = !isAutoConfiguring,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .testTag("auto_config_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = CyberCyan),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    if (isAutoConfiguring) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            color = Color(0xFF001B2E),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Menganalisis & Menyesuaikan Website...",
                            color = Color(0xFF001B2E),
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    } else {
                        Icon(
                            imageVector = Icons.Default.AutoAwesome,
                            contentDescription = null,
                            tint = Color(0xFF001B2E),
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "⚡ ATUR OTOMATIS SESUAI WEBSITE",
                            color = Color(0xFF001B2E),
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                }

                // Feedback Banner
                AnimatedVisibility(visible = autoConfigFeedback != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 8.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF064E3B).copy(alpha = 0.5f))
                            .border(1.dp, EmeraldGreen.copy(alpha = 0.6f), RoundedCornerShape(8.dp))
                            .padding(10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                tint = EmeraldGreen,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Column {
                                Text(
                                    text = autoConfigFeedback ?: "",
                                    color = Color(0xFFD1FAE5),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                                Text(
                                    text = "Pengaturan otomatis diterapkan. Anda tetap dapat mengubahnya secara manual di bawah.",
                                    color = Color(0xFF6EE7B7),
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // App Name
                OutlinedTextField(
                    value = appName,
                    onValueChange = {
                        appName = it
                        appNameError = null
                        if (packageName.isBlank() && it.isNotBlank()) {
                            val cleanSuffix = it.lowercase().replace(Regex("[^a-z0-9]"), "")
                            if (cleanSuffix.isNotBlank()) {
                                packageName = "com.faizfahmiid.$cleanSuffix"
                            }
                        }
                    },
                    label = { Text("Nama Aplikasi") },
                    placeholder = { Text("FAIZ WEBSITE") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Android, contentDescription = null, tint = EmeraldGreen)
                    },
                    isError = appNameError != null,
                    supportingText = {
                        if (appNameError != null) {
                            Text(text = appNameError!!, color = StatusError)
                        }
                    },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("app_name_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = EmeraldGreen,
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Package Name
                OutlinedTextField(
                    value = packageName,
                    onValueChange = {
                        packageName = it
                        packageError = null
                    },
                    label = { Text("Package Name (Unique ID)") },
                    placeholder = { Text("com.faizfahmiid.myapp") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Security, contentDescription = null, tint = CyberCyan)
                    },
                    isError = packageError != null,
                    supportingText = {
                        if (packageError != null) {
                            Text(text = packageError!!, color = StatusError)
                        } else {
                            Text(text = "Format: com.developer.appname (min 2 segmen)", color = Color(0xFF64748B))
                        }
                    },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("package_name_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 2: ICON CONFIGURATION (Manual Lokal Upload Wajib)
        SectionHeader(icon = Icons.Default.Image, title = "2. Logo Aplikasi (Upload Manual Gambar Lokal)")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Upload Manual Gambar Logo dari HP (Jangan menggunakan link URL)",
                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.SemiBold),
                    color = CyberCyan
                )
                Text(
                    text = "Pilih file gambar dari galeri Anda. Sistem akan memproses dan mengonversi otomatis ke icon Android 512×512 PNG saat build.",
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(14.dp))

                // Manual Local Image Picker Area
                if (selectedLocalIconUri != null || localIconBase64 != null) {
                    // Image selected preview card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.dp, EmeraldGreen.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val previewModel: Any? = selectedLocalIconUri
                                ?: (if (localIconBase64 != null) android.util.Base64.decode(localIconBase64, android.util.Base64.NO_WRAP) else null)

                            AsyncImage(
                                model = ImageRequest.Builder(context)
                                    .data(previewModel)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = "Selected Local Icon",
                                modifier = Modifier
                                    .size(64.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .border(2.dp, EmeraldGreen, RoundedCornerShape(14.dp)),
                                contentScale = ContentScale.Crop
                            )

                            Spacer(modifier = Modifier.width(12.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(imageVector = Icons.Default.CheckCircle, contentDescription = null, tint = EmeraldGreen, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = "Gambar Lokal Terpilih",
                                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                                        color = Color.White
                                    )
                                }
                                if (localIconSizeText != null) {
                                    Text(
                                        text = localIconSizeText!!,
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 11.sp
                                        ),
                                        color = Color(0xFFA7F3D0)
                                    )
                                }
                                Text(
                                    text = "Tersimpan di memori perangkat & siap dikompilasi ke APK",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                    color = Color(0xFF94A3B8)
                                )
                            }

                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                IconButton(
                                    onClick = {
                                        selectedLocalIconUri = null
                                        localIconBase64 = null
                                        localIconSizeText = null
                                    },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(imageVector = Icons.Default.Delete, contentDescription = "Hapus Gambar", tint = StatusError)
                                }
                                Text(
                                    text = "Ganti",
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                    color = CyberCyan,
                                    modifier = Modifier.clickable {
                                        photoPickerLauncher.launch(
                                            PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                        )
                                    }
                                )
                            }
                        }
                    }
                } else {
                    // Empty picker box
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.5.dp, CyberCyan.copy(alpha = 0.6f), RoundedCornerShape(14.dp))
                            .clickable {
                                photoPickerLauncher.launch(
                                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                )
                            }
                            .padding(22.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(
                                imageVector = Icons.Default.AddPhotoAlternate,
                                contentDescription = "Pilih Gambar Lokal",
                                tint = CyberCyan,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "PILIH GAMBAR LOGO DARI GALERI HP",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    fontWeight = FontWeight.ExtraBold,
                                    letterSpacing = 0.5.sp
                                ),
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Mendukung PNG, JPG, JPEG, WEBP (Otomatis dijadikan icon 512×512)",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }
                }

                if (localIconError != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = localIconError!!, color = StatusError, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Built-in offline preset options
                Text(
                    text = "Atau Gunakan Logo Bawaan Sistem (Tanpa Internet / Tanpa Link):",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                    color = Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val res = ImageUtil.createPresetBase64(0xFF0284C7, "🚀")
                            if (res.isSuccess) {
                                selectedLocalIconUri = null
                                localIconBase64 = res.base64Data
                                localIconSizeText = "Preset 512×512px • Cyber Rocket"
                                localIconError = null
                            }
                        },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan.copy(alpha = 0.4f)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp)
                    ) {
                        Text("🚀 Rocket", fontSize = 10.sp, color = CyberCyan)
                    }

                    OutlinedButton(
                        onClick = {
                            val res = ImageUtil.createPresetBase64(0xFF10B981, "🌐")
                            if (res.isSuccess) {
                                selectedLocalIconUri = null
                                localIconBase64 = res.base64Data
                                localIconSizeText = "Preset 512×512px • Web Globe"
                                localIconError = null
                            }
                        },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, EmeraldGreen.copy(alpha = 0.4f)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp)
                    ) {
                        Text("🌐 Web", fontSize = 10.sp, color = EmeraldGreen)
                    }

                    OutlinedButton(
                        onClick = {
                            val res = ImageUtil.createPresetBase64(0xFFF59E0B, "🛍️")
                            if (res.isSuccess) {
                                selectedLocalIconUri = null
                                localIconBase64 = res.base64Data
                                localIconSizeText = "Preset 512×512px • Toko Online"
                                localIconError = null
                            }
                        },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B).copy(alpha = 0.4f)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp)
                    ) {
                        Text("🛍️ Store", fontSize = 10.sp, color = Color(0xFFF59E0B))
                    }

                    OutlinedButton(
                        onClick = {
                            val res = ImageUtil.createPresetBase64(0xFF8B5CF6, "⚡")
                            if (res.isSuccess) {
                                selectedLocalIconUri = null
                                localIconBase64 = res.base64Data
                                localIconSizeText = "Preset 512×512px • Lightning"
                                localIconError = null
                            }
                        },
                        modifier = Modifier.weight(1f).height(38.dp),
                        shape = RoundedCornerShape(8.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF8B5CF6).copy(alpha = 0.4f)),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 4.dp)
                    ) {
                        Text("⚡ Fast", fontSize = 10.sp, color = Color(0xFFC084FC))
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 3: BUILD TYPE & ORIENTATION
        SectionHeader(icon = Icons.Default.Settings, title = "3. Format Build & Layar")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Build Output Type:",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("apk" to "APK Standalone", "aab" to "AAB Play Store", "both" to "APK + AAB").forEach { (type, label) ->
                        FilterChip(
                            selected = buildType == type,
                            onClick = { buildType = type },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = CyberCyan,
                                selectedLabelColor = Color(0xFF001B2E)
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Text(
                    text = "Orientasi Layar:",
                    style = MaterialTheme.typography.labelMedium,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    listOf("portrait" to "Portrait", "landscape" to "Landscape", "sensor" to "Auto Sensor").forEach { (ori, label) ->
                        FilterChip(
                            selected = orientation == ori,
                            onClick = { orientation = ori },
                            label = { Text(label, fontSize = 11.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = EmeraldGreen,
                                selectedLabelColor = Color.White
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Fullscreen toggle
                SettingToggleRow(
                    icon = Icons.Default.Smartphone,
                    title = "Mode Fullscreen",
                    description = "Sembunyikan topbar aplikasi untuk tampilan immersive",
                    checked = fullscreen,
                    onCheckedChange = { fullscreen = it }
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Tampilan Link Website (URL Bar Nampak / Tersembunyi)
                SettingToggleRow(
                    icon = Icons.Default.Link,
                    title = "Tampilkan Link Website (URL Bar)",
                    description = if (showUrlBar) "Nampak: Menampilkan bilah link/alamat website di dalam aplikasi" else "Tersembunyi: Tampilan bersih tanpa link seperti aplikasi native murni",
                    checked = showUrlBar,
                    onCheckedChange = { showUrlBar = it }
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 4: WEBVIEW SETTINGS
        SectionHeader(icon = Icons.Default.Code, title = "4. Fitur WebView & Navigasi")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                SettingToggleRow(
                    icon = Icons.Default.Code,
                    title = "Dukungan JavaScript",
                    description = "Wajib aktif untuk situs modern seperti React/Vue/Next/Nuxt",
                    checked = javascript,
                    onCheckedChange = { javascript = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Refresh,
                    title = "Pull to Refresh",
                    description = "Tarik layar ke bawah untuk memuat ulang halaman",
                    checked = pullToRefresh,
                    onCheckedChange = { pullToRefresh = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Share,
                    title = "Allow External Intents",
                    description = "Membuka link WhatsApp (wa.me), Tel, Email, & Google Maps",
                    checked = externalIntents,
                    onCheckedChange = { externalIntents = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.DesktopWindows,
                    title = "Desktop User-Agent Mode",
                    description = "Meminta versi tampilan Desktop dari server website",
                    checked = desktopMode,
                    onCheckedChange = { desktopMode = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Wifi,
                    title = "Offline PWA Mode",
                    description = "Simpan cache Service Worker untuk diakses saat koneksi putus",
                    checked = offlinePwa,
                    onCheckedChange = { offlinePwa = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Share,
                    title = "Native Web Share API",
                    description = "Mendukung navigator.share() untuk membuka dialog share Android",
                    checked = nativeShare,
                    onCheckedChange = { nativeShare = it }
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 5: ADVANCED PERMISSIONS
        SectionHeader(icon = Icons.Default.Security, title = "5. Izin Hardware & File")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                SettingToggleRow(
                    icon = Icons.Default.UploadFile,
                    title = "File & Photo Upload",
                    description = "Mendukung <input type='file'> dengan Photo Picker",
                    checked = fileUpload,
                    onCheckedChange = { fileUpload = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Download,
                    title = "Download Manager",
                    description = "Unduh file PDF, dokumen, dan blob langsung ke folder Download",
                    checked = downloads,
                    onCheckedChange = { downloads = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.CameraAlt,
                    title = "Camera Permission",
                    description = "Izin kamera untuk scanner QR atau video web",
                    checked = cameraPermission,
                    onCheckedChange = { cameraPermission = it }
                )

                SettingToggleRow(
                    icon = Icons.Default.Notifications,
                    title = "Push Notifications",
                    description = "Mendukung Web Push Notification Android 13+",
                    checked = notificationPermission,
                    onCheckedChange = { notificationPermission = it }
                )
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION 6: SPLASH SCREEN
        SectionHeader(icon = Icons.Default.AutoAwesome, title = "6. Splash Screen")

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                SettingToggleRow(
                    icon = Icons.Default.AutoAwesome,
                    title = "Splash Screen Aktif",
                    description = "Tampilkan logo loading halus sebelum website dimuat",
                    checked = splashEnabled,
                    onCheckedChange = { splashEnabled = it }
                )

                AnimatedVisibility(visible = splashEnabled) {
                    Column {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Durasi Splash: ${String.format("%.1f", splashDurationSeconds)} detik",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF94A3B8)
                        )
                        Slider(
                            value = splashDurationSeconds,
                            onValueChange = { splashDurationSeconds = it },
                            valueRange = 0.5f..4.0f,
                            steps = 6,
                            colors = SliderDefaults.colors(
                                thumbColor = CyberCyan,
                                activeTrackColor = CyberCyan
                            )
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // LIVE DEVICE PREVIEW (Showing local uploaded icon or URL)
        PhonePreview(
            webUrl = webUrl,
            appName = appName,
            packageName = packageName,
            iconUrl = iconUrl,
            localImageModel = selectedLocalIconUri,
            fullscreen = fullscreen,
            showUrlBar = showUrlBar,
            pullToRefresh = pullToRefresh,
            desktopMode = desktopMode,
            offlinePwa = offlinePwa,
            nativeShare = nativeShare,
            orientation = orientation
        )

        Spacer(modifier = Modifier.height(14.dp))

        // AppConfig.kt Inspector Action
        OutlinedButton(
            onClick = { showAppConfigDialog = true },
            modifier = Modifier.fillMaxWidth().height(44.dp),
            colors = ButtonDefaults.outlinedButtonColors(contentColor = CyberCyan),
            border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan.copy(alpha = 0.4f)),
            shape = RoundedCornerShape(12.dp)
        ) {
            Icon(imageVector = Icons.Default.Code, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text(text = "Preview AppConfig.kt", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        }

        Spacer(modifier = Modifier.height(16.dp))

        // BIG CTA BUTTON: 🚀 BUAT APK
        Button(
            onClick = {
                // Validation checks
                val urlRes = ValidationUtil.validateWebUrl(webUrl)
                val appRes = ValidationUtil.validateAppName(appName)
                val pkgRes = ValidationUtil.validatePackageName(packageName)
                val hasLocalIcon = localIconBase64 != null || selectedLocalIconUri != null

                urlError = urlRes.errorMessage
                appNameError = appRes.errorMessage
                packageError = pkgRes.errorMessage
                if (!hasLocalIcon) {
                    localIconError = "Wajib upload gambar logo secara manual dari galeri HP (jangan menggunakan link)!"
                } else {
                    localIconError = null
                }

                if (urlRes.isValid && appRes.isValid && pkgRes.isValid && hasLocalIcon) {
                    onTriggerBuild(
                        webUrl,
                        appName,
                        packageName,
                        iconUrl,
                        localIconBase64,
                        selectedLocalIconUri?.toString(),
                        orientation,
                        buildType,
                        fullscreen,
                        showUrlBar,
                        javascript,
                        pullToRefresh,
                        externalIntents,
                        offlinePwa,
                        desktopMode,
                        nativeShare,
                        fileUpload,
                        downloads,
                        splashEnabled,
                        (splashDurationSeconds * 1000).toLong(),
                        splashBgColor
                    )
                } else {
                    Toast.makeText(
                        context,
                        "Harap lengkapi semua kolom dan upload gambar logo sebelum membuat APK",
                        Toast.LENGTH_LONG
                    ).show()
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .testTag("submit_build_button"),
            colors = ButtonDefaults.buttonColors(containerColor = CyberCyan),
            shape = RoundedCornerShape(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.RocketLaunch,
                contentDescription = "Buat APK",
                tint = Color(0xFF001B2E),
                modifier = Modifier.size(22.dp)
            )
            Spacer(modifier = Modifier.width(10.dp))
            Text(
                text = "🚀 BUAT APK SEKARANG",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.sp
                ),
                color = Color(0xFF001B2E)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
        FaizFooter()
    }

    // DIALOG: Preview AppConfig.kt
    if (showAppConfigDialog) {
        val generatedCode = AppConfigGenerator.generateAppConfigKotlin(
            webUrl = webUrl.ifBlank { "https://example.com" },
            appName = appName.ifBlank { "My App" },
            showTopBar = !fullscreen,
            pullToRefresh = pullToRefresh,
            allowExternalIntents = externalIntents,
            desktopMode = desktopMode,
            offlinePwa = offlinePwa,
            webShare = nativeShare
        )
        AppConfigViewerDialog(
            code = generatedCode,
            onDismiss = { showAppConfigDialog = false }
        )
    }
}

@Composable
fun SectionHeader(icon: ImageVector, title: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(imageVector = icon, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(18.dp))
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            color = Color.White
        )
    }
}

@Composable
fun SettingToggleRow(
    icon: ImageVector,
    title: String,
    description: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0xFF1E293B)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = CyberCyan,
                    modifier = Modifier.size(16.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = Color.White
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = Color(0xFF64748B)
                )
            }
        }

        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color(0xFF001B2E),
                checkedTrackColor = CyberCyan,
                uncheckedTrackColor = Color(0xFF1E293B),
                uncheckedThumbColor = Color(0xFF94A3B8)
            )
        )
    }
}

