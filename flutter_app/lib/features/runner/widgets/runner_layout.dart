import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/sync/session/save_state.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'clear_band.dart';
import 'lock_flight.dart';
import 'question_enter.dart';
import 'question_stage.dart';
import 'question_view.dart';
import 'runner_bottom_bar.dart';
import 'runner_meta_row.dart';
import 'runner_motion.dart';
import 'runner_top_bar.dart';
import 'tap_slop.dart';
import 'timing_track.dart';

/// The answering layout (spec 5.5, runner.md 3): top bar, the meta line, the timing track, the
/// question region and the bottom bar. Solid ground, no art, no Mobi; it rebuilds from the
/// session and never animates its layout. What moves is a transform or an opacity: the question
/// arriving, the ring gliding along the track, and the lock-in dot flying from the chosen option
/// to the track.
class RunnerLayout extends StatefulWidget {
  const RunnerLayout({
    super.key,
    required this.session,
    required this.warning,
    required this.onLeave,
    required this.onQuestions,
    required this.onSelect,
    required this.onPrevious,
    required this.onNext,
    this.onJump,
    this.onSwipe,
    this.onRetrySave,
    this.onStrike,
    this.onReady,
  });

  final RunnerSession session;
  final String? warning;
  final VoidCallback onLeave;
  final VoidCallback onQuestions;
  final void Function(String qid, int? option) onSelect;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  /// A tap on a bubble of the timing track.
  final ValueChanged<int>? onJump;

  /// A committed sideways swipe: 1 for the next question, -1 for the previous one. Without it a
  /// swipe calls [onNext] or [onPrevious].
  final ValueChanged<int>? onSwipe;

  /// A tap on "Not saved yet. Tap to retry".
  final VoidCallback? onRetrySave;

  /// A long press on an option: cross it out or bring it back (never part of the answer).
  final void Function(String qid, int option)? onStrike;

  /// The paper has just become complete and its last save is acknowledged (the soft haptic).
  final VoidCallback? onReady;

  @override
  State<RunnerLayout> createState() => _RunnerLayoutState();
}

class _RunnerLayoutState extends State<RunnerLayout> {
  final GlobalKey<TimingTrackState> _trackKey = GlobalKey<TimingTrackState>();
  final GlobalKey<LockFlightLayerState> _flightKey = GlobalKey<LockFlightLayerState>();

  /// Which way the student last moved: 1 forward, -1 back. The next question arrives from there.
  int _direction = 1;
  int _lastIndex = -1;

  RunnerSession get _session => widget.session;

  /// Practice only: how long the question on show has gone untouched. Measured on the session's
  /// own clock (the time left, which the engine ticks every second), so there is no timer of its
  /// own: the time left at the last touch or switch, minus the time left now. From [stallAfter]
  /// the meta line says so; any touch and every switch start the count again.
  static const Duration stallAfter = Duration(seconds: 90);
  late Duration _touchedAt = _session.remaining.value;
  final ValueNotifier<Duration?> _stall = ValueNotifier<Duration?>(null);

  void _touched() {
    _touchedAt = _session.remaining.value;
    _stall.value = null;
  }

  void _onRemaining() {
    if (_session.isMock || !_session.canAnswer) {
      _stall.value = null;
      return;
    }
    final still = _touchedAt - _session.remaining.value;
    _stall.value = still >= stallAfter ? still : null;
  }

  @override
  void initState() {
    super.initState();
    _session.remaining.addListener(_onRemaining);
  }

  @override
  void didUpdateWidget(RunnerLayout old) {
    super.didUpdateWidget(old);
    if (old.session != widget.session) {
      old.session.remaining.removeListener(_onRemaining);
      widget.session.remaining.addListener(_onRemaining);
      _touched();
    }
  }

  /// Where the student is in each passage (folded or open, how far down), per passage group, so
  /// moving between the questions of one passage keeps the place. In memory only.
  final Map<String, PassageRead> _passages = {};

  /// The mock's cells waiting for their option's wash to arrive (one per quick answer).
  final Set<Timer> _inkTimers = {};

