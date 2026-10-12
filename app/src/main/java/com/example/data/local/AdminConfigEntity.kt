package com.example.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "admin_config")
data class AdminConfigEntity(
    @PrimaryKey
    val id: Int = 1,
    val githubToken: String = "",
    val githubOwner: String = "cah-coding-25",
    val githubRepo: String = "webtoapp_faizfahmiid_2026",
    val githubBranch: String = "main",
    val workflowFileName: String = "",
    val maxConcurrentBuilds: Int = 2,
    val maxBuildsPerHour: Int = 10,
    val adminPin: String = "1234",
    val isDevMode: Boolean = false,
    val lastUpdated: Long = System.currentTimeMillis()
)
