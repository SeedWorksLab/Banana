package com.banana.update

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

class BananaUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BananaUpdate")

    AsyncFunction("downloadAndInstall") Coroutine { url: String, version: String ->
      val context = appContext.reactContext ?: error("Banana is not running.")
      val uri = Uri.parse(url)
      require(uri.scheme == "https" && uri.host == "github.com" &&
        uri.path?.startsWith("/SeedWorksLab/Banana/releases/download/") == true) {
        "Only official Banana releases can be installed."
      }
      if (!context.packageManager.canRequestPackageInstalls()) {
        withContext(Dispatchers.Main) {
          context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        error("Allow Banana to install updates, then tap Update now again.")
      }
      val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val fileName = "banana-${version.replace(Regex("[^a-zA-Z0-9._-]"), "_")}-${System.currentTimeMillis()}.apk"
      val request = DownloadManager.Request(uri)
        .setTitle("Banana $version")
        .setDescription("Downloading Banana update")
        .setMimeType("application/vnd.android.package-archive")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
      val contentUri = withContext(Dispatchers.IO) {
        val id = manager.enqueue(request)
        var downloaded: Uri? = null
        while (downloaded == null) {
          manager.query(DownloadManager.Query().setFilterById(id)).use { cursor ->
            check(cursor.moveToFirst()) { "The update download was cancelled." }
            when (cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
              DownloadManager.STATUS_SUCCESSFUL -> {
                val file = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName)
                val archive = context.packageManager.getPackageArchiveInfo(file.absolutePath, 0)
                val installed = context.packageManager.getPackageInfo(context.packageName, 0)
                check(archive != null && archive.packageName == context.packageName &&
                  archive.longVersionCode > installed.longVersionCode) {
                  "The download is not a newer Banana APK."
                }
                downloaded = manager.getUriForDownloadedFile(id)
                  ?: error("The downloaded APK could not be opened.")
              }
              DownloadManager.STATUS_FAILED -> {
                val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                error("APK download failed ($reason). Please try again.")
              }
            }
          }
          if (downloaded == null) delay(500)
        }
        downloaded
      }
      withContext(Dispatchers.Main) {
        context.startActivity(Intent(Intent.ACTION_VIEW)
          .setDataAndType(contentUri, "application/vnd.android.package-archive")
          .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }
  }
}
