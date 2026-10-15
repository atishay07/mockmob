import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/lab_loop.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../review/widgets/page_header.dart';
import '../../review/widgets/review_bits.dart' show SectionHeading;
import '../../review/widgets/review_state_view.dart';
import '../copy.dart';
import '../data/rules_data.dart';
import '../widgets/interval_band.dart';
import '../widgets/traps_meet_view.dart';

/// `/review/rules`: the Rule book (Mistake Lab v4 slice 3, spec 4.10). One list, two kinds of
/// rule: the rule and memory hook of each of the student's repairs, grouped by chapter, newest
/// first, and the four rules from how they take papers, each with its one evidence line. Reached
/// from the Lab's Repair step ("Your rules, 7") and from Review.
///
/// One rule at a time: tapping a rule opens its two actions, "Use in my next mock" and Copy. Use
/// asks the server; only its yes moves the rule into the lit card at the top, ticks the confirm
/// haptic and tells a screen reader. Copy puts the words on the clipboard and says Copied.
class RuleBookScreen extends ConsumerStatefulWidget {
  const RuleBookScreen({super.key});

  @override
  ConsumerState<RuleBookScreen> createState() => _RuleBookScreenState();
}

class _RuleBookScreenState extends ConsumerState<RuleBookScreen> {
  /// The rule whose actions are open.
  String? _open;

  /// The rule whose "Use in my next mock" is waiting on the server.
  String? _saving;

  /// The rule a Use failed on, and what to say.
  (String, String)? _error;

  /// The rule just copied (its Copy says Copied for a moment).
  String? _copied;
  Timer? _copiedReset;

  @override
  void initState() {
    super.initState();
    // The book changes with every repair and every mock: read it again each time it opens. The
    // cached copy shows meanwhile.
    scheduleMicrotask(() {
      if (mounted) unawaited(ref.read(rulesRepositoryProvider.notifier).refresh(force: true));
    });
  }

  @override
  void dispose() {
    _copiedReset?.cancel();
    super.dispose();
  }

  void _toggle(String id) => setState(() {
        _open = _open == id ? null : id;
        if (_error?.$1 != id) _error = null;
      });

