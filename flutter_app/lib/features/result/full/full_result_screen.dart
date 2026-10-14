import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/repositories/repositories.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationScope, CelebrationSlot, celebrationControllerProvider;
import '../../review/data/review_providers.dart' show reviewClockProvider;
import '../copy.dart';
import '../data/result_providers.dart';
import '../model/answer_items.dart';
import '../recap/recap_flow.dart' show RecapPlaceholder;
import '../widgets/evidence_link.dart';
import 'full_sections.dart';
import 'summary_section.dart';

/// `/result/:attemptId` (spec 5.7): the complete, readable result without the ritual. Reopening
/// an old result always lands here, never on the seal. [focusQuestion] opens one answer (the
/// question tiles of the recap link here).
class FullResultScreen extends ConsumerStatefulWidget {
  const FullResultScreen({super.key, required this.attemptId, this.focusQuestion});

  final String attemptId;
  final int? focusQuestion;

  @override
  ConsumerState<FullResultScreen> createState() => _FullResultScreenState();
}

class _FullResultScreenState extends ConsumerState<FullResultScreen> {
  final Set<String> _open = {};
  final Map<String, GlobalKey> _keys = {};
  bool _seeded = false;

  /// True once the page has scrolled under the bar: a hairline then marks the bar's lower edge,
  /// so a heading that scrolls up to it never sits flush on the title.
  bool _scrolled = false;

