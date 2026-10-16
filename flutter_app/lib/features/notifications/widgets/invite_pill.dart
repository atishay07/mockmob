import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';

/// The small volt key of the reminders invitation (Turn on, Open settings): a 36 dp pill on a
/// 48 dp target, so a thumb finds it without it becoming the screen's big call to action. The
/// press sinks it like every key. While [loading] it shows a spinner of the same width, so the
/// words never move.
class InvitePill extends StatelessWidget {
  const InvitePill({
    super.key,
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.semanticsLabel,
  });

  final String label;

  /// Null disables the key.
  final VoidCallback? onPressed;
  final bool loading;

  /// What TalkBack says when the visible word alone is not enough ("Turn on reminders").
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final enabled = onPressed != null;
    return MmPressable(
      onTap: loading ? null : onPressed,
      semanticsLabel: semanticsLabel ?? label,
      builder: (context, pressed, focused) => ConstrainedBox(
        constraints: const BoxConstraints(minWidth: MmTarget.min, minHeight: MmTarget.min),
        child: Center(
          widthFactor: 1,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: enabled || loading ? colors.volt : colors.sunken,
              borderRadius: MmRadius.pillAll,
            ),
            child: SizedBox(
              height: 36,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s16),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Opacity(
                      opacity: loading ? 0 : 1,
                      child: Center(
                        widthFactor: 1,
                        child: Text(
                          label,
                          maxLines: 1,
                          style: type.label.copyWith(
                            color: enabled ? colors.voltInk : colors.ink3,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    if (loading) MmSpinner(color: colors.voltInk, size: 16, strokeWidth: 2),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
