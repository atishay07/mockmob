import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../data/mistake_index.dart';
import 'mistake_map.dart' show MistakeBar;

/// "3 of 12 repaired": how many of the mistakes found so far are repaired, read from the index
/// and nothing else. The bar beside it is the map's own: one segment per mistake, volt where
/// repaired, coral where open, a ring where set aside, so it teaches the bars below it. It fills
/// in over 520 ms on the emphasized curve when the tab opens.
class RepairsProgress extends StatefulWidget {
  const RepairsProgress({super.key, required this.repaired, required this.found, this.setAside = 0});

  final int repaired;
  final int found;
  final int setAside;

  @override
  State<RepairsProgress> createState() => _RepairsProgressState();
}

class _RepairsProgressState extends State<RepairsProgress> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 520));
  late final CurvedAnimation _grow = CurvedAnimation(parent: _c, curve: Motion.emphasized);
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (Motion.reduced(context)) {
      _c.value = 1;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _grow.dispose();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final found = widget.found;
    final open = (found - widget.repaired - widget.setAside).clamp(0, found);
    return Semantics(
      label: ReviewCopy.repairsProgressSemantics(widget.repaired, found),
      excludeSemantics: true,
      child: Row(
        children: [
          Text(
            ReviewCopy.repairsProgress(widget.repaired, found),
            style: type.caption.copyWith(color: colors.ink, fontWeight: FontWeight.w600),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: MistakeBar(open: open, repaired: widget.repaired, setAside: widget.setAside, scale: found, grow: _grow, height: 10),
          ),
        ],
      ),
    );
  }
}

/// Open mistakes exist but none can carry tonight's repair: say why, and offer the one repair
/// that does run. Never the all-clear card, which would deny the list below it.
class NoTonightCard extends StatelessWidget {
  const NoTonightCard({super.key, required this.inShortPractice, required this.inUnopenedResult, this.offer, this.onRepair});

  /// Some open mistakes are in a practice shorter than 10 questions.
  final bool inShortPractice;

  /// Some open mistakes are in a mock whose result has not been opened yet.
  final bool inUnopenedResult;

  /// The paper whose open mistakes the key repairs; null offers no key.
  final PaperOpen? offer;
  final VoidCallback? onRepair;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final reasons = [
      if (inShortPractice) ReviewCopy.noTonightShort,
      if (inUnopenedResult) ReviewCopy.noTonightUnopened,
    ];
    final offer = this.offer;
    return MmSurface.plain(
      padding: const EdgeInsets.all(MmSpace.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(header: true, child: Text(ReviewCopy.noTonightTitle, style: type.cardTitle)),
          for (final r in reasons) ...[const SizedBox(height: MmSpace.s8), Text(r, style: type.small.copyWith(color: colors.ink2))],
          if (offer != null && onRepair != null) ...[
            const SizedBox(height: MmSpace.s16),
            KeyButton.secondary(label: ReviewCopy.repairGroupFromKey(offer.items.length, offer.source), onPressed: onRepair),
          ],
        ],
      ),
    );
  }
}
