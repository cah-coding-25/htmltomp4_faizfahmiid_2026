package com.example.domain

import java.net.URI
import java.util.regex.Pattern

object ValidationUtil {

    private val PACKAGE_NAME_PATTERN = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")
    private val DISALLOWED_PACKAGE_KEYWORDS = setOf(
        "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class",
        "const", "continue", "default", "do", "double", "else", "enum", "extends", "final",
        "finally", "float", "for", "goto", "if", "implements", "import", "instanceof", "int",
        "interface", "long", "native", "new", "package", "private", "protected", "public",
        "return", "short", "static", "strictfp", "super", "switch", "synchronized", "this",
        "throw", "throws", "transient", "try", "void", "volatile", "while"
    )

    data class ValidationResult(
        val isValid: Boolean,
        val errorMessage: String? = null
    )

    /**
     * Parses GitHub repository URL or owner/repo shorthand (e.g. "https://github.com/owner/repo" or "owner/repo")
     */
    fun parseGitHubRepoUrl(input: String): Pair<String, String>? {
        val trimmed = input.trim()
            .removePrefix("https://")
            .removePrefix("http://")
            .removePrefix("www.")
            .removePrefix("github.com/")
            .removeSuffix(".git")
            .removeSuffix("/")
        val parts = trimmed.split("/").filter { it.isNotBlank() }
        return if (parts.size >= 2) {
            Pair(parts[0].trim(), parts[1].trim())
        } else {
            null
        }
    }

    /**
     * Validates Website URL with SSRF protection against internal/private endpoints
     */
    fun validateWebUrl(url: String): ValidationResult {
        val trimmed = url.trim()
        if (trimmed.isEmpty()) {
            return ValidationResult(false, "Website URL tidak boleh kosong")
        }
        if (!trimmed.startsWith("http://", ignoreCase = true) && !trimmed.startsWith("https://", ignoreCase = true)) {
            return ValidationResult(false, "Website URL harus dimulai dengan http:// atau https://")
        }

        try {
            val uri = URI(trimmed)
            val host = uri.host ?: return ValidationResult(false, "Format URL tidak valid (host kosong)")

            val lowerHost = host.lowercase()
            // SSRF protection
            if (lowerHost == "localhost" ||
                lowerHost == "127.0.0.1" ||
                lowerHost == "0.0.0.0" ||
                lowerHost == "::1" ||
                lowerHost == "169.254.169.254" || // AWS/cloud metadata
                lowerHost.startsWith("10.") ||
                lowerHost.startsWith("192.168.") ||
                lowerHost.matches(Regex("^172\\.(1[6-9]|2[0-9]|3[0-1])\\..*")) ||
                lowerHost.endsWith(".local") ||
                lowerHost.endsWith(".internal")
            ) {
                return ValidationResult(false, "Alamat IP privat atau lokal tidak diizinkan demi keamanan (SSRF Protection)")
            }

            if (!lowerHost.contains(".")) {
                return ValidationResult(false, "Domain URL harus memiliki ekstensi yang valid (misal: .com, .id, .org)")
            }

            return ValidationResult(true)
        } catch (e: Exception) {
            return ValidationResult(false, "URL tidak valid: ${e.localizedMessage}")
        }
    }

    /**
     * Validates Android Package Name (e.g. com.faizfahmiid.myapp)
     */
    fun validatePackageName(packageName: String): ValidationResult {
        val trimmed = packageName.trim()
        if (trimmed.isEmpty()) {
            return ValidationResult(false, "Package name tidak boleh kosong")
        }

        if (trimmed.contains(" ")) {
            return ValidationResult(false, "Package name tidak boleh mengandung spasi")
        }

        if (trimmed.contains("-")) {
            return ValidationResult(false, "Package name tidak boleh menggunakan tanda hubung (-). Gunakan underscore (_)")
        }

        if (!PACKAGE_NAME_PATTERN.matcher(trimmed).matches()) {
            return ValidationResult(false, "Format package name salah. Harus terdiri dari minimal 2 segmen (contoh: com.faizfahmiid.myapp)")
        }

        val parts = trimmed.split(".")
        if (parts.size < 2) {
            return ValidationResult(false, "Package name harus memiliki minimal 2 segmen (contoh: com.example.app)")
        }

        for (part in parts) {
            if (DISALLOWED_PACKAGE_KEYWORDS.contains(part.lowercase())) {
                return ValidationResult(false, "'$part' adalah kata kunci terlarang dalam bahasa Java/Kotlin")
            }
        }

        return ValidationResult(true)
    }

    /**
     * Validates Application Name
     */
    fun validateAppName(appName: String): ValidationResult {
        val trimmed = appName.trim()
        if (trimmed.isEmpty()) {
            return ValidationResult(false, "Nama aplikasi tidak boleh kosong")
        }
        if (trimmed.length > 50) {
            return ValidationResult(false, "Nama aplikasi maksimal 50 karakter")
        }
        if (trimmed.contains("\"") || trimmed.contains("\\")) {
            return ValidationResult(false, "Nama aplikasi tidak boleh mengandung tanda petik ganda atau backslash")
        }
        return ValidationResult(true)
    }

    /**
     * Validates Icon URL if provided
     */
    fun validateIconUrl(iconUrl: String): ValidationResult {
        val trimmed = iconUrl.trim()
        if (trimmed.isEmpty()) {
            return ValidationResult(true) // Optional or default icon will be used
        }

        val urlCheck = validateWebUrl(trimmed)
        if (!urlCheck.isValid) {
            return ValidationResult(false, "Icon URL: ${urlCheck.errorMessage}")
        }

        val lower = trimmed.lowercase()
        val hasImageExt = lower.endsWith(".png") ||
                lower.endsWith(".jpg") ||
                lower.endsWith(".jpeg") ||
                lower.endsWith(".webp") ||
                lower.contains(".png?") ||
                lower.contains(".jpg?") ||
                lower.contains(".webp?")

        if (!hasImageExt) {
            return ValidationResult(false, "Icon harus berupa file gambar format PNG, JPG, atau WEBP")
        }

        return ValidationResult(true)
    }
}
