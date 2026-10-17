import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../layers_copy.dart';
import '../model/weak_chapters.dart';

/// "Where your marks went" (v15 spec 3.1, N13 and N15): the one list of the chapters that cost marks on this paper.
/// Each row is a chapter, the marks lost of the marks it had, a bar of that share, what happened in it, and a Practise
/// key that opens a set on that chapter. The first [firstRows] show; "Show all" opens the rest. Rows are ruled by
/// hairlines, never boxed, and the keys are outlined, so the page keeps its one volt in the foot.
class WeakChaptersList extends StatefulWidget {
  const WeakChaptersList({super.key, required this.chapters, required this.onPractise, this.firstRows = 4});

  final List<WeakChapter> chapters;
  final ValueChanged<WeakChapter> onPractise;
  final int firstRows;

  @override
  State<WeakChaptersList> createState() => _WeakChaptersListState();
}

class _WeakChaptersListState extends State<WeakChaptersList> {
  bool _all = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final list = widget.chapters;
    if (list.isEmpty) {
      return Text(LayersCopy.noWeakChapters, style: context.mmType.body.copyWith(color: colors.ink2));
    }
    final shown = _all ? list : list.take(widget.firstRows).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < shown.length; i++) ...[
          if (i > 0) Divider(height: 1, thickness: 1, color: colors.line),
          WeakChapterRow(chapter: shown[i], onPractise: () => widget.onPractise(shown[i])),
        ],
        if (list.length > widget.firstRows) ...[
          Divider(height: 1, thickness: 1, color: colors.line),
          MmPressable(
            onTap: () => setState(() => _all = !_all),
            pressedScale: 0.985,
            focusRadius: MmRadius.smallAll,
            haptic: MmPressHaptic.selection,
            semanticsLabel: _all ? LayersCopy.showFewer : LayersCopy.showAllChapters(list.length),
            builder: (context, pressed, _) => ConstrainedBox(
              constraints: const BoxConstraints(minHeight: MmTarget.min),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  _all ? LayersCopy.showFewer : LayersCopy.showAllChapters(list.length),
                  style: context.mmType.small.copyWith(
                    color: colors.ink,
                    fontWeight: FontWeight.w600,
                    decoration: TextDecoration.underline,
                    decorationColor: colors.ink3,
                    decorationThickness: 1.4,
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// One chapter of the list.
class WeakChapterRow extends StatelessWidget {
  const WeakChapterRow({super.key, required this.chapter, required this.onPractise, this.subtitle});

  final WeakChapter chapter;
  final VoidCallback onPractise;

  /// A quiet line under the chapter's name (the subject, on the record page where chapters of several subjects mix).
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = chapter;
    final tabular = type.small.copyWith(color: colors.ink, fontWeight: FontWeight.w600, fontFeatures: const [FontFeature.tabularFigures()]);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: MmSpace.s12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Semantics(
              container: true,
              label: '${c.chapter}${subtitle == null ? '' : ', $subtitle'}. ${c.marksLine}. ${c.counts}',
              excludeSemantics: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(c.chapter, style: type.cardTitle.copyWith(fontSize: 16), maxLines: 2, overflow: TextOverflow.ellipsis),
                  if (subtitle != null) Text(subtitle!, style: type.caption.copyWith(color: colors.ink3)),
                  const SizedBox(height: MmSpace.s4),
                  Text(c.marksLine, style: tabular),
                  const SizedBox(height: MmSpace.s8),
                  _ShareBar(share: c.share, fill: colors.wrongMark, track: colors.ink.withValues(alpha: 0.07)),
                  const SizedBox(height: MmSpace.s8),
                  Text(c.counts, style: type.caption.copyWith(color: colors.ink2)),
                ],
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          KeyButton.secondary(
            label: LayersCopy.practise,
            semanticsLabel: LayersCopy.practiseChapter(c.chapter),
            onPressed: onPractise,
            expanded: false,
            minHeight: MmTarget.min,
          ),
        ],
      ),
    );
  }
}

/// A 6 dp bar of the share of the chapter's marks that were lost.
class _ShareBar extends StatelessWidget {
  const _ShareBar({required this.share, required this.fill, required this.track});

  final double share;
  final Color fill;
  final Color track;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: 6,
      child: LayoutBuilder(
        builder: (context, c) => Stack(
          children: [
            Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: track, borderRadius: BorderRadius.circular(3)))),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: c.maxWidth * share,
              child: DecoratedBox(decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(3))),
            ),
          ],
        ),
      ),
    ),
  );
}