  /// The "Not attempted" group is folded until opened (or until a link lands inside it).
  bool _blankOpen = false;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() => ref.read(resultActionsProvider).markSeen(widget.attemptId));
  }

  GlobalKey _keyFor(String qid) => _keys.putIfAbsent(qid, GlobalKey.new);

  void _seed(AnswerGroups groups) {
    if (_seeded) return;
    _seeded = true;
    final focus = widget.focusQuestion;
    AnswerItem? target;
    if (focus != null) {
      for (final a in groups.all) {
        if (a.number == focus) target = a;
      }
    }
    target ??= groups.wrong.firstOrNull;
    if (target == null) return;
    _open.add(target.qid);
    // A linked blank question sits in the folded "Not attempted" group: open the group on it.
    if (target.verdict == Verdict.blank) _blankOpen = true;
    if (focus != null) {
      final qid = target.qid;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _keys[qid]?.currentContext;
        if (ctx != null && ctx.mounted) Scrollable.ensureVisible(ctx, alignment: 0.08);
      });
    }
  }

  void _toggle(String qid) => setState(() => _open.contains(qid) ? _open.remove(qid) : _open.add(qid));

  void _back() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go(AppRoutes.review);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final id = widget.attemptId;
    final data = ref.watch(recapDataProvider(id));
    final model = data.model;
    final attempt = data.attempt;
    final progress = model == null ? null : ref.watch(recapProgressProvider(id)).value;

    final Widget body;
    if (model == null || attempt == null) {
      body = RecapPlaceholder(data: data, attemptId: id, page: true, onRetry: () => retryRecapData(ref, id));
    } else {
      final groups = buildAnswerGroups(
        attempt,
        detail: data.detail,
        repairedIds: {
          for (final r in ref.watch(repairLocalRecordsProvider).value ?? const <RepairLocalRecord>[])
            if (r.attemptId == id && r.isRepaired && r.isAcknowledged) r.questionId,
        },
        candidateIds: {for (final c in model.candidates) c.questionId},
      );
      _seed(groups);
      final keysOff = model.keysUnavailable || data.detail == null;
      final fix = firstFixSection(context, model);
      // One authored entrance, riding the page's own transition: the figure first, then what
      // it means, then the sections in reading order. A page that is already up never moves,
      // and content that loads after the page has landed is simply there.
      var turn = 0;
      Widget item(Widget child) => MmStaggerItem(index: turn++, child: child);
      // Built in full (not lazily), so a linked question can be scrolled into view.
      body = NotificationListener<ScrollNotification>(
        onNotification: (n) {
          if (n.depth != 0) return false;
          final scrolled = n.metrics.pixels > 4;
          if (scrolled != _scrolled) setState(() => _scrolled = scrolled);
          return false;
        },
        child: SingleChildScrollView(
        // The first line sits 12 dp under the bar (audit X6): the recap link, then 8 to the
        // submitted line, then 12 to the figure.
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s12, MmSpace.gutter, MmSpace.s48),
        child: MmStagger(
          driver: MmStaggerDriver.route,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (data.stale && data.fetchedAt != null) ...[
                InlineBanner(message: ResultCopy.lastLoaded(ref.watch(reviewClockProvider).local(data.fetchedAt!)), tone: BannerTone.offline, compact: true),
                const SizedBox(height: MmRhythm.item),
              ],
              if (progress != null) ...[
                // A quiet text link, flush with the page's gutter: the score leads, this only says
                // where the recap was left.
                Align(
                  alignment: Alignment.centerLeft,
                  child: EvidenceLink(
                    label: ResultCopy.continueRecap(progress),
                    onTap: () => context.go(AppRoutes.resultRecap(id, progress)),
                  ),
                ),
                const SizedBox(height: MmSpace.s8),
              ],
              if (ref.watch(celebrationControllerProvider.select((s) => s.byScope[CelebrationScope.result(id)]?.showsMoment ?? false))) ...[
                // A moment the rhythm module fired for this result; nothing is reserved without one.
                CelebrationSlot(scope: CelebrationScope.result(id)),
                const SizedBox(height: MmSpace.s16),
              ],
              item(SummarySection(model: model)),
              ...annotations(context, model, data, onRetry: () => ref.read(attemptDetailProvider(id).notifier).refresh(force: true)),
              if (!model.isHeld) ...[const SizedBox(height: MmRhythm.section), item(whereSection(context, model))],
              if (fix != null) ...[const SizedBox(height: MmRhythm.section), item(fix)],
              const SizedBox(height: MmRhythm.section),
              item(
                answersSection(
                  context,
                  groups: groups,
                  keysOff: keysOff,
                  isOpen: _open.contains,
                  keyFor: _keyFor,
                  onToggle: _toggle,
                  model: model,
                  blankOpen: _blankOpen,
                  onToggleBlank: () => setState(() => _blankOpen = !_blankOpen),
                ),
              ),
            ],
          ),
        ),
      ),
      );
    }

    return PopScope(
      canPop: context.canPop(),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) context.go(AppRoutes.review);
      },
      child: Scaffold(
        backgroundColor: colors.ground,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
              child: Column(
                children: [
                  _TopBar(
                    title: model?.title ?? '',
                    onBack: _back,
                    // One way back into the recap: "Continue" while it is unfinished, "Replay" once it is done.
                    onReplay: model == null || progress != null ? null : () => context.go(AppRoutes.resultRecap(id, 1)),
                  ),
                  AnimatedOpacity(
                    opacity: _scrolled ? 1 : 0,
                    duration: Motion.of(context, const Duration(milliseconds: 160)),
                    child: Divider(height: 1, thickness: 1, color: colors.line),
                  ),
                  Expanded(child: body),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.title, required this.onBack, this.onReplay});

  final String title;
  final VoidCallback onBack;
  final VoidCallback? onReplay;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // The title wraps to more lines rather than losing its subject to an ellipsis: "Replay
    // recap" and the back key take the rest of the row. The bar is 56 dp for one line.
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          const SizedBox(width: MmSpace.s4),
          MmPressable(
            onTap: onBack,
            semanticsLabel: MaterialLocalizations.of(context).backButtonTooltip,
            focusRadius: MmRadius.pillAll,
            builder: (context, pressed, _) => SizedBox.square(
              dimension: MmTarget.min,
              child: Icon(LucideIcons.arrowLeft, size: 22, color: colors.ink),
            ),
          ),
          const SizedBox(width: MmSpace.s4),
          Expanded(
            child: Semantics(
              header: true,
              child: Text(title, style: context.mmType.title.copyWith(fontSize: 20), maxLines: 3, overflow: TextOverflow.ellipsis),
            ),
          ),
          if (onReplay != null) KeyButton.quiet(label: ResultCopy.replay, onPressed: onReplay),
          const SizedBox(width: MmSpace.s4),
        ],
      ),
    );
  }
}
