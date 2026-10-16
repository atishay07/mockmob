import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../model/finish_reaction.dart';
import 'finish_ceremony.dart';
import 'marks_bar.dart';
import 'numbered_sheet.dart';

/// The finish moment of a practice (owner feedback 1110, WEB-PARITY A13), a T2 moment on the
/// celebration ladder (MOTION.md 1.2 and 4.7). It opens only after the server has acknowledged
/// the submit (the result route is reached from the receipt). The student's sheet inks in, bubble
/// by bubble in order (40 ms apart, 800 ms at most), the figure counts up with each right answer,
/// then the figure is stamped (a medium haptic as it lands). For a good set one ink ring and 14
/// shards follow (no sweep, no flash); then Mobi, who has been reading the sheet, reacts once the
/// number has landed, and the success haptic follows (allowed: the server already acknowledged).
/// A mixed set gets the stamp alone and Mobi's calm line, never sad.
///
/// The Celebrations setting gates it: Quiet keeps the ink, the count and the stamp but no ring,
/// shards or Mobi act; Off shows the end state at once, with the words. A tap anywhere skips to
/// the end; reduced motion and a result opened again show the end at once.
///
/// The screen mounts it only once the sheet has rows (or the read has settled without them) and
/// keys it by the number of bubbles, so rows that arrive after an empty mount make a new stage:
/// the ink is timed for the real sheet and starts from 0.
class FinishStage extends ConsumerStatefulWidget {
  const FinishStage({
    super.key,
    required this.marks,
    required this.cells,
    required this.tone,
    required this.recordedAt,
    required this.fresh,
    this.subject,
    this.chapter,
    this.onCellTap,
    this.onSettled,
    this.onStampReplay,
  });

  /// Called each time a tap on the settled figure plays the gentle stamp again (tests).
  @visibleForTesting
  final VoidCallback? onStampReplay;

  final FinishMarks marks;
  final List<QuestionCell> cells;
  final FinishTone tone;

  /// When the server acknowledged; null while that is still being read (no receipt yet).
  final DateTime? recordedAt;

  /// First open straight after the submit: play the moment. False shows the end state.
  final bool fresh;
  final String? subject;
  final String? chapter;
  final ValueChanged<int>? onCellTap;

  /// Called once, when the moment has ended (Mobi has reacted, or a skip, a result opened again or
  /// reduced motion landed it). The screen stages what is below the moment on this, so the list of
  /// answers does not sit there giving the result away while the score still counts up.
  final VoidCallback? onSettled;

  /// Bubble-to-bubble stagger, the cap on the whole ink, and the beats around it.
  static const Duration stagger = Duration(milliseconds: 40);
  static const Duration inkCap = Duration(milliseconds: 800);
  static const Duration lead = Duration(milliseconds: 200);

  /// The stamp follows the last bubble at once: 200 ms in place, 800 ms of ink at most, then the
  /// stamp at about 1000 ms (MOTION.md 4.7).
  static const Duration tail = Duration.zero;

  /// After the landing, Mobi's turn and the success haptic wait this long, so the number has
  /// visibly landed before he cheers.
  static const Duration reactAfterLanding = Duration(milliseconds: 160);

  /// How long the whole moment runs for [count] questions.
  static Duration durationFor(int count) {
    final ink = Duration(milliseconds: math.min(stagger.inMilliseconds * math.max(count, 1), inkCap.inMilliseconds));
    return lead + ink + tail;
  }

  @override
  ConsumerState<FinishStage> createState() => _FinishStageState();
}

const double _mobiSize = 80;

