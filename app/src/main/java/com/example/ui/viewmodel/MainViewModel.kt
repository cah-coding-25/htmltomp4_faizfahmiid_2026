package com.example.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.BuildConfig
import com.example.data.local.AdminConfigEntity
import com.example.data.local.AppDatabase
import com.example.data.local.BuildItemEntity
import com.example.data.repository.AdminRepository
import com.example.data.repository.BuildRepository
import com.example.data.repository.GitHubService
import com.example.data.repository.GitHubValidationResult
import com.example.data.repository.SystemStats
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class AppTab {
    BUILDER,
    BUILD_CENTER,
    HISTORY,
    ADMIN,
    SETTINGS
}

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application)
    private val gitHubService = GitHubService()
    private val buildRepo = BuildRepository(db.buildDao(), db.adminDao(), gitHubService)
    private val adminRepo = AdminRepository(db.adminDao(), db.buildDao(), gitHubService)

    // Current navigation tab
    private val _currentTab = MutableStateFlow(AppTab.BUILDER)
    val currentTab: StateFlow<AppTab> = _currentTab.asStateFlow()

    // Active Build in focus
    private val _activeBuild = MutableStateFlow<BuildItemEntity?>(null)
    val activeBuild: StateFlow<BuildItemEntity?> = _activeBuild.asStateFlow()

    // Builds list
    val allBuilds: StateFlow<List<BuildItemEntity>> = buildRepo.allBuilds
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Admin Config
    private val _adminConfig = MutableStateFlow(AdminConfigEntity())
    val adminConfig: StateFlow<AdminConfigEntity> = _adminConfig.asStateFlow()

    // System Stats
    private val _stats = MutableStateFlow(SystemStats(0, 0, 0, 0))
    val stats: StateFlow<SystemStats> = _stats.asStateFlow()

    // GitHub Connection test state
    private val _isTestingConnection = MutableStateFlow(false)
    val isTestingConnection: StateFlow<Boolean> = _isTestingConnection.asStateFlow()

    private val _connectionTestResult = MutableStateFlow<GitHubValidationResult?>(null)
    val connectionTestResult: StateFlow<GitHubValidationResult?> = _connectionTestResult.asStateFlow()

    // Workflow deployment state
    private val _isDeployingWorkflow = MutableStateFlow(false)
    val isDeployingWorkflow: StateFlow<Boolean> = _isDeployingWorkflow.asStateFlow()

    // Repo initialization / push state
    private val _isPushingTemplate = MutableStateFlow(false)
    val isPushingTemplate: StateFlow<Boolean> = _isPushingTemplate.asStateFlow()

    private val _pushProgressText = MutableStateFlow<String?>(null)
    val pushProgressText: StateFlow<String?> = _pushProgressText.asStateFlow()

    // General notification / toast message
    private val _userMessage = MutableStateFlow<String?>(null)
    val userMessage: StateFlow<String?> = _userMessage.asStateFlow()

    init {
        loadInitialAdminConfig()
        refreshStats()
    }

    private fun loadInitialAdminConfig() {
        viewModelScope.launch(Dispatchers.IO) {
            val savedConfig = adminRepo.getConfig()

            // If local DB doesn't have token but BuildConfig has one injected via Secrets plugin, use it!
            var initialToken = savedConfig.githubToken
            try {
                val buildConfigField = BuildConfig::class.java.getField("GITHUB_TOKEN")
                val buildConfigToken = buildConfigField.get(null) as? String
                if (initialToken.isBlank() && !buildConfigToken.isNullOrBlank() && buildConfigToken != "MY_GITHUB_TOKEN") {
                    initialToken = buildConfigToken
                }
            } catch (_: Exception) {}

            val finalConfig = savedConfig.copy(githubToken = initialToken)
            _adminConfig.value = finalConfig
            adminRepo.saveConfig(finalConfig)

            // Test connection on boot if token is available
            if (finalConfig.githubToken.isNotBlank()) {
                testGitHubConnection(finalConfig)
            }
        }
    }

    fun refreshStats() {
        viewModelScope.launch(Dispatchers.IO) {
            _stats.value = adminRepo.getSystemStats()
        }
    }

    fun switchTab(tab: AppTab) {
        _currentTab.value = tab
    }

    fun selectBuild(build: BuildItemEntity) {
        _activeBuild.value = build
        _currentTab.value = AppTab.BUILD_CENTER
    }

    fun startBuild(
        webUrl: String,
        appName: String,
        packageName: String,
        iconUrl: String,
        iconBase64: String? = null,
        localIconUri: String? = null,
        orientation: String,
        buildType: String,
        fullscreen: Boolean,
        showUrlBar: Boolean = false,
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
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            val result = buildRepo.createAndStartBuild(
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
                splashBgColor = splashBgColor,
                tokenOverride = _adminConfig.value.githubToken
            )

            if (result.isSuccess) {
                val newBuild = result.getOrNull()
                _activeBuild.value = newBuild
                _currentTab.value = AppTab.BUILD_CENTER
                refreshStats()

                // Execute async build lifecycle
                if (newBuild != null) {
                    buildRepo.executeBuildLifecycle(newBuild.id, _adminConfig.value.githubToken)
                    // Update active build view
                    _activeBuild.value = buildRepo.getBuildById(newBuild.id)
                    refreshStats()
                }
            } else {
                _userMessage.value = result.exceptionOrNull()?.message ?: "Gagal memulai build"
                // If created as failed due to missing credentials, still show in build center
                val latest = buildRepo.getBuildById(buildRepo.generateBuildId())
                if (latest != null) {
                    _activeBuild.value = latest
                    _currentTab.value = AppTab.BUILD_CENTER
                }
            }
        }
    }

    fun retryBuild(buildId: String) {
        viewModelScope.launch(Dispatchers.IO) {
            val result = buildRepo.retryBuild(buildId)
            if (result.isSuccess) {
                val newBuild = result.getOrNull()
                _activeBuild.value = newBuild
                _currentTab.value = AppTab.BUILD_CENTER
                refreshStats()

                if (newBuild != null) {
                    buildRepo.executeBuildLifecycle(newBuild.id, _adminConfig.value.githubToken)
                    _activeBuild.value = buildRepo.getBuildById(newBuild.id)
                    refreshStats()
                }
            } else {
                _userMessage.value = result.exceptionOrNull()?.message ?: "Gagal mengulang build"
            }
        }
    }

    fun deleteBuild(build: BuildItemEntity) {
        viewModelScope.launch(Dispatchers.IO) {
            buildRepo.deleteBuild(build)
            if (_activeBuild.value?.id == build.id) {
                _activeBuild.value = null
            }
            refreshStats()
        }
    }

    fun clearAllBuilds() {
        viewModelScope.launch(Dispatchers.IO) {
            buildRepo.clearHistory()
            _activeBuild.value = null
            refreshStats()
        }
    }

    fun saveAdminConfig(config: AdminConfigEntity) {
        viewModelScope.launch(Dispatchers.IO) {
            adminRepo.saveConfig(config)
            _adminConfig.value = config
            testGitHubConnection(config)
        }
    }

    fun testGitHubConnection(config: AdminConfigEntity) {
        viewModelScope.launch(Dispatchers.IO) {
            _isTestingConnection.value = true
            _connectionTestResult.value = null

            val result = adminRepo.testGitHubConnection(config)
            _connectionTestResult.value = result
            _isTestingConnection.value = false
        }
    }

    fun runTestBuild() {
        startBuild(
            webUrl = "https://example.com",
            appName = "Demo Website",
            packageName = "com.faizfahmiid.demo",
            iconUrl = "https://cdn-icons-png.flaticon.com/512/2920/2920244.png",
            orientation = "portrait",
            buildType = "apk",
            fullscreen = false,
            javascript = true,
            pullToRefresh = true,
            externalIntents = true,
            offlinePwa = false,
            desktopMode = false,
            nativeShare = true,
            fileUpload = true,
            downloads = true,
            splash = true,
            splashDurationMs = 1500L,
            splashBgColor = "#0B132B"
        )
    }

    fun deployWorkflow(
        config: AdminConfigEntity,
        fileName: String? = null,
        customContent: String? = null
    ) {
        viewModelScope.launch(Dispatchers.IO) {
            _isDeployingWorkflow.value = true
            val result = adminRepo.deployWorkflow(config, fileName, customContent)
            _isDeployingWorkflow.value = false
            if (result.isSuccess) {
                _userMessage.value = result.getOrNull() ?: "Workflow berhasil di-deploy!"
                testGitHubConnection(config)
            } else {
                _userMessage.value = "Gagal deploy workflow: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    fun pushFullTemplateToRepo(config: AdminConfigEntity) {
        viewModelScope.launch(Dispatchers.IO) {
            _isPushingTemplate.value = true
            _pushProgressText.value = "Menyiapkan file engine..."
            val result = adminRepo.pushFullTemplateToRepo(config) { step, current, total ->
                _pushProgressText.value = "$step ($current/$total)"
            }
            _isPushingTemplate.value = false
            _pushProgressText.value = null

            if (result.isSuccess) {
                _userMessage.value = "✓ Seluruh file repositori berhasil di-upload ke GitHub!"
                testGitHubConnection(config)
            } else {
                _userMessage.value = "Gagal upload repositori: ${result.exceptionOrNull()?.message}"
            }
        }
    }

    fun clearUserMessage() {
        _userMessage.value = null
    }
}