  /// Whether the question region has more below that the student has not scrolled to: the band under the
  /// region says so while it holds no key (v16 walk I-11).
  final ValueNotifier<bool> _moreBelow = ValueNotifier<bool>(false);

  @override
  void dispose() {
    _session.remaining.removeListener(_onRemaining);
    _stall.dispose();
    _moreBelow.dispose();
    for (final t in _inkTimers) {
      t.cancel();
    }
    super.dispose();
  }

  /// An answer is about to be chosen on a bubble at [from]. In a practice a dot flies to the
  /// question's cell. In a timed mock there is no flight at all (the one place the student
  /// concentrates): the cell inks by itself as the option's wash arrives.
  void _lockFrom(Offset from) {
    if (RunnerMotion.reduced(context)) return;
    final track = _trackKey.currentState;
    if (track == null) return;
    final index = _session.currentIndex;
    final alreadyAnswered = _session.answerFor(_session.questions[index].id) != null;
    if (_session.isMock) {
      if (alreadyAnswered) return;
      track.hold(index);
      late final Timer timer;
      timer = Timer(RunnerMotion.wash, () {
        _inkTimers.remove(timer);
        track.land(index);
      });
      _inkTimers.add(timer);
      return;
    }
    final flight = _flightKey.currentState;
    final to = track.cellCenterGlobal(index);
    if (flight == null || to == null) return;
    if (!alreadyAnswered) track.hold(index);
    flight.launch(from: from, to: to, onLanded: () => track.land(index));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final s = _session;
    final index = s.currentIndex;
    // The first question of a session does not arrive: the page's own transition is playing.
    final arriving = _lastIndex >= 0;
    if (index != _lastIndex) {
      if (arriving) _direction = index >= _lastIndex ? 1 : -1;
      _lastIndex = index;
      // A new question starts its own count (the tap that moved here has already cleared the line).
      _touchedAt = s.remaining.value;
    }
    final q = s.questions[index];
    final top = MediaQuery.viewPaddingOf(context).top;
    final cells = sheetCellsOf(s);
    // The track's height depends on its real width: the gutter either side comes off the screen.
    final trackHeight = TimingTrack.heightFor(cells.length, MediaQuery.sizeOf(context).width - 2 * MmSpace.gutter);
    final onJump = widget.onJump;
    final onRetrySave = widget.onRetrySave;
    final onStrike = widget.onStrike;

    // A tap anywhere sends the away strip off; the tap itself still lands where it was aimed.
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) {
        s.dismissAway();
        _touched();
      },
      child: ColoredBox(
        color: colors.ground,
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: EdgeInsets.fromLTRB(MmSpace.gutter, top + MmSpace.s4, MmSpace.gutter, 0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      RunnerTopBar(
                        current: index + 1,
                        total: s.questions.length,
                        isMock: s.isMock,
                        remaining: s.isMock ? s.remaining : null,
                        onLeave: widget.onLeave,
                        onQuestions: widget.onQuestions,
                      ),
                      // The retry on the 32 dp meta line gets its 48 dp of touch from the band just
                      // above and below the line; the track's cells, tested first, keep theirs.
                      ValueListenableBuilder<SaveSnapshot>(
                        valueListenable: s.saveState,
                        builder: (context, snapshot, line) => TapSlop(
                          vertical: RunnerMetaRow.retryShowing(snapshot, canRetry: onRetrySave != null)
                              ? (MmTarget.min - RunnerMetaRow.height) / 2
                              : 0,
                          child: line,
                        ),
                        // The return notice takes the subject's place on this line (no layer over
                        // it, so nothing is covered and nothing below it moves).
                        child: _AwayLine(
                          session: s,
                          builder: (context, notice) => ValueListenableBuilder<Duration?>(
                            valueListenable: _stall,
                            builder: (context, stall, _) => RunnerMetaRow(
                              subjectLine: RunnerCopy.subjectLine(s.subject, s.chapter ?? q.chapter),
                              save: s.saveState,
                              showSave: s.answeredCount > 0,
                              warning: widget.warning,
                              notice: notice,
                              stall: stall == null || s.isMock ? null : RunnerCopy.onThisQuestion(stall),
                              onRetrySave: onRetrySave,
                            ),
                          ),
                        ),
                      ),
                      TimingTrack(key: _trackKey, cells: cells, onJump: s.canAnswer ? onJump : null, calm: s.isMock),
                    ],
                  ),
                ),
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, box) {
                      final padTop = trackHeight == TimingTrack.tappableHeight ? MmSpace.s4 : MmSpace.s12;
                      // 4 dp: the pinned clear band under the region adds its own air, and a bigger foot
                      // gap would make a question that just fits scroll by padding alone (and fade).
                      const padBottom = MmSpace.s4;
                      Widget layer(int at, {required bool ghost}) {
                        final question = s.questions[at];
                        return SingleChildScrollView(
                          // Never the primary scroll controller, for either layer: the leaving picture
                          // must not share it, and the tree must be the same shape for both, or the
                          // layer that turns into the picture is rebuilt and replays its entrance (the
                          // root of finding 7's blank frame). Kept, it stays still at its own scroll.
                          primary: false,
                          physics: ghost ? const NeverScrollableScrollPhysics() : null,
                          padding: EdgeInsets.fromLTRB(MmSpace.gutter, padTop, MmSpace.gutter, padBottom),
                          child: Align(
                            alignment: Alignment.topCenter,
                            // At least the height of the region, so the options rest at the foot.
                            child: ConstrainedBox(
                              constraints: BoxConstraints(
                                maxWidth: MmSpace.contentMaxWidth,
                                minHeight: (box.maxHeight - padTop - padBottom).clamp(0.0, double.infinity),
                              ),
                              child: QuestionEnter(
                                direction: _direction,
                                animate: arriving,
                                child: ListenableBuilder(
                                  listenable: s.strikes,
                                  builder: (context, _) => QuestionView(
                                    question: question,
                                    selected: s.answerFor(question.id),
                                    marked: s.marked.contains(question.id),
                                    canAnswer: s.canAnswer,
                                    onSelect: (option) => widget.onSelect(question.id, option),
                                    onMark: (value) => s.setMarked(question.id, value),
                                    onLock: _lockFrom,
                                    passageRange: passageRangeOf(s, at),
                                    isStruck: (option) => s.strikes.isStruck(question.id, option),
                                    passageRead: _passages.putIfAbsent(question.passageGroupId ?? question.id, PassageRead.new),
                                    onStrike: onStrike == null ? null : (option) => onStrike(question.id, option),
                                    note: _noteFor(s, at, strikable: onStrike != null),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }

                      return _ScrollFade(
                        cue: _moreBelow,
                        // A sideways swipe moves between questions; past the last it opens the
                        // submit page, the same as the Next key there.
                        child: QuestionStage(
                          index: index,
                          layer: layer,
                          onSwipe: (step) {
                            final swipe = widget.onSwipe;
                            if (swipe != null) {
                              swipe(step);
                            } else {
                              step > 0 ? widget.onNext() : widget.onPrevious();
                            }
                          },
                          hasPrevious: index > 0,
                          hasNext: index < s.questions.length - 1,
                        ),
                      );
                    },
                  ),
                ),
                // "Clear my answer" is pinned here, under the scrolling question and above the bar:
                // never cut by the bar, never under the fade (finding 11). Keyed by question so
                // its Undo belongs to the question it was given on.
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
                  child: ClearBand(
                    key: ValueKey(q.id),
                    selected: s.answerFor(q.id),
                    canAnswer: s.canAnswer,
                    onSelect: (option) => widget.onSelect(q.id, option),
                    moreBelow: _moreBelow,
                  ),
                ),
                RunnerBottomBar(
                  isFirst: index == 0,
                  isLast: index == s.questions.length - 1,
                  allAnswered: s.answeredCount == s.questions.length,
                  save: s.saveState,
                  onReady: widget.onReady,
                  onPrevious: widget.onPrevious,
                  onNext: widget.onNext,
                ),
              ],
            ),
            // The lock-in dot flies over everything and takes no touches (practice only).
            if (!s.isMock) Positioned.fill(child: LockFlightLayer(key: _flightKey)),
          ],
        ),
      ),
    );
  }
}

