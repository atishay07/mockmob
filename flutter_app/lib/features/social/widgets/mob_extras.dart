import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../pro_nudge/pro_nudge.dart' show proNudgesOnProvider;
import '../../you/widgets/you_page.dart';
import '../../you/widgets/you_row.dart';
import '../copy.dart';
import '../data/mob_models.dart';
import '../data/mob_navigator.dart';
import '../data/mob_repository.dart';
import '../mob_routes.dart';
import 'mob_parts.dart';
import 'mob_pro_entry.dart';

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
        if (!mob.plan.canMakeExtra && extras.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, 0),
            child: MobNote(MobCopy.extrasOpenToAllFor(sell: ref.watch(proNudgesOnProvider))),
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
      sayMobFailure(context, failure, ref.read(mobActionsProvider).say(failure));
    } else if (compare != null) {
      await openMobCompare(context, compare, extra: widget.extra.id);
    }
  }

  @override
  Widget build(BuildContext context) => PillKey(label: _busy ? MobCopy.opening : MobCopy.sideBySide, onPressed: _busy ? null : _open);
}

/// Make an extra paper (Pro): a length and, optionally, one chapter of the Mob's subject. The chapters
/// come from the server (`GET /api/mob/extra`) and are only those the bank can really build a paper
/// from, each with the longest paper it can make, so "10 ready" never builds nothing. The whole
/// subject always works. If a chapter still cannot fill the paper (BANK_THIN) the server says how many
/// questions are ready and the nearest paper that can be made, and one key makes that.
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
  MobSuggestion? _suggest;
  MobChapters? _chapters;
  bool _loading = true;
  bool _chaptersFailed = false;

  @override
  void initState() {
    super.initState();
    _loadChapters();
  }

  Future<void> _loadChapters() async {
    final (chapters, failure) = await ref.read(mobActionsProvider).chapters();
    if (!mounted) return;
    setState(() {
      _loading = false;
      _chapters = chapters;
      // A failed read leaves the whole subject, which always works.
      _chaptersFailed = failure != null || chapters == null;
    });
  }

  List<int> get _lengths {
    final l = _chapters?.lengths ?? const <int>[];
    return l.isEmpty ? MobCopy.extraLengths : l;
  }

  /// The longest paper the picked chapter can build (null: the whole subject, or nothing known).
  int? get _longest => _chapters?.named(_chapter)?.longest;

  Future<void> _pickChapter() async {
    final chapters = _chapters;
    if (chapters == null) return;
    final picked = await showMmSheet<String>(
      context: context,
      title: MobCopy.chapterOf(widget.mob.subjectName),
      heightFactor: 0.86,
      builder: (_) => MobChapterList(chapters: chapters, selected: _chapter),
    );
    if (!mounted || picked == null) return;
    setState(() {
      _chapter = picked.isEmpty ? null : picked;
      _error = null;
      _suggest = null;
      // A shorter paper than asked is what this chapter can build.
      final longest = _longest;
      if (longest != null && _count > longest) _count = longest;
    });
  }

  Future<void> _make() async {
    setState(() {
      _busy = true;
      _error = null;
      _suggest = null;
    });
    final actions = ref.read(mobActionsProvider);
    final (id, failure) = await actions.createExtra(chapter: _chapter, count: _count);
    if (!mounted) return;
    setState(() => _busy = false);
    if (failure != null) {
      setState(() {
        _error = actions.say(failure);
        _suggest = failure == MobFailure.bankThin ? actions.suggestion : null;
      });
    } else {
      ref.read(hapticsProvider).confirm();
      Navigator.of(context).pop(id);
    }
  }

  Future<void> _makeSuggested() async {
    final s = _suggest;
    if (s == null) return;
    setState(() {
      _chapter = s.chapter;
      _count = s.count;
    });
    await _make();
  }

  String get _hint {
    if (_loading) return MobCopy.chaptersLoading;
    if (_chaptersFailed) return MobCopy.chaptersFailed;
    final longest = _longest;
    if (_chapter != null && longest != null) return MobCopy.chapterReady(longest);
    return (_chapters?.chapters.isNotEmpty ?? false) ? MobCopy.chaptersOnly : MobCopy.chaptersNone;
  }

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    final canPick = !_busy && !_loading && !_chaptersFailed && (_chapters?.chapters.isNotEmpty ?? false);
    final longest = _longest;
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
            onTap: canPick ? _pickChapter : null,
          ),
          const SizedBox(height: MmSpace.s4),
          MobNote(_hint),
          const SizedBox(height: MmSpace.s16),
          Text(MobCopy.lengthLabel, style: type.label.copyWith(color: colors.ink2)),
          const SizedBox(height: MmSpace.s8),
          Wrap(
            spacing: MmSpace.s8,
            runSpacing: MmSpace.s4,
            children: [
              for (final n in _lengths)
                MmChip(
                  label: MobCopy.questionsN(n),
                  selected: _count == n,
                  // A length the picked chapter cannot fill is not offered.
                  onTap: _busy || (longest != null && n > longest)
                      ? null
                      : () => setState(() {
                            _count = n;
                            _error = null;
                            _suggest = null;
                          }),
                ),
            ],
          ),
          const SizedBox(height: MmSpace.s12),
          MobNote(MobCopy.extraNote),
          if (_error != null) ...[
            const SizedBox(height: MmSpace.s8),
            InlineBanner(message: _error!, tone: BannerTone.error),
          ],
          if (_suggest != null) ...[
            const SizedBox(height: MmSpace.s8),
            KeyButton.secondary(label: MobCopy.suggestKey(_suggest!), onPressed: _busy ? null : _makeSuggested),
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

/// The chapters of the Mob's subject the bank can build a paper from, by name (the server takes
/// names), most questions first as the server sends them, each with the longest paper it can make,
/// and a search. A tap chooses one and closes the sheet; "Whole subject" chooses none (an empty
/// string).
class MobChapterList extends StatefulWidget {
  const MobChapterList({super.key, required this.chapters, this.selected});

  final MobChapters chapters;
  final String? selected;

  @override
  State<MobChapterList> createState() => _MobChapterListState();
}

class _MobChapterListState extends State<MobChapterList> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final q = _query.trim().toLowerCase();
    final shown = [for (final c in widget.chapters.chapters) if (q.isEmpty || c.chapter.toLowerCase().contains(q)) c];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: MmSpace.sheetSide),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            onChanged: (v) => setState(() => _query = v),
            textInputAction: TextInputAction.search,
            style: type.body.copyWith(color: colors.ink),
            decoration: const InputDecoration(labelText: MobCopy.searchChapters, prefixIcon: Icon(LucideIcons.search, size: 18)),
          ),
          const SizedBox(height: MmSpace.s8),
          if (q.isEmpty) _ChapterTile(label: MobCopy.wholeSubject, selected: widget.selected == null, onTap: () => Navigator.of(context).pop('')),
          for (final c in shown)
            _ChapterTile(
              label: c.chapter,
              note: c.longest == null ? null : MobCopy.chapterUpTo(c.longest!),
              selected: widget.selected == c.chapter,
              onTap: () => Navigator.of(context).pop(c.chapter),
            ),
          const SizedBox(height: MmSpace.s24),
        ],
      ),
    );
  }
}

class _ChapterTile extends StatelessWidget {
  const _ChapterTile({required this.label, required this.selected, required this.onTap, this.note});

  final String label;
  final String? note;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return MmPressable(
      onTap: onTap,
      haptic: MmPressHaptic.selection,
      semanticsLabel: note == null ? label : '$label, $note',
      selected: selected,
      builder: (context, pressed, _) => ConstrainedBox(
        constraints: const BoxConstraints(minHeight: MmTarget.min),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: MmSpace.s8),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: type.body.copyWith(color: colors.ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w400)),
                    if (note != null) Text(note!, style: type.small.copyWith(color: colors.ink2)),
                  ],
                ),
              ),
              if (selected) Icon(LucideIcons.check, size: 18, color: colors.accentText),
            ],
          ),
        ),
      ),
    );
  }
}
