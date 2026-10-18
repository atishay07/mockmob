import 'package:flutter_riverpod/flutter_riverpod.dart';

/// How many real actions the student has taken since the app started: a set or a mock that was
/// submitted and scored. It counts only what happened in this run (it starts at 0), so a feature
/// can say "after the first action of this session" without reading the whole record.
class StudentActions extends Notifier<int> {
  @override
  int build() => 0;

  /// A set or a mock was submitted and the server's answer came back.
  void submitted() => state = state + 1;
}

final studentActionsProvider = NotifierProvider<StudentActions, int>(StudentActions.new);
