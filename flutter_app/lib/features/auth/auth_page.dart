import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth.dart';
import '../../core/connectivity/connectivity.dart';
import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/widgets.dart';
import 'copy.dart';
import 'sign_in_controller.dart';
import 'sign_in_state.dart';

/// The frame both sign-in screens share, in the Night Sheet room: the desk lamp's warm light
/// from the upper left over the ground, banners that float over the top (nothing moves when they
/// come and go) and a scrolling, keyboard-safe column of content (at most 600 dp wide) with the MockMob mark at its head and
/// Mobi beside it. Mobi sits in a fixed 56 dp slot, so nothing below it moves: it thinks while a
/// code is sent or checked, cheers when the code worked and shrugs at a code that did not match.
/// Under reduced motion it stays still.
class AuthPage extends ConsumerStatefulWidget {
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
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  final MobiController _mobi = MobiController();

  SignInStep get step => widget.step;
  Widget get child => widget.child;
  VoidCallback? get onBack => widget.onBack;

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  /// Mobi answers what just happened, never anything that is only a state of the form.
  void _react(SignInState? before, SignInState now) {
    if (!mounted || Motion.reduced(context)) return;
    final working = now.busy != SignInBusy.none;
    final wasWorking = before != null && before.busy != SignInBusy.none;
    if (working && !wasWorking) {
      _mobi.play(MobiAct.think);
    } else if (wasWorking && !working) {
      if (now.problem == SignInProblem.invalidCode) {
        _mobi.play(MobiAct.oops);
      } else if (now.problem != null) {
        _mobi.play(MobiAct.idle);
      } else if (before.busy == SignInBusy.verifying ||
          before.busy == SignInBusy.google) {
        _mobi.play(MobiAct.cheer);
      } else {
        _mobi.play(MobiAct.idle);
      }
    } else if (!working &&
        before != null &&
        now.problem == SignInProblem.invalidCode &&
        now.problemSerial != before.problemSerial) {
      _mobi.play(MobiAct.oops);
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(signInControllerProvider, _react);
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
    final showExpired = expired && step == SignInStep.email;

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          const Positioned.fill(
            child: LampScene(strength: 0.9, vignette: false),
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          SafeArea(
            child: Stack(
              children: [
                Column(
                  children: [
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
                                const SizedBox(height: MmSpace.s16),
                                // Where a banner would land on the brand row (below a back key, or two
                                // banners stacked) the row steps aside, so the banner never sits half
                                // on top of the wordmark. It keeps its space: nothing moves.
                                AnimatedOpacity(
                                  opacity:
                                      (onBack != null &&
                                              (offline || showExpired)) ||
                                          (offline && showExpired)
                                      ? 0
                                      : 1,
                                  duration: Motion.of(context, Motion.press),
                                  child: Row(
                                    children: [
                                      // The wordmark alone: a "mo" tile beside it read as "mo mockmob".
                                      const Wordmark(height: 26),
                                      const Spacer(),
                                      SizedBox(
                                        width: 56,
                                        height: 56,
                                        child: Mobi(
                                          pose: MobiPose.idle,
                                          size: 56,
                                          controller: _mobi,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: MmSpace.s20),
                                child,
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                // Banners float over the top of the page, clear of the screen edges, so the
                // page never moves when the connection or the session changes. With a back key
                // they sit below it, so the way back stays reachable.
                Positioned(
                  top: onBack == null
                      ? MmSpace.s8
                      : MmSpace.s8 + MmTarget.min + MmSpace.s4,
                  left: MmSpace.gutter,
                  right: MmSpace.gutter,
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        maxWidth: MmSpace.contentMaxWidth,
                      ),
                      child: AnimatedSwitcher(
                        duration: Motion.of(context, Motion.press),
                        child: Column(
                          key: ValueKey((offline, showExpired)),
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            if (offline)
                              const InlineBanner(
                                message: AuthCopy.offlineBanner,
                                tone: BannerTone.offline,
                              ),
                            if (offline && showExpired)
                              const SizedBox(height: MmSpace.s8),
                            if (showExpired)
                              const InlineBanner(
                                message: AuthCopy.sessionExpired,
                              ),
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
