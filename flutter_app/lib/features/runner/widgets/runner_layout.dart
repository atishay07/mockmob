import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/sync/session/save_state.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
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
    this.onRetrySave,
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

  /// A tap on "Not saved yet. Tap to retry".
  final VoidCallback? onRetrySave;

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

  /// The mock's cells waiting for their option's wash to arrive (one per quick answer).
  final Set<Timer> _inkTimers = {};

  @override
  void dispose() {
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
    }
    final q = s.questions[index];
    final top = MediaQuery.viewPaddingOf(context).top;
    final cells = sheetCellsOf(s);
    // The track's height depends on its real width: the gutter either side comes off the screen.
    final trackHeight = TimingTrack.heightFor(cells.length, MediaQuery.sizeOf(context).width - 2 * MmSpace.gutter);
    final onJump = widget.onJump;
    final onRetrySave = widget.onRetrySave;

    // A tap anywhere sends the away strip off; the tap itself still lands where it was aimed.
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (_) => s.dismissAway(),
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
                        openUntil: s.isMock ? null : RunnerCopy.openUntil(s.endsAt.toLocal()),
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
                          builder: (context, notice) => RunnerMetaRow(
                            subjectLine: RunnerCopy.subjectLine(s.subject, s.chapter ?? q.chapter),
                            save: s.saveState,
                            showSave: s.answeredCount > 0,
                            warning: widget.warning,
                            notice: notice,
                            onRetrySave: onRetrySave,
                          ),
                        ),
                      ),
                      TimingTrack(key: _trackKey, cells: cells, onJump: s.canAnswer ? onJump : null),
                    ],
                  ),
                ),
                Expanded(
                  child: LayoutBuilder(
                    builder: (context, box) {
                      final padTop = trackHeight == TimingTrack.tappableHeight ? MmSpace.s4 : MmSpace.s12;
                      const padBottom = MmSpace.s16;
                      Widget layer(int at, {required bool ghost}) {
                        final question = s.questions[at];
                        return SingleChildScrollView(
                          // The leaving question is a still picture: it never shares the primary
                          // scroll controller and never scrolls.
                          primary: ghost ? false : null,
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
                                child: QuestionView(
                                  question: question,
                                  selected: s.answerFor(question.id),
                                  marked: s.marked.contains(question.id),
                                  canAnswer: s.canAnswer,
                                  onSelect: (option) => widget.onSelect(question.id, option),
                                  onMark: (value) => s.setMarked(question.id, value),
                                  onLock: _lockFrom,
                                  passageRange: passageRangeOf(s, at),
                                  note: !s.isMock && at == 0 && s.answeredCount == 0 ? const _PracticeNote() : null,
                                ),
                              ),
                            ),
                          ),
                        );
                      }

                      return _ScrollFade(child: QuestionStage(index: index, layer: layer));
                    },
                  ),
                ),
                RunnerBottomBar(
                  isFirst: index == 0,
                  isLast: index == s.questions.length - 1,
                  allAnswered: s.answeredCount == s.questions.length,
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

/// The practice skin's one line at the start: no feedback while answering. Plain words on the
/// gutter, no icon to indent them.
class _PracticeNote extends StatelessWidget {
  const _PracticeNote();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Text(RunnerCopy.practiceNote, style: type.caption.copyWith(color: colors.ink2));
  }
}

/// A short soft fade at the foot of the question region while there is more below it, so an
/// option that runs under the bottom bar reads as scrollable and not as cut off. It is a scrim
/// in the ground colour (nothing decorative), takes no touches, and is gone at the end.
class _ScrollFade extends StatefulWidget {
  const _ScrollFade({required this.child});

  final Widget child;

  @override
  State<_ScrollFade> createState() => _ScrollFadeState();
}

class _ScrollFadeState extends State<_ScrollFade> {
  static const double _height = 28;
  bool _more = false;

  bool _update(ScrollMetrics metrics) {
    final more = metrics.extentAfter > 1;
    if (more != _more) setState(() => _more = more);
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final ground = context.mmColors.ground;
    return Stack(
      children: [
        NotificationListener<ScrollMetricsNotification>(
          onNotification: (n) => _update(n.metrics),
          child: NotificationListener<ScrollNotification>(onNotification: (n) => _update(n.metrics), child: widget.child),
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
  }
}
