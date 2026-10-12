package com.example.data.remote

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class GitHubRepoResponse(
    val id: Long,
    val name: String,
    @param:Json(name = "full_name") val fullName: String,
    val private: Boolean,
    @param:Json(name = "default_branch") val defaultBranch: String,
    val description: String?,
    @param:Json(name = "html_url") val htmlUrl: String,
    val permissions: GitHubPermissions? = null
)

@JsonClass(generateAdapter = true)
data class GitHubPermissions(
    val admin: Boolean = false,
    val push: Boolean = false,
    val pull: Boolean = true
)

@JsonClass(generateAdapter = true)
data class GitHubWorkflowsResponse(
    @param:Json(name = "total_count") val totalCount: Int,
    val workflows: List<GitHubWorkflowItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class GitHubWorkflowItem(
    val id: Long,
    val name: String,
    val path: String,
    val state: String,
    @param:Json(name = "html_url") val htmlUrl: String,
    @param:Json(name = "badge_url") val badgeUrl: String?
)

@JsonClass(generateAdapter = true)
data class WorkflowDispatchPayload(
    val ref: String,
    val inputs: Map<String, String> = emptyMap()
)

@JsonClass(generateAdapter = true)
data class WorkflowRunsResponse(
    @param:Json(name = "total_count") val totalCount: Int,
    @param:Json(name = "workflow_runs") val workflowRuns: List<WorkflowRunItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkflowRunItem(
    val id: Long,
    val name: String?,
    @param:Json(name = "head_branch") val headBranch: String?,
    @param:Json(name = "head_sha") val headSha: String?,
    val status: String, // queued, in_progress, completed
    val conclusion: String?, // success, failure, cancelled, timed_out, neutral
    @param:Json(name = "html_url") val htmlUrl: String,
    @param:Json(name = "created_at") val createdAt: String,
    @param:Json(name = "updated_at") val updatedAt: String,
    @param:Json(name = "run_attempt") val runAttempt: Int = 1
)

@JsonClass(generateAdapter = true)
data class WorkflowJobsResponse(
    @param:Json(name = "total_count") val totalCount: Int,
    val jobs: List<WorkflowJobItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkflowJobItem(
    val id: Long,
    @param:Json(name = "run_id") val runId: Long,
    val name: String,
    val status: String,
    val conclusion: String?,
    val steps: List<WorkflowStepItem>? = null
)

@JsonClass(generateAdapter = true)
data class WorkflowStepItem(
    val name: String,
    val status: String,
    val conclusion: String?,
    val number: Int
)

@JsonClass(generateAdapter = true)
data class WorkflowArtifactsResponse(
    @param:Json(name = "total_count") val totalCount: Int,
    val artifacts: List<WorkflowArtifactItem> = emptyList()
)

@JsonClass(generateAdapter = true)
data class WorkflowArtifactItem(
    val id: Long,
    val name: String,
    @param:Json(name = "size_in_bytes") val sizeInBytes: Long,
    @param:Json(name = "archive_download_url") val archiveDownloadUrl: String,
    val expired: Boolean = false
)

@JsonClass(generateAdapter = true)
data class GitHubReleaseItem(
    val id: Long,
    @param:Json(name = "tag_name") val tagName: String,
    val name: String?,
    val body: String?,
    @param:Json(name = "html_url") val htmlUrl: String,
    val assets: List<GitHubReleaseAsset> = emptyList()
)

@JsonClass(generateAdapter = true)
data class GitHubReleaseAsset(
    val id: Long,
    val name: String,
    @param:Json(name = "browser_download_url") val browserDownloadUrl: String,
    @param:Json(name = "content_type") val contentType: String,
    val size: Long
)

@JsonClass(generateAdapter = true)
data class RateLimitResponse(
    val resources: RateLimitResources
)

@JsonClass(generateAdapter = true)
data class RateLimitResources(
    val core: RateLimitCategory
)

@JsonClass(generateAdapter = true)
data class RateLimitCategory(
    val limit: Int,
    val remaining: Int,
    val reset: Long,
    val used: Int
)

@JsonClass(generateAdapter = true)
data class GitRefResponse(
    val ref: String,
    @param:Json(name = "node_id") val nodeId: String,
    val url: String,
    val `object`: GitRefObject
)

@JsonClass(generateAdapter = true)
data class GitRefObject(
    val sha: String,
    val type: String,
    val url: String
)

@JsonClass(generateAdapter = true)
data class CreateGitRefPayload(
    val ref: String,
    val sha: String
)

@JsonClass(generateAdapter = true)
data class CreateOrUpdateFilePayload(
    val message: String,
    val content: String, // base64 encoded
    val branch: String,
    val sha: String? = null
)

@JsonClass(generateAdapter = true)
data class FileContentResponse(
    val name: String,
    val path: String,
    val sha: String,
    val size: Int,
    val content: String?,
    val encoding: String?
)
