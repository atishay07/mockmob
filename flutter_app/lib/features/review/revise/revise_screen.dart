import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/motion/motion.dart';
import '../../../core/notes/feature_notes.dart';
import '../../../core/notes/sample_row.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../learn/widgets/feedback_mobi.dart';
import '../again/review_again_copy.dart';
import '../again/review_again_entry.dart' show reviewAgainCountProvider;
import '../widgets/page_header.dart';
import '../widgets/review_load_failure.dart' show startQuickTen;
import '../widgets/review_state_view.dart';
import 'revise_copy.dart';
import 'revise_data.dart';

/// `/review/revise`: the student's own wrong answers come back after 1, 3, 7 and 21 days, at most
/// 10 a day (Mistake Lab v4 slice 4, spec 4.8 "Same mistakes later"; the website's rules in
/// `data/revise.js`). One card at a time. The key never reaches the phone before the answer:
/// choosing an option posts it, and the server grades it, moves the card and answers with the
/// right option, the stored explanation and when the card comes back. Only that answer moves
/// anything on screen.
///
/// It costs no credits, writes no attempts row and is in no accuracy number, and it is a page of
/// its own, never part of a timed paper.
///
///   Top    "4 questions to revise today", about how long, the four box lanes with their counts
///   Card   the stem (and passage), the options; after the answer the key, the line and Next
///   End    "8 recalled, 2 come back tomorrow"
class ReviseScreen extends ConsumerStatefulWidget {
  const ReviseScreen({super.key});

  @override
  ConsumerState<ReviseScreen> createState() => _ReviseScreenState();
}

/// Today's read at [cap]. Held while the screen is up, so answering a card never reorders the run.
final reviseReadProvider = FutureProvider.autoDispose.family<ReviseRead, int>(
  // The student's own Try again is the retry: no hidden second read.
  retry: (count, error) => null,
  (ref, cap) => ref.watch(reviseApiProvider).read(cap: cap),
);

class _ReviseScreenState extends ConsumerState<ReviseScreen> {
  int _at = 0;
  final List<bool> _done = [];
  ReviseAnswer? _result;
  int? _chosen;
  bool _busy = false;
  String? _error;

  /// The boxes as the server has moved them this run (null before the first answer).
  List<int>? _boxes;

  /// The lanes a recall just moved a card between, and how many recalls have happened (the key of
  /// the pulse, so each recall pulses once).
  ({int from, int to, int n})? _moved;