  Future<void> _use(BookRule rule) async {
    if (_saving != null) return;
    setState(() {
      _saving = rule.id;
      _error = null;
    });
    try {
      final active = await ref.read(playbookApiProvider).use(rule.id);
      if (!mounted) return;
      // The server said yes: only now does anything say so.
      unawaited(ref.read(hapticsProvider).confirm());
      ref.read(rulesRepositoryProvider.notifier).confirmActive(active);
      unawaited(SemanticsService.sendAnnouncement(View.of(context), RulesCopy.usedSpoken(active.text), TextDirection.ltr));
      setState(() {
        _saving = null;
        _open = null;
      });
    } on Object catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = null;
        _error = (rule.id, RulesCopy.useFailed(e));
      });
      // The book on screen is out of date (the rule is gone): read it again.
      if (e is ApiError && e.isDefinitiveRefusal) unawaited(ref.read(rulesRepositoryProvider.notifier).refresh(force: true));
    }
  }

  Future<void> _copy(BookRule rule, RuleBookLabels labels) async {
    final hook = rule is RepairRule ? rule.hook : null;
    await Clipboard.setData(ClipboardData(text: hook == null ? rule.text : '${rule.text}\n${labels.hook} $hook'));
    if (!mounted) return;
    unawaited(ref.read(hapticsProvider).tick());
    unawaited(SemanticsService.sendAnnouncement(View.of(context), RulesCopy.copiedSpoken, TextDirection.ltr));
    _copiedReset?.cancel();
    setState(() => _copied = rule.id);
    _copiedReset = Timer(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _copied = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final rules = ref.watch(rulesRepositoryProvider);
    final book = rules.value?.book;
    final pad = MediaQuery.paddingOf(context);

    final Widget body;
    if (book == null) {
      final failed = rules.isFailedEmpty || (rules.value != null && !rules.loading);
      body = failed
          ? ReviewStateView(
              kind: (rules.error?.isOffline ?? false) ? StateViewKind.offline : StateViewKind.error,
              title: RulesCopy.loadFailed,
              primary: StateAction(RulesCopy.tryAgain, () => ref.read(rulesRepositoryProvider.notifier).refresh(force: true)),
            )
          : const _BookSkeleton();
    } else {
      body = RuleBookBody(
        book: book,
        open: _open,
        saving: _saving,
        error: _error,
        copied: _copied,
        onToggle: _toggle,
        onUse: _use,
        onCopy: (rule) => _copy(rule, book.labels),
        bottomPadding: pad.bottom + MmSpace.s32,
      );
    }

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          Positioned(left: 0, right: 0, top: 0, height: 360, child: IgnorePointer(child: LightField.lamp(context, strength: 0.55))),
          SafeArea(
            bottom: false,
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    PageHeader(title: book?.title ?? RulesCopy.title, notice: rules.isStale ? RulesCopy.offlineNotice : null),
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

/// The book itself, laid out (the screen's state, the goldens and the tests drive it).
class RuleBookBody extends StatelessWidget {
  const RuleBookBody({
    super.key,
    required this.book,
    required this.onToggle,
    required this.onUse,
    required this.onCopy,
    this.open,
    this.saving,
    this.error,
    this.copied,
    this.bottomPadding = MmSpace.s32,
    this.scrollable = true,
  });

  final RuleBook book;
  final String? open;
  final String? saving;
  final (String, String)? error;
  final String? copied;
  final ValueChanged<String> onToggle;
  final ValueChanged<BookRule> onUse;
  final ValueChanged<BookRule> onCopy;
  final double bottomPadding;

  /// False lays the book out as a plain column (goldens put it in their own frame).
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final labels = book.labels;

    Widget row(BookRule rule) => RuleRow(
          rule: rule,
          labels: labels,
          open: open == rule.id,
          saving: saving == rule.id,
          busy: saving != null,
          error: error?.$1 == rule.id ? error!.$2 : null,
          copied: copied == rule.id,
          onToggle: () => onToggle(rule.id),
          onUse: () => onUse(rule),
          onCopy: () => onCopy(rule),
        );

    List<Widget> rows(List<BookRule> list) => [
          for (var i = 0; i < list.length; i++) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
            row(list[i]),
          ],
        ];

    final sections = <Widget>[
      _InForce(active: book.active, labels: labels),
      // From your repairs: by chapter, newest first.
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s32),
        child: SectionHeading(labels.repairsTitle),
      ),
      if (book.repairs.chapters.isEmpty)
        _QuietLine(text: book.repairs.empty ?? '')
      else
        for (final (i, chapter) in book.repairs.chapters.indexed)
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: EdgeInsets.only(top: i == 0 ? 0 : MmSpace.s20, bottom: MmSpace.s4),
                child: Text(chapter.chapter, style: type.label.copyWith(color: colors.ink2)),
              ),
              ...rows(chapter.rules),
            ],
          ),
      // From how you take papers: the four habits, or the gate.
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s32),
        child: SectionHeading(labels.habitsTitle, rule: true),
      ),
      if (!book.habits.isReady || book.habits.rules.isEmpty)
        _QuietLine(text: book.habits.gateLine ?? '', dashed: true)
      else
        ...rows(book.habits.rules),
      if (book.basis != null)
        Padding(
          padding: const EdgeInsets.only(top: MmSpace.s20),
          child: Text(book.basis!, style: type.small.copyWith(color: colors.ink3)),
        ),
      // Traps you meet (slice 4, spec 4.11): the named traps across mocks, behind a disclosure.
      Padding(
        padding: const EdgeInsets.only(top: MmSpace.s32),
        child: SectionHeading(RulesCopy.trapsTitle, rule: true),
      ),
      const TrapsMeetView(),
    ];

    if (!scrollable) {
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: sections);
    }
    return MmStagger(
      driver: MmStaggerDriver.route,
      child: ListView(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, bottomPadding),
        children: [for (final (i, s) in sections.indexed) MmStaggerItem(index: i.clamp(0, 6), child: s)],
      ),
    );
  }
}

