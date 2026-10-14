package `in`.mockmob.app.platform

import `in`.mockmob.app.MainActivity
import `in`.mockmob.app.R
import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
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
import android.text.StaticLayout
import android.text.TextPaint
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
 *
 * Those dates only change on screen when the widget draws, so every draw books the next one for
 * the moment something it shows goes out of date: the end of an offered session, or the
 * student's next midnight. The alarm is inexact (no exact-alarm permission) and never early.
 */
class TodayWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        val model = WidgetModel.read(context)
        for (id in ids) draw(context, manager, id, model)
        scheduleRedraw(context, model.nextChangeAt)
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) {
        val model = WidgetModel.read(context)
        draw(context, manager, id, model)
        scheduleRedraw(context, model.nextChangeAt)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            ACTION_REDRAW, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_DATE_CHANGED -> {
                val manager = AppWidgetManager.getInstance(context)
                val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidgetProvider::class.java))
                if (ids.isNotEmpty()) onUpdate(context, manager, ids)
            }
        }
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        // The last widget was removed: nothing is left to redraw.
        alarmManager(context)?.cancel(redrawIntent(context))
    }

    private fun alarmManager(context: Context) = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager

    private fun redrawIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, TodayWidgetProvider::class.java).setAction(ACTION_REDRAW),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    /** Books one redraw at [at] (epoch millis), replacing the one booked before. */
    private fun scheduleRedraw(context: Context, at: Long?) {
        val alarms = alarmManager(context) ?: return
        val intent = redrawIntent(context)
        if (at == null) {
            alarms.cancel(intent)
            return
        }
        try {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC, at, intent)
        } catch (e: Exception) {
            // Too many alarms, or a restricted app: the 3-hour update still redraws the widget.
        }
    }

    private fun draw(context: Context, manager: AppWidgetManager, id: Int, model: WidgetModel) {
        val tap = tapIntent(context, id, model.href)
        val options = manager.getAppWidgetOptions(id)
        val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // One layout for each size the launcher reports (portrait and landscape differ), each
            // fitted to that size. The two buckets cover a launcher that reports none.
            @Suppress("DEPRECATION")
            val reported = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
            val sizes = reported?.filterNotNull()?.distinct()?.takeIf { it.isNotEmpty() }
                ?: listOf(SizeF(110f, 110f), SizeF(250f, 130f))
            RemoteViews(sizes.associateWith { build(context, model, it.width, it.height, tap) })
        } else {
            val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
            val width = options.getInt(
                if (landscape) AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,
                250,
            )
            val height = options.getInt(
                if (landscape) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,
                130,
            )
            build(context, model, width.toFloat(), height.toFloat(), tap)
        }
        manager.updateAppWidget(id, views)
    }

    /**
     * Builds the widget for a size of [widthDp] by [heightDp]. Widget text follows the phone's
     * font size, so what fits is measured, not assumed. The move's title always keeps a line,
     * then the key (the pill), then the "Updated" stamp (whole, or not at all, never cut to
     * "Updated 9:..."), then the title's further lines and a larger type size. The move sits in
     * the middle of the space left, so a tall widget grows its type instead of leaving a band.
     * On the wide widget the week ring shrinks and its label goes before anything is cut off at
     * the bottom; on the small one the ring gives way to the brand mark when the countdown's
     * words would not fit beside it.
     */
    private fun build(context: Context, m: WidgetModel, widthDp: Float, heightDp: Float, tap: PendingIntent): RemoteViews {
        val wide = widthDp >= 230f && heightDp >= 120f
        val v = RemoteViews(context.packageName, if (wide) R.layout.widget_today_wide else R.layout.widget_today_small)
        val res = context.resources
        val density = res.displayMetrics.density
        val move = m.move
        val week = m.week
        val updated = m.updated
        val title = move?.title ?: res.getString(R.string.widget_open)

        v.setTextViewText(R.id.widget_title, title)
        v.setTextViewText(R.id.widget_action, move?.action ?: "")
        v.setTextViewText(R.id.widget_updated, updated ?: "")

        // The days to CUET first: its height and width count in the fit below.
        var cuetNumberDp = 0f
        var cuetNumberWidthDp = 0f
        var cuetLabel: String? = null
        val cuet = m.cuetDays
        v.setViewVisibility(R.id.widget_cuet, visibleIf(cuet != null || m.cuetOpen))
        if (cuet != null) {
            val label = res.getQuantityString(R.plurals.widget_cuet_days, cuet)
            val number = textMask(context, cuet.toString(), if (wide) 17f else 24f, maxWidthDp = 80f)
            cuetNumberDp = number.height / density
            cuetNumberWidthDp = number.width / density
            cuetLabel = label
            v.setViewVisibility(R.id.widget_cuet_number, View.VISIBLE)
            v.setImageViewBitmap(R.id.widget_cuet_number, number)
            v.setTextViewText(R.id.widget_cuet_label, label)
            v.setContentDescription(R.id.widget_cuet, res.getString(R.string.widget_cuet_spoken, cuet, label))
        } else if (m.cuetOpen) {
            val open = res.getString(R.string.widget_cuet_open)
            cuetLabel = open
            v.setViewVisibility(R.id.widget_cuet_number, View.GONE)
            v.setTextViewText(R.id.widget_cuet_label, open)
        }

        val titleWidthDp: Float
        val titleSizes: List<Float>
        val titleSpacing: Float
        var middleDp: Float
        var ringDp = if (wide) 52f else 44f
        var showRing = week != null
        var showWeekLabel = wide
        if (wide) {
            val innerWidth = widthDp - 2 * WIDE_PADDING_DP
            val top = maxOf(
                if (move == null) 24f else lineDp(context, 12f),
                if (updated != null) lineDp(context, 11f) else 0f,
            )
            // The bottom row: the key and the countdown share one line while they fit side by
            // side; otherwise the countdown's words wrap to a second line rather than squeeze.
            val pill = if (move != null) {
                minOf(180f, textWidthDp(context, move.action, 13f, bold = true) + 28f) + 12f
            } else {
                0f
            }
            val countdownWidth = (if (cuetNumberWidthDp > 0f) cuetNumberWidthDp + 5f else 0f) +
                (cuetLabel?.let { textWidthDp(context, it, 12f) } ?: 0f)
            val labelLines = if (cuetLabel != null && pill + countdownWidth > innerWidth) 2 else 1
            v.setInt(R.id.widget_cuet_label, "setMaxLines", labelLines)
            val countdownHeight = if (cuetLabel == null) 0f else maxOf(cuetNumberDp, labelLines * lineDp(context, 12f))
            val pillHeight = if (move != null) lineDp(context, 13f) + 14f else 0f
            val bottom = if (pillHeight > 0f || countdownHeight > 0f) 8f + maxOf(pillHeight, countdownHeight) else 0f
            middleDp = heightDp - 2 * WIDE_PADDING_DP - top - 6f - bottom
            if (week != null) {
                val full = 52f + 4f + lineDp(context, 11f)
                if (middleDp < full) {
                    showWeekLabel = false
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        ringDp = middleDp.coerceIn(MIN_RING_DP, 52f)
                        v.setViewLayoutWidth(R.id.widget_ring_frame, ringDp, TypedValue.COMPLEX_UNIT_DIP)
                        v.setViewLayoutHeight(R.id.widget_ring_frame, ringDp, TypedValue.COMPLEX_UNIT_DIP)
                    }
                }
            }
            val ringColumn = if (week == null) 0f else 12f + maxOf(ringDp, if (showWeekLabel) textWidthDp(context, week.label, 11f) else 0f)
            titleWidthDp = innerWidth - ringColumn
            titleSizes = listOf(22f, 20f, 18f, 16f)
            titleSpacing = 1.1f
            v.setViewVisibility(R.id.widget_mark, visibleIf(move == null))
            v.setViewVisibility(R.id.widget_overline, visibleIf(move != null))
            v.setTextViewText(R.id.widget_overline, move?.overline ?: "")
            v.setViewVisibility(R.id.widget_action, visibleIf(move != null))
            v.setViewVisibility(R.id.widget_updated, visibleIf(updated != null))
        } else {
            val inner = widthDp - 2 * SMALL_PADDING_DP
            // The countdown's words sit beside the ring (or the brand mark): two lines at most.
            // When they would not fit beside the ring, the ring gives way to the smaller mark.
            var labelLines = 1
            if (cuetLabel != null) {
                var beside = inner - (if (showRing) 44f else 32f) - 8f
                if (showRing && linesNeeded(context, cuetLabel, 11f, beside, medium = false) > 2) {
                    showRing = false
                    beside = inner - 32f - 8f
                }
                labelLines = linesNeeded(context, cuetLabel, 11f, beside, medium = false).coerceIn(1, 2)
            }
            v.setInt(R.id.widget_cuet_label, "setMaxLines", labelLines)
            val countdown = if (cuetLabel == null) 0f else cuetNumberDp + 3f + labelLines * lineDp(context, 11f)
            val top = maxOf(if (showRing) 44f else 32f, countdown)
            middleDp = heightDp - 2 * SMALL_PADDING_DP - top
            titleWidthDp = inner
            titleSizes = listOf(16f, 14f)
            titleSpacing = 1.05f
            val titleLine = lineDp(context, 14f, titleSpacing)
            // The key at the foot, when the title still keeps a line above it: the pill at 13 sp,
            // or a size smaller on a narrow widget, or none when even that does not fit.
            var showPill = false
            if (move != null) {
                val roomy = textWidthDp(context, move.action, 13f, bold = true) + 28f <= inner
                val compact = !roomy && textWidthDp(context, move.action, 12f, bold = true) + 20f <= inner
                if (roomy || compact) {
                    val pillBlock = 8f + lineDp(context, if (roomy) 13f else 12f) + 14f
                    if (middleDp - pillBlock >= titleLine) {
                        showPill = true
                        middleDp -= pillBlock
                        if (compact) {
                            val h = dp(context, 10f).toInt()
                            val vPad = dp(context, 7f).toInt()
                            v.setTextViewTextSize(R.id.widget_action, TypedValue.COMPLEX_UNIT_SP, 12f)
                            v.setViewPadding(R.id.widget_action, h, vPad, h, vPad)
                        }
                    }
                }
            }
            v.setViewVisibility(R.id.widget_action, visibleIf(showPill))
            var showUpdated = false
            if (updated != null) {
                val lines = if (textWidthDp(context, updated, 11f) <= inner) 1 else 2
                val needed = 2f + lines * lineDp(context, 11f)
                if (middleDp - needed >= titleLine) {
                    showUpdated = true
                    middleDp -= needed
                    v.setInt(R.id.widget_updated, "setMaxLines", lines)
                }
            }
            v.setViewVisibility(R.id.widget_updated, visibleIf(showUpdated))
            // The brand mark stands in for the ring (top left) when there is none.
            v.setViewVisibility(R.id.widget_mark, visibleIf(!showRing))
        }
        // The largest type the middle holds, so a tall widget is filled by its words, not by a gap.
        val titleSize = titleSizeSp(context, title, titleSizes, titleWidthDp, middleDp, titleSpacing)
        v.setTextViewTextSize(R.id.widget_title, TypedValue.COMPLEX_UNIT_SP, titleSize)
        v.setInt(R.id.widget_title, "setMaxLines", (middleDp / lineDp(context, titleSize, titleSpacing)).toInt().coerceIn(1, 3))

        v.setViewVisibility(R.id.widget_week, visibleIf(showRing))
        if (week != null && showRing) {
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
            if (wide) {
                v.setTextViewText(R.id.widget_week_label, week.label)
                v.setViewVisibility(R.id.widget_week_label, visibleIf(showWeekLabel))
            }
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
        /** The widget's own redraw alarm (see scheduleRedraw). */
        const val ACTION_REDRAW = "in.mockmob.app.widget.REDRAW"

        /** The week ring's stroke, the same as widget_ring_track.xml. */
        const val RING_STROKE_DP = 4f

        /** The smallest the wide widget's week ring gets before it is cut off instead. */
        const val MIN_RING_DP = 36f

        /** The layouts' padding: widget_today_small.xml and widget_padding. */
        const val SMALL_PADDING_DP = 12f
        const val WIDE_PADDING_DP = 14f

        /** One line of [sizeSp] text, in dp, at the phone's font size. */
        fun lineDp(context: Context, sizeSp: Float, spacing: Float = 1f): Float {
            val metrics = context.resources.displayMetrics
            val paint = Paint().apply { textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, metrics) }
            return paint.fontSpacing * spacing / metrics.density
        }

        /**
         * How many lines [text] takes at [sizeSp] in a box [widthDp] wide, at the phone's font
         * size. [medium] measures the title's weight, else the regular weight of the small print.
         */
        fun linesNeeded(context: Context, text: String, sizeSp: Float, widthDp: Float, spacing: Float = 1f, medium: Boolean = true): Int {
            val metrics = context.resources.displayMetrics
            val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
                textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, metrics)
                if (medium) typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
            }
            val width = dp(context, widthDp.coerceAtLeast(1f)).toInt().coerceAtLeast(1)
            return StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
                .setLineSpacing(0f, spacing)
                .build()
                .lineCount
        }

        /**
         * The first (largest) of [sizes] at which [text] takes three lines at most and fits
         * [heightDp]; the last (smallest) when none does.
         */
        fun titleSizeSp(context: Context, text: String, sizes: List<Float>, widthDp: Float, heightDp: Float, spacing: Float): Float {
            for (size in sizes) {
                val lines = linesNeeded(context, text, size, widthDp, spacing)
                if (lines <= 3 && lines * lineDp(context, size, spacing) <= heightDp) return size
            }
            return sizes.last()
        }

        /** The width of [text] at [sizeSp], in dp, at the phone's font size. */
        fun textWidthDp(context: Context, text: String, sizeSp: Float, bold: Boolean = false): Float {
            val metrics = context.resources.displayMetrics
            val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, metrics)
                if (bold) typeface = Typeface.DEFAULT_BOLD
            }
            return paint.measureText(text) / metrics.density
        }

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
    /** When what is drawn goes out of date (epoch millis): the move's end, or the next midnight. */
    val nextChangeAt: Long?,
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
        private const val MIDNIGHT_SLACK_MS = 60_000L

        /**
         * The CUET window the countdown uses when the app has never written. The source of truth
         * is CuetDates.windowStart and CuetDates.windowEnd in lib/core/domain/cuet_dates.dart (the
         * expected exam window, 1 to 31 May 2027); every write from the app carries those dates
         * in the "cuet" block, so these two only cover a widget added before the first write.
         * Change them with the Dart file: test/unit/home_widget/home_widget_data_test.dart
         * checks that the Dart side still sends the same two dates.
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
            // The countdown, the week and the "Updated" day change at the student's midnight; a
            // little after it, so a clock that runs slightly early never draws the old day again.
            val midnight = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli() + MIDNIGHT_SLACK_MS

            if (json == null || !json.optBoolean("signedIn", false)) {
                return WidgetModel(null, null, null, cuetDays, cuetOpen, midnight)
            }

            var moveEnds: Long? = null
            val move = json.optJSONObject("move")?.let { o ->
                val href = o.optString("href")
                val until = if (o.has("until")) o.optLong("until") else null
                val title = o.optString("title")
                when {
                    !href.startsWith(SITE) || title.isEmpty() -> null
                    until != null && now >= until -> null
                    else -> {
                        moveEnds = until
                        Move(o.optString("overline"), title, o.optString("action"), href)
                    }
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

            val ends = moveEnds
            val next = if (ends != null && ends < midnight) ends else midnight
            return WidgetModel(move, week, updated, cuetDays, cuetOpen, next)
        }

        private fun date(value: String?): LocalDate? =
            if (value.isNullOrEmpty()) null else runCatching { LocalDate.parse(value) }.getOrNull()
    }
}
