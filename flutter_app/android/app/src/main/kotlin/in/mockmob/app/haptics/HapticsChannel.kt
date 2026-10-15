package `in`.mockmob.app.haptics

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Build
import android.view.HapticFeedbackConstants
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel

/**
 * The haptic grammar's native verbs (Dart: lib/core/haptics/haptics.dart; the names and API levels
 * are `haptics.verbs` in shared/motion-tokens.json). Android tunes these to the phone's motor, so a
 * saved answer is one clean CONFIRM click rather than two impacts. A verb this Android does not have
 * is left out of `verbs`, and Dart plays its fallback (today's calls) instead.
 *
 * `View.performHapticFeedback` honours the phone's own Touch feedback setting; the app's switch is
 * applied in Dart before anything reaches here.
 */
object HapticsChannel {
    private const val NAME = "in.mockmob.app/haptics"

    /** Verb name to the first API level that has it. */
    private val MIN_API = linkedMapOf(
        "confirm" to Build.VERSION_CODES.R,
        "gestureStart" to Build.VERSION_CODES.R,
        "gestureEnd" to Build.VERSION_CODES.R,
        "segmentTick" to Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
        "toggleOn" to Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
        "toggleOff" to Build.VERSION_CODES.UPSIDE_DOWN_CAKE,
    )

    fun register(activity: Activity, messenger: BinaryMessenger) {
        MethodChannel(messenger, NAME).setMethodCallHandler { call, result ->
            when (call.method) {
                "verbs" -> result.success(MIN_API.filterValues { Build.VERSION.SDK_INT >= it }.keys.toList())
                "perform" -> {
                    val constant = constantFor(call.arguments as? String)
                    if (constant == null) {
                        result.success(false)
                    } else {
                        val view = activity.window?.decorView
                        result.success(view?.performHapticFeedback(constant) ?: false)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    /** The `HapticFeedbackConstants` value for [verb], or null when this Android has none. */
    @SuppressLint("InlinedApi")
    private fun constantFor(verb: String?): Int? {
        val name = verb ?: return null
        val min = MIN_API[name] ?: return null
        if (Build.VERSION.SDK_INT < min) return null
        return when (name) {
            "confirm" -> HapticFeedbackConstants.CONFIRM
            "gestureStart" -> HapticFeedbackConstants.GESTURE_START
            "gestureEnd" -> HapticFeedbackConstants.GESTURE_END
            "segmentTick" -> HapticFeedbackConstants.SEGMENT_TICK
            "toggleOn" -> HapticFeedbackConstants.TOGGLE_ON
            "toggleOff" -> HapticFeedbackConstants.TOGGLE_OFF
            else -> null
        }
    }
}
