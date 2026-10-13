package `in`.mockmob.app.platform

import `in`.mockmob.app.MainActivity
import `in`.mockmob.app.R
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetPlugin
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import kotlin.math.ceil
import kotlin.math.min
import org.json.JSONObject

/**
 * The home-screen widget (plan item A5): the next move, this week's study days and the days to
 * CUET, from what the app last wrote (lib/core/home_widget). A tap opens the move through the
 * app's own App Link handling (an https://www.mockmob.in link that ActionRouter maps to a native
 * screen), so the widget never opens anything the app would not.
 *
 * It shows the last state the server confirmed, with its time, and works out the dates itself
 * when it draws: the countdown and the "Updated" day stay true on days the app is not opened, a
 * week that has ended is hidden, and a session that has closed is no longer offered. Signed out,
 * or before the app has written anything, it is a plain "Open MockMob".
 */
class TodayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val model = WidgetModel.read(context)
        for (id in ids) draw(context, manager, id, model)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        draw(context, manager, id, WidgetModel.read(context))
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int, model: WidgetModel) {
        val tap = tapIntent(context, id, model.href)
        val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // The launcher picks the layout that fits the widget's current size.
            RemoteViews(
                mapOf(
                    SizeF(110f, 110f) to build(context, model, wide = false, tap),
                    SizeF(250f, 130f) to build(context, model, wide = true, tap),
                )
            )
        } else {
            val width = manager.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
            build(context, model, wide = width >= 230, tap)
        }
        manager.updateAppWidget(id, views)
    }

    private fun build(context: Context, m: WidgetModel, wide: Boolean, tap: PendingIntent): RemoteViews {
        val v = RemoteViews(context.packageName, if (wide) R.layout.widget_today_wide else R.layout.widget_today_small)
        val res = context.resources
        val move = m.move

        v.setTextViewText(R.id.widget_title, move?.title ?: res.getString(R.string.widget_open))
        // The brand mark stands in for what is missing: the move on the wide widget, the ring
        // (top left) on the small one.
        v.setViewVisibility(R.id.widget_mark, visibleIf(if (wide) move == null else m.week == null))
        if (wide) {
            v.setViewVisibility(R.id.widget_overline, visibleIf(move != null))
            v.setTextViewText(R.id.widget_overline, move?.overline ?: "")
            v.setViewVisibility(R.id.widget_action, visibleIf(move != null))
            v.setTextViewText(R.id.widget_action, move?.action ?: "")
        }
        v.setViewVisibility(R.id.widget_updated, visibleIf(m.updated != null))
        v.setTextViewText(R.id.widget_updated, m.updated ?: "")

        val week = m.week
        v.setViewVisibility(R.id.widget_week, visibleIf(week != null))
        if (week != null) {
            val ringDp = if (wide) 52f else 44f
            val fraction = if (week.paused) 0f else min(week.done, week.goal).toFloat() / week.goal
            v.setImageViewBitmap(R.id.widget_ring_arc, arcMask(context, ringDp, fraction))
            if (week.paused) {
                v.setViewVisibility(R.id.widget_ring_count, View.GONE)
                v.setContentDescription(R.id.widget_week, res.getString(R.string.widget_week_paused_spoken))
            } else {
                v.setViewVisibility(R.id.widget_ring_count, View.VISIBLE)
                v.setImageViewBitmap(
                    R.id.widget_ring_count,
                    textMask(context, "${week.done}/${week.goal}", if (wide) 16f else 14f, maxWidthDp = ringDp - 14f),
                )
                v.setContentDescription(R.id.widget_week, res.getString(R.string.widget_week_spoken, week.done, week.goal))
            }
            if (wide) v.setTextViewText(R.id.widget_week_label, week.label)
        }

        val cuet = m.cuetDays
        v.setViewVisibility(R.id.widget_cuet, visibleIf(cuet != null || m.cuetOpen))
        if (cuet != null) {
            val label = res.getQuantityString(R.plurals.widget_cuet_days, cuet)
            v.setViewVisibility(R.id.widget_cuet_number, View.VISIBLE)
            v.setImageViewBitmap(R.id.widget_cuet_number, textMask(context, cuet.toString(), if (wide) 17f else 24f, maxWidthDp = 80f))
            v.setTextViewText(R.id.widget_cuet_label, label)
            v.setContentDescription(R.id.widget_cuet, res.getString(R.string.widget_cuet_spoken, cuet, label))
        } else if (m.cuetOpen) {
            v.setViewVisibility(R.id.widget_cuet_number, View.GONE)
            v.setTextViewText(R.id.widget_cuet_label, res.getString(R.string.widget_cuet_open))
        }

        v.setOnClickPendingIntent(android.R.id.background, tap)
        return v
    }

    private fun visibleIf(show: Boolean) = if (show) View.VISIBLE else View.GONE

    /** Opens the move's link in MainActivity, where app_links hands it to ActionRouter. */
    private fun tapIntent(context: Context, id: Int, href: String?): PendingIntent {
        val intent = if (href != null) {
            Intent(Intent.ACTION_VIEW, Uri.parse(href)).setClass(context, MainActivity::class.java)
        } else {
            Intent(context, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private companion object {
        /** The week ring's stroke, the same as widget_ring_track.xml. */
        const val RING_STROKE_DP = 4f

        /** The app's display face for numbers (Bricolage Grotesque condensed), from Flutter's assets. */
        const val BRAND_NUMBERS = "flutter_assets/assets/fonts/BricolageCondensed-Bold.ttf"

        @Volatile
        private var brand: Typeface? = null

        fun brandTypeface(context: Context): Typeface {
            brand?.let { return it }
            val loaded = try {
                Typeface.createFromAsset(context.assets, BRAND_NUMBERS)
            } catch (e: Exception) {
                Typeface.create("sans-serif-condensed", Typeface.BOLD)
            }
            brand = loaded
            return loaded
        }

        fun dp(context: Context, value: Float) =
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, context.resources.displayMetrics)

        /**
         * [text] in the brand face as a white mask, cropped to its ink, tinted by the layout
         * (widget_ink), so it follows day and night. Scaled down to fit [maxWidthDp].
         */
        fun textMask(context: Context, text: String, sizeSp: Float, maxWidthDp: Float): Bitmap {
            val metrics = context.resources.displayMetrics
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                typeface = brandTypeface(context)
                color = Color.WHITE
                textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, metrics)
            }
            val maxWidth = dp(context, maxWidthDp)
            val measured = paint.measureText(text)
            if (measured > maxWidth) paint.textSize *= maxWidth / measured
            val bounds = Rect()
            paint.getTextBounds(text, 0, text.length, bounds)
            val width = ceil(paint.measureText(text)).toInt().coerceAtLeast(1)
            val height = bounds.height().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            Canvas(bitmap).drawText(text, 0f, -bounds.top.toFloat(), paint)
            return bitmap
        }

        /** The week's arc from twelve o'clock, as a white mask tinted by the layout (widget_ring). */
        fun arcMask(context: Context, sizeDp: Float, fraction: Float): Bitmap {
            val size = dp(context, sizeDp).toInt().coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            if (fraction <= 0f) return bitmap
            val stroke = dp(context, RING_STROKE_DP)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = stroke
                strokeCap = Paint.Cap.ROUND
            }
            val inset = stroke / 2f
            val oval = RectF(inset, inset, size - inset, size - inset)
            val canvas = Canvas(bitmap)
            if (fraction >= 1f) canvas.drawOval(oval, paint) else canvas.drawArc(oval, -90f, 360f * fraction, false, paint)
            return bitmap
        }
    }
}

