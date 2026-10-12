package com.example.domain

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.Locale

data class WebsiteAnalysisResult(
    val appName: String,
    val packageName: String,
    val themeColorHex: String,
    val iconUrl: String?,
    val pullToRefresh: Boolean,
    val showUrlBar: Boolean,
    val fullscreen: Boolean,
    val fileUpload: Boolean,
    val downloads: Boolean,
    val offlinePwa: Boolean,
    val summaryMessage: String
)

object WebsiteAnalyzer {

    suspend fun analyzeUrl(inputUrl: String): WebsiteAnalysisResult = withContext(Dispatchers.IO) {
        val normalizedUrl = if (!inputUrl.startsWith("http://") && !inputUrl.startsWith("https://")) {
            "https://$inputUrl"
        } else {
            inputUrl.trim()
        }

        var detectedTitle = ""
        var detectedThemeColor = "#0B132B"
        var detectedIcon: String? = null
        var isPwa = false

        // Extract host
        val host = try {
            URI(normalizedUrl).host ?: "example.com"
        } catch (_: Exception) {
            "example.com"
        }

        val domainClean = host.removePrefix("www.").lowercase(Locale.ROOT)
        val domainParts = domainClean.split(".")
        val mainDomainName = if (domainParts.size >= 2) domainParts[domainParts.size - 2] else domainClean

        // Default Title based on domain
        val fallbackTitle = mainDomainName.replace("-", " ").replace("_", " ")
            .split(" ")
            .joinToString(" ") { it.replaceFirstChar { char -> char.uppercase() } }

        // Default Package Name
        val cleanPkgSegment = mainDomainName.filter { it.isLetterOrDigit() }.ifBlank { "app" }
        val fallbackPackage = "com.$cleanPkgSegment.app"

        // Try probing online with fast timeout
        try {
            val urlObj = URL(normalizedUrl)
            val connection = urlObj.openConnection() as HttpURLConnection
            connection.connectTimeout = 3500
            connection.readTimeout = 3500
            connection.instanceFollowRedirects = true
            connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) WebToAppAnalyzer/1.0")
            connection.connect()

            if (connection.responseCode in 200..399) {
                val reader = connection.inputStream.bufferedReader()
                val htmlChunk = StringBuilder()
                var linesRead = 0
                while (linesRead < 200) {
                    val line = reader.readLine() ?: break
                    htmlChunk.append(line).append("\n")
                    linesRead++
                }

                val html = htmlChunk.toString()

                // Extract <title>
                val titleRegex = Regex("<title[^>]*>(.*?)</title>", RegexOption.IGNORE_CASE)
                val titleMatch = titleRegex.find(html)
                if (titleMatch != null) {
                    val rawTitle = titleMatch.groupValues[1].trim()
                    if (rawTitle.isNotBlank()) {
                        val clean = rawTitle.split("|", "-", "—", "•").firstOrNull()?.trim() ?: rawTitle
                        detectedTitle = clean.take(40)
                    }
                }

                // Extract meta theme-color
                val themeColorRegex = Regex("<meta[^>]*name=[\"'](?:theme-color|msapplication-navbutton-color)[\"'][^>]*content=[\"'](#?[0-9a-fA-F]{3,8})[\"']", RegexOption.IGNORE_CASE)
                val themeMatch = themeColorRegex.find(html)
                if (themeMatch != null) {
                    var hex = themeMatch.groupValues[1].trim()
                    if (!hex.startsWith("#")) hex = "#$hex"
                    if (hex.length == 7 || hex.length == 9) {
                        detectedThemeColor = hex
                    }
                }

                // Check PWA manifest
                if (html.contains("manifest.json", ignoreCase = true) || html.contains("rel=\"manifest\"", ignoreCase = true)) {
                    isPwa = true
                }

                // Extract icon
                val iconRegex = Regex("<link[^>]*rel=[\"'](?:apple-touch-icon|icon|shortcut icon)[\"'][^>]*href=[\"']([^\"']+)[\"']", RegexOption.IGNORE_CASE)
                val iconMatch = iconRegex.find(html)
                if (iconMatch != null) {
                    val rawHref = iconMatch.groupValues[1].trim()
                    detectedIcon = when {
                        rawHref.startsWith("http://") || rawHref.startsWith("https://") -> rawHref
                        rawHref.startsWith("//") -> "https:$rawHref"
                        rawHref.startsWith("/") -> "${urlObj.protocol}://${urlObj.host}$rawHref"
                        else -> "${urlObj.protocol}://${urlObj.host}/$rawHref"
                    }
                }
            }
            connection.disconnect()
        } catch (_: Exception) {
            // Graceful fallback if timeout/offline
        }

        val finalTitle = detectedTitle.ifBlank { fallbackTitle }
        val finalPackage = fallbackPackage

        val isShop = normalizedUrl.contains("shop", true) || normalizedUrl.contains("store", true) || normalizedUrl.contains("beli", true)

        val summary = buildString {
            append("✓ Disesuaikan: '$finalTitle' • $finalPackage")
            if (detectedThemeColor != "#0B132B") append(" • Warna $detectedThemeColor")
            if (isPwa) append(" • PWA Aktif")
        }

        WebsiteAnalysisResult(
            appName = finalTitle,
            packageName = finalPackage,
            themeColorHex = detectedThemeColor,
            iconUrl = detectedIcon,
            pullToRefresh = !isShop,
            showUrlBar = false,
            fullscreen = false,
            fileUpload = true,
            downloads = true,
            offlinePwa = isPwa,
            summaryMessage = summary
        )
    }
}
