import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/models/lab_loop.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../insights/widgets/motion_bits.dart' show WhenInView;

/// Prove's rule check (Mistake Lab v4 slice 3, spec 4.8): the rule the student chose before this
/// mock, and what this mock's record says about it, with the timed mock before it in brackets.
/// Arithmetic only, in the server's words: never what the rule "gained".
///
/// The mark beside the rule says the state without colour alone: a check drawn in a ring when
/// kept, an open ring when not kept, a tally when the rule is counted on its chapter, and a dashed
/// ring when this mock's record cannot answer it. The check draws itself in once, when the block
/// first comes into view; under reduced motion it is simply there.
class RuleCheckView extends StatefulWidget {
  const RuleCheckView({super.key, required this.check});

  final RuleCheck check;

  @override
  State<RuleCheckView> createState() => _RuleCheckViewState();
}

class _RuleCheckViewState extends State<RuleCheckView> {
  bool _inView = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final c = widget.check;
    final quiet = c.state == RuleCheck.notChecked;
    return MmSection(
      title: c.title,
      child: WhenInView(
        onVisible: () {
          if (mounted && !_inView) setState(() => _inView = true);
        },
        child: Semantics(
          container: true,
          label: [c.line, c.result, ?c.fine].join(' '),
          child: ExcludeSemantics(
            child: MmSurface.inset(
              padding: const EdgeInsets.all(MmSpace.s16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StateMark(state: c.state, drawn: _inView),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(c.line, style: type.cardTitle.copyWith(fontSize: 16, height: 22 / 16)),
                        const SizedBox(height: MmSpace.s6),
                        Text(c.result, style: type.body.copyWith(color: quiet ? colors.ink2 : colors.ink)),
                        if (c.fine != null) ...[
                          const SizedBox(height: MmSpace.s8),
                          Text(c.fine!, style: type.small.copyWith(color: colors.ink3)),
                        ],
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

/// The state mark: 28 dp, beside the rule's first line.
class _StateMark extends StatelessWidget {
  const _StateMark({required this.state, required this.drawn});

  final String state;
  final bool drawn;

  static Path _check(Size size) => MmPaths.check(Rect.fromLTWH(size.width * 0.18, size.height * 0.18, size.width * 0.64, size.height * 0.64));

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    const size = 28.0;
    return SizedBox.square(
      dimension: size,
      child: switch (state) {
        RuleCheck.kept => Stack(
            children: [
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.goodText, width: 1.5)),
                ),
              ),
              Positioned.fill(
                child: MmStrokeDraw(path: _check, color: colors.goodText, strokeWidth: 2, drawn: drawn, delay: const Duration(milliseconds: 120)),
              ),
            ],
          ),
        RuleCheck.notKept => DecoratedBox(
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: colors.ink3, width: 1.5)),
          ),
        RuleCheck.counted => Icon(LucideIcons.listChecks, size: 22, color: colors.ink2),
        _ => Icon(LucideIcons.circleDashed, size: 24, color: colors.ink3),
      },
    );
  }
}
