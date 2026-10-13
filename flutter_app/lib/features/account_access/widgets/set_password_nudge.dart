import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../state/password_hints.dart';

/// "Set a password for faster sign-in", offered once to a signed-in student who has not set a
/// password on this phone. "Not now" hides it for this account for good. Draws nothing when it
/// should not show, so it can sit in a list (the after-sign-in sheet or You, Account).
class SetPasswordNudge extends ConsumerWidget {
  const SetPasswordNudge({super.key, required this.onSetPassword});

  /// Opens the set-password screen ([AccountAccessRoutes.setPassword]).
  final VoidCallback onSetPassword;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final show = ref.watch(passwordNudgeProvider).value ?? false;
    if (!show) return const SizedBox.shrink();
    final colors = context.mmColors;
    final type = context.mmType;
    return Semantics(
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: colors.raised,
          borderRadius: MmRadius.panelAll,
          border: Border.all(color: colors.line),
        ),
        child: Padding(
          padding: const EdgeInsets.all(MmSpace.cardPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(child: Icon(LucideIcons.keyRound, size: 20, color: colors.ink2)),
                  const SizedBox(width: MmSpace.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(AccessCopy.nudgeTitle, style: type.title.copyWith(color: colors.ink)),
                        const SizedBox(height: MmSpace.s4),
                        Text(AccessCopy.nudgeBody, style: type.small.copyWith(color: colors.ink2)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: MmSpace.s16),
              Row(
                children: [
                  Expanded(child: KeyButton.secondary(label: AccessCopy.nudgeAction, onPressed: onSetPassword)),
                  const SizedBox(width: MmSpace.s8),
                  KeyButton.quiet(
                    label: AccessCopy.notNow,
                    onPressed: () => ref.read(passwordHintsProvider).dismissNudge(),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
