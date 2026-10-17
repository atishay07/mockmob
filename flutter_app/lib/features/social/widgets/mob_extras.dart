import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/haptics/haptics.dart';
import '../../../core/models/subject.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../practice/data/practice_catalog.dart' show practiceChaptersProvider, practiceSubjectsProvider;
import '../../you/widgets/you_page.dart';
import '../../you/widgets/you_row.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../mob_routes.dart';
import 'mob_parts.dart';

/// Extra papers (Pro makes them, any member sits them). A paper on a chosen chapter and length,
/// beyond the weekly one. They close 7 days after they were made, cost no credits and count nothing
/// toward the ring (the ring is the weekly paper). Every rule is on the server; this draws what it
/// was given. Nothing is drawn for a free student when there are none.
class MobExtrasSection extends ConsumerWidget {
  const MobExtrasSection({super.key, required this.mob, required this.onSit, this.busyExtra});

  final Mob mob;

  /// Sits one of the Mob's extra papers (the page owns the start, so one start runs at a time).
  final Future<void> Function(MobExtra) onSit;
  final String? busyExtra;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final extras = mob.extras;
    if (!mob.plan.canMakeExtra && extras.isEmpty) return const SizedBox.shrink();
    final type = context.mmType;
    final colors = context.mmColors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupHeading(MobCopy.extrasTitle, trailing: extras.isEmpty ? null : Padding(padding: const EdgeInsets.only(right: MmSpace.gutter - MmSpace.s4), child: Text(countLabel(extras.length, 'paper'), style: type.small.copyWith(color: colors.ink2)))),
        if (extras.isEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, 0, MmSpace.gutter, MmSpace.s8),
            child: MobNote(MobCopy.extrasEmpty),
          )
        else
          Padding(
            padding: youGutter,
            child: Column(
              children: [
                for (var i = 0; i < extras.length; i++) ...[
                  if (i > 0) Divider(height: 1, color: colors.line),
                  _ExtraRow(mob: mob, extra: extras[i], busy: busyExtra == extras[i].id, onSit: () => onSit(extras[i])),
                ],
              ],
            ),
          ),
        if (mob.plan.canMakeExtra)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: YouPanel(
              flat: true,
              inset: 28 + MmSpace.s16,
              children: [
                YouRow(
                  flat: true,
                  icon: LucideIcons.plus,
                  title: MobCopy.makeExtra,
                  onTap: () => showMmSheet<void>(context: context, title: MobCopy.makeExtraSheetTitle, builder: (_) => ExtraSheet(mob: mob)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _ExtraRow extends ConsumerWidget {
  const _ExtraRow({required this.mob, required this.extra, required this.busy, required this.onSit});

  final Mob mob;
  final MobExtra extra;
  final bool busy;
  final VoidCallback onSit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final type = context.mmType;
    final colors = context.mmColors;
    final cmp = extra.compare;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobCopy.extraTitleOf(extra), style: type.body.copyWith(color: colors.ink, fontWeight: FontWeight.w600)),
          const SizedBox(height: MmSpace.s2),
          Text('${MobCopy.extraWhen(extra)} ${MobCopy.extraSat(extra, mob.week.size)}', style: type.small.copyWith(color: colors.ink2)),
          if (cmp?.teaser != null) Text(cmp!.teaser!.text, style: type.small.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            children: [
              if (!extra.youSat && !extra.closed) PillKey(label: busy ? MobCopy.openingPaper : MobCopy.sitIt, onPressed: busy ? null : onSit),
              if (extra.youSat && extra.yourResultId != null)
                PillKey(label: MobCopy.seeAnswers, onPressed: () => ref.read(mobNavigatorProvider).openAnswers(context, extra.yourResultId!)),
              if (extra.youSat && cmp != null && cmp.available && !cmp.locked) _SideBySideKey(extra: extra),
            ],
          ),
        ],
      ),
    );
  }
}

class _SideBySideKey extends ConsumerStatefulWidget {
  const _SideBySideKey({required this.extra});

  final MobExtra extra;

  @override
  ConsumerState<_SideBySideKey> createState() => _SideBySideKeyState();
}

class _SideBySideKeyState extends ConsumerState<_SideBySideKey> {
  bool _busy = false;

  Future<void> _open() async {
    setState(() => _busy = true);
    final (compare, failure) = await ref.read(mobActionsProvider).compare(extra: widget.extra.id);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure != null) {
      showMobToast(context, MobCopy.failure(failure));
    } else if (compare != null) {
      await openMobCompare(context, compare, extra: widget.extra.id);
    }
  }

  @override
  Widget build(BuildContext context) => PillKey(label: _busy ? MobCopy.opening : MobCopy.sideBySide, onPressed: _busy ? null : _open);
}

/// Make an extra paper (Pro): a length and, optionally, one chapter of the Mob's subject.
class ExtraSheet extends ConsumerStatefulWidget {
  const ExtraSheet({super.key, required this.mob});

  final Mob mob;

  @override
  ConsumerState<ExtraSheet> createState() => _ExtraSheetState();
}

class _ExtraSheetState extends ConsumerState<ExtraSheet> {
  int _count = 10;
  String? _chapter;
  bool _busy = false;
  String? _error;

  /// The stored subject id the Mob carries, as the chapters route knows it (the public id).
  String get _publicSubject {
    final subjects = ref.read(practiceSubjectsProvider).value ?? const <Subject>[];
    for (final s in subjects) {
      if (s.internalId == widget.mob.subject) return s.id;
    }
    return widget.mob.subject;
  }

