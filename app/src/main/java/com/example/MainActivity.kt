package com.example

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.AdminPanelSettings
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.outlined.AddCircleOutline
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Layers
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.ui.components.FaizHeader
import com.example.ui.screens.AdminDashboardScreen
import com.example.ui.screens.BuildCenterScreen
import com.example.ui.screens.BuildHistoryScreen
import com.example.ui.screens.BuilderScreen
import com.example.ui.screens.SettingsScreen
import com.example.ui.theme.CyberCyan
import com.example.ui.theme.EmeraldGreen
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.theme.StatusWarning
import com.example.ui.viewmodel.AppTab
import com.example.ui.viewmodel.MainViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                MainApp()
            }
        }
    }
}

@Composable
fun MainApp(viewModel: MainViewModel = viewModel()) {
    val currentTab by viewModel.currentTab.collectAsState()
    val activeBuild by viewModel.activeBuild.collectAsState()
    val allBuilds by viewModel.allBuilds.collectAsState()
    val adminConfig by viewModel.adminConfig.collectAsState()
    val stats by viewModel.stats.collectAsState()
    val isTestingConnection by viewModel.isTestingConnection.collectAsState()
    val connectionTestResult by viewModel.connectionTestResult.collectAsState()
    val isDeployingWorkflow by viewModel.isDeployingWorkflow.collectAsState()
    val isPushingTemplate by viewModel.isPushingTemplate.collectAsState()
    val pushProgressText by viewModel.pushProgressText.collectAsState()
    val userMessage by viewModel.userMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(userMessage) {
        userMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearUserMessage()
        }
    }

    // Android back navigation handler
    BackHandler(enabled = currentTab != AppTab.BUILDER) {
        viewModel.switchTab(AppTab.BUILDER)
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            FaizHeader(
                isEngineOnline = connectionTestResult?.isSuccess == true || adminConfig.githubToken.isNotBlank(),
                showEngineStatus = currentTab == AppTab.ADMIN,
                onAdminClick = { viewModel.switchTab(AppTab.ADMIN) }
            )
        },
        bottomBar = {
            NavigationBar(
                modifier = Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.navigationBars)
                    .testTag("main_navigation_bar"),
                containerColor = Color(0xFF0F172A),
                contentColor = Color.White,
                tonalElevation = 8.dp
            ) {
                // Tab 1: Builder
                NavigationBarItem(
                    selected = currentTab == AppTab.BUILDER,
                    onClick = { viewModel.switchTab(AppTab.BUILDER) },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == AppTab.BUILDER) Icons.Filled.AddCircle else Icons.Outlined.AddCircleOutline,
                            contentDescription = "Buat APK"
                        )
                    },
                    label = { Text("Buat APK", fontSize = 10.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF001B2E),
                        selectedTextColor = CyberCyan,
                        indicatorColor = CyberCyan,
                        unselectedIconColor = Color(0xFF94A3B8),
                        unselectedTextColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.testTag("nav_builder_tab")
                )

                // Tab 2: Build Center
                NavigationBarItem(
                    selected = currentTab == AppTab.BUILD_CENTER,
                    onClick = { viewModel.switchTab(AppTab.BUILD_CENTER) },
                    icon = {
                        val isBuilding = activeBuild?.status in listOf("QUEUED", "RUNNING", "BUILDING", "PACKAGING")
                        if (isBuilding) {
                            BadgedBox(
                                badge = {
                                    Badge(containerColor = StatusWarning)
                                }
                            ) {
                                Icon(
                                    imageVector = if (currentTab == AppTab.BUILD_CENTER) Icons.Filled.Build else Icons.Outlined.Build,
                                    contentDescription = "Build Center"
                                )
                            }
                        } else {
                            Icon(
                                imageVector = if (currentTab == AppTab.BUILD_CENTER) Icons.Filled.Build else Icons.Outlined.Build,
                                contentDescription = "Build Center"
                            )
                        }
                    },
                    label = { Text("Monitor", fontSize = 10.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF001B2E),
                        selectedTextColor = CyberCyan,
                        indicatorColor = CyberCyan,
                        unselectedIconColor = Color(0xFF94A3B8),
                        unselectedTextColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.testTag("nav_monitor_tab")
                )

                // Tab 3: History
                NavigationBarItem(
                    selected = currentTab == AppTab.HISTORY,
                    onClick = { viewModel.switchTab(AppTab.HISTORY) },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == AppTab.HISTORY) Icons.Filled.History else Icons.Outlined.History,
                            contentDescription = "Riwayat"
                        )
                    },
                    label = { Text("Riwayat", fontSize = 10.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF001B2E),
                        selectedTextColor = CyberCyan,
                        indicatorColor = CyberCyan,
                        unselectedIconColor = Color(0xFF94A3B8),
                        unselectedTextColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.testTag("nav_history_tab")
                )

                // Tab 4: Admin
                NavigationBarItem(
                    selected = currentTab == AppTab.ADMIN,
                    onClick = { viewModel.switchTab(AppTab.ADMIN) },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == AppTab.ADMIN) Icons.Filled.AdminPanelSettings else Icons.Outlined.AdminPanelSettings,
                            contentDescription = "Admin"
                        )
                    },
                    label = { Text("Admin", fontSize = 10.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF001B2E),
                        selectedTextColor = CyberCyan,
                        indicatorColor = CyberCyan,
                        unselectedIconColor = Color(0xFF94A3B8),
                        unselectedTextColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.testTag("nav_admin_tab")
                )

                // Tab 5: Info/Docs
                NavigationBarItem(
                    selected = currentTab == AppTab.SETTINGS,
                    onClick = { viewModel.switchTab(AppTab.SETTINGS) },
                    icon = {
                        Icon(
                            imageVector = if (currentTab == AppTab.SETTINGS) Icons.Filled.Info else Icons.Outlined.Info,
                            contentDescription = "Info"
                        )
                    },
                    label = { Text("Docs", fontSize = 10.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = Color(0xFF001B2E),
                        selectedTextColor = CyberCyan,
                        indicatorColor = CyberCyan,
                        unselectedIconColor = Color(0xFF94A3B8),
                        unselectedTextColor = Color(0xFF94A3B8)
                    ),
                    modifier = Modifier.testTag("nav_docs_tab")
                )
            }
        },
        containerColor = Color(0xFF080D1A)
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFF080D1A))
        ) {
            AnimatedContent(
                targetState = currentTab,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "ScreenTransition"
            ) { targetScreen ->
                when (targetScreen) {
                    AppTab.BUILDER -> {
                        BuilderScreen(
                            onTriggerBuild = { webUrl, appName, packageName, iconUrl, iconBase64, localIconUri, orientation, buildType, fullscreen, showUrlBar, javascript, pullToRefresh, externalIntents, offlinePwa, desktopMode, nativeShare, fileUpload, downloads, splash, splashDurationMs, splashBgColor ->
                                viewModel.startBuild(
                                    webUrl = webUrl,
                                    appName = appName,
                                    packageName = packageName,
                                    iconUrl = iconUrl,
                                    iconBase64 = iconBase64,
                                    localIconUri = localIconUri,
                                    orientation = orientation,
                                    buildType = buildType,
                                    fullscreen = fullscreen,
                                    showUrlBar = showUrlBar,
                                    javascript = javascript,
                                    pullToRefresh = pullToRefresh,
                                    externalIntents = externalIntents,
                                    offlinePwa = offlinePwa,
                                    desktopMode = desktopMode,
                                    nativeShare = nativeShare,
                                    fileUpload = fileUpload,
                                    downloads = downloads,
                                    splash = splash,
                                    splashDurationMs = splashDurationMs,
                                    splashBgColor = splashBgColor
                                )
                            }
                        )
                    }

                    AppTab.BUILD_CENTER -> {
                        BuildCenterScreen(
                            currentBuild = activeBuild,
                            onRetry = { buildId -> viewModel.retryBuild(buildId) },
                            onNewBuild = { viewModel.switchTab(AppTab.BUILDER) },
                            onNavigateToAdmin = { viewModel.switchTab(AppTab.ADMIN) }
                        )
                    }

                    AppTab.HISTORY -> {
                        BuildHistoryScreen(
                            builds = allBuilds,
                            onSelectBuild = { build -> viewModel.selectBuild(build) },
                            onRetry = { build -> viewModel.retryBuild(build.id) },
                            onDelete = { build -> viewModel.deleteBuild(build) },
                            onClearAll = { viewModel.clearAllBuilds() }
                        )
                    }

                    AppTab.ADMIN -> {
                        AdminDashboardScreen(
                            adminConfig = adminConfig,
                            stats = stats,
                            isTestingConnection = isTestingConnection,
                            connectionTestResult = connectionTestResult,
                            isDeployingWorkflow = isDeployingWorkflow,
                            isPushingTemplate = isPushingTemplate,
                            pushProgressText = pushProgressText,
                            onSaveConfig = { config -> viewModel.saveAdminConfig(config) },
                            onTestGitHub = { config -> viewModel.testGitHubConnection(config) },
                            onDeployWorkflow = { config, fileName, customContent -> viewModel.deployWorkflow(config, fileName, customContent) },
                            onPushFullTemplate = { config -> viewModel.pushFullTemplateToRepo(config) },
                            onRunTestBuild = { viewModel.runTestBuild() }
                        )
                    }

                    AppTab.SETTINGS -> {
                        SettingsScreen()
                    }
                }
            }
        }
    }
}
