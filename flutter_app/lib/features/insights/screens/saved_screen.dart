import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart' show CustomSemanticsAction;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/insights_repository.dart';
import '../data/practice_question.dart';
import '../data/saved_repository.dart';
import '../data/subject_names.dart';
import '../insights_paths.dart';
import '../widgets/gesture_motion.dart';
import '../widgets/insights_bits.dart';
import '../widgets/practice_card.dart';
import '../widgets/rail_bleed.dart';
import '../widgets/saved_bits.dart';

/// `/review/saved` (website Saved): the questions the student kept for another go. Practise
/// them one at a time, or remove one; a removal shows only after the server confirms it, and
/// then the row folds toward the key that removed it while the rows below glide up. Undo
/// unfolds it again.
class SavedScreen extends ConsumerWidget {
  const SavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final state = ref.watch(savedRepositoryProvider);
    final list = state.value;
    Future<void> refresh() => ref.read(savedRepositoryProvider.notifier).refresh(force: true);

    Widget body;
    if (list == null) {
      if (state.isFailedEmpty) {
        final offline = state.error?.isOffline ?? false;
        // A failed load shrugs once (StateView's oops, the first failure of a run); offline rests.
        body = StateView(
          kind: offline ? StateViewKind.offline : StateViewKind.error,
          title: InsightsCopy.savedErrorTitle,
          message: InsightsCopy.savedErrorMessage,
          primary: StateAction(InsightsCopy.retry, refresh),
        );
      } else {
        body = const _SavedSkeleton();
      }
    } else {
      body = SavedBody(list: list, stale: state.isStale, onRefresh: refresh);
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const InsightsHeader(title: InsightsCopy.savedTitle, fallback: AppRoutes.review),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}

/// One row of the saved list as the body tracks it: the question, whether it is shown, and
/// whether it arrived after the list was already on screen (so it unfolds in once).
class SavedRowModel {
  SavedRowModel(this.question, {this.shown = true, this.fresh = false});

  PracticeQuestion question;
  bool shown;
  final bool fresh;
}

/// Merges the server's list with what the server has acknowledged this run, keeping a row that
/// was just removed in place (marked not shown) so it can fold out. Pure, so tests can drive it.
List<SavedRowModel> mergeSavedRows(List<SavedRowModel> previous, List<PracticeQuestion> questions, Map<String, bool> acked, {required bool built}) {
  final want = [for (final q in questions) if (acked[q.id] != false) q];
  final wantIds = {for (final q in want) q.id};
  final prev = {for (final r in previous) r.question.id: r};
  final next = <SavedRowModel>[
    for (final q in want)
      if (prev[q.id] case final old?)
        (old..question = q..shown = true)
      else
        SavedRowModel(q, fresh: built),
  ];
  for (var i = 0; i < previous.length; i++) {
    final r = previous[i];
    if (wantIds.contains(r.question.id)) continue;
    r.shown = false;
    next.insert(i.clamp(0, next.length), r);
  }
  return next;
}

/// The loaded Saved page: the slot meter, subject filter, the list with its fold-out and swipes,
/// and the empty state once the last row has folded away.
class SavedBody extends ConsumerStatefulWidget {
  const SavedBody({super.key, required this.list, required this.stale, required this.onRefresh});

  final SavedList list;
  final bool stale;
  final Future<void> Function() onRefresh;

  @override
  ConsumerState<SavedBody> createState() => _SavedBodyState();
}

class _SavedBodyState extends ConsumerState<SavedBody> with SingleTickerProviderStateMixin {
  List<SavedRowModel> _rows = [];
  bool _built = false;
  String? _subject;
  final MobiController _mobi = MobiController();
  bool _hopped = false;

  /// The subject filter's quick fade (the rows under it swap, the new ones fading in).
  late final AnimationController _fade;

  @override
  void initState() {
    super.initState();
    _fade = AnimationController(vsync: this, duration: const Duration(milliseconds: 220), value: 1);
  }

