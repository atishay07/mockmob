import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart' show formatTime12, formatDayMonth, weekdayName;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../result/copy.dart' show ResultCopy;
import '../../result/model/paper_read.dart' show PaperRead;
import '../../result/recap/reveal_tally.dart' show RevealTally;
import '../../result/widgets/finish_reveal.dart' show PaperReadCard;
import '../../rhythm/rhythm.dart' show CelebrationMode, celebrationModeProvider;
import '../copy.dart';
import '../model/finish_reaction.dart';
import 'finish_ceremony.dart';
import 'mark_sheet.dart';
import 'marks_bar.dart';
import 'numbered_sheet.dart';

/// The finish of a practice: the mark sheet reveal (20 Oct, owner K7: "When someone submits the paper ... there should
/// be a proper reveal of the mark sheet"; earlier D108, G22, I13). It opens only after the server has acknowledged the
/// submit (the result route is reached from the receipt).
///
/// 1. The sheet is set down and stamped as saved ([SheetBeats.seal], 520 ms): "Your paper is saved." and what the paper
///    was and when it was recorded, beside the paper stamp (a light haptic as it lands). Said only once the server's
///    acknowledgement is held on this phone ([confirmed]); before that the head is "Your paper is marked." with no
///    stamp.
/// 2. The marking: the bubbles ink in paper order (85 ms apart for ten, 600 ms at least for a short set, 1 s at most);
///    the marks bar fills with them, the tally under the sheet counts what is inked with what it is worth (+5, -1, 0)
///    and the score is the sum of what is inked: every number is true at every frame. Mobi, under the sheet, reads it.
/// 3. The score lands: the figure is stamped (a medium haptic; for a good set with Celebrations on Full one ring and 14
///    shards) and the marker circles it.
/// 4. Then ([SheetBeats.after], 1 s): the accuracy and the time, Mobi's line, the marks by chapter and Mobi's read of
///    the paper. The screen stages the rest of the page on [onSettled].
///
/// About 2.8 s for ten questions from the first frame to the end. A tap anywhere skips to the end in 200 ms (never a
/// jump cut, and every value ends on the server's counts); reduced motion, Celebrations Off and a result opened again
/// show the end at once. Celebrations Quiet keeps the ink, the count and the stamp, without the ring, the shards or
/// Mobi's act.
///
/// The screen mounts it only once the sheet has rows (or the read has settled without them) and keys it by the number
/// of bubbles, so rows that arrive after an empty mount make a new stage that is timed for the real sheet.
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
    this.confirmed = false,
    this.now,
    this.chapterMarks = const [],
    this.chaptersLead,
    this.chaptersDetail,
    this.read,
    this.onFix,
    this.spent,
    this.timed = 0,
  });

  /// Mobi's read of the paper (Strengths, Weaknesses, Opportunity, Threats), the moment's last beat.
  final PaperRead? read;

  /// Opens the repair of the answers the read's Opportunity names ("Fix these 2").
  final VoidCallback? onFix;

  /// Under the read's lead sentence, for a tie: what the tied chapters cost together.
  final String? chaptersDetail;

  /// The sentence over the read's chapters (the v12 costliest line, ties said as ties).
  final String? chaptersLead;

  /// The paper's chapters with their marks ([chapterMarksOf]). Shown when the paper has two or more chapters; the read
  /// then keeps its sentence and leaves the table to this.
  final List<ChapterMark> chapterMarks;

  /// Time on the questions, from the phone's own timing, and how many it timed; null and 0 when it was not recorded.
  final Duration? spent;
  final int timed;

  /// The server acknowledged this paper and the acknowledgement is held on this phone (the pending-result row the
  /// submit writes only after the server returned the attempt). Only then is the paper said to be saved on a fresh
  /// moment.
  final bool confirmed;

  /// The student's clock, for "Recorded at 10:11 PM." against "Recorded on Sunday, 18 October at 10:11 PM.".
  final DateTime? now;

  /// Called each time a tap on the settled figure plays the gentle stamp again (tests).
  @visibleForTesting
  final VoidCallback? onStampReplay;

  final FinishMarks marks;
  final List<QuestionCell> cells;
  final FinishTone tone;

  /// When the server acknowledged; null while that is still being read.
  final DateTime? recordedAt;

  /// First open straight after the submit: play the moment. False shows the end state.
  final bool fresh;
  final String? subject;
  final String? chapter;
  final ValueChanged<int>? onCellTap;

  /// Called once, when the moment has ended. The screen stages what is below the moment on this, so the list of answers
  /// does not sit there giving the result away while the score still adds up.
  final VoidCallback? onSettled;

  /// Bubble-to-bubble stagger: a short set is given room to be seen (five over 600 ms), ten ink over 850 ms, and a long
  /// one is capped at [inkCap].
  static Duration staggerFor(int count) => Duration(milliseconds: (850 / math.max(count, 1)).round().clamp(50, 120).toInt());
  static const Duration inkCap = Duration(milliseconds: 1000);

  /// A breath between the stamp of the seal and the first bubble.
  static const Duration lead = Duration(milliseconds: 80);

  /// The stamp follows the last bubble at once.
  static const Duration tail = Duration.zero;

  /// After the landing, Mobi's turn, the success haptic and the rest of the sheet wait this long, so the number has
  /// visibly landed first.
  static const Duration reactAfterLanding = Duration(milliseconds: 160);

  /// How long the marking runs for [count] questions (after [SheetBeats.seal]).
  static Duration durationFor(int count) {
    final ink = Duration(milliseconds: math.min(staggerFor(count).inMilliseconds * math.max(count, 1), inkCap.inMilliseconds));
    return lead + ink + tail;
  }

  /// The whole moment for [count] questions, from the first frame to the end of the read: the seal, the marking, the
  /// figure's landing, Mobi's turn and [SheetBeats.after].
  static Duration totalFor(int count) {
    final landing = Duration(milliseconds: (FinishCeremony.stampDuration.inMilliseconds * FinishCeremony.landAt).round());
    return SheetBeats.seal + durationFor(count) + landing + reactAfterLanding + SheetBeats.after;
  }

  @override
  ConsumerState<FinishStage> createState() => _FinishStageState();
}

