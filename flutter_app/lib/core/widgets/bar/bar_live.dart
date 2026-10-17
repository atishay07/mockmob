import 'dart:ui' show Rect;

import 'package:flutter/foundation.dart' show ValueGetter, VoidCallback, immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../copy/formatters.dart' show formatTime12;

/// What the live capsule above the bar can say (DOCK.md section 5.3). One at most, built only
/// from real state, highest priority first: [BarSending] (and [BarSaved] after the server's
/// 200), [BarMarked], [BarResume] (only once a paper has real answers in it), and
/// [BarOffline] (and [BarSynced] once the queue drains). The shell no longer shows [BarMove]
/// (tonight's move): it repeated the hero's own action and made a third floating layer at the
/// thumb (v13 clutter fix, 17 Oct); the type stays for the Today publisher and its tests.
enum BarLiveKind { sending, saved, marked, resume, offline, synced, move }

@immutable
sealed class BarLive {
  const BarLive();

  BarLiveKind get kind;

  /// The first words of the one line ("Accountancy mock, 23 of 50"). Never cut below 12
  /// characters.
  String get title;

  /// The rest of the line, cut first when space runs out ("41 min left"), or null.
  String? get detail;

  /// The part of [title] that gives way to an ellipsis when the line is too long ("Business
  /// Studies mock"); by default the whole title.
  String get titleName => title;

  /// The part of [title] that is never cut ("0 of 50"), or null. The line reads
  /// "[titleName], [titleTail]".
  String? get titleTail => null;

  /// The action word at the end ("Resume"), or null when the capsule only reports.
  String? get action => null;

  /// Identifies this state for a dismissal: a dismissed capsule stays hidden until this changes.
  String get identity;

  /// The whole capsule as one spoken line.
  String get semanticsLabel => [title, ?detail].join(', ');
}

/// A submit is in flight (the real call).
class BarSending extends BarLive {
  const BarSending({required this.paper});

  /// "Accountancy mock".
  final String paper;

  @override
  BarLiveKind get kind => BarLiveKind.sending;
  @override
  String get title => 'Sending your answers';
  @override
  String? get detail => paper;
  @override
  String get identity => 'sending:$paper';
}

/// The server answered 200 for the submit; shown for 3 s, then the next state.
class BarSaved extends BarLive {
  const BarSaved({required this.at, required this.paper});

  final DateTime at;
  final String paper;

  @override
  BarLiveKind get kind => BarLiveKind.saved;
  @override
  String get title => 'Saved at ${formatTime12(at)}';
  @override
  String? get detail => paper;
  @override
  String get identity => 'saved:${at.millisecondsSinceEpoch}';
}

/// A received result has not been opened.
class BarMarked extends BarLive {
  const BarMarked({required this.attemptId, required this.paper, this.subject, this.more = 0});

  final String attemptId;

  /// "Mock 8".
  final String paper;

  /// "Accountancy", or null when unknown.
  final String? subject;

  /// Other unopened results.
  final int more;

  @override
  BarLiveKind get kind => BarLiveKind.marked;
  @override
  String get title => '$paper is marked';
  @override
  String? get detail => more > 0 ? (subject == null ? '$more more waiting' : '$subject, $more more waiting') : subject;
  @override
  String? get action => 'Open';
  @override
  String get identity => 'marked:$attemptId';
  @override
  String get semanticsLabel => '${super.semanticsLabel}. Opens the result';
}

/// An open session can be resumed.
class BarResume extends BarLive {
  const BarResume({
    required this.sessionId,
    required this.paper,
    required this.total,
    this.answered,
    this.endsAt,
    this.now,
  });

  final String sessionId;

  /// "Accountancy mock".
  final String paper;
  final int total;

  /// Null until the journal has been read.
  final int? answered;

  /// A timed session's end, or null.
  final DateTime? endsAt;

  /// When [minutesLeft] was read (the shell refreshes it once a minute).
  final DateTime? now;

  /// Whole minutes left, rounded up, or null for an untimed session.
  int? get minutesLeft {
    final end = endsAt;
    final at = now;
    if (end == null || at == null) return null;
    final seconds = end.difference(at).inSeconds;
    if (seconds <= 0) return 0;
    return (seconds + 59) ~/ 60;
  }

  @override
  BarLiveKind get kind => BarLiveKind.resume;
  @override
  String get title => answered == null ? paper : '$paper, $answered of $total';
  @override
  String get titleName => paper;
  @override
  String? get titleTail => answered == null ? null : '$answered of $total';
  @override
  String? get detail {
    final left = minutesLeft;
    return left == null ? null : '$left min left';
  }

  @override
  String? get action => 'Resume';
  @override
  String get identity => 'resume:$sessionId';
  @override
  String get semanticsLabel {
    final left = minutesLeft;
    return [
      'Resume $paper',
      if (answered != null) '$answered of $total answered',
      if (left != null) '$left ${left == 1 ? 'minute' : 'minutes'} left',
    ].join(', ');
  }
}

/// Offline, with work waiting on this phone.
class BarOffline extends BarLive {
  const BarOffline({required this.answers});

  /// Answers (or other writes) saved on this phone; 0 when the count is not known yet.
  final int answers;

  @override
  BarLiveKind get kind => BarLiveKind.offline;
  @override
  String get title => 'Offline';
  @override
  String? get detail => answers <= 0
      ? 'Your work is saved on this phone'
      : '$answers ${answers == 1 ? 'answer' : 'answers'} saved on this phone';
  @override
  String get identity => 'offline';
}

/// The offline queue drained; shown for 2 s.
class BarSynced extends BarLive {
  const BarSynced();