class _FinishStageState extends ConsumerState<FinishStage> with TickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: FinishStage.durationFor(widget.cells.length));
  late final Animation<double> _ink;

  /// The stamp after the ink (lift, land, and for a good set the ring and the burst).
  late final AnimationController _stamp = AnimationController(vsync: this, duration: FinishCeremony.stampDuration);
  bool _landed = false;
  Timer? _reactTimer;

  /// The Celebrations setting, read once when the moment starts.
  CelebrationMode _mode = CelebrationMode.full;
  final MobiController _mobi = MobiController();
  final GlobalKey _sheetKey = GlobalKey();
  bool _reacted = false;

  /// The stamp is being played again by a tap on the settled figure: gentle, with no ring or
  /// shards (those belong to the first landing).
  bool _replay = false;
  Timer? _hushTimer;

  /// The marks bar fills a beat after Mobi's line starts, so it never shows washed out under an
  /// empty bubble.
  bool _marksOn = false;
  Timer? _marksTimer;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _ink = _inkFor(_c.duration!);
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) _stampDown();
    });
    _stamp.addListener(() {
      if (!_landed && _stamp.value >= FinishCeremony.landAt) _land();
    });
    _c.addListener(_followInk);
  }

  /// How many bubbles have inked so far.
  int get _inked => _c.value >= 1 ? widget.cells.length : math.min(widget.cells.length, (_ink.value * widget.cells.length + 1e-6).floor());

  /// The last bubble Mobi's eyes were sent to.
  int _gazeAt = -1;

  /// Mobi reads the sheet as it inks: his eyes go to the newest bubble, every other one so the glance
  /// travels along the row and never twitches (AP2-03). Not once the moment has landed, and not
  /// under reduced motion, where nothing is inking.
  void _followInk() {
    if (_landed || _reacted || !_c.isAnimating) return;
    final i = _inked - 1;
    if (i < 0 || i == _gazeAt || i.isOdd) return;
    _gazeAt = i;
    final at = _cellGlobal(i);
    if (at != null) _mobi.lookAt(at);
  }

  /// A good or great set: the ring and the burst (on Full) and the success haptic.
  bool get _celebrates => widget.tone == FinishTone.good || widget.tone == FinishTone.great;

  /// The ring and the shards: a good set with Celebrations on Full.
  bool get _burst => _celebrates && _mode == CelebrationMode.full;

  /// The moment is shown at its end at once: a result opened again, reduced motion, or
  /// Celebrations off (words only).
  bool get _still => !widget.fresh || Motion.reduced(context) || _mode == CelebrationMode.off;

  /// The ink is done: stamp the figure. A still moment lands at once.
  void _stampDown() {
    // A skip has already landed it.
    if (_landed) return;
    if (_still) {
      _landed = true;
      _react();
      return;
    }
    _stamp.forward(from: 0);
  }

  /// The figure touches down: the medium haptic now, then (once the number has visibly landed)
  /// Mobi's turn and, for a good set, the success haptic.
  void _land() {
    _landed = true;
    unawaited(ref.read(hapticsProvider).medium());
    _reactTimer = Timer(FinishStage.reactAfterLanding, () {
      if (!mounted) return;
      if (_celebrates) unawaited(ref.read(hapticsProvider).success());
      _react();
    });
  }

  /// The ink runs between the lead-in and the tail of a moment [total] long.
  Animation<double> _inkFor(Duration total) {
    final ms = total.inMilliseconds;
    return CurvedAnimation(parent: _c, curve: Interval(FinishStage.lead.inMilliseconds / ms, 1 - FinishStage.tail.inMilliseconds / ms));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _mode = ref.read(celebrationModeProvider);
    if (_still) {
      _c.value = 1;
      _react();
    } else {
      _c.forward();
    }
  }

  /// A tap on the settled figure: it stamps again, gently (a light haptic, no ring, no shards).
  /// While the moment is still playing the tap skips it instead. Nothing under reduced motion or
  /// with Celebrations off, where the figure holds still.
  void _tapFigure() {
    if (_c.isAnimating || _stamp.isAnimating) {
      _skip();
      return;
    }
    if (!_reacted || Motion.reduced(context) || _mode == CelebrationMode.off) return;
    setState(() => _replay = true);
    unawaited(ref.read(hapticsProvider).light());
    widget.onStampReplay?.call();
    _stamp.forward(from: 0);
  }

  /// A long press on a bubble of the sheet: Mobi points at it and says what it was, in his own
  /// bubble ("Question 7: wrong"). The line goes after 3 s.
  void _cellSays(int index) {
    if (index < 0 || index >= widget.cells.length) return;
    _pointAtCell(index);
    _mobi.say(PracticeCopy.cellSays(index + 1, widget.cells[index]), live: true);
    _hushTimer?.cancel();
    _hushTimer = Timer(const Duration(milliseconds: 3600), () {
      if (mounted) _mobi.hush();
    });
  }

  void _skip() {
    if (_c.isAnimating) {
      // Straight to the end: no stamp left to watch. Mobi still gives his act for the tone
      // (on Full): the skip saves the student the wait, not the reaction.
      _landed = true;
      _c.value = 1;
      if (_celebrates && !Motion.reduced(context)) unawaited(ref.read(hapticsProvider).success());
      _react();
    } else if (_stamp.isAnimating) {
      _stamp.value = 1;
      if (_reactTimer?.isActive ?? false) {
        _reactTimer!.cancel();
        _react();
      }
    }
  }

  /// Mobi reacts once, with the line for the tone. With Celebrations on Quiet or Off he says the
  /// line without an act: the words stay, the show goes.
  void _react() {
    if (_reacted) return;
    _reacted = true;
    // The eyes come off the ink: the act below, or his rest, takes them from here.
    _mobi.lookAt(null);
    // Through react: a still pose with no travel under reduced motion, and never twice in a hurry.
    // His face follows the tone once the number has landed (Full and Quiet; Off is words only).
    if (_mode != CelebrationMode.off) _mobi.setMood(widget.tone.mood);
    if (_mode == CelebrationMode.full) _mobi.react(widget.tone.act, key: 'practice-finish');
    _mobi.say(PracticeCopy.finishLine(widget.tone, widget.marks));
    if (_still) {
      _marksOn = true;
    } else {
      _marksTimer = Timer(const Duration(milliseconds: 260), () {
        if (mounted) setState(() => _marksOn = true);
      });
    }
    final settled = widget.onSettled;
    if (settled != null) WidgetsBinding.instance.addPostFrameCallback((_) => settled());
    if (widget.tone.pointsAtMistake) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _pointAtFirstWrong());
    }
    if (mounted) setState(() {});
  }

  void _pointAtFirstWrong() {
    final first = widget.cells.indexOf(QuestionCell.wrong);
    if (first >= 0) _pointAtCell(first);
  }

  /// Where bubble [index] of the sheet is on screen, or null before the sheet is laid out.
  Offset? _cellGlobal(int index) {
    final box = _sheetKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize || !mounted) return null;
    final g = NumberedSheet.geometry(widget.cells.length, box.size.width);
    final local = Offset(
      g.left + (index % g.columns) * (g.cell + g.gap) + g.cell / 2,
      (index ~/ g.columns) * (g.cell + g.gap) + g.cell / 2,
    );
    return box.localToGlobal(local);
  }

  /// Aims Mobi at bubble [index] of the sheet.
  void _pointAtCell(int index) {
    final at = _cellGlobal(index);
    if (at != null) _mobi.pointAt(at);
  }

  @override
  void dispose() {
    _marksTimer?.cancel();
    _hushTimer?.cancel();
    _reactTimer?.cancel();
    _c.dispose();
    _stamp.dispose();
    _mobi.dispose();
    super.dispose();
  }

  /// Right answers inked so far: the figure counts up with the sheet.
  int _tally() {
    final exact = _ink.value * widget.cells.length;
    var n = 0;
    for (var i = 0; i < widget.cells.length && i + 1 <= exact + 1e-6; i++) {
      if (widget.cells[i] == QuestionCell.right) n++;
    }
    return _c.value >= 1 ? widget.marks.correct : n;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = widget.marks;
    // "Accountancy practice, Admission of a partner, finished": the one line that says what this is.
    final named = [
      if (widget.subject != null) PracticeCopy.resultOverline(widget.subject!),
      if (widget.chapter != null) widget.chapter!,
    ];
    final overline = named.isEmpty ? '' : [...named, PracticeCopy.resultFinished].join(', ');

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _skip,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (overline.isNotEmpty) Text(overline, style: type.caption.copyWith(color: colors.ink2)),
          // Room for the stamp's ring above the figure, so it never lands on the line over it.
          const SizedBox(height: MmSpace.s16),
          Semantics(
            header: true,
            label: PracticeCopy.figureSemantics(m.correct, m.total),
            excludeSemantics: true,
            // A tap on the settled figure stamps it again, gently.
            child: GestureDetector(
              key: const ValueKey('finish-figure'),
              behavior: HitTestBehavior.opaque,
              onTap: _tapFigure,
              child: StampedFigure(
                stamp: _stamp,
                burst: _burst && !_replay,
                digits: '${m.correct}'.length,
                child: AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) =>
                      // The thin spaces keep "of 10" clear of the digit it follows.
                      MonumentalNumber(
                        value: PracticeCopy.figureNumber(_tally()),
                        unit: '\u2009\u2009${PracticeCopy.figureUnit(m.total)}',
                        roll: false,
                      ),
                ),
              ),
            ),
          ),
          // And room under it, clear of the ring spreading out from behind the figure.
          const SizedBox(height: MmSpace.s16),
          // The summary line comes in with the count-up's last third, so the result is not given
          // away at 0.
          AnimatedBuilder(
            animation: _c,
            builder: (context, child) => Opacity(opacity: Curves.easeOut.transform(((_c.value - 0.6) / 0.4).clamp(0.0, 1.0)), child: child),
            child: Text(PracticeCopy.countsLine(m.correct, m.wrong, m.blank), style: type.lead.copyWith(color: colors.ink)),
          ),
          if (widget.cells.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s16),
            _InkSheet(cells: widget.cells, reveal: _ink, onCellTap: widget.onCellTap, onCellLongPress: _cellSays, stripKey: _sheetKey),
          ],
          const SizedBox(height: MmSpace.s8),
          // Mobi sits under the sheet, reading it while it inks, then turns and says one line.
          // The row keeps Mobi's height from the start, so nothing above it moves.
          ConstrainedBox(
            constraints: const BoxConstraints(minHeight: _mobiSize),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                MobiCharacter(controller: _mobi, size: _mobiSize, entrance: MobiAct.read, seed: 41),
                const SizedBox(width: MmSpace.s8),
                Expanded(child: _MobiSays(controller: _mobi)),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          // The bar's track is there from the first frame (no dead band) and fills with the ink,
          // bubble by bubble: each right bubble adds its marks, each wrong one what it cost, each
          // blank what was left. It is full when the figure stamps. Its line comes in after
          // Mobi's.
          TweenAnimationBuilder<double>(
            tween: Tween(end: _marksOn ? 1 : 0),
            duration: Motion.of(context, Motion.emphasizedDuration),
            curve: Motion.out,
            builder: (context, reveal, _) => AnimatedBuilder(
              animation: _c,
              builder: (context, _) => MarksBar(marks: m, reveal: reveal, fill: MarksFill.after(widget.cells, _inked)),
            ),
          ),
          const SizedBox(height: MmSpace.s12),
          // The line keeps its height while the acknowledgement time is read, so nothing jumps.
          SizedBox(height: MmSpace.s24, child: widget.recordedAt == null ? null : ReceiptLine(text: PracticeCopy.recordedLine(widget.recordedAt!))),
          // The late-night "good place to stop" line is not here any more: it sits under the pinned
          // key, with "Finish for now" (AP3-06, A14).
        ],
      ),
    );
  }
}

