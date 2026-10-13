import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../model/recap_model.dart';
import '../widgets/breakdown_section.dart';
import 'card_page.dart';

/// Card 2 (spec 5.6.3): where the other marks went. The bar grows once, left to right.
class BreakdownCard extends StatefulWidget {
  const BreakdownCard({super.key, required this.model, required this.onNext, required this.onBack});

  final RecapModel model;
  final VoidCallback onNext;
  final VoidCallback onBack;

  @override
  State<BreakdownCard> createState() => _BreakdownCardState();
}

class _BreakdownCardState extends State<BreakdownCard> with SingleTickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_grow.status != AnimationStatus.dismissed) return;
    if (Motion.reduced(context)) {
      _grow.value = 1;
    } else {
      Future<void>.delayed(const Duration(milliseconds: 140), () {
        if (mounted) _grow.forward();
      });
    }
  }

  @override
  void dispose() {
    _grow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final b = widget.model.breakdown;
    return RecapCardPage(
      onNext: widget.onNext,
      onBack: widget.onBack,
      footer: KeyButton(label: ResultCopy.nextFix, onPressed: widget.onNext),
      children: [
        const SizedBox(height: MmSpace.s16),
        Semantics(
          header: true,
          child: Text(b.lost == 0 ? ResultCopy.allScored(b.max) : ResultCopy.breakdownTitle(b.lost), style: type.moment),
        ),
        const SizedBox(height: MmSpace.s8),
        Text(widget.model.title, style: type.small.copyWith(color: colors.ink3)),
        const SizedBox(height: MmSpace.s32),
        BreakdownSection(breakdown: b, grow: _grow),
      ],
    );
  }
}
