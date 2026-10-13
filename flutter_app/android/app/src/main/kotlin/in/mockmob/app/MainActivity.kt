package `in`.mockmob.app

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.WindowManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.mockmob.app/system_settings")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Opens this app's notification settings, so a student who blocked reminders
                    // can allow them without hunting through Android's menus.
                    "openNotificationSettings" -> result.success(openNotificationSettings())
                    else -> result.notImplemented()
                }
            }
        // How much memory the phone has, so a weak phone starts with Lite glass.
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.mockmob.app/device")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "memory" -> {
                        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                        val info = ActivityManager.MemoryInfo()
                        am.getMemoryInfo(info)
                        result.success(
                            mapOf(
                                "lowRam" to am.isLowRamDevice,
                                "totalMb" to (info.totalMem / (1024 * 1024)).toInt(),
                            )
                        )
                    }
                    else -> result.notImplemented()
                }
            }
        // NTA mode keeps the exam paper out of screenshots, screen recordings and the recents
        // preview while a timed exam is open (the website cannot; the app can).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.mockmob.app/secure_window")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "set" -> {
                        val on = call.arguments as? Boolean ?: false
                        runOnUiThread {
                            if (on) {
                                window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
                            } else {
                                window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                            }
                        }
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun openNotificationSettings(): Boolean {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
        }
        return try {
            startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (e: Exception) {
            try {
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
                true
            } catch (e2: Exception) {
                false
            }
        }
    }
}