  @override
  BarLiveKind get kind => BarLiveKind.synced;
  @override
  String get title => 'Synced';
  @override
  String? get detail => 'Everything reached MockMob';
  @override
  String get identity => 'synced';
}

/// Tonight's move, standing in for Today's hero key while that key is off-screen ("Accountancy
/// repair, 15 min  Start"). Today publishes it through `MmBarInsets.tonightMove`; the shell
/// shows it only on Today and only when nothing above it applies.
class BarMove extends BarLive {
  const BarMove({
    required this.title,
    this.detail,
    required this.onStart,
    this.label,
    this.originRect,
    this.originNow,
    this.originRadius,
  });

  @override
  final String title;
  @override
  final String? detail;

  /// Starts the move: the same action as the hero's primary key.
  final VoidCallback onStart;

  /// The hero key's full words ("Start repair, 15 min"), for TalkBack.
  final String? label;

  /// Where the hero's own key was (global coordinates) when this move was published. The
  /// capsule grows from this rect to its slot over 280 ms (rect and radius tween, content
  /// cross-fades) and shrinks back toward it when the move clears. Null: it rises as before.
  /// Not part of the move's identity.
  final Rect? originRect;

  /// Where the key is right now, asked when the capsule arrives and again when it leaves (the
  /// page may have scrolled since [originRect] was read). Null, or null result: [originRect].
  final ValueGetter<Rect?>? originNow;

  /// The key's corner radius; defaults to a full pill (half its height).
  final double? originRadius;

  /// The rect the capsule should travel from or to now, or null when it has none.
  Rect? resolveOrigin() => originNow?.call() ?? originRect;

  @override
  BarLiveKind get kind => BarLiveKind.move;
  @override
  String? get action => 'Start';
  @override
  String get identity => 'move:$title';
  @override
  String get semanticsLabel => "Tonight's move, ${super.semanticsLabel}";

  @override
  bool operator ==(Object other) => other is BarMove && other.title == title && other.detail == detail && other.label == label;

  @override
  int get hashCode => Object.hash(title, detail, label);
}

// Inputs. Each defaults to "nothing", so a shell under test never opens the session journal,
// the database or the network; `main.dart` wires them to the real sources.

/// A submit in flight: the paper's name ("Accountancy mock"), or null.
final barSendingInputProvider = Provider<String?>((ref) => null);

/// The newest unopened result as the capsule names it, or null.
final barMarkedInputProvider = Provider<BarMarked?>((ref) => null);

/// The open session to resume, or null. Its [BarResume.now] is filled in by [barLiveProvider].
final barResumeInputProvider = Provider<BarResume?>((ref) => null);

/// While offline with work waiting: how many answers are saved on this phone. Null when online
/// or when nothing is waiting.
final barOfflineInputProvider = Provider<int?>((ref) => null);

/// The kinds Today's hero is already showing (the open draft, the sealed sheet): the capsule
/// stands down for them while Today is the open tab. Today wires it.
final todayHeroCoversProvider = Provider<Set<BarLiveKind>>((ref) => const {});

/// The minute clock the Resume capsule reads. The shell ticks it once a minute while a timed
/// session is open, so the capsule repaints once a minute, never every second.
class BarMinute extends Notifier<DateTime> {
  @override
  DateTime build() => DateTime.now();

  void tick(DateTime now) => state = now;
}

final barMinuteProvider = NotifierProvider<BarMinute, DateTime>(BarMinute.new);

/// The capsule's steady state from the inputs, by priority. The short-lived Saved and Synced
/// states, the Today stand-down and dismissals are applied by the shell on top of this.
final barLiveProvider = Provider<BarLive?>((ref) {
  final sending = ref.watch(barSendingInputProvider);
  if (sending != null) return BarSending(paper: sending);
  final marked = ref.watch(barMarkedInputProvider);
  if (marked != null) return marked;
  final resume = ref.watch(barResumeInputProvider);
  // Only a paper with real answers in it is "in progress". An opened paper with none yet (or one
  // whose journal has not been read) is not worth a floating strip: the Start key already offers
  // Resume, and Today's hero names it.
  if (resume != null && (resume.answered ?? 0) > 0) {
    final now = resume.endsAt == null ? null : ref.watch(barMinuteProvider);
    return BarResume(
      sessionId: resume.sessionId,
      paper: resume.paper,
      total: resume.total,
      answered: resume.answered,
      endsAt: resume.endsAt,
      now: now,
    );
  }
  final offline = ref.watch(barOfflineInputProvider);
  if (offline != null) return BarOffline(answers: offline);
  return null;
});

/// Capsules the student swiped away in this app session, by [BarLive.identity]. Cleared only
/// by a cold start; a changed state has a new identity, so it shows again.
class BarDismissals extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void dismiss(String identity) => state = {...state, identity};
}

final barDismissalsProvider = NotifierProvider<BarDismissals, Set<String>>(BarDismissals.new);

/// What the capsule shows, from the steady state: null when Today's hero already shows it (on
/// Today) or the student dismissed it. Tonight's [move] is the lowest priority and shows only on
/// Today, when nothing above it would show.
BarLive? visibleLive(
  BarLive? live, {
  required Set<String> dismissed,
  required Set<BarLiveKind> todayCovers,
  required bool onToday,
  BarMove? move,
}) {
  BarLive? shown = live;
  if (shown != null && dismissed.contains(shown.identity)) shown = null;
  if (shown != null && onToday && todayCovers.contains(shown.kind)) shown = null;
  if (shown == null && onToday && move != null && !dismissed.contains(move.identity)) return move;
  return shown;
}
