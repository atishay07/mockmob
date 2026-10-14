import 'package:flutter/foundation.dart' show debugPrint, visibleForTesting;

/// A local log of the things Learn throws away or cannot draw, so drift between the app and the
/// server can be counted. It never holds what the student typed or chose: only the event type,
/// its request key and the step type.
abstract final class LearnLog {
  static final List<String> _lines = [];

  /// The most recent lines, oldest first (at most 50).
  static List<String> get lines => List.unmodifiable(_lines);

  static void _add(String line) {
    _lines.add(line);
    if (_lines.length > 50) _lines.removeAt(0);
    debugPrint('Learn: $line');
  }

  /// A step the student sent that the server had already moved past (another device answered it).
  static void droppedEvent({required String type, required String requestKey}) =>
      _add('dropped $type event $requestKey after a conflict');

  /// A step type this build cannot draw.
  static void unknownStep({required String wireType, required String itemId}) =>
      _add('unknown step type "$wireType" on item $itemId');

  @visibleForTesting
  static void clear() => _lines.clear();
}
