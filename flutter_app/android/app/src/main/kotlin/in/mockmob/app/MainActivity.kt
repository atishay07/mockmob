package `in`.mockmob.app

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.window.SplashScreenView
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import `in`.mockmob.app.haptics.HapticsChannel

class MainActivity : FlutterActivity() {
    private val main = Handler(Looper.getMainLooper())

    /** The Android 12+ system splash (a SplashScreenView), held over the Flutter view until the
     *  brand opening asks. Typed as a View so older Androids never resolve the class. */
    private var splashView: View? = null
    private var splashGone = false
    private var releaseAsked = false
    private var pendingRelease: MethodChannel.Result? = null

    /** The splash while it fades off the Flutter "mo". */
    private var fadingView: View? = null

    /** Dart asked for the splash to go at once, with no fade (its opening is already handing off). */
    private var liftAtOnce = false

    override fun onCreate(savedInstanceState: Bundle?) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // The Flutter brand opening's first frame is the splash's "mo", so the splash is held
            // until Dart says that frame has been drawn under it, then faded off it in 150 ms (a
            // soft hand-over, so a pixel of difference in where a phone puts its splash cannot
            // show as a jump). The system's default exit (the icon fading to the ground, then the
            // app sliding up as it fades in) dipped to black and jumped 6 dp.
            splashScreen.setOnExitAnimationListener { view ->
                splashView = view
                if (releaseAsked) {
                    releaseSplash()
                } else {
                    // Never hold it for good if Dart does not ask.
                    main.postDelayed({ releaseSplash() }, SPLASH_HOLD_MAX_MS)
                }
            }
        } else {
            splashGone = true
        }
        super.onCreate(savedInstanceState)
    }

    /** Fades the held splash off the Flutter "mo", then answers Dart once that frame is drawn. If
     *  Dart asked for it to go at once, it is removed with no fade (even mid-fade), so a splash
     *  "mo" is never faded over the first screen. */
    private fun releaseSplash() {
        val view = splashView ?: fadingView?.takeIf { liftAtOnce }
        if (view == null) {
            // Already gone, or fading (the fade answers when it ends).
            if (releaseAsked && splashGone) answerRelease()
            return
        }
        splashView = null
        if (liftAtOnce) {
            fadingView = null
            view.animate().cancel()
            removeSplash(view)
            return
        }
        fadingView = view
        view.animate()
            .alpha(0f)
            .setDuration(SPLASH_FADE_MS)
            .setInterpolator(LinearInterpolator())
            .withEndAction {
                if (fadingView === view) {
                    fadingView = null
                    removeSplash(view)
                }
            }
            .start()
    }

    private fun removeSplash(view: View) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) (view as SplashScreenView).remove()
        splashGone = true
        window.decorView.postOnAnimation { answerRelease() }
    }

    private fun answerRelease() {
        pendingRelease?.success(true)
        pendingRelease = null
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // The brand opening asks for the system splash to be lifted once its first "mo" is drawn
        // under it, and starts its clock when this answers (see OpeningGlass in Dart).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.mockmob.app/splash")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "release" -> {
                        if (splashGone) {
                            result.success(true)
                        } else {
                            pendingRelease?.success(false)
                            pendingRelease = result
                            releaseAsked = true
                            // `false` asks for no fade (see OpeningGlass.liftNow in Dart).
                            if (call.arguments == false) liftAtOnce = true
                            if (splashView != null || (liftAtOnce && fadingView != null)) {
                                releaseSplash()
                            } else {
                                // A start without a system splash (some launches have none): go.
                                main.postDelayed({ if (pendingRelease === result) answerRelease() }, SPLASH_WAIT_MS)
                            }
                        }
                    }
                    else -> result.notImplemented()
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "in.mockmob.app/system_settings")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Opens this app's notification settings, so a student who blocked reminders
                    // can allow them without hunting through Android's menus.
                    "openNotificationSettings" -> result.success(openNotificationSettings())
                    else -> result.notImplemented()
                }
            }
        // The haptic grammar's native verbs (CONFIRM, SEGMENT_TICK, TOGGLE_ON/OFF, GESTURE_START/END).
        HapticsChannel.register(this, flutterEngine.dartExecutor.binaryMessenger)
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
                                // An emulator's software GPU misses any raster budget, so the
                                // glass watch does not judge the glass there.
                                "emulator" to isEmulator(),
                            )
                        )
                    }
                    // The phone's bottom screen corner radius in dp (Android 12+), so a floating
                    // sheet's bottom corners can be concentric with the glass (GLASS-1017 5.7).
                    // Null below Android 12 or when the display reports no rounded corner.
                    "cornerRadius" -> {
                        var radiusDp: Double? = null
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                            val insets = window.decorView.rootWindowInsets
                            val corner = insets?.getRoundedCorner(android.view.RoundedCorner.POSITION_BOTTOM_LEFT)
                            if (corner != null && corner.radius > 0) {
                                radiusDp = corner.radius / resources.displayMetrics.density.toDouble()
                            }
                        }
                        result.success(radiusDp)
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

    private companion object {
        /** The splash's fade off the matching Flutter "mo". */
        const val SPLASH_FADE_MS = 150L

        /** How long Dart's ask waits for a system splash that may never come. */
        const val SPLASH_WAIT_MS = 600L

        /** The longest the splash is held if Dart never asks. */
        const val SPLASH_HOLD_MAX_MS = 3000L
    }

    private fun isEmulator(): Boolean =
        Build.HARDWARE.contains("ranchu") ||
            Build.HARDWARE.contains("goldfish") ||
            Build.FINGERPRINT.startsWith("generic") ||
            Build.PRODUCT.contains("sdk_gphone")
}
