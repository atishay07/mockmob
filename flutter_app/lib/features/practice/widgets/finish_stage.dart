import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/copy/formatters.dart' show formatSignedNumber, formatTime12, formatDayMonth, weekdayName;
import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../result/widgets/finish_reveal.dart';
import '../../result/model/paper_read.dart' show PaperRead;
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
/// 19 Oct (owner D108, G22): restored on the practice result as it was at 68f63c11, with its
/// durations unchanged, and refined with one completion line in place of the old receipt: "Paper
/// saved. You scored 34 of 50 marks." It rises in as the figure lands, its marks count up from 0
/// in tabular figures over [Motion.countUp] (720 ms, ease-out), and "Paper saved." is said only
/// when the server's acknowledgement is held on this phone ([confirmed]).
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
    this.confirmed = false,
    this.now,
    this.chapters = const [],
    this.chaptersLead,
    this.chaptersDetail,
    this.read,
    this.onFix,
  });

  /// Mobi's read of the paper (Strengths, Weaknesses, Opportunity, Threats), the moment's last beat. When it is there
  /// it carries the chapters in its Weaknesses, so [chapters] are not shown on their own.
  final PaperRead? read;

  /// Opens the repair of the answers the read's Opportunity names ("Fix these 2").
  final VoidCallback? onFix;

  /// Under the sentence, for a tie: what the tied chapters cost together.
  final String? chaptersDetail;

  /// The sentence over the chapters (the v12 costliest line, ties said as ties).
  final String? chaptersLead;

  /// Where the marks went, chapter by chapter, ranked with ties shared ([finishChaptersOf]). Shown as the moment's
  /// last beat when two or more chapters lost marks.
  final List<FinishChapter> chapters;

  /// The server acknowledged this paper and the acknowledgement is held on this phone (the
  /// pending-result row the submit writes only after the server returned the attempt). Only then
  /// does the completion line say "Your paper is saved.".
  final bool confirmed;

  /// The student's clock, for "Saved today at 10:11 PM" on a result opened again.
  final DateTime? now;

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

  /// Bubble-to-bubble stagger: the ink of a short set is given room to be seen (20 Oct, I13: five bubbles were 200 ms
  /// of ink, over before the eye found them), a long one is capped. 5 questions ink over 600 ms, 10 over 720 ms, 20 or
  /// more over [inkCap].
  static Duration staggerFor(int count) => Duration(milliseconds: (720 / math.max(count, 1)).round().clamp(40, 120).toInt());
  static const Duration inkCap = Duration(milliseconds: 800);
  static const Duration lead = Duration(milliseconds: 200);

  /// The stamp follows the last bubble at once.
  static const Duration tail = Duration.zero;

  /// After the landing, Mobi's turn, the success haptic and the marks being added up wait this long, so the number
  /// has visibly landed first.
  static const Duration reactAfterLanding = Duration(milliseconds: 160);

  /// How long the ink part of the moment runs for [count] questions.
  static Duration durationFor(int count) {
    final ink = Duration(milliseconds: math.min(staggerFor(count).inMilliseconds * math.max(count, 1), inkCap.inMilliseconds));
    return lead + ink + tail;
  }

  @override
  ConsumerState<FinishStage> createState() => _FinishStageState();
}

const double _mobiSize = 64;

/// How far under the ledger the follow scroll looks (see [_FinishStageState._followToLedger]).
const double _followRoom = 72;