/// Mobi's line, typed in after the reaction, in Mobi's own speech bubble.
class _MobiSays extends StatelessWidget {
  const _MobiSays({required this.controller});

  final MobiController controller;

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<MobiSpeech?>(
    valueListenable: controller.speech,
    builder: (context, speech, _) => speech == null
        ? const SizedBox.shrink()
        : Align(
            alignment: Alignment.centerLeft,
            child: MobiBubble(key: ValueKey(speech.id), speech: speech, tail: MobiTail.left, maxWidth: 280, delay: 0.04),
          ),
  );
}

/// The student's sheet on a solid card: one bubble per question, inking in order. Each bubble
/// is a verdict, and a tap opens that question below (the rows are the accessible path).
class _InkSheet extends StatelessWidget {
  const _InkSheet({required this.cells, required this.reveal, this.onCellTap, this.onCellLongPress, this.stripKey});

  final List<QuestionCell> cells;
  final Animation<double> reveal;
  final ValueChanged<int>? onCellTap;
  final ValueChanged<int>? onCellLongPress;
  final Key? stripKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(
          borderRadius: MmRadius.panelAll,
          side: BorderSide(color: colors.line),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: NumberedSheet(cells: cells, reveal: reveal, onCellTap: onCellTap, onCellLongPress: onCellLongPress, stripKey: stripKey),
      ),
    );
  }
}
