import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api_error.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/copy/formatters.dart' show formatTime12;
import '../../../core/motion/motion.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/keycards_models.dart';
import '../data/keycards_providers.dart';
import '../keycards_copy.dart';
import '../widgets/key_card_parts.dart';

/// `/cards`, Key cards home (KEYCARDS-BUILD-SPEC 3 and 4). Opened from Learn and Review; no tab of its own.
///
///   Top     today's due cards and about how long, with the one primary key: Revise now
///   Switch  the student's subjects, and the one-tap option for Mathematics, Computer Science, Accountancy
///   Units   the CUET units, each with its chapters in NCERT order: title, NCERT book and chapter, the chip,
///           the state in words with a shape, "18 cards · 6 due", and on Free "5 of 38 open"
///
/// Without a connection it shows the copy this phone kept, with "As of 9:40 PM" under the title.
class KeyCardsHomeScreen extends ConsumerStatefulWidget {
  const KeyCardsHomeScreen({super.key, this.initialSubject});

  final String? initialSubject;

  @override
  ConsumerState<KeyCardsHomeScreen> createState() => _KeyCardsHomeScreenState();
}

class _KeyCardsHomeScreenState extends ConsumerState<KeyCardsHomeScreen> {
  late String? _subject = widget.initialSubject;
  String? _savingOption;
  String? _optionError;

  Future<void> _setOption(KcSubject subject, String option) async {
    if (_savingOption != null || option == subject.option) return;
    setState(() {
      _savingOption = option;
      _optionError = null;
    });
    try {
      await ref.read(keyCardsApiProvider).setOption(subject: subject.subject, option: option);
      ref.invalidate(keyCardsHomeProvider);
      await ref.read(keyCardsHomeProvider.future);
      if (mounted) setState(() => _savingOption = null);
    } on Object {
      if (mounted) {
        setState(() {
          _savingOption = null;
          _optionError = KeyCardsCopy.optionFailed;
        });
      }
    }
  }

  /// Revise, then today's counts again: the cards rated there have moved on.
  Future<void> _revise() async {
    await context.push<void>(AppRoutes.reviewRevise);
    if (mounted) ref.invalidate(keyCardsHomeProvider);
  }

