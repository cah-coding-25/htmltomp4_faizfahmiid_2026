package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "build_items")
data class BuildItemEntity(
    @PrimaryKey
    val id: String,
    val webUrl: String,
    val appName: String,
    val packageName: String,
    val iconUrl: String = "",
    val iconBase64: String? = null,
    val localIconUri: String? = null,
    val orientation: String = "portrait",
    val buildType: String = "apk",
    val fullscreen: Boolean = false,
    val showUrlBar: Boolean = false,
    val javascript: Boolean = true,
    val pullToRefresh: Boolean = true,
    val externalIntents: Boolean = true,
    val offlinePwa: Boolean = false,
    val desktopMode: Boolean = false,
    val nativeShare: Boolean = true,
    val fileUpload: Boolean = true,
    val downloads: Boolean = true,
    val splash: Boolean = true,
    val splashDurationMs: Long = 1800L,
    val splashBgColor: String = "#0B132B",
    val status: String = "QUEUED", // QUEUED, RUNNING, BUILDING, PACKAGING, SUCCESS, FAILED
    val stage: String = "Waiting for GitHub Actions",
    val workflowRunId: Long? = null,
    val runHtmlUrl: String? = null,
    val apkDownloadUrl: String? = null,
    val aabDownloadUrl: String? = null,
    val apkFileName: String? = null,
    val errorMessage: String? = null,
    val logOutput: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val completedAt: Long? = null
)
