import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Which settings row last had its setting changed, so the You hub can mark it once when the
/// student comes back (a 600 ms volt hairline). A settings screen calls [mark] after a change;
/// the hub row clears it when it has played.
class ChangedSettingsRow extends Notifier<String?> {
  @override
  String? build() => null;

  void mark(String id) => state = id;

  void clear(String id) {
    if (state == id) state = null;
  }
}

final changedSettingsRowProvider = NotifierProvider<ChangedSettingsRow, String?>(ChangedSettingsRow.new);

/// The ids screens pass to [ChangedSettingsRow.mark] and hub rows pass as their `changeKey`.
abstract final class ChangedRowKeys {
  static const rhythm = 'rhythm';
  static const notifications = 'notifications';
  static const appearance = 'appearance';
  static const privacy = 'privacy';
  static const account = 'account';
}
