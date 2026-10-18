import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/mistake_lab_traps.dart';
import '../../../core/motion/mm_light.dart';
import '../../../core/motion/motion.dart';
import '../../../core/notes/feature_notes.dart';
import '../../../core/notes/sample_row.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../learn/data/run_starter.dart';
import '../../learn/widgets/feedback_mobi.dart';
import '../again/review_again_copy.dart';
import '../again/review_again_entry.dart' show reviewAgainCountProvider;
import '../data/repair_check_controller.dart';
import '../data/repair_check_logic.dart' show CheckPhase;
import '../widgets/repair_check_section.dart' show CheckItHeld;
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
    final items = read.runItems;
    final item = _at < items.length ? items[_at] : null;
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
    final items = read.runItems;
    final checks = read.runChecks;
    final queue = read.queue;
    // One run: the questions back first, then the Check it held (5.8). Concept cards follow in
    // the lesson recall run, offered at the end.
    final total = items.length + checks.length;
    final finished = total > 0 && at >= total;
    final current = at < items.length ? items[at] : null;
    final check = current == null && at < total ? checks[at - items.length] : null;
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
            total: total,
            result: result,
            chosen: chosen,
            busy: busy,
            error: error,
            queued: queue != null,
            last: at + 1 >= total,
            onChoose: onChoose,
            onNext: onNext,
          ),
        ),
      );
    } else if (check != null) {
      stage = KeyedSubtree(
        key: ValueKey('check:${check.key}'),
        child: MmEntrance(
          rise: 8,
          child: ReviseCheckStep(
            check: check,
            number: at + 1,
            total: total,
            last: at + 1 >= total,
            onNext: onNext,
          ),
        ),
      );
    } else if (finished) {
      // Only the end needs the phone's repaired count, so only the end reads it.
      stage = Consumer(
        builder: (context, ref, _) {
          // The checks this run asked, as the server marked them (a check left for later is
          // still due, so it is counted apart).
          final marked = [
            for (final c in checks)
              ref.watch(
                repairCheckProvider((
                  attemptId: c.attemptId,
                  questionId: c.questionId,
                )).select((v) => v.result?.right),
              ),
          ];
          final held = marked.where((r) => r == true).length;
          final slipped = marked.where((r) => r == false).length;
          return ReviseEnd(
            line: ReviseCopy.end(right: right, wrong: wrong),
            next: read.next,
            right: right + held,
            wrong: wrong + slipped,
            // The repaired mistakes due today are in the queue now; the phone's own list is offered
            // only by an older server that does not merge them.
            repaired: queue == null ? ref.watch(reviewAgainCountProvider) : 0,
            cards: queue?.counts.cards ?? 0,
            held: held,
            slipped: slipped,
            checksLeft: checks.length - held - slipped,
          );
        },
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
        teaches: firstTime && (queue?.total ?? 0) == 0,
        cards: queue?.counts.cards ?? 0,
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
              if (!finished && queue != null && queue.total > 0) ...[
                // One head over the four sources, then what is in it (5.8).
                Semantics(
                  header: true,
                  child: Text(
                    ReviseCopy.runHead(queue.total, queue.minutes),
                    style: type.title,
                  ),
                ),
                const SizedBox(height: MmSpace.s4),
                Text(
                  ReviseCopy.mix(
                    back: queue.counts.back,
                    checks: queue.counts.checks,
                    cards: queue.counts.cards,
                  ),
                  style: type.small.copyWith(
                    color: colors.ink2,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ] else if (!finished && read.head != null)
                Semantics(
                  header: true,
                  child: Text(read.head!, style: type.title),
                ),
              if (!finished && queue == null && read.shown > 0) ...[
                const SizedBox(height: MmSpace.s4),
                Text(
                  ReviseCopy.minutes(read.minutes),
                  style: type.small.copyWith(color: colors.ink2),
                ),
              ],
              // With the queue the head and the mix line say it all (5.8: "nothing more"); the old
              // summary counts only the questions, and the old sub says checks are elsewhere.
              if (queue == null && read.summary != null) ...[
                const SizedBox(height: MmSpace.s4),
                Text(
                  read.summary!,
                  style: type.small.copyWith(
                    color: colors.ink3,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
              if (queue == null) ...[
                const SizedBox(height: MmSpace.s16),
                Text(
                  read.labels.sub,
                  style: type.body.copyWith(color: colors.ink2),
                ),
              ],
              if (queue == null || !finished && queue.total > 0)
                const SizedBox(height: MmSpace.s16),
              _CapChoice(cap: cap, onChanged: onCap, disabled: busy),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s16),
        if (queue == null)
          _Lanes(boxes: boxes, labels: read.labels, moved: moved)
        else
          // The four box lanes fold into "How Revise schedules" (5.8): the card comes first.
          _ScheduleFold(
            cap: cap,
            child: _Lanes(boxes: boxes, labels: read.labels, moved: moved),
          ),
        SizedBox(height: queue == null ? MmSpace.s24 : MmSpace.s16),
        MmOverlapSwitcher.fade(
          duration: Motion.card,
          alignment: Alignment.center,
          child: stage,
        ),
        const SizedBox(height: MmSpace.s24),
        Text(
          queue == null ? read.labels.fine : ReviseCopy.foot,
          style: type.small.copyWith(color: colors.ink3),
        ),
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

/// The four boxes with their counts and when each comes back. After a recall the eye can follow
/// the card (APP-PASS AP2-04, M08; rule 31; MOTION.md 1.2 T1; standards s8 R-153): a 6 dp volt dot
/// (olive rim on Day) flies from the lane it left to the lane it entered on a low arc (280 ms,
/// Motion.emphasized, no tail); the from-lane's count rolls down and the to-lane's rolls up
/// (300 ms); the to-lane's top edge inks a 2 dp line (220 ms) that fades after 600 ms. The counts
/// always match the server's moves. Reduced motion: the counts change in place, no dot.
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
    final m = moved;
    final reduced = Motion.reduced(context);
    final flies = m != null && m.from != m.to && !reduced;
    final row = IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < 4; i++) ...[
            if (i > 0) const SizedBox(width: _LaneFlight.gap),
            Expanded(
              child: Semantics(
                container: true,
                label: ReviseCopy.laneSpoken(
                  i + 1,
                  boxes[i],
                  labels.boxes[i + 1],
                ),
                child: ExcludeSemantics(
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
                        _RollCount(
                          count: boxes[i],
                          // Keyed by the recall, so each recall rolls the two lanes it touched once.
                          roll: m == null || reduced || m.from == m.to
                              ? 0
                              : (m.to == i ? 1 : (m.from == i ? -1 : 0)),
                          recall: m?.n ?? 0,
                          style: type.title.copyWith(
                            fontFeatures: const [FontFeature.tabularFigures()],
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
          ],
        ],
      ),
    );
    return Semantics(
      container: true,
      label: ReviseCopy.cardsByBox,
      // Four tiles of one height, whatever their days wrap to.
      child: !flies
          ? row
          : Stack(
              clipBehavior: Clip.none,
              children: [
                row,
                Positioned.fill(
                  child: IgnorePointer(
                    child: TweenAnimationBuilder<double>(
                      key: ValueKey(m.n),
                      tween: Tween(begin: 0, end: _LaneFlight.total),
                      duration: Duration(milliseconds: _LaneFlight.total.round()),
                      builder: (context, ms, _) => CustomPaint(
                        painter: _LaneFlight(
                          from: m.from,
                          to: m.to,
                          ms: ms,
                          dot: MmLight.particleFill(context),
                          rim: MmLight.particleRim(context),
                          edge: colors.isNight ? colors.volt : colors.accentText,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

/// The card's flight between two lanes and the to-lane's inked edge, painted over the row.
class _LaneFlight extends CustomPainter {
  _LaneFlight({
    required this.from,
    required this.to,
    required this.ms,
    required this.dot,
    required this.rim,
    required this.edge,
  });

  final int from;
  final int to;
  final double ms;
  final Color dot;
  final Paint? rim;
  final Color edge;

  static const double gap = MmSpace.s8;
  static const double flight = 280;
  static const double ink = 220;
  static const double hold = 600;
  static const double fade = 200;
  static const double total = flight + ink + hold + fade;

  /// Where the dot is at flight progress [t] (0..1) between lane centres [a] and [b] along the top
  /// edge: a low arc, its highest point 14 dp above the edge.
  static Offset dotAt(double t, double a, double b) {
    final e = Motion.emphasized.transform(t.clamp(0.0, 1.0));
    return Offset(a + (b - a) * e, -14 * 4 * e * (1 - e));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final lane = (size.width - 3 * gap) / 4;
    double centre(int i) => i * (lane + gap) + lane / 2;
    if (ms < flight) {
      final p = dotAt(ms / flight, centre(from), centre(to)) + const Offset(0, 6);
      canvas.drawCircle(p, 3, Paint()..color = dot);
      final r = rim;
      if (r != null) canvas.drawCircle(p, 3, r);
      return;
    }
    final inked = Motion.out.transform(((ms - flight) / ink).clamp(0.0, 1.0));
    final gone = ((ms - flight - ink - hold) / fade).clamp(0.0, 1.0);
    final alpha = 1 - Motion.out.transform(gone);
    if (alpha <= 0) return;
    final left = to * (lane + gap) + MmSpace.s12;
    final width = (lane - 2 * MmSpace.s12) * inked;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromLTWH(left, 0, width, 2), const Radius.circular(1)),
      Paint()..color = edge.withValues(alpha: edge.a * alpha),
    );
  }

  @override
  bool shouldRepaint(_LaneFlight old) => old.ms != ms || old.from != from || old.to != to || old.dot != dot || old.edge != edge;
}

/// A lane's count. When a recall moves a card it rolls: up into place on the lane the card
/// entered ([roll] 1), down on the lane it left (-1), 300 ms on Motion.out; 0 changes in place.
class _RollCount extends StatelessWidget {
  const _RollCount({required this.count, required this.roll, required this.recall, required this.style});

  final int count;
  final int roll;
  final int recall;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final text = Text('$count', style: style);
    if (roll == 0) return text;
    return TweenAnimationBuilder<double>(
      key: ValueKey(recall),
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      curve: Motion.out,
      builder: (context, t, child) => Opacity(
        opacity: (0.2 + 0.8 * t).clamp(0.0, 1.0),
        child: Transform.translate(offset: Offset(0, roll * 10 * (1 - t)), child: child),
      ),
      child: text,
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
    this.queued = false,
  });

  /// From the merged queue: the card says what it is and where it came from (5.8 kind line).
  final bool queued;

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
    final detail = [?item.source, ?item.chapter].join('. ');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (queued) ...[
          Text(
            '${ReviseCopy.position(number, total)}. '
            '${item.kind == ReviseItem.kindAgain ? ReviseCopy.kindAgain : ReviseCopy.kindQuestion}',
            style: type.label.copyWith(
              color: colors.ink2,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          if (detail.isNotEmpty) ...[
            const SizedBox(height: MmSpace.s2),
            Text(
              detail,
              style: type.small.copyWith(color: colors.ink3),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ] else
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
  const ReviseEnd({
    super.key,
    required this.line,
    required this.next,
    required this.right,
    required this.wrong,
    this.repaired = 0,
    this.cards = 0,
    this.held = 0,
    this.slipped = 0,
    this.checksLeft = 0,
  });

  /// Lesson recall cards due today (source 4): above 0 the end's key plays them.
  final int cards;

  /// The Check it held this run asked: held and slipped on the new question, and those left for
  /// later (no new question was ready, or the student moved on), which stay due.
  final int held;
  final int slipped;
  final int checksLeft;

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
        for (final l in [
          ?ReviseCopy.checksEnd(held: held, slipped: slipped),
          if (checksLeft > 0) ReviseCopy.checksLeft(checksLeft),
        ]) ...[
          const SizedBox(height: MmSpace.s8),
          Text(l, style: type.body.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s24),
        if (cards > 0) ...[
          ReviseCardsKey(cards: cards),
          Align(
            child: KeyButton.quiet(
              label: ReviseCopy.backToReview,
              onPressed: () => context.canPop()
                  ? context.pop()
                  : context.go(AppRoutes.review),
            ),
          ),
        ] else
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
  const _Empty({
    required this.text,
    this.teaches = false,
    this.cards = 0,
  });

  final String text;
  final int cards;

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
          if (cards > 0) ...[
            ReviseCardsKey(cards: cards),
            Align(
              child: KeyButton.quiet(
                label: ReviseCopy.backToReview,
                onPressed: back,
              ),
            ),
          ] else
            KeyButton(label: ReviseCopy.backToReview, onPressed: back),
        ],
      ],
    );
  }
}

/// "How Revise schedules": the four box lanes behind one quiet line, closed until asked for.
class _ScheduleFold extends StatefulWidget {
  const _ScheduleFold({required this.cap, required this.child});

  final int cap;
  final Widget child;

  @override
  State<_ScheduleFold> createState() => _ScheduleFoldState();
}

class _ScheduleFoldState extends State<_ScheduleFold> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          semanticsLabel:
              '${ReviseCopy.scheduleTitle}. '
              '${_open ? ReviseCopy.hideSchedule : ReviseCopy.showSchedule}',
          focusRadius: MmRadius.panelAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          onTap: () => setState(() => _open = !_open),
          builder: (context, pressed, _) => ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        ReviseCopy.scheduleTitle,
                        style: type.body.copyWith(fontWeight: FontWeight.w500),
                      ),
                      Text(
                        ReviseCopy.scheduleLine(widget.cap),
                        style: type.small.copyWith(color: colors.ink2),
                      ),
                    ],
                  ),
                ),
                AnimatedRotation(
                  turns: _open ? 0.5 : 0,
                  duration: Motion.of(context, Motion.ui),
                  curve: Motion.out,
                  child: Icon(
                    LucideIcons.chevronDown,
                    size: 16,
                    color: colors.ink3,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_open) ...[
          const SizedBox(height: MmSpace.s8),
          MmEntrance(rise: 8, child: widget.child),
        ],
      ],
    );
  }
}

/// A pending Check it held inside the run (Revise source 3): a new question on the rule of a
/// repair, asked and marked by the repair check (`/api/recovery/check`, no credit, no model). The
/// position and the mistake it checks sit above Review's own Check it held block; the student
/// moves on once it is marked, or leaves it for later, when it stays due.
class ReviseCheckStep extends ConsumerStatefulWidget {
  const ReviseCheckStep({
    super.key,
    required this.check,
    required this.number,
    required this.total,
    required this.last,
    required this.onNext,
  });

  final ReviseCheck check;
  final int number;
  final int total;
  final bool last;
  final VoidCallback onNext;

  @override
  ConsumerState<ReviseCheckStep> createState() => _ReviseCheckStepState();
}

class _ReviseCheckStepState extends ConsumerState<ReviseCheckStep> {
  CheckKey get _key => (attemptId: widget.check.attemptId, questionId: widget.check.questionId);

  @override
  void initState() {
    super.initState();
    // Ask for the question once (free). A check already open or marked on this phone keeps its
    // question and the student's answer.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (ref.read(repairCheckProvider(_key)).phase == CheckPhase.idle) {
        unawaited(ref.read(repairCheckProvider(_key).notifier).load());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = ref.watch(repairCheckProvider(_key));
    final c = widget.check;
    final detail = [
      if (c.number != null) ReviseCopy.checkRule(c.number!),
      ?c.paper,
      ?c.chapter,
    ].join('. ');
    final marked = view.phase == CheckPhase.answered;
    final nothing = view.phase == CheckPhase.none;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          ReviseCopy.position(widget.number, widget.total),
          style: type.label.copyWith(
            color: colors.ink2,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        if (detail.isNotEmpty) ...[
          const SizedBox(height: MmSpace.s2),
          Text(
            detail,
            style: type.small.copyWith(color: colors.ink3),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        const SizedBox(height: MmSpace.s12),
        CheckItHeld(attemptId: c.attemptId, questionId: c.questionId),
        const SizedBox(height: MmSpace.s16),
        if (marked || nothing)
          KeyButton(
            label: widget.last ? ReviseCopy.finish : ReviseCopy.nextQuestion,
            onPressed: widget.onNext,
          )
        else
          Align(
            child: KeyButton.quiet(
              label: ReviseCopy.skipCheck,
              onPressed: widget.onNext,
            ),
          ),
      ],
    );
  }
}

/// The lesson recall cards due today, played by the Learn recall run (Revise source 4).
class ReviseCardsKey extends ConsumerStatefulWidget {
  const ReviseCardsKey({super.key, required this.cards});

  final int cards;

  @override
  ConsumerState<ReviseCardsKey> createState() => _ReviseCardsKeyState();
}

class _ReviseCardsKeyState extends ConsumerState<ReviseCardsKey> {
  bool _busy = false;
  String? _message;

  Future<void> _start() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final result = await ref.read(runStarterProvider).start(mode: 'recall');
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = result.message;
    });
    final run = result.run;
    if (run != null) unawaited(context.push<void>(AppRoutes.learnRun(run.id)));
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KeyButton(
          label: ReviseCopy.cardsKey(widget.cards),
          onPressed: _busy ? null : _start,
        ),
        const SizedBox(height: MmSpace.s8),
        Text(
          _message ?? ReviseCopy.cardsNote,
          style: type.small.copyWith(color: colors.ink3),
          textAlign: TextAlign.center,
        ),
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
