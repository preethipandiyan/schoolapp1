package com.zuna.school

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.io.FileOutputStream

class ZunaFilePickerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pickerPromise: Promise? = null
    private val PICK_FILE_REQUEST_CODE = 41921

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "ZunaFilePicker"
    }

    @ReactMethod
    fun pickFile(options: ReadableMap?, promise: Promise) {
        val currentActivity = reactContext.currentActivity
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity doesn't exist")
            return
        }

        if (pickerPromise != null) {
            pickerPromise?.reject("CANCELLED", "New picker request started")
            pickerPromise = null
        }

        pickerPromise = promise

        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"

                val requestedType = if (options != null && options.hasKey("type")) {
                    options.getString("type")?.lowercase()
                } else null

                val mimeTypes = when (requestedType) {
                    "excel", "xlsx" -> arrayOf(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "application/vnd.ms-excel",
                        "text/csv",
                        "text/comma-separated-values",
                        "application/csv"
                    )
                    "image", "photo" -> arrayOf("image/*")
                    "pdf" -> arrayOf("application/pdf")
                    "document" -> arrayOf(
                        "application/pdf",
                        "image/*",
                        "application/msword",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        "text/plain"
                    )
                    else -> arrayOf("*/*")
                }

                putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
            }

            currentActivity.startActivityForResult(
                Intent.createChooser(intent, "Select File"),
                PICK_FILE_REQUEST_CODE
            )
        } catch (e: Exception) {
            pickerPromise?.reject("PICKER_ERROR", e.message, e)
            pickerPromise = null
        }
    }

    @ReactMethod
    fun saveAndOpenFile(fileName: String, mimeType: String, base64Data: String, promise: Promise) {
        val currentActivity = reactContext.currentActivity
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity doesn't exist")
            return
        }

        try {
            val cleanBase64 = if (base64Data.contains(",")) {
                base64Data.substringAfter(",")
            } else {
                base64Data
            }

            val decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT)
            val cacheDir = File(reactContext.cacheDir, "exports").apply {
                if (!exists()) mkdirs()
            }
            val targetFile = File(cacheDir, fileName)

            FileOutputStream(targetFile).use { output ->
                output.write(decodedBytes)
                output.flush()
            }

            val fileUri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.provider",
                targetFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = if (mimeType.isNotBlank()) mimeType else "*/*"
                putExtra(Intent.EXTRA_STREAM, fileUri)
                putExtra(Intent.EXTRA_SUBJECT, fileName)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(shareIntent, "Share / Open $fileName").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            currentActivity.startActivity(chooser)

            val result: WritableMap = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("filePath", targetFile.absolutePath)
                putString("uri", fileUri.toString())
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("SAVE_OPEN_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openUrl(url: String, promise: Promise) {
        val currentActivity = reactContext.currentActivity
        if (currentActivity == null) {
            promise.reject("ACTIVITY_NOT_FOUND", "Activity doesn't exist")
            return
        }

        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            currentActivity.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_URL_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode != PICK_FILE_REQUEST_CODE) return

        val promise = pickerPromise ?: return
        pickerPromise = null

        if (resultCode != Activity.RESULT_OK || data == null || data.data == null) {
            promise.reject("CANCELLED", "User cancelled file selection")
            return
        }

        val uri = data.data!!
        try {
            var fileName = "selected_file"
            var fileSize = 0L

            reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)

                    if (nameIndex != -1) {
                        fileName = cursor.getString(nameIndex) ?: "selected_file"
                    }
                    if (sizeIndex != -1) {
                        fileSize = cursor.getLong(sizeIndex)
                    }
                }
            }

            val mimeType = reactContext.contentResolver.getType(uri) ?: "application/octet-stream"

            // Copy to local app cache so React Native and XLSX can read it directly
            val cacheDir = File(reactContext.cacheDir, "uploads").apply {
                if (!exists()) mkdirs()
            }
            val cachedFile = File(cacheDir, "${System.currentTimeMillis()}_$fileName")

            var base64String = ""
            reactContext.contentResolver.openInputStream(uri)?.use { input ->
                val bytes = input.readBytes()
                if (fileSize == 0L) {
                    fileSize = bytes.size.toLong()
                }
                base64String = Base64.encodeToString(bytes, Base64.NO_WRAP)
                FileOutputStream(cachedFile).use { output ->
                    output.write(bytes)
                }
            }

            val result: WritableMap = Arguments.createMap().apply {
                putString("name", fileName)
                putDouble("size", fileSize.toDouble())
                putString("type", mimeType)
                putString("uri", uri.toString())
                putString("filePath", cachedFile.absolutePath)
                putString("base64", base64String)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("FILE_READ_ERROR", e.message, e)
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