/// The rule in force for the next mock, lit at the top with the volt rail of a kept rule; or,
/// before one is chosen, nothing but the space the book starts in.
class _InForce extends StatelessWidget {
  const _InForce({required this.active, required this.labels});

  final RuleRef? active;
  final RuleBookLabels labels;

  static Path _rail(Size size) => Path()
    ..moveTo(size.width / 2, 0)
    ..lineTo(size.width / 2, size.height);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final rule = active;
    return AnimatedSwitcher(
      duration: Motion.of(context, Motion.card),
      switchInCurve: Motion.out,
      switchOutCurve: Motion.exit,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(animation), child: child),
      ),
      layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
      child: rule == null
          ? const SizedBox(key: ValueKey('none'), width: double.infinity)
          : Semantics(
              key: ValueKey(rule.id),
              container: true,
              label: '${labels.inUse}. ${rule.text}',
              child: ExcludeSemantics(
                child: MmSurface.hero(
                  lit: true,
                  padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s20, MmSpace.s20, MmSpace.s20),
                  child: IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          width: 4,
                          child: RepaintBoundary(
                            child: MmStrokeDraw(path: _rail, color: colors.volt, strokeWidth: 3, delay: const Duration(milliseconds: 160)),
                          ),
                        ),
                        const SizedBox(width: MmSpace.s12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(labels.inUse, style: type.label.copyWith(color: colors.ink2)),
                              const SizedBox(height: MmSpace.s8),
                              Text(rule.text, style: type.title.copyWith(fontSize: 21, height: 27 / 21)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );
  }
}

/// A line where a section has nothing to list: the server's sentence, quiet.
class _QuietLine extends StatelessWidget {
  const _QuietLine({required this.text, this.dashed = false});

  final String text;
  final bool dashed;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    if (text.isEmpty) return const SizedBox.shrink();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (dashed) ...[
          Padding(padding: const EdgeInsets.only(top: 3), child: Icon(LucideIcons.circleDashed, size: 18, color: colors.ink3)),
          const SizedBox(width: MmSpace.s8),
        ],
        Expanded(child: Text(text, style: context.mmType.body.copyWith(color: colors.ink2))),
      ],
    );
  }
}

/// One rule: its words, then its evidence (a habit) or its memory hook (a repair). The rule in
/// force wears the "Your rule for your next mock" tag. Tapped, it opens its actions under it.
class RuleRow extends StatelessWidget {
  const RuleRow({
    super.key,
    required this.rule,
    required this.labels,
    required this.open,
    required this.onToggle,
    required this.onUse,
    required this.onCopy,
    this.saving = false,
    this.busy = false,
    this.error,
    this.copied = false,
  });

  final BookRule rule;
  final RuleBookLabels labels;
  final bool open;

  /// This rule's Use is waiting on the server.
  final bool saving;

