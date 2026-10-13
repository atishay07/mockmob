// The words the home-screen widget gets from Dart. The fixed states the widget draws before the
// app has ever run ("Open MockMob", the CUET countdown) live in the Android strings
// (res/values/widget_strings.xml), because the launcher can draw them with no Dart at all.
import '../copy/formatters.dart';

abstract final class HomeWidgetCopy {
  /// Over tonight's move. Fixed, so a widget read hours later never says "Today's" at night.
  static const String moveOverline = 'Next move';

  /// Under the week ring.
  static const String weekOpen = 'study days';
  static const String weekMet = 'Goal met';
  static const String weekPaused = 'Paused';

  /// When the widget's data was last confirmed by the server.
  static String updatedToday(DateTime at) => 'Updated ${formatTime12(at)}';
  static String updatedYesterday(DateTime at) => 'Updated yesterday, ${formatTime12(at)}';
  static String updatedOn(DateTime date) => 'Updated ${formatDayMonthShort(date)}';
}
