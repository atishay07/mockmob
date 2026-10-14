import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/sync/session/save_state.dart';
import '../../../core/sync/session/session_engine.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/runner_session.dart';
import '../logic/sheet_cells.dart';
import 'lock_flight.dart';
import 'question_enter.dart';
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

  /// An answer is about to be chosen on a bubble at [from]: fly a dot to the question's cell.
  void _lockFrom(Offset from) {
    if (RunnerMotion.reduced(context)) return;
    final track = _trackKey.currentState;
    final flight = _flightKey.currentState;
    if (track == null || flight == null) return;
    final index = _session.currentIndex;
    final to = track.cellCenterGlobal(index);
    if (to == null) return;
    final alreadyAnswered = _session.answerFor(_session.questions[index].id) != null;
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
                        // The away strip lies over the meta line as glass: nothing below it reflows.
                        child: Stack(
                          clipBehavior: Clip.none,
                          children: [
                            RunnerMetaRow(
                              subjectLine: RunnerCopy.subjectLine(s.subject, q.chapter ?? s.chapter),
                              openUntil: s.isMock ? null : RunnerCopy.openUntil(s.endsAt.toLocal()),
                              save: s.saveState,
                              showSave: s.answeredCount > 0,
                              warning: widget.warning,
                              onRetrySave: onRetrySave,
                            ),
                            Positioned.fill(child: _AwayStrip(session: s)),
                          ],
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
                      return SingleChildScrollView(
                        key: ValueKey('question-$index'),
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
                                question: q,
                                selected: s.answerFor(q.id),
                                marked: s.marked.contains(q.id),
                                canAnswer: s.canAnswer,
                                onSelect: (option) => widget.onSelect(q.id, option),
                                onMark: (value) => s.setMarked(q.id, value),
                                onLock: _lockFrom,
                                passageRange: passageRangeOf(s, index),
                                note: !s.isMock && index == 0 && s.answeredCount == 0 ? const _PracticeNote() : null,
                              ),
                            ),
                          ),
                        ),
                      );
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
            // The lock-in dot flies over everything and takes no touches.
            Positioned.fill(child: LockFlightLayer(key: _flightKey)),
          ],
        ),
      ),
    );
  }
}

/// "You were away for 2 minutes 10 seconds. The timer kept running." with the save fact that
/// is true right now, as a glass strip over the meta line. It takes no room from the question:
/// it leaves on the first tap, answer or jump, and the strip itself is a tap target too.
class _AwayStrip extends StatelessWidget {
  const _AwayStrip({required this.session});

  final RunnerSession session;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ValueListenableBuilder<AwayInfo?>(
      valueListenable: session.away,
      builder: (context, info, _) {
        if (info == null) return const SizedBox.shrink();
        final text = RunnerCopy.awayStrip(info.duration, allSaved: info.allSaved);
        return MediaQuery.withClampedTextScaling(
          maxScaleFactor: 1.3,
          child: Semantics(
            container: true,
            liveRegion: true,
            label: text,
            onTap: session.dismissAway,
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: session.dismissAway,
              child: OverflowBox(
                minHeight: 0,
                maxHeight: double.infinity,
                child: GlassSurface(
                  borderRadius: MmRadius.keyAll,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s6),
                    child: Row(
                      children: [
                        Icon(LucideIcons.clock, size: 14, color: colors.ink2),
                        const SizedBox(width: MmSpace.s8),
                        Expanded(
                          child: Text(
                            text,
                            style: type.caption.copyWith(color: colors.ink),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// The practice skin's one line at the start: no feedback while answering.
class _PracticeNote extends StatelessWidget {
  const _PracticeNote();

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Row(
      children: [
        Icon(LucideIcons.messageCircle, size: 15, color: colors.ink3),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Text(RunnerCopy.practiceNote, style: type.small.copyWith(color: colors.ink2)),
        ),
      ],
    );
  }
}
