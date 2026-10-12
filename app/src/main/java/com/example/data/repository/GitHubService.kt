package com.example.data.repository

import com.example.data.remote.CreateGitRefPayload
import com.example.data.remote.CreateOrUpdateFilePayload
import com.example.data.remote.GitHubApiService
import com.example.data.remote.GitHubReleaseItem
import com.example.data.remote.GitHubRepoResponse
import com.example.data.remote.GitHubWorkflowItem
import com.example.data.remote.NetworkClient
import com.example.data.remote.RateLimitResponse
import com.example.data.remote.WorkflowArtifactItem
import com.example.data.remote.WorkflowDispatchPayload
import com.example.data.remote.WorkflowJobItem
import com.example.data.remote.WorkflowRunItem
import com.example.domain.AppConfigGenerator

data class GitHubValidationResult(
    val isSuccess: Boolean,
    val message: String,
    val repo: GitHubRepoResponse? = null,
    val workflows: List<GitHubWorkflowItem> = emptyList(),
    val rateLimitRemaining: Int? = null,
    val errorDetail: String? = null
)

class GitHubService(
    private val api: GitHubApiService = NetworkClient.gitHubApi
) {

    suspend fun validateConnection(
        owner: String,
        repo: String,
        token: String?
    ): GitHubValidationResult {
        val authHeader = NetworkClient.formatAuthHeader(token)

        return try {
            val repoResponse = api.getRepository(owner, repo, authHeader)
            if (!repoResponse.isSuccessful) {
                val code = repoResponse.code()
                val errBody = repoResponse.errorBody()?.string() ?: ""
                return when (code) {
                    401 -> GitHubValidationResult(
                        false,
                        "Autentikasi GitHub gagal: Token tidak valid atau kedaluwarsa.",
                        errorDetail = "HTTP 401 Unauthorized: $errBody"
                    )
                    403 -> GitHubValidationResult(
                        false,
                        "Akses ditolak: Rate limit tercapai atau token tidak memiliki izin repositori.",
                        errorDetail = "HTTP 403 Forbidden: $errBody"
                    )
                    404 -> GitHubValidationResult(
                        false,
                        "Repositori '$owner/$repo' tidak ditemukan. Pastikan nama repositori benar dan token memiliki akses repositori privat.",
                        errorDetail = "HTTP 404 Not Found"
                    )
                    else -> GitHubValidationResult(
                        false,
                        "Gagal menghubungi GitHub API (HTTP $code)",
                        errorDetail = errBody
                    )
                }
            }

            val repoData = repoResponse.body()
                ?: return GitHubValidationResult(false, "Respons repositori kosong dari GitHub.")

            // Check workflows
            val workflowsResponse = api.getWorkflows(owner, repo, authHeader)
            val workflowList = if (workflowsResponse.isSuccessful) {
                workflowsResponse.body()?.workflows ?: emptyList()
            } else {
                emptyList()
            }

            // Check rate limit
            var remainingQuota: Int? = null
            try {
                val rateResp = api.getRateLimit(authHeader)
                if (rateResp.isSuccessful) {
                    remainingQuota = rateResp.body()?.resources?.core?.remaining
                }
            } catch (_: Exception) {}

            GitHubValidationResult(
                isSuccess = true,
                message = "Terhubung dengan sukses ke $owner/$repo (${workflowList.size} workflow ditemukan)",
                repo = repoData,
                workflows = workflowList,
                rateLimitRemaining = remainingQuota
            )
        } catch (e: Exception) {
            GitHubValidationResult(
                isSuccess = false,
                message = "Koneksi ke GitHub gagal: ${e.localizedMessage ?: "Network error"}",
                errorDetail = e.stackTraceToString()
            )
        }
    }

    suspend fun getWorkflows(
        owner: String,
        repo: String,
        token: String?
    ): Result<List<GitHubWorkflowItem>> {
        return try {
            val response = api.getWorkflows(owner, repo, NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful) {
                Result.success(response.body()?.workflows ?: emptyList())
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun dispatchWorkflow(
        owner: String,
        repo: String,
        workflowIdOrFile: String,
        ref: String,
        inputs: Map<String, String>,
        token: String?
    ): Result<Boolean> {
        return try {
            val auth = NetworkClient.formatAuthHeader(token)
            if (auth == null) {
                return Result.failure(Exception("GitHub Token diperlukan untuk memicu GitHub Actions."))
            }

            val payload = WorkflowDispatchPayload(ref = ref, inputs = inputs)
            val response = api.dispatchWorkflow(owner, repo, workflowIdOrFile, payload, auth)

            if (response.isSuccessful || response.code() == 204) {
                Result.success(true)
            } else {
                val err = response.errorBody()?.string() ?: "Unknown error"
                Result.failure(Exception("HTTP ${response.code()}: $err"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLatestWorkflowRun(
        owner: String,
        repo: String,
        branch: String?,
        token: String?
    ): Result<WorkflowRunItem?> {
        return try {
            val response = api.getWorkflowRuns(
                owner = owner,
                repo = repo,
                branch = branch,
                event = "workflow_dispatch",
                perPage = 5,
                authHeader = NetworkClient.formatAuthHeader(token)
            )
            if (response.isSuccessful) {
                val runs = response.body()?.workflowRuns ?: emptyList()
                Result.success(runs.firstOrNull())
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWorkflowRun(
        owner: String,
        repo: String,
        runId: Long,
        token: String?
    ): Result<WorkflowRunItem> {
        return try {
            val response = api.getWorkflowRun(owner, repo, runId, NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getWorkflowJobs(
        owner: String,
        repo: String,
        runId: Long,
        token: String?
    ): Result<List<WorkflowJobItem>> {
        return try {
            val response = api.getWorkflowJobs(owner, repo, runId, NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful) {
                Result.success(response.body()?.jobs ?: emptyList())
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getArtifacts(
        owner: String,
        repo: String,
        runId: Long,
        token: String?
    ): Result<List<WorkflowArtifactItem>> {
        return try {
            val response = api.getWorkflowArtifacts(owner, repo, runId, NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful) {
                Result.success(response.body()?.artifacts ?: emptyList())
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getReleases(
        owner: String,
        repo: String,
        token: String?
    ): Result<List<GitHubReleaseItem>> {
        return try {
            val response = api.getReleases(owner, repo, 5, NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getRateLimit(token: String?): Result<RateLimitResponse> {
        return try {
            val response = api.getRateLimit(NetworkClient.formatAuthHeader(token))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Isolates build in temporary branch 'build/<build-id>' to avoid overwriting other builds
     * Also pushes AppConfig.kt and custom local icon if provided
     */
    suspend fun prepareIsolatedBuildBranch(
        owner: String,
        repo: String,
        baseBranch: String,
        buildId: String,
        appConfigContent: String,
        iconBase64: String? = null,
        token: String?
    ): Result<String> {
        val auth = NetworkClient.formatAuthHeader(token)
            ?: return Result.failure(Exception("GitHub Token diperlukan untuk membuat branch terisolasi."))

        return try {
            val baseRefResponse = api.getBranchRef(owner, repo, baseBranch, auth)
            if (!baseRefResponse.isSuccessful) {
                return Result.failure(Exception("Gagal mengambil referensi branch '$baseBranch'"))
            }

            val headSha = baseRefResponse.body()?.`object`?.sha
                ?: return Result.failure(Exception("SHA branch '$baseBranch' kosong"))

            val newBranchName = "build/$buildId"
            val createRefPayload = CreateGitRefPayload(
                ref = "refs/heads/$newBranchName",
                sha = headSha
            )

            val createBranchResp = api.createBranch(owner, repo, createRefPayload, auth)
            if (!createBranchResp.isSuccessful && createBranchResp.code() != 422) {
                return Result.failure(Exception("Gagal membuat branch terisolasi: HTTP ${createBranchResp.code()}"))
            }

            // Commit AppConfig.kt into new branch
            val base64Content = AppConfigGenerator.encodeBase64(appConfigContent)
            val filePath = "app/src/main/java/com/example/AppConfig.kt"

            // Check existing file SHA in new branch
            val fileCheckResp = api.getFileContent(owner, repo, filePath, newBranchName, auth)
            val existingSha = if (fileCheckResp.isSuccessful) fileCheckResp.body()?.sha else null

            val commitPayload = CreateOrUpdateFilePayload(
                message = "Configure AppConfig for build #$buildId [skip ci]",
                content = base64Content,
                branch = newBranchName,
                sha = existingSha
            )

            val commitResp = api.createOrUpdateFile(owner, repo, filePath, commitPayload, auth)
            if (!commitResp.isSuccessful) {
                return Result.failure(Exception("Gagal commit AppConfig.kt ke branch $newBranchName (HTTP ${commitResp.code()})"))
            }

            // Commit custom local icon if uploaded
            if (!iconBase64.isNullOrBlank()) {
                val iconPath = "app/src/main/res/drawable/ic_launcher_foreground.png"
                val existingIconCheck = api.getFileContent(owner, repo, iconPath, newBranchName, auth)
                val existingIconSha = if (existingIconCheck.isSuccessful) existingIconCheck.body()?.sha else null

                val iconCommitPayload = CreateOrUpdateFilePayload(
                    message = "Upload custom local icon for build #$buildId [skip ci]",
                    content = iconBase64,
                    branch = newBranchName,
                    sha = existingIconSha
                )
                api.createOrUpdateFile(owner, repo, iconPath, iconCommitPayload, auth)
            }

            Result.success(newBranchName)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deploys or updates the GitHub Actions workflow file in the repository
     */
    suspend fun deployWorkflowFile(
        owner: String,
        repo: String,
        branch: String,
        token: String?,
        fileName: String = "build_apk.yml",
        customContent: String? = null
    ): Result<String> {
        val auth = NetworkClient.formatAuthHeader(token)
            ?: return Result.failure(Exception("GitHub Token diperlukan untuk deploy workflow."))

        val defaultWorkflowContent = """
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

        val finalContent = if (!customContent.isNullOrBlank()) customContent else defaultWorkflowContent
        val base64Workflow = AppConfigGenerator.encodeBase64(finalContent)
        val cleanFileName = if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) fileName else "$fileName.yml"
        val workflowPath = ".github/workflows/$cleanFileName"

        return try {
            val fileCheck = api.getFileContent(owner, repo, workflowPath, branch, auth)
            val sha = if (fileCheck.isSuccessful) fileCheck.body()?.sha else null

            val payload = CreateOrUpdateFilePayload(
                message = "Setup Faiz Fahmi ID Web to App Builder GitHub Actions Workflow ($cleanFileName) [skip ci]",
                content = base64Workflow,
                branch = branch,
                sha = sha
            )

            val response = api.createOrUpdateFile(owner, repo, workflowPath, payload, auth)
            if (response.isSuccessful || response.code() == 201 || response.code() == 200) {
                Result.success("Workflow berhasil di-deploy ke $owner/$repo/$workflowPath")
            } else {
                Result.failure(Exception("HTTP ${response.code()}: ${response.errorBody()?.string()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Uploads/Pushes all essential WebToApp engine template files into a new GitHub repository
     */
    suspend fun initializeFullRepository(
        owner: String,
        repo: String,
        branch: String,
        token: String?,
        files: Map<String, String>,
        onProgress: (step: String, current: Int, total: Int) -> Unit
    ): Result<Int> {
        val auth = NetworkClient.formatAuthHeader(token)
            ?: return Result.failure(Exception("GitHub Token diperlukan untuk inisialisasi repositori."))

        var count = 0
        val total = files.size
        try {
            for ((path, content) in files) {
                onProgress("Mengunggah $path...", count + 1, total)
                val base64Content = AppConfigGenerator.encodeBase64(content)
                val fileCheck = api.getFileContent(owner, repo, path, branch, auth)
                val sha = if (fileCheck.isSuccessful) fileCheck.body()?.sha else null

                val payload = CreateOrUpdateFilePayload(
                    message = "Initialize $path for WebToApp Engine [skip ci]",
                    content = base64Content,
                    branch = branch,
                    sha = sha
                )

                val response = api.createOrUpdateFile(owner, repo, path, payload, auth)
                if (response.isSuccessful || response.code() == 200 || response.code() == 201) {
                    count++
                } else if (response.code() == 409 || response.code() == 422) {
                    count++
                } else {
                    return Result.failure(Exception("Gagal upload $path (HTTP ${response.code()}): ${response.errorBody()?.string()}"))
                }
            }
            return Result.success(count)
        } catch (e: Exception) {
            return Result.failure(e)
        }
    }
}