  @override
  void dispose() {
    _fade.dispose();
    _mobi.dispose();
    super.dispose();
  }

  void _setSubject(String? s) {
    if (s == _subject) return;
    setState(() => _subject = s);
    if (!Motion.reduced(context)) _fade.forward(from: 0);
  }

  void _gone(String id) {
    if (!mounted) return;
    setState(() => _rows = [for (final r in _rows) if (r.shown || r.question.id != id) r]);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final marks = ref.watch(saveControllerProvider);
    final pro = ref.watch(insightsProProvider);
    final list = widget.list;
    final pad = MediaQuery.paddingOf(context);

    // The first server-acknowledged save of the visit (an Undo) gets one small nod from Mobi.
    ref.listen<SaveMarks>(saveControllerProvider, (prev, next) {
      if (_hopped) return;
      final saved = next.acked.entries.any((e) => e.value && prev?.acked[e.key] != true);
      if (saved) {
        _hopped = true;
        // The server confirmed a save: the small nod of the event table, not a hop.
        _mobi.react(MobiMoments.act(MobiEvent.saveConfirmed), key: 'saved:first');
      }
    });

    _rows = mergeSavedRows(_rows, list.questions, marks.acked, built: _built);
    _built = true;
    final subjects = <String>[];
    for (final r in _rows) {
      if (r.shown && !subjects.contains(r.question.subject)) subjects.add(r.question.subject);
    }
    // A filter whose subject has no rows left falls back to all of them.
    final filter = subjects.contains(_subject) ? _subject : null;
    if (filter != _subject) {
      _subject = filter;
    }
    final shownRows = [for (final r in _rows) if (filter == null || r.question.subject == filter) r];

    if (_rows.isEmpty && list.held == 0) return _SavedEmpty(onOpen: () => context.push(InsightsPaths.stream));

    final count = marks.count ?? list.count;
    final limit = pro ? null : (marks.limit ?? freeSaveLimit);
    final live = _rows.where((r) => r.shown).length;
    return MmPullRefresh(
      onRefresh: widget.onRefresh,
      child: ListView(
        // The pull is drawn by the ring, so the list must always take a drag, even when short.
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, pad.bottom + MmSpace.s32),
        children: [
          if (widget.stale) ...[
            const InlineBanner(message: InsightsCopy.staleNote, tone: BannerTone.offline),
            const SizedBox(height: MmSpace.s16),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(InsightsCopy.savedCount(count, limit), style: type.small.copyWith(color: colors.ink2)),
                    // The pips are the free plan's slots; Pro has no limit, so only the count shows.
                    if (limit != null) ...[
                      const SizedBox(height: MmSpace.s8),
                      SlotMeter(count: count, limit: limit),
                    ],
                    if (list.held > 0) ...[
                      const SizedBox(height: MmSpace.s4),
                      Text(InsightsCopy.savedHeld(list.held), style: type.caption.copyWith(color: colors.ink3)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: MmSpace.s12),
              SizedBox(
                width: MobiFigure.widthFor(44),
                height: 44,
                child: MobiCharacter(controller: _mobi, size: 44, entrance: MobiAct.rest, seed: 31, watchTaps: false, shadow: false, interactive: true, tapCycle: MobiTapCycle.standard),
              ),
            ],
          ),
          if (subjects.length > 1) ...[
            const SizedBox(height: MmSpace.s16),
            _SubjectChips(subjects: subjects, selected: filter, onSelect: _setSubject),
          ],
          const SizedBox(height: MmSpace.s16),
          if (live > 0) KeyButton(label: InsightsCopy.savedPractise, onPressed: () => context.push(InsightsPaths.savedStreamFrom(null))),
          const SizedBox(height: MmSpace.s24),
          for (var i = 0; i < shownRows.length; i++)
            FadeTransition(
              key: ValueKey('saved-${shownRows[i].question.id}'),
              opacity: CurvedAnimation(parent: _fade, curve: Motion.out),
              child: FoldExit(
                visible: shownRows[i].shown,
                fresh: shownRows[i].fresh,
                onGone: () => _gone(shownRows[i].question.id),
                child: Column(
                  children: [
                    if (i > 0) Divider(height: 1, color: colors.line),
                    _SavedRow(question: shownRows[i].question, removing: marks.pending.contains(shownRows[i].question.id)),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The subjects that are actually in the list, as chips (never a subject with nothing saved).
class _SubjectChips extends StatelessWidget {
  const _SubjectChips({required this.subjects, required this.selected, required this.onSelect});

  final List<String> subjects;
  final String? selected;
  final ValueChanged<String?> onSelect;

  @override
  Widget build(BuildContext context) {
    final labels = [InsightsCopy.allSubjects, for (final s in subjects) subjectDisplayName(s)];
    final at = selected == null ? 0 : subjects.indexOf(selected!) + 1;
    return RailBleed(
      child: ChipRail.labelled(
        labels: labels,
        selected: at < 0 ? 0 : at,
        onSelected: (i) => onSelect(i == 0 ? null : subjects[i - 1]),
        semanticLabel: InsightsCopy.savedSubjects,
      ),
    );
  }
}

/// One saved question. The whole row practises it (the screen's one dominant action stays
/// "Practise these"); removing is a quiet 48 dp icon at the end, and the removal says so with an
/// Undo, so a slip costs nothing. A swipe does the same two things: right to practise, left to
/// remove, with a tick once it will commit. TalkBack gets both as custom actions.
class _SavedRow extends ConsumerWidget {
  const _SavedRow({required this.question, required this.removing});

  final PracticeQuestion question;
  final bool removing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = question;
    // Captured now: the row leaves the list once the server confirms, before the answer is used.
    final controller = ref.read(saveControllerProvider.notifier);
    final messenger = ScaffoldMessenger.maybeOf(context);
    void say(String text, {SnackBarAction? action}) => messenger
      ?..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(text), behavior: SnackBarBehavior.floating, action: action));

    Future<void> undo() async {
      final outcome = await controller.set(q.id, saved: true, source: 'saved');
      if (outcome is SaveLimitReached) {
        say(InsightsCopy.limitReached);
      } else if (outcome is SaveFailed && !outcome.error.isAccountChanged) {
        say(InsightsCopy.saveFailed);
      }
    }

    Future<void> remove() async {
      final outcome = await controller.set(q.id, saved: false, source: 'saved');
      if (outcome is SaveFailed) {
        if (!outcome.error.isAccountChanged) say(InsightsCopy.saveFailed);
      } else if (outcome is SaveDone) {
        say(InsightsCopy.removedFromSaved, action: SnackBarAction(label: InsightsCopy.undo, onPressed: undo));
      }
    }

    void practise() => context.push(InsightsPaths.savedStreamFrom(q.id));
    final onCoral = colors.isNight ? colors.ground : colors.raised;

    return SwipeCommit(
      enabled: !removing,
      start: SwipeAction(label: InsightsCopy.swipePractise, icon: LucideIcons.play, background: colors.volt, foreground: colors.voltInk, onCommit: practise),
      end: SwipeAction(label: InsightsCopy.swipeRemove, icon: LucideIcons.bookmarkMinus, background: colors.wrongMark, foreground: onCoral, onCommit: remove),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            // One node for TalkBack: the row's own label and button, with the two actions of a
            // swipe offered beside it.
            child: MergeSemantics(
              child: Semantics(
                customSemanticsActions: {
                  CustomSemanticsAction(label: InsightsCopy.practiseThisAction): practise,
                  if (!removing) CustomSemanticsAction(label: InsightsCopy.removeThisAction): remove,
                },
                child: MmPressable(
                onTap: practise,
                semanticsLabel: 'Practise this question: ${q.body}',
                focusRadius: MmRadius.smallAll,
                pressedScale: 0.99,
                highlight: true,
                haptic: MmPressHaptic.selection,
                builder: (context, pressed, _) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SubjectThumb(subject: q.subject),
                      const SizedBox(width: MmSpace.s12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(questionMeta(q), style: type.caption.copyWith(color: colors.ink3)),
                            const SizedBox(height: MmSpace.s4),
                            Text(q.body, style: type.body, maxLines: 3, overflow: TextOverflow.ellipsis),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: MmPressable(
              onTap: removing ? null : remove,
              semanticsLabel: removing ? InsightsCopy.removing : 'Remove this question from saved',
              focusRadius: MmRadius.pillAll,
              haptic: MmPressHaptic.selection,
              builder: (context, pressed, _) => SizedBox.square(
                dimension: MmTarget.min,
                child: Center(
                  // Pending: the bookmark dips inside a turning ring and the row stays fully
                  // readable; no half-faded row.
                  child: removing
                      ? const PendingBookmark()
                      : Icon(LucideIcons.bookmarkMinus, size: 20, color: pressed ? colors.ink : colors.ink2),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Nothing saved: Mobi sits in the saved room, and after 1.2 s points at the way to the stream.
/// He does it once per visit and never under reduced motion, where he stays seated.
class _SavedEmpty extends StatefulWidget {
  const _SavedEmpty({required this.onOpen});

  final VoidCallback onOpen;

  /// How long Mobi reads before he points at the key.
  static const Duration pointAfter = Duration(milliseconds: 1200);

  @override
  State<_SavedEmpty> createState() => _SavedEmptyState();
}

class _SavedEmptyState extends State<_SavedEmpty> {
  final MobiController _mobi = MobiController();
  final GlobalKey _action = GlobalKey(debugLabel: 'saved-empty-action');
  Timer? _point;
  bool _armed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_armed) return;
    _armed = true;
    if (!Motion.reduced(context)) {
      _point = Timer(_SavedEmpty.pointAfter, () {
        if (mounted) _mobi.pointAtWidget(_action);
      });
    }
  }

  @override
  void dispose() {
    _point?.cancel();
    _mobi.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return LayoutBuilder(
      builder: (context, box) {
        final compact = box.hasBoundedHeight && box.maxHeight < 600;
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: box.hasBoundedHeight ? box.maxHeight : 0),
            child: Align(
              alignment: const Alignment(0, -0.16),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Padding(
                  padding: const EdgeInsets.all(MmSpace.s24),
                  child: MmStagger(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // The saved room (the ribbon and two taped notes): where kept questions will
                        // live. Mobi sits in its lit ellipse and still points at the way to the stream.
                        MmStaggerItem(
                          index: 0,
                          rise: 8,
                          child: SceneVignette(scene: StateScene.saved, maxHeight: compact ? 150 : 248, controller: _mobi),
                        ),
                        const SizedBox(height: MmSpace.s12),
                        MmStaggerItem(
                          index: 1,
                          child: Semantics(header: true, child: Text(InsightsCopy.savedEmptyTitle, style: type.title, textAlign: TextAlign.center)),
                        ),
                        const SizedBox(height: MmSpace.s8),
                        MmStaggerItem(
                          index: 2,
                          child: Text(InsightsCopy.savedEmptyMessage, style: type.body.copyWith(color: colors.ink2), textAlign: TextAlign.center),
                        ),
                        const SizedBox(height: MmSpace.s24),
                        MmStaggerItem(
                          index: 3,
                          child: KeyedSubtree(key: _action, child: KeyButton(label: InsightsCopy.savedEmptyAction, onPressed: widget.onOpen)),
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

class _SavedSkeleton extends StatelessWidget {
  const _SavedSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton.line(width: 160),
            SizedBox(height: MmSpace.s16),
            Skeleton(height: 56, radius: MmRadius.panel + MmSpace.s4),
            SizedBox(height: MmSpace.s24),
            MmSkeletonRows(rows: 4),
          ],
        ),
      ),
    );
  }
}