  Future<void> _open(String chapterKey) async {
    await context.push<void>(AppRoutes.keyCardsChapter(chapterKey));
    if (mounted) ref.invalidate(keyCardsHomeProvider);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final read = ref.watch(keyCardsHomeProvider);
    final data = read.value;
    final asOf = data?.savedAt == null ? null : KeyCardsCopy.asOf(formatTime12(data!.savedAt!.toLocal()));

    final Widget body;
    final String kind;
    if (data != null && data.value.enabled) {
      kind = 'content';
      body = _content(data.value, cached: data.cached);
    } else if (data != null) {
      kind = 'off';
      body = const StateView(kind: StateViewKind.empty, title: KeyCardsCopy.off, message: KeyCardsCopy.offNote);
    } else if (read.hasError && !read.isLoading) {
      final offline = read.error is ApiError && (read.error! as ApiError).isOffline;
      kind = 'error';
      body = StateView(
        kind: offline ? StateViewKind.offline : StateViewKind.error,
        title: KeyCardsCopy.loadFailed,
        message: KeyCardsCopy.loadFailedNote,
        primary: StateAction(KeyCardsCopy.tryAgain, () => ref.invalidate(keyCardsHomeProvider)),
      );
    } else {
      kind = 'loading';
      body = const KcHomeSkeleton();
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
                    if (data?.cached ?? false) const InlineBanner.offlineStrip(message: KeyCardsCopy.offlineCached),
                    MmPageHeader(title: KeyCardsCopy.title, caption: asOf, fallbackRoute: AppRoutes.learnDoor),
                    Expanded(
                      child: MmOverlapSwitcher.fade(
                        alignment: Alignment.topCenter,
                        child: KeyedSubtree(key: ValueKey(kind), child: body),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _content(KcHome home, {required bool cached}) {
    final colors = context.mmColors;
    final type = context.mmType;
    final isPro = ref.watch(authSnapshotProvider.select((s) => s.isPro)) || home.isPro;
    final subjects = home.subjects;
    final subject = subjects.where((s) => s.subject == _subject).firstOrNull ?? subjects.firstOrNull;
    final bottom = MediaQuery.paddingOf(context).bottom + MmSpace.s32;
    final today = home.today;

    return ListView(
      padding: EdgeInsets.fromLTRB(0, MmSpace.s8, 0, bottom),
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
          child: MmSurface.hero(
            lit: today.due > 0,
            padding: const EdgeInsets.fromLTRB(MmSpace.s20, MmSpace.s20, MmSpace.s20, MmSpace.s20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Semantics(header: true, child: Text(today.due > 0 ? KeyCardsCopy.dueHead(today.due) : KeyCardsCopy.nothingDue, style: type.title)),
                const SizedBox(height: MmSpace.s4),
                Text(
                  today.due > 0 ? KeyCardsCopy.aboutMinutes(today.minutes) : KeyCardsCopy.nothingDueNote,
                  style: type.small.copyWith(color: colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
                ),
                if (!isPro && today.reviewsLeft != null) ...[
                  const SizedBox(height: MmSpace.s2),
                  Text(KeyCardsCopy.reviewsLeft(today.reviewsLeft!), style: type.small.copyWith(color: colors.ink3, fontFeatures: const [FontFeature.tabularFigures()])),
                ],
                if (today.due > 0) ...[
                  const SizedBox(height: MmSpace.s16),
                  KeyButton(label: KeyCardsCopy.reviseNow, onPressed: () => unawaited(_revise())),
                ],
              ],
            ),
          ),
        ),
        if (subjects.isEmpty)
          const Padding(
            padding: EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
            child: StateView(kind: StateViewKind.empty, title: KeyCardsCopy.noSubjects, message: KeyCardsCopy.noSubjectsNote),
          )
        else ...[
          const SizedBox(height: MmSpace.s24),
          if (subjects.length > 1) ...[
            ChipRail(
              semanticLabel: KeyCardsCopy.subjectSwitch,
              revealIndex: subjects.indexOf(subject!),
              children: [
                for (final s in subjects)
                  MmChip(label: s.title, selected: s.subject == subject.subject, showBubble: false, onTap: () => setState(() => _subject = s.subject)),
              ],
            ),
            const SizedBox(height: MmSpace.s16),
          ],
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter),
            child: _SubjectBody(
              key: ValueKey('kc-subject-${subject!.subject}'),
              subject: subject,
              isPro: isPro,
              savingOption: _savingOption,
              optionError: _optionError,
              offline: cached,
              onOption: (o) => unawaited(_setOption(subject, o)),
              onOpen: (key) => unawaited(_open(key)),
            ),
          ),
        ],
      ],
    );
  }
}

class _SubjectBody extends StatelessWidget {
  const _SubjectBody({
    super.key,
    required this.subject,
    required this.isPro,
    required this.savingOption,
    required this.optionError,
    required this.offline,
    required this.onOption,
    required this.onOpen,
  });

  final KcSubject subject;
  final bool isPro;
  final String? savingOption;
  final String? optionError;
  final bool offline;
  final ValueChanged<String> onOption;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final options = subject.options;
    final chosen = savingOption ?? subject.option ?? options?.defaultId ?? options?.choices.first.id;
    // A CUET unit that is one chapter of the same name (most of Business Studies) needs no heading of its own.
    bool headed(KcUnit u) => !(u.chapters.length == 1 && u.chapters.first.title == u.unit);
    final rows = <Widget>[];
    for (final unit in subject.units) {
      if (headed(unit)) {
        rows
          ..add(const SizedBox(height: MmSpace.s24))
          ..add(Semantics(header: true, child: Text(unit.unit, style: type.label.copyWith(color: colors.ink2))))
          ..add(const SizedBox(height: MmSpace.s4));
      } else if (rows.isNotEmpty) {
        rows.add(Divider(height: 1, thickness: 1, color: colors.line));
      }
      for (final (i, c) in unit.chapters.indexed) {
        if (i > 0) rows.add(Divider(height: 1, thickness: 1, color: colors.line));
        rows.add(KcChapterRow(chapter: c, isPro: isPro, onTap: () => onOpen(c.key)));
      }
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (options != null) ...[
          // One tap: the student's own part or section of the paper.
          Semantics(header: true, child: Text(options.label, style: type.label.copyWith(color: colors.ink2))),
          const SizedBox(height: MmSpace.s8),
          for (final (i, c) in options.choices.indexed) ...[
            if (i > 0) const SizedBox(height: MmSpace.s8),
            KeyButton.option(
              label: c.label,
              selected: c.id == chosen,
              onPressed: savingOption != null || offline ? null : () => onOption(c.id),
            ),
          ],
          if (savingOption != null || optionError != null) ...[
            const SizedBox(height: MmSpace.s4),
            Semantics(
              liveRegion: true,
              child: Text(optionError ?? KeyCardsCopy.optionSaving, style: type.small.copyWith(color: optionError != null ? colors.warnText : colors.ink2)),
            ),
          ],
          const SizedBox(height: MmSpace.s24),
        ],
        Text(KeyCardsCopy.syllabusNote, style: type.small.copyWith(color: colors.ink3)),
        if (rows.isNotEmpty && rows.first is! SizedBox) const SizedBox(height: MmSpace.s8),
        ...rows,
      ],
    );
  }
}