  /// Some rule's Use is waiting: no other may start.
  final bool busy;
  final String? error;
  final bool copied;
  final VoidCallback onToggle;
  final VoidCallback onUse;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final r = rule;
    final (String? detail, bool gated) = switch (r) {
      HabitRule() => (r.evidence, r.gated),
      RepairRule(:final hook?) => ('${labels.hook} $hook', false),
      RepairRule() => (null, false),
    };
    final interval = r is HabitRule && !r.gated ? r.interval : null;
    final spoken = [r.text, ?detail, if (interval != null) IntervalBand.lineOf(interval), if (r.active) labels.inUse].join('. ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MmPressable(
          onTap: onToggle,
          semanticsLabel: RulesCopy.rowSpoken(spoken, open: open),
          selected: open,
          pressedScale: 0.99,
          focusRadius: MmRadius.smallAll,
          haptic: MmPressHaptic.selection,
          highlight: true,
          builder: (context, pressed, _) => Padding(
            padding: const EdgeInsets.symmetric(vertical: MmSpace.s16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(r.text, style: type.cardTitle.copyWith(fontSize: 16, height: 22 / 16)),
                      if (detail != null) ...[
                        const SizedBox(height: MmSpace.s4),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (gated) ...[
                              Padding(padding: const EdgeInsets.only(top: 2), child: Icon(LucideIcons.circleDashed, size: 16, color: colors.ink3)),
                              const SizedBox(width: MmSpace.s6),
                            ],
                            Expanded(child: Text(detail, style: type.small.copyWith(color: gated ? colors.ink3 : colors.ink2))),
                          ],
                        ),
                      ],
                      // The 95% interval behind a habit's evidence, drawn as a band (never on a gated habit).
                      if (interval != null) ...[
                        const SizedBox(height: MmSpace.s12),
                        IntervalBand(interval: interval),
                      ],
                      if (r.active) ...[
                        const SizedBox(height: MmSpace.s8),
                        _InUseTag(label: labels.inUse),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: MmSpace.s8),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: AnimatedRotation(
                    turns: open ? 0.5 : 0,
                    duration: Motion.of(context, Motion.ui),
                    curve: Motion.out,
                    child: Icon(LucideIcons.chevronDown, size: 18, color: colors.ink3),
                  ),
                ),
              ],
            ),
          ),
        ),
        MmSizeEase(
          duration: Motion.of(context, Motion.card),
          curve: Motion.out,
          alignment: Alignment.topCenter,
          child: !open
              ? const SizedBox(width: double.infinity)
              : Padding(
                  padding: const EdgeInsets.only(bottom: MmSpace.s16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: MmSpace.s8,
                        runSpacing: MmSpace.s8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (!r.active)
                            KeyButton.secondary(
                              label: labels.use,
                              expanded: false,
                              loading: saving,
                              semanticsLabel: saving ? RulesCopy.saving : '${labels.use}: ${r.text}',
                              onPressed: busy ? null : onUse,
                            ),
                          KeyButton.quiet(
                            label: copied ? RulesCopy.copied : RulesCopy.copy,
                            semanticsLabel: copied ? RulesCopy.copiedSpoken : RulesCopy.copySpoken(r.text),
                            onPressed: onCopy,
                          ),
                        ],
                      ),
                      if (error != null) ...[
                        const SizedBox(height: MmSpace.s8),
                        Semantics(
                          liveRegion: true,
                          child: Text(error!, style: type.small.copyWith(color: colors.warnText)),
                        ),
                      ],
                    ],
                  ),
                ),
        ),
      ],
    );
  }
}

/// "Your rule for your next mock", with a check that draws in when the tag first appears.
class _InUseTag extends StatelessWidget {
  const _InUseTag({required this.label});

  final String label;

  static Path _check(Size size) => MmPaths.check(Offset.zero & size);

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox.square(dimension: 16, child: MmStrokeDraw(path: _check, color: colors.accentText, strokeWidth: 2)),
        const SizedBox(width: MmSpace.s6),
        Flexible(child: Text(label, style: context.mmType.label.copyWith(color: colors.accentText))),
      ],
    );
  }
}

/// Loading: the lit card, a heading and three rule rows, at the real heights.
class _BookSkeleton extends StatelessWidget {
  const _BookSkeleton();

  @override
  Widget build(BuildContext context) {
    return const SkeletonGroup(
      label: RulesCopy.loading,
      child: Padding(
        padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Skeleton(height: 104, radius: 28),
            SizedBox(height: MmSpace.s32),
            Skeleton.line(width: 180, height: 22),
            SizedBox(height: MmSpace.s20),
            MmSkeletonRows(rows: 3),
          ],
        ),
      ),
    );
  }
}
