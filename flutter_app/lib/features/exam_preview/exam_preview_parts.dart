import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import '../runner/nta/nta_skin.dart';
import 'exam_preview_content.dart';
import 'exam_preview_copy.dart';
import 'exam_preview_controller.dart';

/// The section tabs under the bar: one tab per section of the sample paper, the open one with
/// the exam's own underline. A tap switches section; each section keeps its place.
class PreviewSectionStrip extends StatelessWidget {
  const PreviewSectionStrip({super.key, required this.sections, required this.selected, required this.onSelect});

  static const double height = 48;

  final List<PreviewSection> sections;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final skin = NtaSkin.of(context);
    final colors = skin.colors;
    final type = context.mmType;
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          border: Border(bottom: BorderSide(color: colors.line)),
        ),
        child: SizedBox(
          height: height,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.s4),
            itemCount: sections.length,
            separatorBuilder: (_, _) => const SizedBox(width: MmSpace.s4),
            itemBuilder: (context, i) {
              final open = i == selected;
              return Semantics(
                button: true,
                selected: open,
                label: 'Section ${i + 1} of ${sections.length}, ${sections[i].name}',
                excludeSemantics: true,
                child: InkWell(
                  onTap: () => onSelect(i),
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                    decoration: BoxDecoration(
                      border: Border(bottom: BorderSide(color: open ? skin.tabLine : Colors.transparent, width: 2)),
                    ),
                    child: Text(
                      sections[i].name,
                      maxLines: 1,
                      style: type.label.copyWith(color: open ? colors.ink : colors.ink3, fontWeight: open ? FontWeight.w700 : FontWeight.w500),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// One line under the section tabs: the next thing to try, and how many of the five are done.
/// When all five are done it says what a real paper holds, in numbers.
class PreviewTryBand extends StatelessWidget {
  const PreviewTryBand({super.key, required this.controller});

  final ExamPreviewController controller;

  static String stepText(PreviewStep? step, int total) => switch (step) {
    PreviewStep.answer => ExamPreviewCopy.stepAnswer,
    PreviewStep.mark => ExamPreviewCopy.stepMark,
    PreviewStep.palette => ExamPreviewCopy.stepPalette,
    PreviewStep.section => ExamPreviewCopy.stepSection,
    PreviewStep.clock => ExamPreviewCopy.stepClock,
    null => ExamPreviewCopy.allTried(total),
  };

  @override
  Widget build(BuildContext context) {
    final colors = NtaSkin.of(context).colors;
    final type = context.mmType;
    final total = PreviewStep.values.length;
    final done = controller.triedCount;
    final text = stepText(controller.nextStep, total);
    return MediaQuery.withClampedTextScaling(
      maxScaleFactor: 1.3,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.sunken,
          border: Border(bottom: BorderSide(color: colors.line)),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 52),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: MmSpace.gutter, vertical: MmSpace.s8),
            child: Row(
              children: [
                Expanded(
                  child: Semantics(
                    liveRegion: true,
                    child: AnimatedSwitcher(
                      duration: Motion.reduced(context) ? Duration.zero : Motion.crossFade,
                      child: Align(
                        key: ValueKey(text),
                        alignment: Alignment.centerLeft,
                        child: Text(text, style: type.small.copyWith(color: colors.ink)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: MmSpace.s12),
                Semantics(
                  label: ExamPreviewCopy.triedSemantics(done, total),
                  excludeSemantics: true,
                  child: Text(
                    ExamPreviewCopy.triedCount(done, total),
                    style: type.label.copyWith(color: done == total ? colors.ink : colors.ink2, fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