/// The return after an interruption: "Away for 2 minutes 10 seconds. Timer kept running. Answers
/// saved." with the save fact that is true right now. It is handed to the meta line to show in
/// place of the subject, as a polite live region; it leaves on the first tap, answer or jump.
class _AwayLine extends StatelessWidget {
  const _AwayLine({required this.session, required this.builder});

  final RunnerSession session;
  final Widget Function(BuildContext context, String? notice) builder;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AwayInfo?>(
      valueListenable: session.away,
      builder: (context, info, _) {
        final notice = info == null ? null : RunnerCopy.awayStrip(info.duration, allSaved: info.allSaved);
        return Semantics(
          container: notice != null,
          liveRegion: notice != null,
          onTap: notice == null ? null : session.dismissAway,
          child: builder(context, notice),
        );
      },
    );
  }
}

/// The one quiet line on question 1: the practice note until the first answer, then (practice or
/// mock) how to cross an option out, until the student has done it once.
Widget? _noteFor(RunnerSession s, int at, {required bool strikable}) {
  if (at != 0) return null;
  if (!s.isMock && s.answeredCount == 0) return const _PracticeNote();
  if (strikable && !s.strikes.used) return const _PracticeNote(text: RunnerCopy.strikeHint);
  return null;
}

/// The practice skin's one line at the start: no feedback while answering. Plain words on the
/// gutter, no icon to indent them.
class _PracticeNote extends StatelessWidget {
  const _PracticeNote({this.text = RunnerCopy.practiceNote});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Text(text, style: type.caption.copyWith(color: colors.ink2));
  }
}

