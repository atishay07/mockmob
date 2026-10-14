import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/connectivity/connectivity.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/auth_page.dart' show BackKey;
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
          const Positioned.fill(
            child: LampScene(strength: 0.9, vignette: false),
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          SafeArea(
            child: Column(
              children: [
                if (offline)
                  const InlineBanner(
                    message: AccessCopy.offline,
                    tone: BannerTone.offline,
                  ),
                Expanded(
                  child: SingleChildScrollView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    padding: const EdgeInsets.fromLTRB(
                      MmSpace.gutter,
                      MmSpace.s8,
                      MmSpace.gutter,
                      MmSpace.s24,
                    ),
                    child: Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          maxWidth: MmSpace.contentMaxWidth,
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // One header pattern: the back key (a 48 dp target, 44 dp drawn),
                            // 8 dp, the screen title in the 26/30 cut, one 56 dp row; the lead
                            // sits under it on the gutter.
                            _Header(title: title, onBack: onBack),
                            if (lead != null) ...[
                              const SizedBox(height: MmSpace.s4),
                              Text(
                                lead!,
                                style: type.lead.copyWith(color: colors.ink2),
                              ),
                            ],
                            const SizedBox(height: MmSpace.s24),
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

class _Header extends StatelessWidget {
  const _Header({required this.title, required this.onBack});

  final String title;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    final colors = context.mmColors;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          if (onBack != null) ...[
            BackKey(
              onPressed: onBack!,
              label: AccessCopy.back,
              onEdge: false,
            ),
            const SizedBox(width: MmSpace.s8),
          ],
          Expanded(
            child: Semantics(
              header: true,
              child: Text(
                title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: type.screenTitle.copyWith(color: colors.ink),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