/** What the widget draws, worked out from the app's last write and today's date. */
private class WidgetModel(
    val move: Move?,
    val week: Week?,
    val updated: String?,
    val cuetDays: Int?,
    val cuetOpen: Boolean,
) {
    class Move(val overline: String, val title: String, val action: String, val href: String)

    class Week(val done: Int, val goal: Int, val paused: Boolean, val label: String)

    /** The link a tap opens: the move's, or none (the app opens where it was). */
    val href: String? get() = move?.href

    companion object {
        /** Must match homeWidgetDataKey and homeWidgetDataVersion in home_widget_data.dart. */
        private const val KEY = "mm_today_widget"
        private const val VERSION = 1
        private const val SITE = "https://www.mockmob.in/"
        private const val DEFAULT_ZONE = "Asia/Kolkata"

        /**
         * The CUET window when the app has never written (lib/core/domain/cuet_dates.dart holds
         * the dates; every write carries them).
         */
        private const val CUET_START = "2027-05-01"
        private const val CUET_END = "2027-05-31"

        fun read(context: Context): WidgetModel {
            val raw = try {
                HomeWidgetPlugin.getData(context).getString(KEY, null)
            } catch (e: Exception) {
                null
            }
            val json = raw?.let { runCatching { JSONObject(it) }.getOrNull() }?.takeIf { it.optInt("v") == VERSION }
            val zone = runCatching { ZoneId.of(json?.optString("tz")?.ifEmpty { null } ?: DEFAULT_ZONE) }
                .getOrElse { ZoneId.of(DEFAULT_ZONE) }
            val today = LocalDate.now(zone)
            val now = System.currentTimeMillis()

            val cuet = json?.optJSONObject("cuet")
            val start = date(cuet?.optString("start")) ?: LocalDate.parse(CUET_START)
            val end = date(cuet?.optString("end")) ?: LocalDate.parse(CUET_END)
            val daysToCuet = ChronoUnit.DAYS.between(today, start)
            val cuetDays = if (daysToCuet > 0) daysToCuet.toInt() else null
            val cuetOpen = cuetDays == null && !today.isAfter(end)

            if (json == null || !json.optBoolean("signedIn", false)) {
                return WidgetModel(null, null, null, cuetDays, cuetOpen)
            }

            val move = json.optJSONObject("move")?.let { o ->
                val href = o.optString("href")
                val until = if (o.has("until")) o.optLong("until") else null
                val title = o.optString("title")
                when {
                    !href.startsWith(SITE) || title.isEmpty() -> null
                    until != null && now >= until -> null
                    else -> Move(o.optString("overline"), title, o.optString("action"), href)
                }
            }

            val week = json.optJSONObject("week")?.let { o ->
                val weekStart = date(o.optString("start")) ?: return@let null
                val goal = o.optInt("goal")
                // Only the week it describes: from its Monday to its Sunday.
                if (goal <= 0 || today.isBefore(weekStart) || today.isAfter(weekStart.plusDays(6))) return@let null
                Week(o.optInt("done"), goal, o.optString("state") == "paused", o.optString("label"))
            }

            val updated = json.optJSONObject("updated")?.let { o ->
                if (move == null && week == null) return@let null
                val day = date(o.optString("day")) ?: Instant.ofEpochMilli(o.optLong("at")).atZone(zone).toLocalDate()
                when {
                    !day.isBefore(today) -> o.optString("today")
                    day == today.minusDays(1) -> o.optString("yesterday")
                    else -> o.optString("older")
                }.ifEmpty { null }
            }

            return WidgetModel(move, week, updated, cuetDays, cuetOpen)
        }

        private fun date(value: String?): LocalDate? =
            if (value.isNullOrEmpty()) null else runCatching { LocalDate.parse(value) }.getOrNull()
    }
}