const double _mobiSize = 64;

/// How far under the sheet the follow scroll looks (see [_FinishStageState._followToSheet]): the bar fade over the
/// list's last 24 dp.
const double _followRoom = 28;

class _FinishStageState extends ConsumerState<FinishStage> with TickerProviderStateMixin {
  /// The sheet set down and stamped as saved.
  late final AnimationController _seal = AnimationController(vsync: this, duration: SheetBeats.seal);
  bool _sealLanded = false;

  /// The marking.
  late final AnimationController _c = AnimationController(vsync: this, duration: FinishStage.durationFor(widget.cells.length));
  late final Animation<double> _ink;

  /// The stamp of the figure after the marking (lift, land, and for a good set the ring and the burst).
  late final AnimationController _stamp = AnimationController(vsync: this, duration: FinishCeremony.stampDuration);
  bool _landed = false;
  Timer? _reactTimer;

  /// After the landing: the circle, the facts, the chapters and the read ([SheetBeats.after]).
  late final AnimationController _after = AnimationController(vsync: this, duration: SheetBeats.after);
  late final Animation<double> _circle = CurvedAnimation(
    parent: _after,
    curve: const Interval(0, SheetBeats.circleEnd, curve: Curves.easeInOutCubic),
  );

  /// The student skipped: what is left lands in [_skipTime].
  bool _skipped = false;
  static const Duration _skipTime = Duration(milliseconds: 200);
  final GlobalKey _followKey = GlobalKey();

  /// The Celebrations setting, read once when the moment starts.
  CelebrationMode _mode = CelebrationMode.full;
  final MobiController _mobi = MobiController();
  final GlobalKey _sheetKey = GlobalKey();
  bool _reacted = false;

  /// The stamp is being played again by a tap on the settled figure: gentle, with no ring or shards.
  bool _replay = false;
  Timer? _hushTimer;

  bool _started = false;
  bool _settledOnce = false;

