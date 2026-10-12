package com.example.data.repository

import com.example.data.local.AdminConfigEntity
import com.example.data.local.AdminDao
import com.example.data.local.BuildDao
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull

data class SystemStats(
    val totalBuilds: Int,
    val successBuilds: Int,
    val failedBuilds: Int,
    val runningBuilds: Int
)

class AdminRepository(
    private val adminDao: AdminDao,
    private val buildDao: BuildDao,
    private val gitHubService: GitHubService = GitHubService()
) {

    val configFlow: Flow<AdminConfigEntity?> = adminDao.getConfigFlow()

    suspend fun getConfig(): AdminConfigEntity {
        return adminDao.getConfig() ?: AdminConfigEntity().also {
            adminDao.saveConfig(it)
        }
    }

    suspend fun saveConfig(config: AdminConfigEntity) {
        adminDao.saveConfig(config.copy(lastUpdated = System.currentTimeMillis()))
    }

    suspend fun getSystemStats(): SystemStats {
        val all = buildDao.getAllBuilds().firstOrNull() ?: emptyList()
        val total = all.size
        val success = all.count { it.status == "SUCCESS" }
        val failed = all.count { it.status == "FAILED" }
        val running = all.count { it.status in listOf("QUEUED", "RUNNING", "BUILDING", "PACKAGING") }
        return SystemStats(total, success, failed, running)
    }

    suspend fun testGitHubConnection(config: AdminConfigEntity): GitHubValidationResult {
        return gitHubService.validateConnection(
            owner = config.githubOwner.ifBlank { "cah-coding-25" },
            repo = config.githubRepo.ifBlank { "webtoapp_faizfahmiid_2026" },
            token = config.githubToken
        )
    }

    suspend fun deployWorkflow(
        config: AdminConfigEntity,
        fileName: String? = null,
        customContent: String? = null
    ): Result<String> {
        val targetFileName = fileName?.ifBlank { null }
            ?: config.workflowFileName.ifBlank { "build_apk.yml" }

        return gitHubService.deployWorkflowFile(
            owner = config.githubOwner.ifBlank { "cah-coding-25" },
            repo = config.githubRepo.ifBlank { "webtoapp_faizfahmiid_2026" },
            branch = config.githubBranch.ifBlank { "main" },
            token = config.githubToken,
            fileName = targetFileName,
            customContent = customContent
        )
    }

    suspend fun pushFullTemplateToRepo(
        config: AdminConfigEntity,
        onProgress: (step: String, current: Int, total: Int) -> Unit
    ): Result<Int> {
        val files = com.example.domain.TemplateZipManager.getEssentialEngineFiles()
        return gitHubService.initializeFullRepository(
            owner = config.githubOwner.ifBlank { "cah-coding-25" },
            repo = config.githubRepo.ifBlank { "webtoapp_faizfahmiid_2026" },
            branch = config.githubBranch.ifBlank { "main" },
            token = config.githubToken,
            files = files,
            onProgress = onProgress
        )
    }
}
