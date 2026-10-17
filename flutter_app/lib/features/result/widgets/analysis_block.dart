import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// One open part of the full analysis (v15 spec 3.1): a hairline, a plain heading, the part itself. Nothing folds; the
/// analysis is read in the order the page gives it. The heading is the page's section size (22 sp), so the titles of the
/// sections inside a part (20 sp) read as its subheadings.
class AnalysisBlock extends StatelessWidget {
  const AnalysisBlock({super.key, required this.title, required this.child, this.caption, this.first = false});

  final String title;
  final String? caption;
  final Widget child;

  /// The first block of the analysis sits under the analysis heading and needs no rule of its own.
  final bool first;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!first) ...[Divider(height: 1, thickness: 1, color: colors.line), const SizedBox(height: MmSpace.s24)],
        Semantics(header: true, child: Text(title, style: type.title.copyWith(fontSize: 22, height: 28 / 22))),
        if (caption != null) ...[
          const SizedBox(height: MmSpace.s4),
          Text(caption!, style: type.small.copyWith(color: colors.ink2)),
        ],
        const SizedBox(height: MmSpace.s16),
        child,
        const SizedBox(height: MmSpace.s32),
      ],
    );
  }
}