class _FinishStageState extends ConsumerState<FinishStage> with TickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: FinishStage.durationFor(widget.cells.length));
  late final Animation<double> _ink;

  /// The stamp after the ink (lift, land, and for a good set the ring and the burst).
  late final AnimationController _stamp = AnimationController(vsync: this, duration: FinishCeremony.stampDuration);
  bool _landed = false;
  Timer? _reactTimer;

  /// The marks being added up, after the landing (the ledger, the circled total, the chapters): [FinishBeats.after].
  late final AnimationController _after = AnimationController(vsync: this, duration: FinishBeats.after);

  /// The total's line has started counting.
  bool _totalOn = false;

  /// The student skipped: what is left lands in [FinishBeats.skip].
  bool _skipped = false;
  final GlobalKey _ledgerKey = GlobalKey();

  /// The Celebrations setting, read once when the moment starts.
  CelebrationMode _mode = CelebrationMode.full;
  final MobiController _mobi = MobiController();
  final GlobalKey _sheetKey = GlobalKey();
  bool _reacted = false;

  /// The stamp is being played again by a tap on the settled figure: gentle, with no ring or
  /// shards (those belong to the first landing).
  bool _replay = false;
  Timer? _hushTimer;

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
    _after.addListener(() {
      if (!_totalOn && _after.value >= FinishBeats.totalAt) setState(() => _totalOn = true);
    });
    _after.addStatusListener((s) {
      if (s == AnimationStatus.completed) _settle();
    });
  }

  bool _settledOnce = false;

  /// The moment has ended: the screen stages what is below it.
  void _settle() {
    if (_settledOnce) return;
    _settledOnce = true;
    final settled = widget.onSettled;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      settled?.call();
      // The screen's pinned keys may grow as the moment ends (the late-night line): follow once more after that.
      if (mounted && !_still) _followToLedger();
    });
  }

  /// Brings the ledger into view as the marks start to be added up, so the moment's second half is never played
  /// below the fold. Only on a fresh moment with motion on.
  void _followToLedger() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _ledgerKey.currentContext;
      if (ctx == null || !mounted || _still) return;
      unawaited(
        Scrollable.ensureVisible(
          ctx,
          duration: _skipped ? FinishBeats.skip : const Duration(milliseconds: 700),
          curve: Motion.out,
          alignmentPolicy: ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
        ),
      );
    });
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
    setState(() => _landed = true);
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
    if (_c.isAnimating || _stamp.isAnimating || _after.isAnimating) {
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

  /// A tap while the moment plays: the end state lands in [FinishBeats.skip] (200 ms), never a jump cut, and never
  /// skips a beat's truth (every value ends on the server's counts).
  void _skip() {
    if (_skipped) return;
    if (_c.isAnimating) {
      // Straight to the end: no stamp left to watch. Mobi still gives his act for the tone
      // (on Full): the skip saves the student the wait, not the reaction.
      _skipped = true;
      _landed = true;
      unawaited(_c.animateTo(1, duration: FinishBeats.skip, curve: Motion.out));
      if (_celebrates && !Motion.reduced(context)) unawaited(ref.read(hapticsProvider).success());
      _react();
    } else if (_stamp.isAnimating) {
      _skipped = true;
      _stamp.value = 1;
      if (_reactTimer?.isActive ?? false) {
        _reactTimer!.cancel();
        _react();
      } else {
        unawaited(_after.animateTo(1, duration: FinishBeats.skip, curve: Motion.out));
      }
    } else if (_after.isAnimating) {
      _skipped = true;
      setState(() => _totalOn = true);
      unawaited(_after.animateTo(1, duration: FinishBeats.skip, curve: Motion.out));
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
      _totalOn = true;
      _after.value = 1;
      _settle();
    } else {
      if (_skipped) {
        // The total lands with everything else, inside the skip's 200 ms.
        _totalOn = true;
        unawaited(_after.animateTo(1, duration: FinishBeats.skip, curve: Motion.out));
      } else {
        unawaited(_after.forward());
      }
      _followToLedger();
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
    _c.dispose();
    _stamp.dispose();
    _after.dispose();
    _mobi.dispose();
    super.dispose();
  }

  /// The first words of the completion line: "Your paper is saved." straight after the submit, once the
  /// server's acknowledgement is held here; "Saved today at 10:11 PM." on a result opened again;
  /// nothing while neither is known (the marks are said alone, never a claim before it is true).
  String? _savedText() {
    final at = widget.recordedAt;
    if (widget.fresh) return widget.confirmed ? FinishCopy.paperSaved : null;
    return at == null ? null : FinishCopy.savedWhen(at, widget.now ?? DateTime.now());
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
          const SizedBox(height: MmSpace.s12),
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
          const SizedBox(height: MmSpace.s12),
          // Mobi sits over the paper, reading it while it inks, then turns and says one line. The row keeps Mobi's
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
          const SizedBox(height: MmSpace.s8),
          // The paper, marked (20 Oct, I13): the student's sheet inks bubble by bubble with the marks bar filling under
          // it; then, on the same card, the marks are added up (+5 each right, -1 each wrong, 0 each not attempted), a
          // rule, and the completion line (D108) as the total, counted up and circled by the marker. Every band gets
          // it. Its room is held from the first frame, so nothing moves when the rows rise in.
          Stack(
            clipBehavior: Clip.none,
            children: [
          FinishLedger(
            right: m.correct,
            wrong: m.wrong,
            blank: m.blank,
            t: _after,
            sheet: widget.cells.isEmpty
                ? null
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      NumberedSheet(cells: widget.cells, reveal: _ink, onCellTap: widget.onCellTap, onCellLongPress: _cellSays, stripKey: _sheetKey),
                      const SizedBox(height: MmSpace.s12),
                      // The bar's track is there from the first frame and fills with the ink, bubble by bubble (each
                      // right bubble adds its marks, each wrong one what it cost, each blank what was left). Its words
                      // are the ledger's rows now, so it has no line of its own.
                      AnimatedBuilder(
                        animation: _c,
                        builder: (context, _) => MarksBar(marks: m, fill: MarksFill.after(widget.cells, _inked), headless: true, lineless: true),
                      ),
                    ],
                  ),
            footer: CompletionLine(
              saved: _savedText(),
              scored: m.scored,
              max: m.max,
              run: _totalOn,
              animate: !_still,
              fast: _skipped,
              circleColor: _celebrates ? colors.accentText : colors.ink,
            ),
          ),
              // The follow scroll's mark: the ledger's foot plus room for the fade and the pinned keys that sit over the
              // list's last 70 dp, so the circled total always lands in clear view.
              Positioned(left: 0, right: 0, bottom: -_followRoom, height: _followRoom, child: SizedBox(key: _ledgerKey)),
            ],
          ),
          const SizedBox(height: MmSpace.s20),
          // Where the marks went, chapter by chapter, ties shared and said (I14). Only when two or more chapters lost
          // marks.
          if (widget.read case final read?)
            PaperReadCard(read: read, t: _after, lead: widget.chaptersLead, leadDetail: widget.chaptersDetail, onFix: widget.onFix)
          else if (widget.chapters.length >= 2)
            FinishChapters(chapters: widget.chapters, t: _after, lead: widget.chaptersLead, leadDetail: widget.chaptersDetail),
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

/// The words of the completion line (D108), read aloud before they were written (R6).
abstract final class FinishCopy {
  /// Straight after the submit (copy pass, 19 Oct): a whole sentence, not "Paper saved.".
  static const String paperSaved = 'Your paper is saved.';

  /// "Saved today at 10:11 PM." or "Saved on Sunday, 18 October at 10:11 PM.", in the student's own day. A receipt's
  /// time stamp, kept short (copy pass, 19 Oct): the line beside the ring holds about 20 characters at 360 dp, and a
  /// longer sentence would push the marks to a third line.
  static String savedWhen(DateTime at, DateTime now) {
    final sameDay = at.year == now.year && at.month == now.month && at.day == now.day;
    return sameDay ? 'Saved today at ${formatTime12(at)}.' : 'Saved on ${weekdayName(at.weekday)}, ${formatDayMonth(at)} at ${formatTime12(at)}.';
  }

  static const String scoredLead = 'You scored ';
  static String scoredTail(int max) => ' of $max marks.';

  /// The whole line, as TalkBack reads it once it has landed.
  static String spoken(String? saved, int scored, int max) =>
      [?saved, '$scoredLead${formatSignedNumber(scored)}${scoredTail(max)}'].join(' ');
}

/// "Paper saved. You scored 34 of 50 marks." (D108): a ringed check that draws itself, the saved
/// words, and the marks counting up from 0 in tabular figures over [Motion.countUp] on an ease-out
/// once [run] turns true. The line's room is laid out from the final figure from the first frame
/// (the figure sits in a box as wide as its final digits), so it never wraps differently or moves
/// anything while it counts. [animate] false (a result opened again, reduced motion, Celebrations
/// off) shows it at rest.
class CompletionLine extends StatefulWidget {
  const CompletionLine({
    super.key,
    required this.saved,
    required this.scored,
    required this.max,
    required this.run,
    this.animate = true,
    this.fast = false,
    this.circleColor,
  });

  /// The student skipped: whatever is left of the count and the circle lands in [FinishBeats.skip].
  final bool fast;

  /// The marker's ring around the total, drawn once the count has landed (20 Oct, I13: the sheet is marked). Null
  /// draws no ring.
  final Color? circleColor;

  /// How long the marker takes to ring the total.
  static const Duration circleDuration = Duration(milliseconds: 420);

  /// "Your paper is saved." or "Saved today at 10:11 PM."; null while not known (the marks alone).
  final String? saved;
  final int scored;
  final int max;
  final bool run;
  final bool animate;

  /// The figure shown at [t] (0 to 1) of the count.
  static int figureAt(int scored, double t) => (scored * Motion.out.transform(t.clamp(0.0, 1.0))).round();

  @override
  State<CompletionLine> createState() => _CompletionLineState();
}

class _CompletionLineState extends State<CompletionLine> with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: Motion.card);
  late final AnimationController _count = AnimationController(vsync: this, duration: Motion.countUp);
  late final AnimationController _circle = AnimationController(vsync: this, duration: CompletionLine.circleDuration);
  late final Animation<double> _circleDraw = CurvedAnimation(parent: _circle, curve: Curves.easeInOutCubic);

  @override
  void initState() {
    super.initState();
    _count.addStatusListener((s) {
      if (s == AnimationStatus.completed && widget.animate && !_circle.isAnimating && _circle.value == 0) {
        if (widget.fast) {
          _circle.value = 1;
        } else {
          unawaited(_circle.forward());
        }
      }
    });
    if (widget.run) _start();
  }

  @override
  void didUpdateWidget(CompletionLine old) {
    super.didUpdateWidget(old);
    if (widget.run && !old.run) _start();
    if (widget.fast && !old.fast && widget.run) _land();
  }

  void _start() {
    if (!widget.animate) {
      _in.value = 1;
      _count.value = 1;
      _circle.value = 1;
      return;
    }
    if (widget.fast) {
      _land();
      return;
    }
    unawaited(_in.forward());
    unawaited(_count.forward());
  }

  /// A skip: what is left lands in 200 ms.
  void _land() {
    for (final c in [_in, _count, _circle]) {
      if (c.value < 1) unawaited(c.animateTo(1, duration: FinishBeats.skip, curve: Motion.out));
    }
  }

  @override
  void dispose() {
    _in.dispose();
    _count.dispose();
    _circle.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final style = type.lead.copyWith(color: colors.ink);
    final figureStyle = style.copyWith(fontWeight: FontWeight.w700);
    final finalFigure = formatSignedNumber(widget.scored);
    final scaler = MediaQuery.textScalerOf(context);
    final probe = TextPainter(text: TextSpan(text: finalFigure, style: figureStyle), textDirection: TextDirection.ltr, textScaler: scaler)..layout();
    final figureWidth = probe.width;
    probe.dispose();
    final saved = widget.saved;
    final glyphColor = colors.accentText;
    final line = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 2),
          child: SizedBox.square(
            dimension: 20,
            child: Stack(
              children: [
                CustomPaint(size: const Size.square(20), painter: _CompletionRing(color: glyphColor)),
                if (widget.run)
                  MmStrokeDraw(
                    key: const ValueKey('completion-check'),
                    size: const Size.square(20),
                    path: _check,
                    color: glyphColor,
                    strokeWidth: 20 / 12,
                    duration: const Duration(milliseconds: 260),
                    delay: widget.animate ? const Duration(milliseconds: 90) : Duration.zero,
                    animateFirst: widget.animate,
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: MmSpace.s8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Two lines, each whole: "Your paper is saved." then "You scored 34 of 50 marks." (at 360 dp one line left
              // "marks." alone on the second).
              if (saved != null) Text(saved, style: style.copyWith(fontWeight: FontWeight.w600)),
              _scored(style, figureStyle, figureWidth),
            ],
          ),
        ),
      ],
    );
    return Semantics(
      container: true,
      liveRegion: widget.run,
      label: widget.run ? FinishCopy.spoken(saved, widget.scored, widget.max) : null,
      excludeSemantics: true,
      child: AnimatedBuilder(
        animation: _in,
        child: line,
        builder: (context, child) {
          final t = Motion.out.transform(_in.value);
          return Opacity(
            opacity: t,
            child: Transform.translate(offset: Offset(0, 8 * (1 - t)), child: child),
          );
        },
      ),
    );
  }

  /// "You scored 34 of 50 marks.", the figure counting up in a box as wide as its final digits.
  Widget _scored(TextStyle style, TextStyle figureStyle, double figureWidth) => Text.rich(
            TextSpan(
              style: style,
              children: [
                TextSpan(text: FinishCopy.scoredLead),
                WidgetSpan(
                  alignment: PlaceholderAlignment.baseline,
                  baseline: TextBaseline.alphabetic,
                  child: _ringed(
                    SizedBox(
                    width: figureWidth,
                    child: AnimatedBuilder(
                      animation: _count,
                      builder: (context, _) => Text(
                        formatSignedNumber(_count.value >= 1 ? widget.scored : CompletionLine.figureAt(widget.scored, _count.value)),
                        key: const ValueKey('completion-figure'),
                        style: figureStyle,
                        textAlign: TextAlign.right,
                        maxLines: 1,
                        softWrap: false,
                        overflow: TextOverflow.visible,
                      ),
                    ),
                  ),
                  ),
                ),
                TextSpan(text: FinishCopy.scoredTail(widget.max)),
              ],
            ),
          );

  Widget _ringed(Widget figure) {
    final color = widget.circleColor;
    if (color == null) return figure;
    figure = Padding(padding: const EdgeInsets.symmetric(horizontal: 7), child: figure);
    return MarkerCircle(key: const ValueKey('completion-circle'), progress: _circleDraw, color: color, child: figure);
  }

  /// Lucide's circle-check stroke ("m9 12 2 2 4-4") scaled to the box.
  static Path _check(Size size) {
    final k = size.width / 24;
    return Path()
      ..moveTo(9 * k, 12 * k)
      ..lineTo(11 * k, 14 * k)
      ..lineTo(15 * k, 10 * k);
  }
}

class _CompletionRing extends CustomPainter {
  const _CompletionRing({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final k = size.width / 24;
    canvas.drawCircle(
      size.center(Offset.zero),
      10 * k,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2 * k
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_CompletionRing old) => old.color != color;
}