/// A short soft fade at the foot of the question region while there is more below it, so an
/// option that runs under the bottom bar reads as scrollable and not as cut off. It is a scrim
/// in the ground colour (nothing decorative), takes no touches, and is gone at the end.
class _ScrollFade extends StatefulWidget {
  const _ScrollFade({required this.child, required this.cue});

  final Widget child;

  /// Set while the "More below" cue should show (in the band under the region, never over an option).
  final ValueNotifier<bool> cue;

  @override
  State<_ScrollFade> createState() => _ScrollFadeState();
}

class _ScrollFadeState extends State<_ScrollFade> {
  static const double _height = 28;

  /// The fade at the top, under the progress dots: once the question has scrolled up, its first
  /// line dissolves into the ground instead of being sliced by the header (v13 walk, finding 9).
  static const double _topHeight = 20;

  /// The shortest question region that shows the "More below" cue.
  static const double _cueRoom = 200;
  bool _more = false;
  bool _before = false;

  bool _update(ScrollMetrics metrics) {
    if (metrics.axis != Axis.vertical) return false;
    final more = metrics.extentAfter > 1;
    final before = metrics.extentBefore > 1;
    if (more != _more || before != _before) {
      setState(() {
        _more = more;
        _before = before;
      });
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return LayoutBuilder(
      builder: (context, box) {
        // The fade alone read as a stray smudge on a long stem (v15 walk). One small word and an arrow say it, until the
        // first scroll: the student who has scrolled knows. It stands in the band under the region, where the Clear key
        // goes once there is an answer: floating over the region it covered option D and left the band empty (v16 walk
        // I-11). Only where the region is tall enough to show a line of the option it points at.
        final show = _more && !_before && box.maxHeight >= _cueRoom;
        if (widget.cue.value != show) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) widget.cue.value = show;
          });
        }
        return Stack(
      children: [
        NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) => _update(n.metrics),
          child: NotificationListener<ScrollNotification>(onNotification: (n) => _update(n.metrics), child: widget.child),
        ),
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: _topHeight,
          child: IgnorePointer(
            child: AnimatedOpacity(
              opacity: _before ? 1 : 0,
              duration: Motion.of(context, Motion.glideDuration),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [ground, ground.withValues(alpha: 0)],
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: _height,
          child: IgnorePointer(
            child: AnimatedOpacity(
              opacity: _more ? 1 : 0,
              duration: Motion.of(context, Motion.glideDuration),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [ground.withValues(alpha: 0), ground],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
      },
    );
  }
}