  Future<void> _pickChapter() async {
    final picked = await showMmSheet<String>(
      context: context,
      title: MobCopy.chapterOf(widget.mob.subjectName),
      heightFactor: 0.86,
      builder: (_) => MobChapterList(subjectId: _publicSubject, selected: _chapter),
    );
    if (!mounted || picked == null) return;
    setState(() {
      _chapter = picked.isEmpty ? null : picked;
      _error = null;
    });
  }

  Future<void> _make() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final (id, failure) = await ref.read(mobActionsProvider).createExtra(chapter: _chapter, count: _count);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure != null) {
      setState(() => _error = MobCopy.failure(failure));
    } else {
      ref.read(hapticsProvider).confirm();
      Navigator.of(context).pop(id);
    }
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(MobCopy.chapterOf(widget.mob.subjectName), style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          MobChoiceRow(
            icon: LucideIcons.bookOpen,
            label: _chapter ?? MobCopy.wholeSubject,
            onTap: _busy ? null : _pickChapter,
          ),
          const SizedBox(height: MmSpace.s16),
          Text(MobCopy.lengthLabel, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            children: [
              for (final n in MobCopy.extraLengths) MmChip(label: MobCopy.questionsN(n), selected: _count == n, onTap: _busy ? null : () => setState(() => _count = n)),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          MobNote(MobCopy.extraNote),
          if (_error != null) ...[
            const SizedBox(height: MmSpace.s8),
            InlineBanner(message: _error!, tone: BannerTone.error),
          ],
          const SizedBox(height: MmSpace.s16),
          KeyButton(label: _busy ? MobCopy.makingPaper : MobCopy.makePaper, loading: _busy, onPressed: _busy ? null : _make),
          const SizedBox(height: MmSpace.s16),
        ],
      ),
    );
  }
}

/// A 56 dp row that opens a chooser: an icon, the current choice and a chevron.
class MobChoiceRow extends StatelessWidget {
  const MobChoiceRow({super.key, required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      focusRadius: MmRadius.keyAll,
      pressedScale: 0.985,
      haptic: MmPressHaptic.selection,
      semanticsLabel: label,
      builder: (context, pressed, _) => DecoratedBox(
        decoration: ShapeDecoration(
          color: pressed ? colors.raised2 : colors.raised,
          shape: RoundedSuperellipseBorder(borderRadius: MmRadius.keyAll, side: BorderSide(color: colors.lineStrong)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: MmTarget.option),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
            child: Row(
              children: [
                Icon(icon, size: 18, color: colors.ink2),
                const SizedBox(width: MmSpace.s12),
                Expanded(child: Text(label, style: type.labelLarge.copyWith(color: colors.ink))),
                Icon(LucideIcons.chevronRight, size: 18, color: colors.ink3),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One chapter of the Mob's subject, by name (the server takes names), grouped by unit with search.
/// A tap chooses it and closes the sheet; "Whole subject" chooses none (an empty string).
class MobChapterList extends ConsumerStatefulWidget {
  const MobChapterList({super.key, required this.subjectId, this.selected});

  final String subjectId;
  final String? selected;

  @override
  ConsumerState<MobChapterList> createState() => _MobChapterListState();
}

class _MobChapterListState extends ConsumerState<MobChapterList> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final chapters = ref.watch(practiceChaptersProvider(widget.subjectId));
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: chapters.when(
        loading: () => SkeletonGroup(
          label: 'Loading chapters',
          child: Column(children: [for (var i = 0; i < 6; i++) const Padding(padding: EdgeInsets.symmetric(vertical: MmSpace.s12), child: Skeleton.line(height: 16))]),
        ),
        error: (error, _) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(error is ApiError && error.isOffline ? 'You\'re offline, so the chapters didn\'t load.' : 'The chapters didn\'t load.', style: type.body.copyWith(color: colors.ink2)),
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: MobCopy.tryAgain, onPressed: () => ref.invalidate(practiceChaptersProvider(widget.subjectId))),
          ],
        ),
        data: (catalog) {
          final q = _query.trim().toLowerCase();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                onChanged: (v) => setState(() => _query = v),
                textInputAction: TextInputAction.search,
                style: type.body.copyWith(color: colors.ink),
                decoration: const InputDecoration(labelText: 'Search chapters', prefixIcon: Icon(LucideIcons.search, size: 18)),
              ),
              const SizedBox(height: MmSpace.s8),
              if (q.isEmpty) _ChapterTile(label: MobCopy.wholeSubject, selected: widget.selected == null, onTap: () => Navigator.of(context).pop('')),
              for (final unit in catalog.units) ...[
                if (unit.name.isNotEmpty && unit.chapters.any((c) => q.isEmpty || c.name.toLowerCase().contains(q)))
                  Padding(
                    padding: const EdgeInsets.only(top: MmSpace.s16, bottom: MmSpace.s4),
                    child: Semantics(header: true, child: Text(unit.name, style: type.label.copyWith(color: colors.ink3))),
                  ),
                for (final c in unit.chapters)
                  if (q.isEmpty || c.name.toLowerCase().contains(q))
                    _ChapterTile(label: c.name, selected: widget.selected == c.name, onTap: () => Navigator.of(context).pop(c.name)),
              ],
              const SizedBox(height: MmSpace.s24),
            ],
          );
        },
      ),
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      semanticsLabel: label,
      selected: selected,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              Expanded(child: Text(label, style: type.body.copyWith(color: colors.ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w400))),
              if (selected) Icon(LucideIcons.check, size: 18, color: colors.accentText),
            ],
          ),
        ),
      ),
    );
  }
}