/// One chapter: its title across the row (the chevron at its right), the NCERT book and chapter and the chip
/// under it, then its state in words on the left and its cards on the right ("8 cards, 5 due", and on Free
/// "5 of 8 open" under it). The title and the book's long names get the whole width; the counts share the
/// state's line, and drop under it when the two do not fit.
class KcChapterRow extends StatelessWidget {
  const KcChapterRow({super.key, required this.chapter, required this.isPro, required this.onTap});

  final KcChapter chapter;
  final bool isPro;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = chapter;
    final count = c.cards == 0 ? KeyCardsCopy.noCardsYet : KeyCardsCopy.cardsDue(c.cards, c.due);
    final open = !isPro && c.cards > 0 ? KeyCardsCopy.openOf(c.unlocked, c.cards) : null;
    final spoken = [c.title, ?c.ncertLine, ?c.chip, c.state.text, count, ?open].join('. ');
    const figures = [FontFeature.tabularFigures()];
    // The chevron's column: the lines under the title stop where the title does.
    const chevronRoom = MmSpace.s8 + 16;
    return MmPressable(
      onTap: onTap,
      pressedScale: 0.985,
      focusRadius: MmRadius.keyAll,
      haptic: MmPressHaptic.selection,
      highlight: true,
      semanticsLabel: spoken,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 64),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(c.title, style: type.cardTitle.copyWith(fontSize: 16, height: 22 / 16))),
                  const SizedBox(width: MmSpace.s8),
                  // The same chevron as every row that opens a page (SPACING 4.3).
                  Padding(padding: const EdgeInsets.only(top: 3), child: Icon(LucideIcons.chevronRight, size: 16, color: colors.ink3)),
                ],
              ),
              if (c.ncertLine != null) ...[
                const SizedBox(height: MmSpace.s2),
                Padding(
                  padding: const EdgeInsets.only(right: chevronRoom),
                  child: Text(c.ncertLine!, style: type.caption.copyWith(color: colors.ink3)),
                ),
              ],
              if (c.chip != null) ...[
                const SizedBox(height: MmSpace.s6),
                Align(alignment: Alignment.centerLeft, child: KcTag(text: c.chip!)),
              ],
              const SizedBox(height: MmSpace.s8),
              Padding(
                padding: const EdgeInsets.only(right: chevronRoom),
                child: Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: MmSpace.s12,
                  runSpacing: MmSpace.s4,
                  children: [
                    KcStateLine(state: c.state),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(count, style: type.small.copyWith(color: colors.ink, fontFeatures: figures)),
                        if (open != null) ...[
                          const SizedBox(height: MmSpace.s2),
                          Text(open, style: type.caption.copyWith(color: colors.ink3, fontFeatures: figures)),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Loading: the head card, the subject switch and chapter rows at about their real heights.
class KcHomeSkeleton extends StatelessWidget {
  const KcHomeSkeleton({super.key});

  static Widget _bar(double width, double height) => Align(alignment: Alignment.centerLeft, child: Skeleton(width: width, height: height));

  @override
  Widget build(BuildContext context) {
    final line = context.mmColors.line;
    return SkeletonGroup(
      label: KeyCardsCopy.loading,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Skeleton(height: 132, radius: 28),
            const SizedBox(height: MmSpace.s24),
            const Row(children: [Skeleton(width: 136, height: 44, radius: 22), SizedBox(width: MmSpace.s8), Skeleton(width: 112, height: 44, radius: 22)]),
            const SizedBox(height: MmSpace.s24),
            _bar(260, 12),
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) Divider(height: 1, thickness: 1, color: line),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _bar(i == 1 ? 180 : 240, 18),
                    const SizedBox(height: MmSpace.s6),
                    _bar(150, 12),
                    const SizedBox(height: MmSpace.s12),
                    _bar(110, 12),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
