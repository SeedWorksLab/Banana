package com.banana.speech

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest

class BananaSpeechModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BananaSpeech")

    AsyncFunction("modelDirectory") {
      val context = appContext.reactContext ?: error("Banana is not running.")
      val directory = File(context.noBackupFilesDir, "whisper-models")
      check(directory.isDirectory || directory.mkdirs()) { "Cannot create model storage." }
      Uri.fromFile(directory).toString() + "/"
    }

    AsyncFunction("sha256") Coroutine { uri: String ->
      withContext(Dispatchers.IO) {
        val file = privateFile(uri)
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
          val buffer = ByteArray(65536)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
          }
        }
        digest.digest().joinToString("") { "%02x".format(it) }
      }
    }

    AsyncFunction("decodeAudio") Coroutine { uri: String ->
      withContext(Dispatchers.IO) { decodeAudio(privateFile(uri)) }
    }

    AsyncFunction("fileSize") { uri: String ->
      val file = privateFile(uri)
      if (file.isFile) file.length().toDouble() else null
    }

    AsyncFunction("deleteFile") { uri: String ->
      val file = privateFile(uri)
      check(!file.exists() || (file.isFile && file.delete())) { "Cannot delete this model." }
    }

    AsyncFunction("moveFile") { from: String, to: String ->
      check(privateFile(from).renameTo(privateFile(to))) { "Cannot install the downloaded model." }
    }
  }

  private fun privateFile(uri: String): File {
    val context = appContext.reactContext ?: error("Banana is not running.")
    require(Uri.parse(uri).scheme == "file") { "Only local audio and models are allowed." }
    val file = File(Uri.parse(uri).path ?: error("Invalid file.")).canonicalFile
    val root = context.applicationInfo.dataDir
    require(file.path.startsWith("$root/")) { "The file must belong to Banana." }
    return file
  }

  // Expo Audio records AAC on Android; whisper.cpp requires PCM WAV input.
  private fun decodeAudio(source: File): String {
    val context = appContext.reactContext ?: error("Banana is not running.")
    val target = File.createTempFile("whisper-", ".wav", context.cacheDir)
    val extractor = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      extractor.setDataSource(source.path)
      val track = (0 until extractor.trackCount).firstOrNull {
        extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      } ?: error("The recording contains no audio.")
      extractor.selectTrack(track)
      val format = extractor.getTrackFormat(track)
      codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
      format.setInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
      codec.configure(format, null, null, 0)
      codec.start()
      var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var frames = 0L
      var nextSample = 0.0
      var inputEnded = false
      var outputEnded = false
      val info = MediaCodec.BufferInfo()
      val deadline = System.currentTimeMillis() + 300000
      RandomAccessFile(target, "rw").use { output ->
        output.write(ByteArray(44))
        while (!outputEnded) {
          check(System.currentTimeMillis() < deadline) { "Audio decoding timed out." }
          if (!inputEnded) {
            val index = codec.dequeueInputBuffer(10000)
            if (index >= 0) {
              val buffer = codec.getInputBuffer(index)!!
              val count = extractor.readSampleData(buffer, 0)
              if (count < 0) {
                codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                inputEnded = true
              } else {
                codec.queueInputBuffer(index, 0, count, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }
          val index = codec.dequeueOutputBuffer(info, 10000)
          if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val decoded = codec.outputFormat
            sampleRate = decoded.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            channels = decoded.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            check(!decoded.containsKey(MediaFormat.KEY_PCM_ENCODING) ||
              decoded.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_16BIT) {
              "This device could not decode the recording to PCM16."
            }
          } else if (index >= 0) {
            val buffer = codec.getOutputBuffer(index)!!.order(ByteOrder.LITTLE_ENDIAN)
            buffer.position(info.offset)
            buffer.limit(info.offset + info.size)
            while (buffer.remaining() >= channels * 2) {
              var sum = 0
              repeat(channels) { sum += buffer.short.toInt() }
              val sample = sum / channels
              while (nextSample <= frames) {
                output.write(sample and 255)
                output.write((sample shr 8) and 255)
                nextSample += sampleRate / 16000.0
              }
              frames++
            }
            outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
            codec.releaseOutputBuffer(index, false)
          }
        }
        val dataSize = (output.length() - 44).toInt()
        check(dataSize > 0) { "The recording is empty." }
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray()).putInt(dataSize + 36).put("WAVEfmt ".toByteArray())
        header.putInt(16).putShort(1).putShort(1).putInt(16000).putInt(32000)
        header.putShort(2).putShort(16).put("data".toByteArray()).putInt(dataSize)
        output.seek(0)
        output.write(header.array())
      }
      return Uri.fromFile(target).toString()
    } catch (error: Throwable) {
      target.delete()
      throw error
    } finally {
      codec?.release()
      extractor.release()
    }
  }
}
