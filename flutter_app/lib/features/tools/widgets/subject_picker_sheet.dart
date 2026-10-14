import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../domain/du_helpers.dart';
import '../domain/du_models.dart';
import 'action_chip.dart';
import 'tools_page.dart';

/// Reads the current choice inside the sheet, so it rebuilds as chips are ticked.
typedef WatchPicks = Set<DuPick> Function(WidgetRef ref);

/// Opens the CUET subject picker: a finder that maps the names students know ("IP", "Book
/// Keeping") to the one subject DU and NTA count, quick-start presets, then List A, List B and
/// the aptitude test as answer-sheet chips. Changes apply as they are ticked.
Future<void> showSubjectPicker({
  required BuildContext context,
  required DuCatalog catalog,
  required WatchPicks watch,
  required ValueChanged<DuPick> onToggle,
  ValueChanged<DuPreset>? onPreset,
  VoidCallback? onClear,
  int? limit,
  String? limitNote,
}) {
  return showMmSheet<void>(
    context: context,
    title: ToolsCopy.pickerTitle,
    heightFactor: 0.92,
    builder: (context) => _PickerBody(
      catalog: catalog,
      watch: watch,
      onToggle: onToggle,
      onPreset: onPreset,
      onClear: onClear,
      limit: limit,
      limitNote: limitNote,
    ),
    footer: (context) => Consumer(
      builder: (context, ref, _) {
        final n = watch(ref).length;
        return Row(
          children: [
            Expanded(
              child: Text(
                limit == null ? ToolsCopy.selectedCount(n) : '$n of $limit',
                style: context.mmType.labelLarge.copyWith(color: context.mmColors.ink2),
              ),
            ),
            KeyButton(label: ToolsCopy.done, expanded: false, onPressed: () => Navigator.of(context).maybePop()),
          ],
        );
      },
    ),
  );
}

class _PickerBody extends ConsumerStatefulWidget {
  const _PickerBody({
    required this.catalog,
    required this.watch,
    required this.onToggle,
    this.onPreset,
    this.onClear,
    this.limit,
    this.limitNote,
  });

  final DuCatalog catalog;
  final WatchPicks watch;
  final ValueChanged<DuPick> onToggle;
  final ValueChanged<DuPreset>? onPreset;
  final VoidCallback? onClear;
  final int? limit;
  final String? limitNote;

  @override
  ConsumerState<_PickerBody> createState() => _PickerBodyState();
}

class _PickerBodyState extends ConsumerState<_PickerBody> {
  final _finder = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _finder.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final catalog = widget.catalog;
    final picked = widget.watch(ref);
    final full = widget.limit != null && picked.length >= widget.limit!;
    final searching = _query.trim().length >= 2;
    final found = duSearchSubjects(_query, catalog);
    final langs = searching ? catalog.languages.where((l) => found.languages.contains(l.id)).toList() : catalog.languages;
    final doms = searching ? catalog.domains.where((d) => found.domains.contains(d.id)).toList() : catalog.domains;
    final showGat = duFinderShowsGat(_query);
    final aliasNotes = <String>[];
    if (searching) {
      for (final d in doms) {
        final hit = found.hits[d.id];
        if (hit != null && !d.name.toLowerCase().startsWith(hit.toLowerCase())) aliasNotes.add(ToolsCopy.aliasNote(hit, d.name));
      }
    }

    Widget chip(DuPick pick, String label) {
      final on = picked.contains(pick);
      return MmChip(label: label, selected: on, onTap: !on && full ? null : () => widget.onToggle(pick));
    }

    Widget group(String title, String? note, List<Widget> chips) => Padding(
          padding: const EdgeInsets.only(top: MmSpace.s20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text.rich(TextSpan(children: [
                  TextSpan(text: title, style: type.labelLarge),
                  if (note != null) TextSpan(text: '  $note', style: type.caption.copyWith(color: colors.ink3)),
                ])),
              ),
              const SizedBox(height: MmSpace.s4),
              Wrap(spacing: MmSpace.s8, children: chips),
            ],
          ),
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ToolsSearchField(controller: _finder, hint: ToolsCopy.finderHint, onChanged: (v) => setState(() => _query = v)),
        for (final note in aliasNotes)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s8),
            child: Text(note, style: type.caption.copyWith(color: colors.ink2)),
          ),
        if (widget.onPreset != null && !searching) ...[
          const SizedBox(height: MmSpace.s16),
          Text(ToolsCopy.quickStart, style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: MmSpace.s4),
          Wrap(
            spacing: MmSpace.s8,
            children: [
              for (final p in duPresets)
                Tooltip(
                  message: p.hint,
                  child: ToolsActionChip(label: p.label, icon: LucideIcons.zap, onTap: () => widget.onPreset!(p)),
                ),
              if (picked.isNotEmpty && widget.onClear != null)
                ToolsActionChip(label: ToolsCopy.clearAll, icon: LucideIcons.x, onTap: widget.onClear),
            ],
          ),
        ],
        if (full && widget.limitNote != null)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s12),
            child: InlineBanner(message: widget.limitNote!, compact: true),
          ),
        if (searching && langs.isEmpty && doms.isEmpty && !showGat)
          Padding(
            padding: const EdgeInsets.only(top: MmSpace.s20),
            child: Text(ToolsCopy.noSubjectMatch(_query.trim()), style: type.body.copyWith(color: colors.ink2)),
          ),
        if (langs.isNotEmpty)
          group(ToolsCopy.languages, ToolsCopy.languagesNote, [for (final l in langs) chip(DuPick.language(l.id), l.name)]),
        if (doms.isNotEmpty)
          group(ToolsCopy.domains, ToolsCopy.domainsNote, [for (final d in doms) chip(DuPick.domain(d.id), d.shortName)]),
        if (showGat) group(ToolsCopy.aptitude, null, [chip(const DuPick.gat(), ToolsCopy.gat)]),
        SizedBox(height: MmSpace.s16 + MediaQuery.viewInsetsOf(context).bottom),
      ],
    );
  }
}
