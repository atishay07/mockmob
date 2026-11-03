import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// The frame both sign-in screens share: banners that sit in the layout above a scrolling,
/// keyboard-safe column of content, at most 600 dp wide.
class AuthPage extends ConsumerWidget {
  const AuthPage({
    super.key,
    required this.step,
    required this.child,
    this.onBack,
  });

  final SignInStep step;
  final Widget child;

  /// Shows the back key when set.
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final offline =
        ref.watch(networkStatusProvider) == NetworkStatus.offline ||
        ref.watch(
          signInControllerProvider.select(
            (s) => s.problemFor(step) == SignInProblem.offline,
          ),
        );
    final expired = ref.watch(
      authSnapshotProvider.select((s) => s.sessionExpired),
    );

    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Column(
          children: [
            if (offline)
              const InlineBanner(
                message: AuthCopy.offlineBanner,
                tone: BannerTone.offline,
              ),
            if (expired && step == SignInStep.email)
              const InlineBanner(message: AuthCopy.sessionExpired),
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
                        SizedBox(
                          height: MmTarget.min,
                          child: onBack == null
                              ? null
                              : Align(
                                  alignment: Alignment.centerLeft,
                                  child: BackKey(onPressed: onBack!),
                                ),
                        ),
                        const SizedBox(height: MmSpace.s12),
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
    );
  }
}

/// A 44 dp back key: an arrow glyph that sinks into a sunken square while pressed. No ripple.
class BackKey extends StatefulWidget {
  const BackKey({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  State<BackKey> createState() => _BackKeyState();
}

class _BackKeyState extends State<BackKey> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: AuthCopy.back,
      excludeSemantics: true,
      onTap: widget.onPressed,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _down = true),
        onTapCancel: () => setState(() => _down = false),
        onTapUp: (_) => setState(() => _down = false),
        onTap: widget.onPressed,
        child: Container(
          width: MmTarget.min,
          height: MmTarget.min,
          decoration: BoxDecoration(
            color: _down ? colors.sunken : Colors.transparent,
            borderRadius: MmRadius.smallAll,
          ),
          alignment: Alignment.center,
          child: Icon(LucideIcons.arrowLeft, size: 22, color: colors.ink),
        ),
      ),
    );
  }
}

/// One plain line of what went wrong and what to do. Colour is the second signal; the icon and
/// the words carry it. Read out when it appears.
class ProblemLine extends StatelessWidget {
  const ProblemLine({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 3),
            child: ExcludeSemantics(
              child: Icon(
                LucideIcons.circleAlert,
                size: 16,
                color: colors.badText,
              ),
            ),
          ),
          const SizedBox(width: MmSpace.s8),
          Expanded(
            child: Text(
              message,
              style: context.mmType.small.copyWith(color: colors.ink),
            ),
          ),
        ],
      ),
    );
  }
}