  @override
  void initState() {
    super.initState();
    // The student is in Revise: its introduction on Review has done its job.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) ref.read(featureNotesProvider.notifier).done(FeatureNote.revise);
    });
  }

  void _reset() {
    _at = 0;
    _done.clear();
    _result = null;
    _chosen = null;
    _busy = false;
    _error = null;
    _boxes = null;
    _moved = null;
  }

  Future<void> _choose(ReviseRead read, int cap, int index) async {
    final item = _at < read.items.length ? read.items[_at] : null;
    if (item == null || _busy || _result != null) return;
    setState(() {
      _busy = true;
      _error = null;
      _chosen = index;
    });
    try {
      final answer = await ref
          .read(reviseApiProvider)
          .answer(questionId: item.questionId, choice: index, cap: cap);
      if (!mounted) return;
      unawaited(
        answer.correct
            ? ref.read(hapticsProvider).confirm()
            : ref.read(hapticsProvider).tick(),
      );
      final from = item.box - 1;
      final to = answer.retired ? null : answer.box - 1;
      setState(() {
        _busy = false;
        _result = answer;
        _done.add(answer.correct);
        final next = [...(_boxes ?? read.boxes)];
        next[from] = (next[from] - 1).clamp(0, 1 << 30);
        if (to != null) next[to] += 1;
        _boxes = next;
        _moved = (from: from, to: to ?? from, n: (_moved?.n ?? 0) + 1);
      });
      unawaited(
        SemanticsService.sendAnnouncement(
          View.of(context),
          answer.line,
          TextDirection.ltr,
        ),
      );
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _chosen = null;
        _error = e is ReviseRefused ? e.message : ReviseCopy.sendFailed;
      });
    }
  }

  void _next() => setState(() {
    _result = null;
    _chosen = null;
    _error = null;
    _at += 1;
  });

  Future<void> _setCap(int cap) async {
    if (_busy) return;
    await ref.read(reviseCapProvider.notifier).set(cap);
    if (mounted) setState(_reset);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final pad = MediaQuery.paddingOf(context);
    final cap = ref.watch(reviseCapProvider).value;
    final read = cap == null ? null : ref.watch(reviseReadProvider(cap));
    final data = read?.value;

    Widget body;
    if (data != null && !data.isUnavailable) {
      body = _Run(
        read: data,
        cap: cap!,
        at: _at,
        done: _done,
        result: _result,
        chosen: _chosen,
        busy: _busy,
        error: _error,
        boxes: _boxes ?? data.boxes,
        moved: _moved,
        bottomPadding: pad.bottom + MmSpace.s32,
        onChoose: (i) => _choose(data, cap, i),
        onNext: _next,
        onCap: _setCap,
      );
    } else if (data != null ||
        (read != null && read.hasError && !read.isLoading)) {
      final offline =
          read?.error is ApiError && (read!.error! as ApiError).isOffline;
      body = ReviewStateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: ReviseCopy.unavailable,
        primary: StateAction(ReviseCopy.tryAgain, () {
          if (cap != null) ref.invalidate(reviseReadProvider(cap));
        }),
      );
    } else {
      body = const _ReviseSkeleton();
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 360,
            child: IgnorePointer(
              child: LightField.lamp(context, strength: 0.55),
            ),
          ),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(
                  maxWidth: MmSpace.contentMaxWidth,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    PageHeader(title: data?.labels.title ?? ReviseCopy.title),
                    Expanded(child: body),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The run itself, laid out (the screen's state, the goldens and the tests drive it).
class _Run extends StatelessWidget {
  const _Run({
    required this.read,
    required this.cap,
    required this.at,
    required this.done,
    required this.result,
    required this.chosen,
    required this.busy,
    required this.error,
    required this.boxes,
    required this.moved,
    required this.bottomPadding,
    required this.onChoose,
    required this.onNext,
    required this.onCap,
  });

  final ReviseRead read;

  final int cap;
  final int at;
  final List<bool> done;
  final ReviseAnswer? result;
  final int? chosen;
  final bool busy;
  final String? error;
  final List<int> boxes;
  final ({int from, int to, int n})? moved;
  final double bottomPadding;
  final ValueChanged<int> onChoose;
  final VoidCallback onNext;
  final ValueChanged<int> onCap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final items = read.items;
    final finished = items.isNotEmpty && at >= items.length;
    final current = at < items.length ? items[at] : null;
    final right = done.where((d) => d).length;
    final wrong = done.length - right;

    final Widget stage;
    if (current != null) {
      stage = KeyedSubtree(
        key: ValueKey(current.questionId),
        child: MmEntrance(
          rise: 8,
          child: ReviseCard(
            item: current,
            number: at + 1,
            total: items.length,
            result: result,
            chosen: chosen,
            busy: busy,
            error: error,
            last: at + 1 >= items.length,
            onChoose: onChoose,
            onNext: onNext,
          ),
        ),
      );
    } else if (finished) {
      // Only the end needs the phone's repaired count, so only the end reads it.
      stage = Consumer(
        builder: (context, ref, _) => ReviseEnd(
          line: ReviseCopy.end(right: right, wrong: wrong),
          next: read.next,
          right: right,
          wrong: wrong,
          repaired: ref.watch(reviewAgainCountProvider),
        ),
      );
    } else {
      // No card at all yet: the first time here. The page teaches what will
      // appear, shows one sample card and goes to the next action. A cap reached, or a day when
      // the next ones are named, keeps the server's own sentence.
      final firstTime = read.answeredToday == 0 && (read.state == ReviseRead.empty || (read.cards == 0 && read.nextDay == null));
      stage = _Empty(
        text: read.answeredToday >= read.cap
            ? ReviseCopy.capReached
            : (read.next ?? ReviseCopy.nextNone),
        teaches: firstTime,
      );
    }

    return ListView(
      padding: EdgeInsets.fromLTRB(
        MmSpace.gutter,
        MmSpace.s8,
        MmSpace.gutter,
        bottomPadding,
      ),
      children: [
        MmSurface.hero(
          lit: true,
          padding: const EdgeInsets.fromLTRB(
            MmSpace.s20,
            MmSpace.s20,
            MmSpace.s20,
            MmSpace.s16,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!finished && read.head != null)
                Semantics(
                  header: true,
                  child: Text(read.head!, style: type.title),
                ),
              if (!finished && read.shown > 0) ...[
                const SizedBox(height: MmSpace.s4),
                Text(
                  ReviseCopy.minutes(read.minutes),
                  style: type.small.copyWith(color: colors.ink2),
                ),
              ],
              if (read.summary != null) ...[
                const SizedBox(height: MmSpace.s4),
                Text(
                  read.summary!,
                  style: type.small.copyWith(
                    color: colors.ink3,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
              const SizedBox(height: MmSpace.s16),
              Text(
                read.labels.sub,
                style: type.body.copyWith(color: colors.ink2),
              ),
              const SizedBox(height: MmSpace.s16),
              _CapChoice(cap: cap, onChanged: onCap, disabled: busy),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        _Lanes(boxes: boxes, labels: read.labels, moved: moved),
        const SizedBox(height: MmSpace.s24),
        MmOverlapSwitcher.fade(
          duration: Motion.card,
          alignment: Alignment.center,
          child: stage,
        ),
        const SizedBox(height: MmSpace.s24),
        Text(read.labels.fine, style: type.small.copyWith(color: colors.ink3)),
      ],
    );
  }
}

/// Questions a day: 5 or 10, two 48 dp segments.
class _CapChoice extends StatelessWidget {
  const _CapChoice({
    required this.cap,
    required this.onChanged,
    required this.disabled,
  });

  final int cap;
  final ValueChanged<int> onChanged;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: ReviseCopy.questionsADay,
      child: Row(
        children: [
          Expanded(
            child: Text(
              ReviseCopy.questionsADay,
              style: type.label.copyWith(color: colors.ink2),
            ),
          ),
          for (final n in const [5, 10]) ...[
            if (n == 10) const SizedBox(width: MmSpace.s8),
            MmPressable(
              onTap: disabled ? null : () => onChanged(n),
              semanticsLabel: ReviseCopy.capSpoken(n),
              selected: cap == n,
              haptic: MmPressHaptic.selection,
              builder: (context, pressed, _) => AnimatedContainer(
                duration: Motion.of(context, Motion.ui),
                curve: Motion.out,
                constraints: const BoxConstraints(
                  minWidth: 64,
                  minHeight: MmTarget.min,
                ),
                alignment: Alignment.center,
                decoration: ShapeDecoration(
                  color: cap == n ? colors.raised2 : Colors.transparent,
                  shape: RoundedSuperellipseBorder(
                    borderRadius: MmRadius.pillAll,
                    side: BorderSide(
                      color: cap == n ? colors.accentText : colors.line,
                      width: cap == n ? 1.5 : 1,
                    ),
                  ),
                ),
                child: Text(
                  '$n',
                  style: type.labelLarge.copyWith(
                    color: cap == n ? colors.ink : colors.ink2,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The four boxes with their counts and when each comes back. After a recall the lanes the card
/// left and entered pulse once; the counts always match the server's moves.
class _Lanes extends StatelessWidget {
  const _Lanes({
    required this.boxes,
    required this.labels,
    required this.moved,
  });

  final List<int> boxes;
  final ReviseLabels labels;
  final ({int from, int to, int n})? moved;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      label: ReviseCopy.cardsByBox,
      // Four tiles of one height, whatever their days wrap to.
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < 4; i++) ...[
              if (i > 0) const SizedBox(width: MmSpace.s8),
              Expanded(
                child: Semantics(
                  container: true,
                  label: ReviseCopy.laneSpoken(
                    i + 1,
                    boxes[i],
                    labels.boxes[i + 1],
                  ),
                  child: ExcludeSemantics(
                    child: _Pulse(
                      pulse:
                          moved != null && (moved!.from == i || moved!.to == i)
                          ? moved!.n
                          : 0,
                      child: MmSurface.inset(
                        padding: const EdgeInsets.fromLTRB(
                          MmSpace.s8,
                          MmSpace.s12,
                          MmSpace.s8,
                          MmSpace.s12,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${boxes[i]}',
                              style: type.title.copyWith(
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                            const SizedBox(height: MmSpace.s2),
                            Text(
                              ReviseCopy.box(i + 1),
                              style: type.label.copyWith(color: colors.ink2),
                            ),
                            const SizedBox(height: MmSpace.s2),
                            Text(
                              labels.boxes[i + 1] ?? '',
                              style: type.caption.copyWith(color: colors.ink3),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A lane's one pulse when a card leaves or enters it (200 ms, scale 1.06 back to 1). The key is
/// the recall's number, so each recall pulses once; reduced motion lands every change at once.
class _Pulse extends StatelessWidget {
  const _Pulse({required this.pulse, required this.child});

  final int pulse;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (pulse == 0 || Motion.reduced(context)) return child;
    return TweenAnimationBuilder<double>(
      key: ValueKey(pulse),
      tween: Tween(begin: 1.06, end: 1),
      duration: const Duration(milliseconds: 200),
      curve: Motion.out,
      builder: (context, scale, child) =>
          Transform.scale(scale: scale, child: child),
      child: child,
    );
  }
}

/// One question: the stem (and its passage), the options, and after the answer the key, the
/// server's line and Next. The options are 56 dp targets; none is enabled once answered.
class ReviseCard extends StatelessWidget {
  const ReviseCard({
    super.key,
    required this.item,
    required this.number,
    required this.total,
    required this.result,
    required this.chosen,
    required this.busy,
    required this.error,
    required this.last,
    required this.onChoose,
    required this.onNext,
  });

  final ReviseItem item;
  final int number;
  final int total;
  final ReviseAnswer? result;
  final int? chosen;
  final bool busy;
  final String? error;
  final bool last;
  final ValueChanged<int> onChoose;
  final VoidCallback onNext;

  static const _letters = 'ABCDEFGH';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final answered = result != null;
    final r = result;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Text(
              ReviseCopy.questionOf(number, total),
              style: type.label.copyWith(
                color: colors.ink2,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
            if (item.chapter != null) ...[
              const SizedBox(width: MmSpace.s12),
              Expanded(
                child: Text(
                  item.chapter!,
                  style: type.label.copyWith(color: colors.ink3),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: MmSpace.s12),
        if (item.passage != null) ...[
          MmSurface.inset(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  ReviseCopy.passage,
                  style: type.label.copyWith(color: colors.ink3),
                ),
                const SizedBox(height: MmSpace.s4),
                Text(
                  item.passage!,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
          const SizedBox(height: MmSpace.s12),
        ],
        Semantics(
          header: true,
          child: Text(item.question, style: type.question),
        ),
        const SizedBox(height: MmSpace.s16),
        for (var i = 0; i < item.options.length; i++) ...[
          if (i > 0) const SizedBox(height: MmSpace.s8),
          _Option(
            letter: i < _letters.length ? _letters[i] : '${i + 1}',
            text: item.options[i],
            isKey: answered && r!.keyIndex == i,
            mineWrong: answered && !r!.correct && chosen == i,
            pending: busy && chosen == i,
            onTap: answered || busy ? null : () => onChoose(i),
          ),
        ],
        if (busy) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(
            liveRegion: true,
            child: Row(
              children: [
                SizedBox.square(
                  dimension: 16,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: colors.ink2,
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Text(
                  ReviseCopy.checking,
                  style: type.small.copyWith(color: colors.ink2),
                ),
              ],
            ),
          ),
        ],
        if (error != null) ...[
          const SizedBox(height: MmSpace.s12),
          Semantics(
            liveRegion: true,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Icon(
                    LucideIcons.triangleAlert,
                    size: 16,
                    color: colors.warnText,
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Expanded(
                  child: Text(
                    error!,
                    style: type.small.copyWith(color: colors.warnText),
                  ),
                ),
              ],
            ),
          ),
        ],
        if (r != null) ...[
          const SizedBox(height: MmSpace.s16),
          MmSurface.inset(
            padding: const EdgeInsets.all(MmSpace.s16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 1),
                      child: Icon(
                        r.correct ? LucideIcons.check : LucideIcons.x,
                        size: 20,
                        color: r.correct ? colors.goodText : colors.ink2,
                      ),
                    ),
                    const SizedBox(width: MmSpace.s8),
                    Expanded(
                      child: Text(
                        r.line,
                        style: type.cardTitle.copyWith(
                          fontSize: 16,
                          height: 22 / 16,
                        ),
                      ),
                    ),
                    // The server has just graded this recall: Mobi answers it beside the line, a
                    // small correct hop or the "come on" lean (Full only, at most once every
                    // 2.5 s, dropped for large text; the line says it in words either way).
                    FeedbackMobi(
                      right: r.correct,
                      rateKey: FeedbackMobi.reviseGate,
                      full: MobiCelebrations.of(context) == MobiCelebrationLevel.full,
                    ),
                  ],
                ),
                if (r.explanation != null) ...[
                  const SizedBox(height: MmSpace.s8),
                  Text(
                    r.explanation!,
                    style: type.body.copyWith(color: colors.ink2),
                  ),
                ],
              ],
            ),
          ),
        ],
        if (answered || error != null) ...[
          const SizedBox(height: MmSpace.s16),
          KeyButton(
            label: last ? ReviseCopy.finish : ReviseCopy.nextQuestion,
            onPressed: onNext,
          ),
        ],
      ],
    );
  }
}

class _Option extends StatelessWidget {
  const _Option({
    required this.letter,
    required this.text,
    required this.isKey,
    required this.mineWrong,
    required this.pending,
    required this.onTap,
  });

  final String letter;
  final String text;
  final bool isKey;
  final bool mineWrong;
  final bool pending;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final state = isKey
        ? BubbleState.filled
        : (mineWrong
              ? BubbleState.wrong
              : (pending ? BubbleState.marked : BubbleState.hollow));
    final tag = isKey
        ? ReviseCopy.rightAnswer
        : (mineWrong ? ReviseCopy.yourPick : null);
    final border = isKey
        ? colors.ink2
        : (mineWrong ? colors.wrongBorder : colors.line);
    return MmPressable(
      onTap: onTap,
      semanticsLabel: [ReviseCopy.optionSpoken(letter, text), ?tag].join('. '),
      pressedScale: 0.99,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      builder: (context, pressed, _) => Container(
        constraints: const BoxConstraints(minHeight: MmTarget.option),
        padding: const EdgeInsets.all(MmSpace.s12),
        decoration: ShapeDecoration(
          color: mineWrong ? colors.wrongSurface : colors.raised,
          shape: RoundedSuperellipseBorder(
            borderRadius: MmRadius.keyAll,
            side: BorderSide(
              color: border,
              width: isKey || mineWrong ? 1.5 : 1,
            ),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Bubble(state: state, size: 20, animate: false),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$letter. $text',
                    style: type.body.copyWith(
                      color: mineWrong ? colors.wrongText : colors.ink,
                    ),
                  ),
                  if (tag != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        tag,
                        style: type.label.copyWith(
                          color: mineWrong ? colors.wrongText : colors.ink2,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The end of a run: Mobi reacts to what the server graded, then "8 recalled, 2 come back
/// tomorrow" and when the next ones are due.
///
/// The finished run is a real moment (every answer was graded by the server before the run could
/// end), so Mobi stands where the check ring was and plays one act for it: a cheer when every
/// recall held, the small correct hop when most did, and the warm "come on" lean when more came
/// back than held. He says nothing; the line carries the numbers. The Celebrations setting is
/// honoured through [MobiRation.underLevel]: Quiet seats him (no hop), Off keeps the plain check
/// ring that draws itself in. Reduced motion holds his pose still (the character does that).
/// He is the only Mobi on the Revise screen.
class ReviseEnd extends StatelessWidget {
  const ReviseEnd({super.key, required this.line, required this.next, required this.right, required this.wrong, this.repaired = 0});

  final String? line;
  final String? next;

  /// Recalls the server graded right and wrong in this run.
  final int right;
  final int wrong;

  /// Mistakes the student repaired on this phone; above 0 the end offers Review again.
  final int repaired;

  /// Mobi's height at the end of a run.
  static const double mobiSize = 88;

  /// The act for a finished run of [right] recalled and [wrong] coming back.
  static MobiAct actFor({required int right, required int wrong}) {
    if (wrong == 0) return MobiMoments.act(MobiEvent.sessionDone);
    if (right >= wrong) return MobiMoments.act(MobiEvent.answerRight);
    return MobiMoments.act(MobiEvent.answerWrong);
  }

  static Path _check(Size size) => MmPaths.check(
    Rect.fromLTWH(
      size.width * 0.22,
      size.height * 0.22,
      size.width * 0.56,
      size.height * 0.56,
    ),
  );

  Widget _ring(BuildContext context) {
    final colors = context.mmColors;
    return SizedBox.square(
      dimension: 44,
      child: Stack(
        children: [
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: colors.goodText, width: 1.5),
              ),
            ),
          ),
          Positioned.fill(
            child: MmStrokeDraw(
              path: _check,
              color: colors.goodText,
              strokeWidth: 2.5,
              delay: const Duration(milliseconds: 120),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    // Revise's cards are the server's; the mistakes the student repaired are the phone's. After a
    // run the second is offered, so the two never leave a dead end.
    final level = MobiCelebrations.of(context);
    final act = MobiRation.underLevel(actFor(right: right, wrong: wrong), level, held: true);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left-aligned at its own size: a stretched column would widen it.
        Align(
          alignment: Alignment.centerLeft,
          child: level == MobiCelebrationLevel.off || act == null
              ? _ring(context)
              : MobiCharacter(key: const ValueKey('revise-end-mobi'), size: mobiSize, entrance: act, seed: 23, interactive: true, tapCycle: MobiTapCycle.standard),
        ),
        const SizedBox(height: MmSpace.s16),
        if (line != null)
          Semantics(
            header: true,
            liveRegion: true,
            child: Text(line!, style: type.moment),
          ),
        if (next != null) ...[
          const SizedBox(height: MmSpace.s8),
          Text(next!, style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        KeyButton(
          label: ReviseCopy.backToReview,
          onPressed: () =>
              context.canPop() ? context.pop() : context.go(AppRoutes.review),
        ),
        if (repaired > 0)
          Align(
            child: KeyButton.quiet(
              label: ReviseCopy.reviewAgainMore(repaired),
              onPressed: () => context.push(ReviewAgainCopy.path),
            ),
          ),
      ],
    );
  }
}

/// Nothing is due: the server's sentence (when the next ones come, or the cap), and the way back.
class _Empty extends StatelessWidget {
  const _Empty({required this.text, this.teaches = false});

  final String text;

  /// The first-time state that teaches: one sample card, and the next action first.
  final bool teaches;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    void back() => context.canPop() ? context.pop() : context.go(AppRoutes.review);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(text, style: context.mmType.body.copyWith(color: colors.ink2)),
        if (teaches) ...[
          const SizedBox(height: MmSpace.s20),
          const SampleRow(
            leading: Bubble(state: BubbleState.wrong, size: 14, animate: false),
            title: ReviseCopy.sampleTitle,
            note: ReviseCopy.sampleNote,
          ),
          const SizedBox(height: MmSpace.s20),
          KeyButton(label: ReviseCopy.startAction, onPressed: () => startQuickTen(context)),
          Align(child: KeyButton.quiet(label: ReviseCopy.backToReview, onPressed: back)),
        ] else ...[
          const SizedBox(height: MmSpace.s24),
          KeyButton(label: ReviseCopy.backToReview, onPressed: back),
        ],
      ],
    );
  }
}

/// Loading: the lit card, the four lanes and a card, at about their real heights.
class _ReviseSkeleton extends StatelessWidget {
  const _ReviseSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: ReviseCopy.loading,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          MmSpace.gutter,
          MmSpace.s8,
          MmSpace.gutter,
          0,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 176, radius: 28),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 88, radius: 16),
            SizedBox(height: MmSpace.s24),
            MmSkeletonRows(rows: 3),
          ],
        ),
      ),
    );
  }
}
