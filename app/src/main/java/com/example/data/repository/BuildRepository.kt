package com.example.data.repository

import com.example.data.local.AdminDao
import com.example.data.local.BuildDao
import com.example.data.local.BuildItemEntity
import com.example.domain.AppConfigGenerator
import com.example.domain.ValidationUtil
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class BuildRepository(
    private val buildDao: BuildDao,
    private val adminDao: AdminDao,
    private val gitHubService: GitHubService = GitHubService()
) {

    val allBuilds: Flow<List<BuildItemEntity>> = buildDao.getAllBuilds()

    fun getBuildFlow(id: String): Flow<BuildItemEntity?> = buildDao.getBuildByIdFlow(id)

    suspend fun getBuildById(id: String): BuildItemEntity? = buildDao.getBuildById(id)

    fun generateBuildId(): String {
        val dateFormat = SimpleDateFormat("yyyyMMdd", Locale.getDefault())
        val dateStr = dateFormat.format(Date())
        val randomSuffix = UUID.randomUUID().toString().substring(0, 4).uppercase()
        return "FAIZ-$dateStr-$randomSuffix"
    }

    suspend fun createAndStartBuild(
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
        splashBgColor: String,
        tokenOverride: String? = null
    ): Result<BuildItemEntity> {
        // Validate inputs
        val urlVal = ValidationUtil.validateWebUrl(webUrl)
        if (!urlVal.isValid) return Result.failure(Exception(urlVal.errorMessage))

        val appVal = ValidationUtil.validateAppName(appName)
        if (!appVal.isValid) return Result.failure(Exception(appVal.errorMessage))

        val pkgVal = ValidationUtil.validatePackageName(packageName)
        if (!pkgVal.isValid) return Result.failure(Exception(pkgVal.errorMessage))

        val iconVal = ValidationUtil.validateIconUrl(iconUrl)
        if (!iconVal.isValid && iconBase64.isNullOrBlank()) return Result.failure(Exception(iconVal.errorMessage))

        val adminConfig = adminDao.getConfig()
        val owner = adminConfig?.githubOwner?.ifBlank { "cah-coding-25" } ?: "cah-coding-25"
        val repo = adminConfig?.githubRepo?.ifBlank { "webtoapp_faizfahmiid_2026" } ?: "webtoapp_faizfahmiid_2026"
        val branch = adminConfig?.githubBranch?.ifBlank { "main" } ?: "main"
        val configuredToken = (tokenOverride?.takeIf { it.isNotBlank() })
            ?: adminConfig?.githubToken?.takeIf { it.isNotBlank() }

        // Rate Limit Checks
        val maxConcurrent = adminConfig?.maxConcurrentBuilds ?: 2
        val maxPerHour = adminConfig?.maxBuildsPerHour ?: 10

        val activeBuilds = buildDao.getActiveRunningBuilds()
        if (activeBuilds.size >= maxConcurrent) {
            return Result.failure(
                Exception("Batas build bersamaan tercapai (Maksimum $maxConcurrent build aktif). Harap tunggu proses selesai.")
            )
        }

        val oneHourAgo = System.currentTimeMillis() - (60 * 60 * 1000)
        val hourlyCount = buildDao.countBuildsSince(oneHourAgo)
        if (hourlyCount >= maxPerHour) {
            return Result.failure(
                Exception("Batas build per jam tercapai (Maksimum $maxPerHour build/jam). Coba lagi beberapa saat lagi.")
            )
        }

        val buildId = generateBuildId()
        val initialBuild = BuildItemEntity(
            id = buildId,
            webUrl = webUrl.trim(),
            appName = appName.trim(),
            packageName = packageName.trim(),
            iconUrl = iconUrl.trim(),
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
            status = "QUEUED",
            stage = "Configuration validated",
            createdAt = System.currentTimeMillis()
        )

        buildDao.insertBuild(initialBuild)

        // Rule #46: DO NOT MOCK. If GitHub is not configured, show clear error!
        if (configuredToken.isNullOrBlank()) {
            val failedBuild = initialBuild.copy(
                status = "FAILED",
                stage = "GitHub belum dikonfigurasi",
                errorMessage = "GitHub Token belum dikonfigurasi. Administrator harus menghubungkan akun GitHub di Admin Dashboard terlebih dahulu.",
                completedAt = System.currentTimeMillis()
            )
            buildDao.updateBuild(failedBuild)
            return Result.failure(
                Exception("GitHub belum dikonfigurasi. Silakan administrator menghubungkan GitHub terlebih dahulu di Admin Dashboard.")
            )
        }

        return Result.success(initialBuild)
    }

    suspend fun executeBuildLifecycle(
        buildId: String,
        tokenOverride: String? = null
    ) {
        val currentBuild = buildDao.getBuildById(buildId) ?: return
        val adminConfig = adminDao.getConfig()

        val owner = adminConfig?.githubOwner?.ifBlank { "cah-coding-25" } ?: "cah-coding-25"
        val repo = adminConfig?.githubRepo?.ifBlank { "webtoapp_faizfahmiid_2026" } ?: "webtoapp_faizfahmiid_2026"
        val baseBranch = adminConfig?.githubBranch?.ifBlank { "main" } ?: "main"
        val token = tokenOverride ?: adminConfig?.githubToken

        if (token.isNullOrBlank()) {
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "FAILED",
                    stage = "Autentikasi Diperlukan",
                    errorMessage = "GitHub Token belum diatur di Admin Dashboard.",
                    completedAt = System.currentTimeMillis()
                )
            )
            return
        }

        try {
            // Stage 1: Generate AppConfig.kt
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "RUNNING",
                    stage = "Menyiapkan konfigurasi Android (AppConfig.kt)..."
                )
            )

            val appConfigCode = AppConfigGenerator.generateAppConfigKotlin(
                webUrl = currentBuild.webUrl,
                appName = currentBuild.appName,
                showTopBar = !currentBuild.fullscreen,
                showUrlBar = currentBuild.showUrlBar,
                pullToRefresh = currentBuild.pullToRefresh,
                allowExternalIntents = currentBuild.externalIntents,
                desktopMode = currentBuild.desktopMode,
                offlinePwa = currentBuild.offlinePwa,
                webShare = currentBuild.nativeShare
            )

            // Strategy A: Branch isolation (build/<buildId>)
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "RUNNING",
                    stage = "Mengirim konfigurasi ke branch terisolasi..."
                )
            )

            val branchResult = gitHubService.prepareIsolatedBuildBranch(
                owner = owner,
                repo = repo,
                baseBranch = baseBranch,
                buildId = currentBuild.id,
                appConfigContent = appConfigCode,
                iconBase64 = currentBuild.iconBase64,
                token = token
            )

            val targetBranch = branchResult.getOrDefault(baseBranch)

            // Stage 2: Discover and Dispatch workflow
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "RUNNING",
                    stage = "Memeriksa GitHub Actions Workflows..."
                )
            )

            val workflowsResult = gitHubService.getWorkflows(owner, repo, token)
            val workflowList = workflowsResult.getOrNull() ?: emptyList()

            // Find workflow dynamically
            val targetWorkflow = workflowList.firstOrNull {
                it.path.contains("android", ignoreCase = true) ||
                it.name.contains("build", ignoreCase = true) ||
                it.name.contains("apk", ignoreCase = true)
            } ?: workflowList.firstOrNull()

            val workflowIdOrPath = targetWorkflow?.id?.toString()
                ?: adminConfig?.workflowFileName?.takeIf { it.isNotBlank() }
                ?: "android.yml"

            buildDao.updateBuild(
                currentBuild.copy(
                    status = "RUNNING",
                    stage = "Memicu workflow GitHub Actions ($workflowIdOrPath)..."
                )
            )

            val inputs = mapOf(
                "build_id" to currentBuild.id,
                "web_url" to currentBuild.webUrl,
                "app_title" to currentBuild.appName,
                "package_name" to currentBuild.packageName,
                "build_type" to currentBuild.buildType,
                "show_url_bar" to currentBuild.showUrlBar.toString()
            )

            val dispatchResult = gitHubService.dispatchWorkflow(
                owner = owner,
                repo = repo,
                workflowIdOrFile = workflowIdOrPath,
                ref = targetBranch,
                inputs = inputs,
                token = token
            )

            if (dispatchResult.isFailure) {
                val err = dispatchResult.exceptionOrNull()?.message ?: "Gagal memicu workflow"
                buildDao.updateBuild(
                    currentBuild.copy(
                        status = "FAILED",
                        stage = "Gagal memicu GitHub Actions",
                        errorMessage = err,
                        completedAt = System.currentTimeMillis()
                    )
                )
                return
            }

            // Stage 3: Wait for GitHub Actions run to register
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "BUILDING",
                    stage = "Menunggu pendaftaran workflow run di GitHub Actions..."
                )
            )

            delay(3500)

            val latestRunResult = gitHubService.getLatestWorkflowRun(owner, repo, targetBranch, token)
            val workflowRun = latestRunResult.getOrNull()

            var runId = workflowRun?.id
            var runHtmlUrl = workflowRun?.htmlUrl ?: "https://github.com/$owner/$repo/actions"

            buildDao.updateBuild(
                currentBuild.copy(
                    status = "BUILDING",
                    stage = "Android Gradle sedang melakukan build...",
                    workflowRunId = runId,
                    runHtmlUrl = runHtmlUrl
                )
            )

            // Stage 4: Monitor status with real GitHub polling (Rule #15 & #41)
            var isFinished = false
            var attempts = 0
            val maxAttempts = 60 // ~5-6 minutes max monitoring in background loop

            while (!isFinished && attempts < maxAttempts) {
                attempts++
                delay(6000)

                if (runId == null) {
                    val retryRun = gitHubService.getLatestWorkflowRun(owner, repo, targetBranch, token).getOrNull()
                    if (retryRun != null) {
                        runId = retryRun.id
                        runHtmlUrl = retryRun.htmlUrl
                    }
                }

                if (runId != null) {
                    val runDetailResult = gitHubService.getWorkflowRun(owner, repo, runId, token)
                    if (runDetailResult.isSuccess) {
                        val run = runDetailResult.getOrNull()!!

                        when (run.status) {
                            "queued" -> {
                                buildDao.updateBuild(
                                    currentBuild.copy(
                                        status = "QUEUED",
                                        stage = "Menunggu antrean runner GitHub Actions...",
                                        workflowRunId = runId,
                                        runHtmlUrl = runHtmlUrl
                                    )
                                )
                            }
                            "in_progress" -> {
                                // Inspect specific jobs/steps for realistic stage reflection
                                val jobsResult = gitHubService.getWorkflowJobs(owner, repo, runId, token)
                                val currentStepName = jobsResult.getOrNull()
                                    ?.flatMap { it.steps ?: emptyList() }
                                    ?.lastOrNull { it.status == "in_progress" || it.conclusion != null }
                                    ?.name ?: "Gradle assembleRelease"

                                buildDao.updateBuild(
                                    currentBuild.copy(
                                        status = "BUILDING",
                                        stage = "Gradle running: $currentStepName",
                                        workflowRunId = runId,
                                        runHtmlUrl = runHtmlUrl
                                    )
                                )
                            }
                            "completed" -> {
                                isFinished = true
                                if (run.conclusion == "success") {
                                    // Fetch artifacts and releases
                                    val artifacts = gitHubService.getArtifacts(owner, repo, runId, token).getOrNull() ?: emptyList()
                                    val apkArtifact = artifacts.firstOrNull { it.name.contains("apk", ignoreCase = true) }
                                    val aabArtifact = artifacts.firstOrNull { it.name.contains("aab", ignoreCase = true) || it.name.contains("bundle", ignoreCase = true) }

                                    val releases = gitHubService.getReleases(owner, repo, token).getOrNull() ?: emptyList()
                                    val releaseAsset = releases.firstOrNull()?.assets?.firstOrNull { it.name.endsWith(".apk", ignoreCase = true) }

                                    val downloadUrl = releaseAsset?.browserDownloadUrl
                                        ?: apkArtifact?.archiveDownloadUrl
                                        ?: "https://github.com/$owner/$repo/actions/runs/$runId"

                                    val aabUrl = aabArtifact?.archiveDownloadUrl

                                    buildDao.updateBuild(
                                        currentBuild.copy(
                                            status = "SUCCESS",
                                            stage = "Build APK Berhasil Diselesaikan",
                                            workflowRunId = runId,
                                            runHtmlUrl = runHtmlUrl,
                                            apkDownloadUrl = downloadUrl,
                                            aabDownloadUrl = aabUrl,
                                            apkFileName = "${currentBuild.appName.replace(" ", "_")}.apk",
                                            completedAt = System.currentTimeMillis()
                                        )
                                    )
                                } else {
                                    val failureReason = run.conclusion ?: "Workflow gagal"
                                    buildDao.updateBuild(
                                        currentBuild.copy(
                                            status = "FAILED",
                                            stage = "Build Gagal di GitHub Actions ($failureReason)",
                                            workflowRunId = runId,
                                            runHtmlUrl = runHtmlUrl,
                                            errorMessage = "GitHub Actions menyelesaikan proses dengan status: $failureReason. Buka log run untuk melihat detail Gradle.",
                                            completedAt = System.currentTimeMillis()
                                        )
                                    )
                                }
                            }
                        }
                    }
                }
            }

            if (!isFinished) {
                buildDao.updateBuild(
                    currentBuild.copy(
                        status = "BUILDING",
                        stage = "Build masih berjalan di background...",
                        workflowRunId = runId,
                        runHtmlUrl = runHtmlUrl
                    )
                )
            }

        } catch (e: Exception) {
            buildDao.updateBuild(
                currentBuild.copy(
                    status = "FAILED",
                    stage = "Kesalahan Eksekusi",
                    errorMessage = e.localizedMessage ?: "Terjadi kesalahan internal",
                    completedAt = System.currentTimeMillis()
                )
            )
        }
    }

    suspend fun retryBuild(oldBuildId: String): Result<BuildItemEntity> {
        val oldBuild = buildDao.getBuildById(oldBuildId)
            ?: return Result.failure(Exception("Build lama tidak ditemukan"))

        return createAndStartBuild(
            webUrl = oldBuild.webUrl,
            appName = oldBuild.appName,
            packageName = oldBuild.packageName,
            iconUrl = oldBuild.iconUrl,
            iconBase64 = oldBuild.iconBase64,
            localIconUri = oldBuild.localIconUri,
            orientation = oldBuild.orientation,
            buildType = oldBuild.buildType,
            fullscreen = oldBuild.fullscreen,
            javascript = oldBuild.javascript,
            pullToRefresh = oldBuild.pullToRefresh,
            externalIntents = oldBuild.externalIntents,
            offlinePwa = oldBuild.offlinePwa,
            desktopMode = oldBuild.desktopMode,
            nativeShare = oldBuild.nativeShare,
            fileUpload = oldBuild.fileUpload,
            downloads = oldBuild.downloads,
            splash = oldBuild.splash,
            splashDurationMs = oldBuild.splashDurationMs,
            splashBgColor = oldBuild.splashBgColor
        )
    }

    suspend fun deleteBuild(build: BuildItemEntity) {
        buildDao.deleteBuild(build)
    }

    suspend fun clearHistory() {
        buildDao.clearAllBuilds()
    }
}
