import 'dart:async';

import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/learn_models.dart';
import '../data/learn_providers.dart' show learnApiProvider;
import 'chapter_model.dart';

/// What the chapter page knows of its dry run (the website's `usePreview`): the answer on screen, which ask it belongs to
/// and how the newest ask is doing.
@immutable
class ChapterRead {
  const ChapterRead({this.status = ChapterReadStatus.loading, this.data, this.asked, this.error});

  final ChapterReadStatus status;

  /// The answer on screen: the newest, or the last good one while a newer one loads or failed.
  final LearnPreview? data;

  /// What [data] answers.
  final LearnPreviewKey? asked;

  /// Why the newest ask failed ([ChapterReadStatus.stale], [ChapterReadStatus.error]).
  final Object? error;

  bool get hasData => data != null;
}

/// One chapter page's dry run: every change of length, left-out piles or the next chapter asks again, debounced
/// ([debounce]); only the newest ask's answer is kept (an older one that lands late is dropped); the numbers of the last
/// answer stay on screen while a new one loads, and stay (marked [ChapterReadStatus.stale]) when the new one fails.
class ChapterPreviewNotifier extends Notifier<ChapterRead> {
  ChapterPreviewNotifier(this.chapterKey);

  final String chapterKey;

  /// A burst of taps asks once.
  static const Duration debounce = Duration(milliseconds: 120);

  LearnPreviewKey? _wanted;
  Timer? _timer;
  int _serial = 0;

  @override
  ChapterRead build() {
    ref.onDispose(() => _timer?.cancel());
    return const ChapterRead();
  }

  /// The page wants the answer for [minutes], [leaveOut] and [addNext]. The same ask again is a no-op. A change waits out the
  /// debounce; the page's first ask ([immediate]) goes at once.
  void want({required int minutes, List<String> leaveOut = const [], bool addNext = false, bool immediate = false}) {
    final ask = LearnPreviewKey(chapterKey: chapterKey, minutes: minutes, leaveOut: leaveOut, addNext: addNext);
    if (ask == _wanted) return;
    _wanted = ask;
    // An answer still in flight is for an older ask now.
    _serial++;
    _timer?.cancel();
    // The answer on screen is already for this ask (a pile put back before the new answer came): nothing to ask.
    if (state.hasData && state.asked == ask) {
      if (state.status != ChapterReadStatus.ready) state = ChapterRead(status: ChapterReadStatus.ready, data: state.data, asked: ask);
      return;
    }
    _busy();
    if (immediate) {
      unawaited(_fetch());
    } else {
      _timer = Timer(debounce, _fetch);
    }
  }

  /// "Try again": asks for the wanted ask at once.
  void retry() {
    if (_wanted == null) return;
    _timer?.cancel();
    _busy();
    unawaited(_fetch());
  }

  /// A new answer is on its way: the old numbers stay, marked as refreshing (or loading when there are none).
  void _busy() {
    final status = state.hasData ? ChapterReadStatus.refreshing : ChapterReadStatus.loading;
    if (state.status != status || state.error != null) state = ChapterRead(status: status, data: state.data, asked: state.asked);
  }

  Future<void> _fetch() async {
    final ask = _wanted;
    if (ask == null) return;
    final mine = ++_serial;
    try {
      final data = await ref.read(learnApiProvider).preview(chapterKey: ask.chapterKey, minutes: ask.minutes, leaveOut: ask.leaveOut, addNext: ask.addNext);
      if (!ref.mounted || mine != _serial) return;
      state = ChapterRead(status: ChapterReadStatus.ready, data: data, asked: ask);
    } on Object catch (error) {
      if (!ref.mounted || mine != _serial) return;
      state = ChapterRead(status: state.hasData ? ChapterReadStatus.stale : ChapterReadStatus.error, data: state.data, asked: state.asked, error: error);
    }
  }
}

/// The chapter page's dry run, one per chapter.
final chapterPreviewProvider = NotifierProvider.autoDispose.family<ChapterPreviewNotifier, ChapterRead, String>(ChapterPreviewNotifier.new);
