package com.example.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.CyberCyan
import com.example.ui.theme.EmeraldGreen
import com.example.ui.theme.StatusError

enum class StepState {
    PENDING,
    ACTIVE,
    COMPLETED,
    FAILED
}

data class TimelineStage(
    val title: String,
    val description: String,
    val state: StepState
)

@Composable
fun BuildTimeline(
    status: String,
    stageDescription: String
) {
    // Derive steps based on real GitHub Actions lifecycle
    val isFailed = status == "FAILED"
    val isSuccess = status == "SUCCESS"

    val stages = listOf(
        TimelineStage(
            title = "Configuration Validated",
            description = "URL, package name & Android parameters verified",
            state = StepState.COMPLETED
        ),
        TimelineStage(
            title = "Build Request Dispatched",
            description = "AppConfig.kt committed to isolated GitHub branch",
            state = if (status in listOf("RUNNING", "BUILDING", "PACKAGING", "SUCCESS")) {
                StepState.COMPLETED
            } else if (isFailed && stageDescription.contains("Autentikasi", true)) {
                StepState.FAILED
            } else if (status == "QUEUED") {
                StepState.ACTIVE
            } else {
                StepState.COMPLETED
            }
        ),
        TimelineStage(
            title = "GitHub Actions Started",
            description = "Ubuntu runner spinning up Android SDK environment",
            state = if (status in listOf("BUILDING", "PACKAGING", "SUCCESS")) {
                StepState.COMPLETED
            } else if (status == "RUNNING" || status == "QUEUED") {
                StepState.ACTIVE
            } else if (isFailed) {
                StepState.FAILED
            } else {
                StepState.PENDING
            }
        ),
        TimelineStage(
            title = "Android Project Prepared",
            description = "Applying Gradle plugins, dependencies & assets",
            state = if (status in listOf("BUILDING", "PACKAGING", "SUCCESS")) {
                StepState.COMPLETED
            } else if (status == "RUNNING") {
                StepState.ACTIVE
            } else {
                StepState.PENDING
            }
        ),
        TimelineStage(
            title = "Gradle Build Running",
            description = "Compiling Kotlin & assembleRelease APK task",
            state = if (status in listOf("PACKAGING", "SUCCESS")) {
                StepState.COMPLETED
            } else if (status == "BUILDING") {
                StepState.ACTIVE
            } else if (isFailed && stageDescription.contains("Gradle", true)) {
                StepState.FAILED
            } else {
                StepState.PENDING
            }
        ),
        TimelineStage(
            title = "APK Packaging & Artifacts",
            description = "Signing APK and creating downloadable artifact",
            state = if (isSuccess) {
                StepState.COMPLETED
            } else if (status == "PACKAGING") {
                StepState.ACTIVE
            } else if (isFailed && stageDescription.contains("Packaging", true)) {
                StepState.FAILED
            } else {
                StepState.PENDING
            }
        ),
        TimelineStage(
            title = "Completed & Download Ready",
            description = "APK ready for direct download to device",
            state = if (isSuccess) StepState.COMPLETED else if (isFailed) StepState.FAILED else StepState.PENDING
        )
    )

    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
        stages.forEachIndexed { index, stage ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top
            ) {
                // Indicator column
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    when (stage.state) {
                        StepState.COMPLETED -> {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(EmeraldGreen),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Completed",
                                    tint = Color.White,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                        StepState.ACTIVE -> {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(CyberCyan.copy(alpha = 0.2f)),
                                contentAlignment = Alignment.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    color = CyberCyan,
                                    strokeWidth = 2.dp
                                )
                            }
                        }
                        StepState.FAILED -> {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(StatusError),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Close,
                                    contentDescription = "Failed",
                                    tint = Color.White,
                                    modifier = Modifier.size(14.dp)
                                )
                            }
                        }
                        StepState.PENDING -> {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF334155)),
                                contentAlignment = Alignment.Center
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF64748B))
                                )
                            }
                        }
                    }

                    if (index < stages.size - 1) {
                        Box(
                            modifier = Modifier
                                .width(2.dp)
                                .height(32.dp)
                                .background(
                                    if (stage.state == StepState.COMPLETED) EmeraldGreen.copy(alpha = 0.5f)
                                    else Color(0xFF334155)
                                )
                        )
                    }
                }

                Spacer(modifier = Modifier.width(14.dp))

                // Text details
                Column(modifier = Modifier.padding(bottom = 16.dp)) {
                    Text(
                        text = stage.title,
                        style = MaterialTheme.typography.titleSmall.copy(
                            fontWeight = if (stage.state == StepState.ACTIVE) FontWeight.Bold else FontWeight.SemiBold,
                            fontSize = 13.sp
                        ),
                        color = when (stage.state) {
                            StepState.COMPLETED -> Color.White
                            StepState.ACTIVE -> CyberCyan
                            StepState.FAILED -> StatusError
                            StepState.PENDING -> Color(0xFF94A3B8)
                        }
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = stage.description,
                        style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                        color = Color(0xFF64748B)
                    )
                }
            }
        }
    }
}
