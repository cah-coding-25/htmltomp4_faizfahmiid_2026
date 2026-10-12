package com.example.domain

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.InputStream

data class ProcessedImageResult(
    val isSuccess: Boolean,
    val base64Data: String? = null,
    val width: Int = 0,
    val height: Int = 0,
    val sizeBytes: Int = 0,
    val errorMessage: String? = null
)

object ImageUtil {

    private const val MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB
    private const val TARGET_ICON_SIZE = 512

    fun processLocalImage(context: Context, imageUri: Uri): ProcessedImageResult {
        return try {
            val contentResolver = context.contentResolver

            // Check file size first
            var inputStream: InputStream? = contentResolver.openInputStream(imageUri)
            val availableBytes = inputStream?.available() ?: 0
            if (availableBytes > MAX_IMAGE_BYTES) {
                inputStream?.close()
                return ProcessedImageResult(
                    isSuccess = false,
                    errorMessage = "Ukuran gambar terlalu besar (Maksimal 5MB)"
                )
            }
            inputStream?.close()

            // Decode dimensions
            val options = BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            contentResolver.openInputStream(imageUri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, options)
            }

            val origWidth = options.outWidth
            val origHeight = options.outHeight

            if (origWidth <= 0 || origHeight <= 0) {
                return ProcessedImageResult(
                    isSuccess = false,
                    errorMessage = "Gagal memproses file gambar. Pastikan format PNG, JPG, atau WEBP valid."
                )
            }

            // Decode actual bitmap with sample size
            var sampleSize = 1
            while (origWidth / sampleSize > TARGET_ICON_SIZE * 2 || origHeight / sampleSize > TARGET_ICON_SIZE * 2) {
                sampleSize *= 2
            }

            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }

            val originalBitmap = contentResolver.openInputStream(imageUri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, decodeOptions)
            } ?: return ProcessedImageResult(false, errorMessage = "Gagal membaca data gambar.")

            // Scale to 512x512 square icon
            val scaledBitmap = Bitmap.createScaledBitmap(originalBitmap, TARGET_ICON_SIZE, TARGET_ICON_SIZE, true)
            if (scaledBitmap != originalBitmap) {
                originalBitmap.recycle()
            }

            val outputStream = ByteArrayOutputStream()
            scaledBitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val byteArray = outputStream.toByteArray()
            scaledBitmap.recycle()

            val base64 = Base64.encodeToString(byteArray, Base64.NO_WRAP)

            ProcessedImageResult(
                isSuccess = true,
                base64Data = base64,
                width = TARGET_ICON_SIZE,
                height = TARGET_ICON_SIZE,
                sizeBytes = byteArray.size
            )
        } catch (e: Exception) {
            ProcessedImageResult(
                isSuccess = false,
                errorMessage = "Gagal memproses icon lokal: ${e.localizedMessage ?: "Unknown error"}"
            )
        }
    }

    fun createPresetBase64(colorHex: Long, symbol: String): ProcessedImageResult {
        return try {
            val bitmap = Bitmap.createBitmap(TARGET_ICON_SIZE, TARGET_ICON_SIZE, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)

            // Draw rounded background
            val bgPaint = android.graphics.Paint().apply {
                color = colorHex.toInt()
                isAntiAlias = true
            }
            val rect = android.graphics.RectF(0f, 0f, TARGET_ICON_SIZE.toFloat(), TARGET_ICON_SIZE.toFloat())
            canvas.drawRoundRect(rect, 100f, 100f, bgPaint)

            // Inner border
            val borderPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.WHITE
                style = android.graphics.Paint.Style.STROKE
                strokeWidth = 8f
                alpha = 60
                isAntiAlias = true
            }
            val borderRect = android.graphics.RectF(12f, 12f, TARGET_ICON_SIZE.toFloat() - 12f, TARGET_ICON_SIZE.toFloat() - 12f)
            canvas.drawRoundRect(borderRect, 90f, 90f, borderPaint)

            // Draw text symbol
            val textPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.WHITE
                textSize = 200f
                typeface = android.graphics.Typeface.DEFAULT_BOLD
                textAlign = android.graphics.Paint.Align.CENTER
                isAntiAlias = true
            }
            val textY = TARGET_ICON_SIZE / 2f - (textPaint.descent() + textPaint.ascent()) / 2f
            canvas.drawText(symbol, TARGET_ICON_SIZE / 2f, textY, textPaint)

            val outputStream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream)
            val bytes = outputStream.toByteArray()
            bitmap.recycle()

            val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
            ProcessedImageResult(
                isSuccess = true,
                base64Data = base64,
                width = TARGET_ICON_SIZE,
                height = TARGET_ICON_SIZE,
                sizeBytes = bytes.size
            )
        } catch (e: Exception) {
            ProcessedImageResult(isSuccess = false, errorMessage = e.message)
        }
    }
}
