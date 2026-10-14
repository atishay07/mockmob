import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';

/// The frame of the account-access screens, matching the sign-in screens: the desk lamp's light
/// over the ground, an offline banner in the layout (never over content), and a keyboard-safe
/// scrolling column at most 600 dp wide with the title and lead at its head.
class AccessPage extends ConsumerWidget {
  const AccessPage({
    super.key,
    required this.title,
    required this.child,
    this.lead,
    this.onBack,
  });

  final String title;
  final String? lead;
  final Widget child;

  /// Shows the back key when set.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          const Positioned.fill(child: LampScene(strength: 0.9, vignette: false)),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          SafeArea(
            child: Column(
              children: [
                if (offline) const InlineBanner(message: AccessCopy.offline, tone: BannerTone.offline),
                Expanded(
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s24),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(
                              height: MmTarget.min,
                              child: onBack == null
                                  ? null
                                  : Align(alignment: Alignment.centerLeft, child: _BackKey(onPressed: onBack!)),
                            ),
                            const SizedBox(height: MmSpace.s16),
                            Semantics(header: true, child: Text(title, style: type.headline.copyWith(color: colors.ink))),
                            if (lead != null) ...[
                              const SizedBox(height: MmSpace.s8),
                              Text(lead!, style: type.lead.copyWith(color: colors.ink2)),
                            ],
                            const SizedBox(height: MmSpace.group),
                            child,
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BackKey extends StatelessWidget {
  const _BackKey({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: AccessCopy.back,
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: MmRadius.smallAll,
        child: SizedBox(
          width: MmTarget.min,
          height: MmTarget.min,
          child: Icon(LucideIcons.arrowLeft, size: 22, color: context.mmColors.ink),
        ),
      ),
    );
  }
}
