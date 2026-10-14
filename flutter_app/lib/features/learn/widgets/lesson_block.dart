import 'package:flutter/material.dart';

import '../../../core/models/json_helpers.dart';
import '../../../core/theme/theme.dart';
import '../copy.dart';

/// One teaching block of a lesson (`type: reading`): explanation, steps, worked example,
/// common mistake, comparison table or word set. Used by the lesson page and by the guided run.
class LessonBlock extends StatelessWidget {
  const LessonBlock({super.key, required this.block, this.showTitle = true});

  final Json block;
  final bool showTitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final kind = asString(block['kind']);
    final title = asString(block['title']);
    final body = asString(block['body']);
    final formula = asString(block['formula']);
    final steps = asStringList(block['steps']);
    final rows = _rows(block['rows']);
    final words = asJsonList(block['words']);
    final note = asString(block['note']);
    final label = LearnCopy.blockKindLabel(kind);
    final emphasised = kind == 'worked_example' || kind == 'mistake';

    final children = <Widget>[
      if (label != null)
        Padding(
          padding: const EdgeInsets.only(bottom: MmSpace.s4),
          child: Text(label, style: type.label.copyWith(color: colors.ink2)),
        ),
      if (showTitle && title != null) Semantics(header: true, child: Text(title, style: type.subhead)),
      if (body != null) ...[if (showTitle && title != null) const SizedBox(height: MmSpace.s8), Text(body, style: type.body)],
      if (formula != null) ...[const SizedBox(height: MmSpace.s12), _Formula(text: formula)],
      if (steps.isNotEmpty) ...[const SizedBox(height: MmSpace.s12), _Steps(steps: steps)],
      if (rows.isNotEmpty) ...[const SizedBox(height: MmSpace.s12), _RowsTable(rows: rows)],
      for (final w in words) ...[const SizedBox(height: MmSpace.s12), _WordEntry(word: w)],
      if (note != null) ...[const SizedBox(height: MmSpace.s12), Text(note, style: type.small.copyWith(color: colors.ink2))],
    ];

    final content = Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
    if (!emphasised) return content;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised2,
        borderRadius: MmRadius.panelAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(padding: const EdgeInsets.all(MmSpace.cardPadding), child: content),
    );
  }

  static List<List<String>> _rows(Object? raw) => raw is List
      ? [
          for (final r in raw)
            if (r is List) [for (final c in r) asStringOr(c, '')],
        ]
      : const [];
}

class _Formula extends StatelessWidget {
  const _Formula({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    // The server joins several formulas with a middle dot; each goes on its own line here.
    final lines = text.split('·').map((l) => l.trim()).where((l) => l.isNotEmpty).toList();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.sunken,
        borderRadius: MmRadius.smallAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16, vertical: MmSpace.s12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [for (final l in lines) Text(l, style: context.mmType.label.copyWith(fontSize: 15, height: 1.5))],
        ),
      ),
    );
  }
}

/// Steps joined by a thin rail with a dot at each step: order without numbered badges.
class _Steps extends StatelessWidget {
  const _Steps({required this.steps});

  final List<String> steps;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Column(
      children: [
        for (var i = 0; i < steps.length; i++)
          Semantics(
            container: true,
            label: LearnCopy.stepSemantics(i + 1, steps.length, steps[i]),
            excludeSemantics: true,
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  SizedBox(
                    width: 20,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.topCenter,
                      children: [
                        if (i < steps.length - 1)
                          Positioned(
                            top: 12,
                            bottom: -8,
                            child: SizedBox(
                              width: 2,
                              child: DecoratedBox(decoration: BoxDecoration(color: colors.lineStrong)),
                            ),
                          ),
                        Positioned(
                          top: 8,
                          child: DecoratedBox(
                            decoration: BoxDecoration(color: colors.ink, shape: BoxShape.circle),
                            child: const SizedBox(width: 9, height: 9),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: MmSpace.s12),
                      child: Text(steps[i], style: context.mmType.body),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _RowsTable extends StatelessWidget {
  const _RowsTable({required this.rows});

  final List<List<String>> rows;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final columns = rows.fold<int>(0, (m, r) => r.length > m ? r.length : m);
    if (columns == 0) return const SizedBox.shrink();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.smallAll,
        border: Border.all(color: colors.line),
      ),
      child: ClipRRect(
        borderRadius: MmRadius.smallAll,
        child: Table(
          defaultColumnWidth: const IntrinsicColumnWidth(flex: 1),
          border: TableBorder(horizontalInside: BorderSide(color: colors.line)),
          children: [
            for (var r = 0; r < rows.length; r++)
              TableRow(
                decoration: r == 0 ? BoxDecoration(color: colors.sunken) : null,
                children: [
                  for (var c = 0; c < columns; c++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: MmSpace.s8, vertical: MmSpace.s8),
                      child: Text(
                        c < rows[r].length ? rows[r][c] : '',
                        style: (r == 0 ? type.label : type.small).copyWith(color: colors.ink),
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class _WordEntry extends StatelessWidget {
  const _WordEntry({required this.word});

  final Json word;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final similar = asString(word['synonym']);
    final opposite = asString(word['opposite']);
    final example = asString(word['example']);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.raised,
        borderRadius: MmRadius.smallAll,
        border: Border.all(color: colors.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(MmSpace.s16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(asStringOr(word['word'], ''), style: type.subhead),
            const SizedBox(height: MmSpace.s4),
            Text(asStringOr(word['meaning'], ''), style: type.body),
            if (example != null) ...[const SizedBox(height: MmSpace.s8), Text(example, style: type.small.copyWith(color: colors.ink2))],
            if (similar != null) Text('${LearnCopy.similarWord}: $similar', style: type.small.copyWith(color: colors.ink2)),
            if (opposite != null) Text('${LearnCopy.oppositeWord}: $opposite', style: type.small.copyWith(color: colors.ink2)),
          ],
        ),
      ),
    );
  }
}
