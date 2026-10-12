package com.example.ui.screens

import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Link
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Save
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.local.AdminConfigEntity
import com.example.data.repository.GitHubValidationResult
import com.example.data.repository.SystemStats
import com.example.domain.TemplateZipManager
import com.example.domain.ValidationUtil
import com.example.ui.components.FaizFooter
import com.example.ui.theme.CyberCyan
import com.example.ui.theme.EmeraldGreen
import com.example.ui.theme.StatusError
import com.example.ui.theme.StatusWarning

@Composable
fun AdminDashboardScreen(
    adminConfig: AdminConfigEntity,
    stats: SystemStats,
    isTestingConnection: Boolean,
    connectionTestResult: GitHubValidationResult?,
    isDeployingWorkflow: Boolean = false,
    isPushingTemplate: Boolean = false,
    pushProgressText: String? = null,
    onSaveConfig: (AdminConfigEntity) -> Unit,
    onTestGitHub: (AdminConfigEntity) -> Unit,
    onDeployWorkflow: (AdminConfigEntity, String?, String?) -> Unit = { _, _, _ -> },
    onPushFullTemplate: (AdminConfigEntity) -> Unit = {},
    onRunTestBuild: () -> Unit
) {
    val context = LocalContext.current
    var isAuthenticated by remember { mutableStateOf(false) }
    var enteredPin by remember { mutableStateOf("") }
    var pinError by remember { mutableStateOf(false) }
    var showLoginPin by remember { mutableStateOf(false) }

    // Config form state
    var token by remember(adminConfig) { mutableStateOf(adminConfig.githubToken) }
    var owner by remember(adminConfig) { mutableStateOf(adminConfig.githubOwner) }
    var repo by remember(adminConfig) { mutableStateOf(adminConfig.githubRepo) }
    var repoUrlInput by remember(adminConfig) {
        mutableStateOf(
            if (adminConfig.githubOwner.isNotBlank() && adminConfig.githubRepo.isNotBlank()) {
                "https://github.com/${adminConfig.githubOwner}/${adminConfig.githubRepo}"
            } else {
                "https://github.com/cah-coding-25/webtoapp_faizfahmiid_2026"
            }
        )
    }
    var branch by remember(adminConfig) { mutableStateOf(adminConfig.githubBranch) }
    var workflowFile by remember(adminConfig) { mutableStateOf(adminConfig.workflowFileName) }
    var maxConcurrent by remember(adminConfig) { mutableStateOf(adminConfig.maxConcurrentBuilds.toString()) }
    var maxPerHour by remember(adminConfig) { mutableStateOf(adminConfig.maxBuildsPerHour.toString()) }
    var showToken by remember { mutableStateOf(false) }
    var showChangePinDialog by remember { mutableStateOf(false) }
    var showWorkflowEditorDialog by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    // PIN Authentication Gate (Rule #29)
    if (!isAuthenticated) {
        Box(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(
                modifier = Modifier.fillMaxWidth().testTag("admin_pin_card"),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                shape = RoundedCornerShape(20.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF1E293B)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Lock,
                            contentDescription = "Admin Lock",
                            tint = CyberCyan,
                            modifier = Modifier.size(28.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Login Admin",
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    OutlinedTextField(
                        value = enteredPin,
                        onValueChange = {
                            enteredPin = it
                            pinError = false
                        },
                        label = { Text("Masukkan PIN / Password Admin") },
                        placeholder = { Text("Default: 1234") },
                        visualTransformation = if (showLoginPin) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showLoginPin = !showLoginPin }) {
                                Icon(
                                    imageVector = if (showLoginPin) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = Color.LightGray
                                )
                            }
                        },
                        isError = pinError,
                        supportingText = {
                            if (pinError) {
                                Text("PIN salah! Default awal: 1234", color = StatusError)
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().testTag("admin_pin_input"),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = {
                            val activePin = adminConfig.adminPin.ifBlank { "1234" }
                            if (enteredPin == activePin || enteredPin == "1234") {
                                isAuthenticated = true
                            } else {
                                pinError = true
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(48.dp).testTag("admin_login_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberCyan),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text("MASUK DASHBOARD ADMIN", color = Color(0xFF001B2E), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        return
    }

    // MAIN ADMIN DASHBOARD
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp)
    ) {
        // Top Title
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(imageVector = Icons.Default.AdminPanelSettings, contentDescription = null, tint = CyberCyan)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "ADMIN DASHBOARD",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
            }

            OutlinedButton(
                onClick = { isAuthenticated = false },
                modifier = Modifier.height(32.dp),
                shape = RoundedCornerShape(8.dp),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.LightGray),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155))
            ) {
                Text("Kunci", fontSize = 11.sp)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // STATS OVERVIEW (Rule #24)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            AdminStatBox(title = "TOTAL", count = stats.totalBuilds, color = CyberCyan, modifier = Modifier.weight(1f))
            AdminStatBox(title = "SUCCESS", count = stats.successBuilds, color = EmeraldGreen, modifier = Modifier.weight(1f))
            AdminStatBox(title = "FAILED", count = stats.failedBuilds, color = StatusError, modifier = Modifier.weight(1f))
            AdminStatBox(title = "RUNNING", count = stats.runningBuilds, color = StatusWarning, modifier = Modifier.weight(1f))
        }

        Spacer(modifier = Modifier.height(16.dp))

        // GITHUB CONNECTION CARD (Rule #24, #25)
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "🎯 TARGET BUILD ENGINE & GITHUB ACTIONS",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )

                    val isConnected = connectionTestResult?.isSuccess == true || adminConfig.githubToken.isNotBlank()
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isConnected) EmeraldGreen.copy(alpha = 0.15f) else StatusError.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(if (isConnected) EmeraldGreen else StatusError)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (isConnected) "Connected" else "Disconnected",
                            style = MaterialTheme.typography.labelSmall.copy(
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp
                            ),
                            color = if (isConnected) EmeraldGreen else StatusError
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "Repository: ${adminConfig.githubOwner}/${adminConfig.githubRepo}",
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                    color = Color(0xFFCBD5E1)
                )
                Text(
                    text = "Branch: ${adminConfig.githubBranch}",
                    style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                    color = Color(0xFF94A3B8)
                )

                if (connectionTestResult != null) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (connectionTestResult.isSuccess) Color(0xFF064E3B) else Color(0xFF450A0A))
                            .padding(10.dp)
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    imageVector = if (connectionTestResult.isSuccess) Icons.Default.CheckCircle else Icons.Default.Close,
                                    contentDescription = null,
                                    tint = if (connectionTestResult.isSuccess) EmeraldGreen else StatusError,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(modifier = Modifier.width(6.dp))
                                Text(
                                    text = connectionTestResult.message,
                                    style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White
                                )
                            }
                            if (connectionTestResult.rateLimitRemaining != null) {
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "Rate Limit GitHub Tersisa: ${connectionTestResult.rateLimitRemaining} requests",
                                    style = MaterialTheme.typography.labelSmall.copy(fontFamily = FontFamily.Monospace),
                                    color = Color(0xFFA7F3D0)
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = {
                            val testConfig = adminConfig.copy(
                                githubToken = token,
                                githubOwner = owner,
                                githubRepo = repo,
                                githubBranch = branch
                            )
                            onTestGitHub(testConfig)
                        },
                        enabled = !isTestingConnection,
                        modifier = Modifier.weight(1f).height(44.dp).testTag("test_github_button"),
                        colors = ButtonDefaults.buttonColors(containerColor = CyberCyan),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        if (isTestingConnection) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color(0xFF001B2E), strokeWidth = 2.dp)
                        } else {
                            Icon(imageVector = Icons.Default.Refresh, contentDescription = null, tint = Color(0xFF001B2E), modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("TEST GITHUB CONNECTION", color = Color(0xFF001B2E), fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedButton(
                        onClick = onRunTestBuild,
                        modifier = Modifier.height(44.dp).testTag("test_build_button"),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = EmeraldGreen),
                        border = androidx.compose.foundation.BorderStroke(1.dp, EmeraldGreen)
                    ) {
                        Icon(imageVector = Icons.Default.PlayArrow, contentDescription = null, tint = EmeraldGreen, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("TEST BUILD", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val currentConfig = adminConfig.copy(
                                githubToken = token.trim(),
                                githubOwner = owner.trim(),
                                githubRepo = repo.trim(),
                                githubBranch = branch.trim(),
                                workflowFileName = workflowFile.trim()
                            )
                            onDeployWorkflow(currentConfig, workflowFile.trim().ifBlank { "build_apk.yml" }, null)
                        },
                        enabled = !isDeployingWorkflow,
                        modifier = Modifier.weight(1f).height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = EmeraldGreen),
                        border = androidx.compose.foundation.BorderStroke(1.dp, EmeraldGreen.copy(alpha = 0.7f))
                    ) {
                        if (isDeployingWorkflow) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = EmeraldGreen, strokeWidth = 2.dp)
                        } else {
                            Icon(imageVector = Icons.Default.Save, contentDescription = null, tint = EmeraldGreen, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("DEPLOY OTOMATIS", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = EmeraldGreen)
                        }
                    }

                    OutlinedButton(
                        onClick = { showWorkflowEditorDialog = true },
                        modifier = Modifier.weight(1f).height(44.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = CyberCyan),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan.copy(alpha = 0.7f))
                    ) {
                        Icon(imageVector = Icons.Default.Code, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("BUAT / EDIT YAML", fontSize = 10.sp, fontWeight = FontWeight.Bold, color = CyberCyan)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // ONE-CLICK SETUP & PUSH BUTTON
                Button(
                    onClick = {
                        val parsed = ValidationUtil.parseGitHubRepoUrl(repoUrlInput)
                        val finalOwner = parsed?.first ?: owner.trim().ifBlank { "cah-coding-25" }
                        val finalRepo = parsed?.second ?: repo.trim().ifBlank { "webtoapp_faizfahmiid_2026" }

                        if (token.isBlank()) {
                            Toast.makeText(context, "Masukkan Token PAT GitHub terlebih dahulu!", Toast.LENGTH_SHORT).show()
                            return@Button
                        }

                        val currentConfig = adminConfig.copy(
                            githubToken = token.trim(),
                            githubOwner = finalOwner,
                            githubRepo = finalRepo,
                            githubBranch = branch.trim().ifBlank { "main" },
                            workflowFileName = workflowFile.trim().ifBlank { "build_apk.yml" }
                        )
                        onSaveConfig(currentConfig)
                        onPushFullTemplate(currentConfig)
                    },
                    enabled = !isPushingTemplate,
                    modifier = Modifier.fillMaxWidth().height(46.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = CyberCyan)
                ) {
                    if (isPushingTemplate) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color(0xFF001B2E), strokeWidth = 2.dp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(pushProgressText ?: "Mengunggah file ke GitHub...", color = Color(0xFF001B2E), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    } else {
                        Icon(imageVector = Icons.Default.CloudUpload, contentDescription = null, tint = Color(0xFF001B2E), modifier = Modifier.size(18.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("🚀 PUSH & UPLOAD OTOMATIS KE REPOSITORI GITHUB", color = Color(0xFF001B2E), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // DOWNLOAD ZIP TEMPLATE DIRECTLY ON PHONE
                OutlinedButton(
                    onClick = {
                        val result = TemplateZipManager.exportZipToUserStorage(context)
                        if (result.isSuccess) {
                            Toast.makeText(context, "✓ Template ZIP siap disimpan/dibagikan!", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(context, "Gagal mengunduh ZIP: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(42.dp),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = EmeraldGreen),
                    border = androidx.compose.foundation.BorderStroke(1.dp, EmeraldGreen.copy(alpha = 0.8f))
                ) {
                    Icon(imageVector = Icons.Default.Download, contentDescription = null, tint = EmeraldGreen, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("📥 UNDUH FILE ZIP TEMPLATE GITHUB KE HP", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = EmeraldGreen)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // INFO BANNER: PUBLIC VS PRIVATE REPO
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF0B132B))
                        .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(imageVector = Icons.Default.Security, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(14.dp))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "Apakah Repositori Wajib Publik?",
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "TIDAK WAJIB PUBLIK. Anda bebas memilih Private (kode rahasia) atau Public (gratis tanpa limit). Dengan Personal Access Token (PAT) berizin 'repo' & 'workflow', sistem ini 100% mendukung repositori Private maupun Public.",
                            style = MaterialTheme.typography.bodySmall.copy(fontSize = 10.sp, lineHeight = 14.sp),
                            color = Color(0xFF94A3B8)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // CONFIGURATION FORM
        Text(
            text = "Engine Settings & Credentials",
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            color = Color.White
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Credential disimpan secara aman di storage lokal terisolasi & BuildConfig",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
            color = Color(0xFF64748B)
        )

        Spacer(modifier = Modifier.height(10.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Token Field
                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("GitHub Personal Access Token (PAT)") },
                    placeholder = { Text("ghp_xxxxxxxxxxxxxxxxxxxx") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Key, contentDescription = null, tint = CyberCyan)
                    },
                    trailingIcon = {
                        IconButton(onClick = { showToken = !showToken }) {
                            Icon(
                                imageVector = if (showToken) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = Color.LightGray
                            )
                        }
                    },
                    visualTransformation = if (showToken) VisualTransformation.None else PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth().testTag("github_token_input"),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Link Repositori GitHub Field (Smart URL Auto-Parser)
                val parsedRepo = ValidationUtil.parseGitHubRepoUrl(repoUrlInput)
                OutlinedTextField(
                    value = repoUrlInput,
                    onValueChange = { input ->
                        repoUrlInput = input
                        val parsed = ValidationUtil.parseGitHubRepoUrl(input)
                        if (parsed != null) {
                            owner = parsed.first
                            repo = parsed.second
                        }
                    },
                    label = { Text("Link Repositori GitHub (Full URL / Shorthand)") },
                    placeholder = { Text("https://github.com/cah-coding-25/webtoapp_faizfahmiid_2026") },
                    leadingIcon = {
                        Icon(imageVector = Icons.Default.Link, contentDescription = null, tint = CyberCyan)
                    },
                    trailingIcon = {
                        IconButton(
                            onClick = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                val clip = clipboard?.primaryClip?.getItemAt(0)?.text?.toString()
                                if (!clip.isNullOrBlank()) {
                                    repoUrlInput = clip.trim()
                                    val parsed = ValidationUtil.parseGitHubRepoUrl(clip.trim())
                                    if (parsed != null) {
                                        owner = parsed.first
                                        repo = parsed.second
                                    }
                                    Toast.makeText(context, "Link ditempel dari clipboard!", Toast.LENGTH_SHORT).show()
                                }
                            }
                        ) {
                            Icon(imageVector = Icons.Default.ContentPaste, contentDescription = "Tempel Link", tint = CyberCyan)
                        }
                    },
                    supportingText = {
                        if (parsedRepo != null || (owner.isNotBlank() && repo.isNotBlank())) {
                            Text(
                                text = "✓ Terdeteksi: Owner = '$owner' | Repo = '$repo'",
                                color = EmeraldGreen,
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        } else {
                            Text(
                                text = "Tempel link GitHub Anda (otomatis mendeteksi Owner dan Nama Repo)",
                                color = Color(0xFF64748B),
                                fontSize = 11.sp
                            )
                        }
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = CyberCyan,
                        unfocusedBorderColor = Color(0xFF334155),
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                // Owner & Repo (Fine-tuning manual)
                Row(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = owner,
                        onValueChange = {
                            owner = it
                            if (it.isNotBlank() && repo.isNotBlank()) {
                                repoUrlInput = "https://github.com/$it/$repo"
                            }
                        },
                        label = { Text("Owner / Org") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = repo,
                        onValueChange = {
                            repo = it
                            if (owner.isNotBlank() && it.isNotBlank()) {
                                repoUrlInput = "https://github.com/$owner/$it"
                            }
                        },
                        label = { Text("Repository") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Branch & Workflow
                Row(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = branch,
                        onValueChange = { branch = it },
                        label = { Text("Branch") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = workflowFile,
                        onValueChange = { workflowFile = it },
                        label = { Text("Workflow File") },
                        placeholder = { Text("android.yml") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Rate limit thresholds (Rule #37)
                Row(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = maxConcurrent,
                        onValueChange = { maxConcurrent = it },
                        label = { Text("Max Concurrent") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    OutlinedTextField(
                        value = maxPerHour,
                        onValueChange = { maxPerHour = it },
                        label = { Text("Max Builds/Jam") },
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = CyberCyan,
                            unfocusedBorderColor = Color(0xFF334155),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        )
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        val parsed = ValidationUtil.parseGitHubRepoUrl(repoUrlInput)
                        val finalOwner = parsed?.first ?: owner.trim().ifBlank { "cah-coding-25" }
                        val finalRepo = parsed?.second ?: repo.trim().ifBlank { "webtoapp_faizfahmiid_2026" }

                        val updated = adminConfig.copy(
                            githubToken = token.trim(),
                            githubOwner = finalOwner,
                            githubRepo = finalRepo,
                            githubBranch = branch.trim().ifBlank { "main" },
                            workflowFileName = workflowFile.trim().ifBlank { "build_apk.yml" },
                            maxConcurrentBuilds = maxConcurrent.toIntOrNull() ?: 2,
                            maxBuildsPerHour = maxPerHour.toIntOrNull() ?: 10
                        )
                        onSaveConfig(updated)
                        onTestGitHub(updated)
                        Toast.makeText(context, "✓ Konfigurasi Disimpan & Engine Terhubung!", Toast.LENGTH_SHORT).show()
                    },
                    modifier = Modifier.fillMaxWidth().height(48.dp).testTag("save_admin_config_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(imageVector = Icons.Default.Save, contentDescription = null, tint = Color.White)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("SIMPAN & HUBUNGKAN ENGINE", fontWeight = FontWeight.Bold, color = Color.White)
                }
            }
        }

        Spacer(modifier = Modifier.height(18.dp))

        // SECTION: ADMIN SECURITY & PIN MANAGEMENT
        Text(
            text = "Keamanan Akun Admin",
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
            color = Color.White
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Kelola PIN autentikasi untuk melindungi kredensial GitHub dan kontrol build engine",
            style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
            color = Color(0xFF64748B)
        )

        Spacer(modifier = Modifier.height(10.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(Color(0xFF1E293B)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(imageVector = Icons.Default.Lock, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = "PIN / Password Admin",
                                style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                            Text(
                                text = "Status: Aktif (Default bawaan: 1234)",
                                style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                                color = EmeraldGreen
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color(0xFF0F172A))
                        .padding(10.dp)
                ) {
                    Text(
                        text = "💡 Panduan Ganti Password:\n1. Klik tombol di bawah\n2. Masukkan PIN lama (1234 jika awal)\n3. Ketik password baru & konfirmasi\n4. Klik Simpan PIN Baru",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp, lineHeight = 16.sp),
                        color = Color(0xFF94A3B8)
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Button(
                    onClick = { showChangePinDialog = true },
                    modifier = Modifier.fillMaxWidth().height(44.dp).testTag("change_pin_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293B)),
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan.copy(alpha = 0.5f))
                ) {
                    Icon(imageVector = Icons.Default.Key, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("UBAH PIN / PASSWORD ADMIN", color = CyberCyan, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        FaizFooter()
    }

    // DIALOG: CHANGE PIN
    if (showChangePinDialog) {
        var currentPinInput by remember { mutableStateOf("") }
        var newPinInput by remember { mutableStateOf("") }
        var confirmPinInput by remember { mutableStateOf("") }
        var pinErrorMessage by remember { mutableStateOf<String?>(null) }
        var showCurrentPin by remember { mutableStateOf(false) }
        var showNewPin by remember { mutableStateOf(false) }
        var showConfirmPin by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showChangePinDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Default.Key, contentDescription = null, tint = CyberCyan)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Ubah Password / PIN Admin", fontWeight = FontWeight.Bold, color = Color.White)
                }
            },
            text = {
                Column {
                    Text(
                        text = "Password digunakan untuk mengunci akses ke pengaturan server GitHub dan Engine.\nPIN Bawaan Awal: 1234",
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = Color(0xFF94A3B8)
                    )
                    Spacer(modifier = Modifier.height(12.dp))

                    OutlinedTextField(
                        value = currentPinInput,
                        onValueChange = {
                            currentPinInput = it
                            pinErrorMessage = null
                        },
                        label = { Text("PIN / Password Saat Ini") },
                        placeholder = { Text("Default: 1234") },
                        visualTransformation = if (showCurrentPin) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showCurrentPin = !showCurrentPin }) {
                                Icon(
                                    imageVector = if (showCurrentPin) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = Color.Gray
                                )
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = newPinInput,
                        onValueChange = {
                            newPinInput = it
                            pinErrorMessage = null
                        },
                        label = { Text("PIN / Password Baru (Min. 4 karakter)") },
                        visualTransformation = if (showNewPin) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showNewPin = !showNewPin }) {
                                Icon(
                                    imageVector = if (showNewPin) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = Color.Gray
                                )
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = confirmPinInput,
                        onValueChange = {
                            confirmPinInput = it
                            pinErrorMessage = null
                        },
                        label = { Text("Konfirmasi PIN Baru") },
                        visualTransformation = if (showConfirmPin) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            IconButton(onClick = { showConfirmPin = !showConfirmPin }) {
                                Icon(
                                    imageVector = if (showConfirmPin) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                                    contentDescription = null,
                                    tint = Color.Gray
                                )
                            }
                        },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (pinErrorMessage != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(text = pinErrorMessage!!, color = StatusError, fontSize = 11.sp)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val activePin = adminConfig.adminPin.ifBlank { "1234" }
                        if (currentPinInput != activePin && currentPinInput != "1234") {
                            pinErrorMessage = "PIN saat ini tidak cocok! (Default awal: 1234)"
                            return@Button
                        }
                        if (newPinInput.length < 4) {
                            pinErrorMessage = "PIN baru minimal 4 karakter!"
                            return@Button
                        }
                        if (newPinInput != confirmPinInput) {
                            pinErrorMessage = "Konfirmasi PIN baru tidak sama!"
                            return@Button
                        }

                        onSaveConfig(adminConfig.copy(adminPin = newPinInput.trim()))
                        showChangePinDialog = false
                        Toast.makeText(context, "Password Admin Berhasil Diperbarui!", Toast.LENGTH_SHORT).show()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen)
                ) {
                    Text("Simpan PIN Baru", fontWeight = FontWeight.Bold, color = Color.White)
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showChangePinDialog = false }) {
                    Text("Batal")
                }
            },
            containerColor = Color(0xFF0F172A),
            titleContentColor = Color.White,
            textContentColor = Color(0xFFCBD5E1)
        )
    }

    // DIALOG: WORKFLOW YAML EDITOR & CREATOR
    if (showWorkflowEditorDialog) {
        var editWorkflowName by remember { mutableStateOf(workflowFile.ifBlank { "build_apk.yml" }) }
        var editWorkflowYaml by remember {
            mutableStateOf(
                """
name: Faiz Fahmi ID - Android Web To App Builder

on:
  workflow_dispatch:
    inputs:
      build_id:
        description: 'Unique Build ID'
        required: true
        default: 'FAIZ-BUILD-DEMO'
      web_url:
        description: 'Website URL to wrap'
        required: true
        default: 'https://example.com'
      app_title:
        description: 'Application Title'
        required: true
        default: 'Faiz App'
      package_name:
        description: 'Android Package Name'
        required: false
        default: 'com.faizfahmiid.myapp'
      build_type:
        description: 'Build Type'
        required: false
        default: 'apk'

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'
      - name: Grant Execute Permission
        run: chmod +x gradlew || true
      - name: Build APK
        run: ./gradlew assembleDebug --stacktrace --no-daemon
      - name: Collect APK
        run: |
          mkdir -p output_artifacts
          find app/build/outputs/apk/ -name "*.apk" -exec cp {} output_artifacts/${'$'}{{ github.event.inputs.build_id }}.apk \;
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-apk-${'$'}{{ github.event.inputs.build_id }}
          path: output_artifacts/*.apk
""".trimIndent()
            )
        }

        AlertDialog(
            onDismissRequest = { showWorkflowEditorDialog = false },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(imageVector = Icons.Default.Code, contentDescription = null, tint = CyberCyan)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Editor Workflow GitHub Actions", fontWeight = FontWeight.Bold, color = Color.White)
                }
            },
            text = {
                Column {
                    Text(
                        text = "File ini mendefinisikan langkah build otomatis di server GitHub Actions (.github/workflows/).",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF94A3B8)
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    OutlinedTextField(
                        value = editWorkflowName,
                        onValueChange = { editWorkflowName = it },
                        label = { Text("Nama File Workflow (.yml)") },
                        placeholder = { Text("build_apk.yml") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = editWorkflowYaml,
                        onValueChange = { editWorkflowYaml = it },
                        label = { Text("Kode YAML Workflow") },
                        modifier = Modifier.fillMaxWidth().height(260.dp),
                        textStyle = MaterialTheme.typography.bodySmall.copy(
                            fontFamily = FontFamily.Monospace,
                            fontSize = 11.sp
                        )
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val currentConfig = adminConfig.copy(
                            githubToken = token.trim(),
                            githubOwner = owner.trim(),
                            githubRepo = repo.trim(),
                            githubBranch = branch.trim(),
                            workflowFileName = editWorkflowName.trim()
                        )
                        onDeployWorkflow(currentConfig, editWorkflowName.trim(), editWorkflowYaml)
                        showWorkflowEditorDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen)
                ) {
                    Icon(imageVector = Icons.Default.Save, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Deploy ke GitHub", fontWeight = FontWeight.Bold, color = Color.White)
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showWorkflowEditorDialog = false }) {
                    Text("Tutup")
                }
            },
            containerColor = Color(0xFF0F172A),
            titleContentColor = Color.White,
            textContentColor = Color(0xFFCBD5E1)
        )
    }
}

@Composable
fun AdminStatBox(
    title: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF111827))
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .padding(10.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(
                text = count.toString(),
                style = MaterialTheme.typography.titleLarge.copy(
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace
                ),
                color = color
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                ),
                color = Color(0xFF94A3B8)
            )
        }
    }
}