  @override
  void initState() {
    super.initState();
    final ms = _c.duration!.inMilliseconds;
    _ink = CurvedAnimation(parent: _c, curve: Interval(FinishStage.lead.inMilliseconds / ms, 1 - FinishStage.tail.inMilliseconds / ms));
    _seal.addListener(() {
      if (!_sealLanded && _seal.value >= SheetBeats.stampLand) {
        _sealLanded = true;
        // The stamp touches the paper: a light tap, once, and only where the stamp is drawn.
        if (_stamped && !_skipped) unawaited(ref.read(hapticsProvider).light());
      }
    });
    _seal.addStatusListener((s) {
      if (s == AnimationStatus.completed && !_skipped && !_landed && !_c.isAnimating && _c.value == 0) unawaited(_c.forward());
    });
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed) _stampDown();
    });
    _stamp.addListener(() {
      if (!_landed && _stamp.value >= FinishCeremony.landAt) _land();
    });
    _c.addListener(_followInk);
    _after.addStatusListener((s) {
      if (s == AnimationStatus.completed) _settle();
    });
  }

  /// The paper is said to be saved, with the stamp: straight after the submit once the acknowledgement is held here,
  /// and on a result opened again (read back from the account, so saved by definition).
  bool get _stamped => !widget.fresh || widget.confirmed;

  /// The moment has ended: the screen stages what is below it.
  void _settle() {
    if (_settledOnce) return;
    _settledOnce = true;
    final settled = widget.onSettled;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      settled?.call();
      // The screen's pinned keys may grow as the moment ends (the late-night line): follow once more after that.
      if (mounted && !_still) _followToSheet();
    });
  }

  /// As the score lands, makes sure the whole sheet (down to its tally) is in view, so the marks are never added up below
  /// the fold (a large text size, a short phone). It scrolls only as far as that takes and never past the sheet's head:
  /// "Your paper is saved." and the score stay on screen. Only on a fresh moment with motion on.
  void _followToSheet() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _followKey.currentContext;
      if (ctx == null || !mounted || _still) return;
      unawaited(
        Scrollable.ensureVisible(
          ctx,
          duration: _skipped ? _skipTime : const Duration(milliseconds: 700),
          curve: Motion.out,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
        ),
      );
    });
  }

  /// How many bubbles are inked: a bubble counts once it is half inked, as the sheet draws it and as the tally counts
  /// it ([RevealTally]), so the bubbles, the tally and the score agree at every frame.
  int get _inked {
    final n = widget.cells.length;
    if (_c.value >= 1) return n;
    return (_ink.value * n + 0.5).floor().clamp(0, n);
  }

  /// The score the sheet shows: the marks of what is inked, and the server's own figure once the marking is done.
  int get _score => _c.value >= 1 ? widget.marks.scored : marksOf(widget.cells, _inked);

  /// The last bubble Mobi's eyes were sent to.
  int _gazeAt = -1;

  /// Mobi reads the sheet as it inks: his eyes go to the newest bubble, every other one so the glance travels along the
  /// row and never twitches (AP2-03). Not once the moment has landed, and not under reduced motion.
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

  /// The moment is shown at its end at once: a result opened again, reduced motion, or Celebrations off (words only).
  bool get _still => !widget.fresh || Motion.reduced(context) || _mode == CelebrationMode.off;

  /// The marking is done: stamp the figure. A still moment lands at once.
  void _stampDown() {
    if (_landed) return;
    if (_still) {
      _landed = true;
      _react();
      return;
    }
    unawaited(_stamp.forward(from: 0));
  }

  /// The figure touches down: the medium haptic now, then (once the number has visibly landed) Mobi's turn and, for a
  /// good set, the success haptic.
  void _land() {
    setState(() => _landed = true);
    unawaited(ref.read(hapticsProvider).medium());
    _announce();
    _reactTimer = Timer(FinishStage.reactAfterLanding, () {
      if (!mounted) return;
      if (_celebrates) unawaited(ref.read(hapticsProvider).success());
      _react();
    });
  }

  /// TalkBack hears the score once it has landed, never a figure still adding up.
  void _announce() {
    if (!mounted) return;
    final m = widget.marks;
    unawaited(SemanticsService.sendAnnouncement(View.of(context), SheetCopy.scored(m.scored, m.max), TextDirection.ltr));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _mode = ref.read(celebrationModeProvider);
    // The stamp's art is decoded while the sheet rises, so it is there when the stamp lands.
    if (_stamped) unawaited(precacheImage(SheetStamp.provider(context), context, onError: (_, _) {}));
    if (_still) {
      _seal.value = 1;
      _sealLanded = true;
      _c.value = 1;
      _react();
    } else {
      unawaited(_seal.forward());
    }
  }

  /// A tap on the settled figure: it stamps again, gently (a light haptic, no ring, no shards). While the moment is
  /// still playing the tap skips it instead. Nothing under reduced motion or with Celebrations off.
  void _tapFigure() {
    if (_playing) {
      _skip();
      return;
    }
    if (!_reacted || Motion.reduced(context) || _mode == CelebrationMode.off) return;
    setState(() => _replay = true);
    unawaited(ref.read(hapticsProvider).light());
    widget.onStampReplay?.call();
    unawaited(_stamp.forward(from: 0));
  }

  bool get _playing => _seal.isAnimating || _c.isAnimating || _stamp.isAnimating || _after.isAnimating || (_reactTimer?.isActive ?? false);

  /// A long press on a bubble of the sheet: Mobi points at it and says what it was ("Question 7: wrong"). The line goes
  /// after 3.6 s.
  void _cellSays(int index) {
    if (index < 0 || index >= widget.cells.length) return;
    _pointAtCell(index);
    _mobi.say(PracticeCopy.cellSays(index + 1, widget.cells[index]), live: true);
    _hushTimer?.cancel();
    _hushTimer = Timer(const Duration(milliseconds: 3600), () {
      if (mounted) _mobi.hush();
    });
  }

  /// A tap while the moment plays: the end state lands in 200 ms, never a jump cut, and every value ends on the server's
  /// counts.
  void _skip() {
    if (_skipped || !_playing) return;
    _skipped = true;
    if (_seal.value < 1) unawaited(_seal.animateTo(1, duration: _skipTime, curve: Motion.out));
    if (!_landed) {
      // Straight to the end: no stamp left to watch. Mobi still gives his act for the tone (on Full): the skip saves
      // the student the wait, not the reaction.
      _landed = true;
      _stamp.value = 1;
      unawaited(_c.animateTo(1, duration: _skipTime, curve: Motion.out));
      if (_celebrates && !Motion.reduced(context)) unawaited(ref.read(hapticsProvider).success());
      _announce();
      _react();
    } else if (_reactTimer?.isActive ?? false) {
      _stamp.value = 1;
      _reactTimer!.cancel();
      _react();
    } else {
      if (_stamp.isAnimating) _stamp.value = 1;
      unawaited(_after.animateTo(1, duration: _skipTime, curve: Motion.out));
    }
    setState(() {});
  }

  /// Mobi reacts once, with the line for the tone. With Celebrations on Quiet or Off he says the line without an act.
  void _react() {
    if (_reacted) return;
    _reacted = true;
    // The eyes come off the ink: the act below, or his rest, takes them from here.
    _mobi.lookAt(null);
    if (_mode != CelebrationMode.off) _mobi.setMood(widget.tone.mood);
    if (_mode == CelebrationMode.full) _mobi.react(widget.tone.act, key: 'practice-finish');
    _mobi.say(PracticeCopy.finishLine(widget.tone, widget.marks));
    if (_still) {
      _after.value = 1;
      _settle();
    } else {
      unawaited(_skipped ? _after.animateTo(1, duration: _skipTime, curve: Motion.out) : _after.forward());
      _followToSheet();
    }
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
    _hushTimer?.cancel();
    _reactTimer?.cancel();
    _seal.dispose();
    _c.dispose();
    _stamp.dispose();
    _after.dispose();
    _mobi.dispose();
    super.dispose();
  }

  /// "Accountancy practice, 10 questions on Goodwill. Recorded at 10:42 PM."
  String _detail() {
    final count = widget.cells.isEmpty ? widget.marks.total : widget.cells.length;
    final paper = SheetCopy.paper(subject: widget.subject, questions: count, chapter: widget.chapter);
    final at = widget.recordedAt;
    return at == null ? paper : '$paper ${FinishCopy.recordedWhen(at, widget.now ?? DateTime.now())}';
  }

  Widget _rule(MmColors colors) => Padding(
    padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
    child: Divider(height: 1, thickness: 1, color: colors.line),
  );

  /// Rises in with [v] (0 to 1); a part still rising cannot be tapped (L-30).
  Widget _rise(double v, Widget child) => IgnorePointer(
    ignoring: v < 0.99,
    child: Opacity(
      opacity: v,
      child: Transform.translate(offset: Offset(0, 8 * (1 - v)), child: child),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final m = widget.marks;
    final still = _still;
    final bubbles = [for (final c in widget.cells) bubbleOf(c)];
    final extremes = marksExtremes(widget.cells, m.scored);

    final sheet = DecoratedBox(
      key: const ValueKey('finish-ledger'),
      decoration: ShapeDecoration(
        color: colors.raised,
        shape: RoundedSuperellipseBorder(borderRadius: MmRadius.panelAll, side: BorderSide(color: colors.line)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SavedHead(
              title: _stamped ? SheetCopy.saved : SheetCopy.marked,
              detail: _detail(),
              stamped: _stamped,
              seal: _seal,
            ),
            _rule(colors),
            // The score: the sum of what is inked while the sheet is marked, then stamped and circled. A tap on the
            // settled figure stamps it again, gently; while the moment plays a tap anywhere skips it.
            GestureDetector(
              key: const ValueKey('finish-figure'),
              behavior: HitTestBehavior.opaque,
              onTap: _tapFigure,
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) => SheetScore(
                  value: _score,
                  max: m.max,
                  extremes: extremes,
                  stamp: _stamp,
                  circle: still ? kAlwaysCompleteAnimation : _circle,
                  circleColor: _celebrates ? colors.accentText : colors.ink,
                  burst: _burst && !_replay,
                  landed: _landed || still,
                  figureKey: const ValueKey('completion-figure'),
                ),
              ),
            ),
            const SizedBox(height: MmSpace.s12),
            // The bar's track is there from the first frame and fills with the ink, bubble by bubble.
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) => MarksBar(marks: m, fill: MarksFill.after(widget.cells, _inked), headless: true, lineless: true),
            ),
            const SizedBox(height: MmSpace.s8),
            // The marking scheme is printed on the paper from the start, as on a real mark sheet.
            Text(ResultCopy.scheme, style: type.caption.copyWith(color: colors.ink3)),
            if (widget.cells.isNotEmpty) ...[
              _rule(colors),
              Row(
                children: [
                  Text(ResultCopy.answers, style: type.caption.copyWith(color: colors.ink3)),
                  const Spacer(),
                  Text(ResultCopy.range(widget.cells.length), style: type.caption.copyWith(color: colors.ink3)),
                ],
              ),
              const SizedBox(height: MmSpace.s8),
              NumberedSheet(cells: widget.cells, reveal: _ink, onCellTap: widget.onCellTap, onCellLongPress: _cellSays, stripKey: _sheetKey),
              _rule(colors),
              // The tally: what is inked of each kind, with its marks, adding up to the score above.
              RevealTally(cells: bubbles, ink: still ? null : _ink, marks: true),
            ],
          ],
        ),
      ),
    );

    return GestureDetector(
      behavior: HitTestBehavior.translucent,
      onTap: _skip,
      child: AnimatedBuilder(
        animation: _after,
        builder: (context, _) {
          final t = _after.value;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // The sheet is set down: it rises 12 dp as the seal starts.
              Stack(
                clipBehavior: Clip.none,
                children: [
                  AnimatedBuilder(
                    animation: _seal,
                    child: sheet,
                    builder: (context, child) {
                      final v = SheetBeats.card(_seal.value);
                      return Opacity(opacity: 0.35 + 0.65 * v, child: Transform.translate(offset: Offset(0, 12 * (1 - v)), child: child));
                    },
                  ),
                  // The follow scroll's mark: the sheet's foot and the bar fade under it.
                  Positioned(left: 0, right: 0, bottom: -_followRoom, height: _followRoom, child: SizedBox(key: _followKey)),
                ],
              ),
              const SizedBox(height: MmSpace.s16),
              // The facts, as the score lands: how much of what was answered was right, and the time.
              _rise(
                SheetBeats.beat(t, SheetBeats.factsAt),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
                  child: SheetFacts(right: m.correct, answered: m.correct + m.wrong, total: m.total, spent: widget.spent, timed: widget.timed),
                ),
              ),
              const SizedBox(height: MmSpace.s16),
              // Mobi, under the paper: he reads it while it is marked, then turns and says one line. The row keeps his
              // height from the start, so nothing below it moves.
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
              if (widget.chapterMarks.length >= 2) ...[
                const SizedBox(height: MmSpace.s20),
                ChapterMarksBlock(chapters: widget.chapterMarks, t: _after),
              ],
              if (widget.read case final read?) ...[
                const SizedBox(height: MmSpace.s20),
                PaperReadCard(
                  read: read,
                  t: _after,
                  at: SheetBeats.readAt,
                  blockGap: SheetBeats.gap,
                  blockSpan: SheetBeats.span,
                  chapterTable: widget.chapterMarks.length < 2,
                  lead: widget.chaptersLead,
                  leadDetail: widget.chaptersDetail,
                  onFix: widget.onFix,
                ),
              ],
            ],
          );
        },
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

/// The words of the finish's head (D108, K7), read aloud before they were written (R6).
abstract final class FinishCopy {
  /// Straight after the submit (copy pass, 19 Oct): a whole sentence, not "Paper saved.".
  static const String paperSaved = SheetCopy.saved;

  /// "Recorded at 10:11 PM." or "Recorded on Sunday, 18 October at 10:11 PM.", in the student's own day.
  static String recordedWhen(DateTime at, DateTime now) {
    final sameDay = at.year == now.year && at.month == now.month && at.day == now.day;
    return sameDay ? 'Recorded at ${formatTime12(at)}.' : 'Recorded on ${weekdayName(at.weekday)}, ${formatDayMonth(at)} at ${formatTime12(at)}.';
  }
}
