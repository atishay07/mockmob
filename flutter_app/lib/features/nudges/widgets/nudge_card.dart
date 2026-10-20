import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../data/nudge_facts.dart' show NudgeView;
import '../nudge_copy.dart';

/// Mobi's note on Today (D191): a small Mobi head, the title, one line, one key and an X. One idea per line, no more
/// (D185). It enters with a 12 dp rise and a fade (a fade alone under reduced motion); its X folds it away in 240 ms
/// and only then reports [onDismiss], so the page under it closes the gap in the same motion.
class NudgeCard extends StatefulWidget {
  const NudgeCard({super.key, required this.view, required this.onKey, required this.onDismiss, this.onSecondary, this.enter = true});

  final NudgeView view;
  final VoidCallback onKey;
  final VoidCallback? onSecondary;
  final VoidCallback onDismiss;

  /// Plays the entrance; false draws the card at rest (goldens of the settled card).
  final bool enter;

  /// The collapse of the X.
  static const Duration collapse = Duration(milliseconds: 240);

  /// The entrance's rise.
  static const double rise = 12;

  /// The Mobi head's size.
  static const double mobi = 40;

  @override
  State<NudgeCard> createState() => _NudgeCardState();
}

class _NudgeCardState extends State<NudgeCard> with TickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(vsync: this, duration: Motion.card, value: widget.enter ? 0 : 1);
  late final AnimationController _leave = AnimationController(vsync: this, duration: NudgeCard.collapse);
  bool _leaving = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.enter && _enter.value == 0 && !_enter.isAnimating) {
      _enter.duration = Motion.reduced(context) ? Motion.reducedFade : Motion.card;
      unawaited(_enter.forward());
    }
  }

  @override
  void dispose() {
    _enter.dispose();
    _leave.dispose();
    super.dispose();
  }

  Future<void> _dismiss() async {
    if (_leaving) return;
    setState(() => _leaving = true);
    if (!Motion.reduced(context)) await _leave.forward();
    if (mounted) widget.onDismiss();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = Motion.reduced(context);
    final enter = CurvedAnimation(parent: _enter, curve: Motion.out);
    final leave = CurvedAnimation(parent: _leave, curve: Motion.exit);
    return AnimatedBuilder(
      animation: Listenable.merge([_enter, _leave]),
      builder: (context, child) {
        final inT = enter.value;
        final outT = leave.value;
        return ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: 1 - outT,
            child: Opacity(
              opacity: (inT * (1 - outT)).clamp(0.0, 1.0),
              child: Transform.translate(offset: Offset(0, reduced ? 0 : (1 - inT) * NudgeCard.rise), child: child),
            ),
          ),
        );
      },
      child: IgnorePointer(ignoring: _leaving, child: _face(context)),
    );
  }

  Widget _face(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final view = widget.view;
    final secondary = view.secondary;
    return Semantics(
      container: true,
      label: NudgeCopy.from,
      child: MmSurface.plain(
        padding: const EdgeInsets.fromLTRB(MmSpace.s16, MmSpace.s16, MmSpace.s4, MmSpace.s16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: MmSpace.s2),
              child: ExcludeSemantics(
                child: MobiCharacter(size: NudgeCard.mobi, head: true, still: true, shadow: false, entrance: MobiAct.idle),
              ),
            ),
            const SizedBox(width: MmSpace.s12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: MmSpace.s2),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(view.title, style: type.subhead.copyWith(color: colors.ink)),
                    const SizedBox(height: MmSpace.s4),
                    Text(view.line, style: type.small.copyWith(color: colors.ink2)),
                    const SizedBox(height: MmSpace.s12),
                    Wrap(
                      spacing: MmSpace.s4,
                      runSpacing: MmSpace.s4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        KeyButton.secondary(key: const ValueKey('nudge-key'), label: view.key, expanded: false, minHeight: MmTarget.min, onPressed: widget.onKey),
                        if (secondary != null && widget.onSecondary != null)
                          KeyButton.quiet(key: const ValueKey('nudge-secondary'), label: secondary, onPressed: widget.onSecondary),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            MmPressable(
              key: const ValueKey('nudge-dismiss'),
              onTap: _dismiss,
              semanticsLabel: NudgeCopy.dismissLabel,
              focusRadius: MmRadius.pillAll,
              builder: (context, pressed, focused) => SizedBox.square(
                dimension: MmTarget.min,
                child: Center(child: Icon(LucideIcons.x, size: 18, color: colors.ink3)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
