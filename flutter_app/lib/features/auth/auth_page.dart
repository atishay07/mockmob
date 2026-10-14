import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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
/// from the upper left over the ground, and one column of content (at most 600 dp wide) that
/// scrolls and stays clear of the keyboard.
///
/// The column reads top to bottom as: the top bar (the back arrow on the content's edge, the
/// MockMob mark centred), one quiet status line when the phone is offline or the session ended,
/// Mobi as the hero in a pool of volt light, then the screen's own content, which sits at the
/// foot of the screen in the thumb's reach. Mobi's slot takes whatever height the content leaves
/// (and shrinks, down to a small Mobi, when the keyboard is up), so the form never floats
/// mid-screen and nothing below the hero moves when a status line comes or goes.
///
/// Mobi thinks while a code is sent or checked, cheers when the code worked and shrugs at a
/// code that did not match. Under reduced motion it stays still.
class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({
    super.key,
    required this.step,
    required this.child,
    this.onBack,
    this.backLabel = AuthCopy.back,
    this.entrance = MobiAct.hello,
  });

  final SignInStep step;
  final Widget child;

  /// Shows the back arrow when set.
  final VoidCallback? onBack;

  /// What a screen reader hears for the back arrow.
  final String backLabel;

  /// What Mobi does when the screen opens.
  final MobiAct entrance;

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> {
  final MobiController _mobi = MobiController();

  SignInStep get step => widget.step;

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
    const padTop = MmSpace.s8;
    const padBottom = MmSpace.s24;

    return Scaffold(
      backgroundColor: colors.ground,
      body: Stack(
        children: [
          const Positioned.fill(
            child: LampScene(strength: 0.9, vignette: false),
          ),
          const Positioned.fill(child: IgnorePointer(child: Grain())),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, box) => SingleChildScrollView(
                keyboardDismissBehavior:
                    ScrollViewKeyboardDismissBehavior.onDrag,
                padding: const EdgeInsets.fromLTRB(
                  MmSpace.gutter,
                  padTop,
                  MmSpace.gutter,
                  padBottom,
                ),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: MmSpace.contentMaxWidth,
                      minHeight: math.max(
                        0,
                        box.maxHeight - padTop - padBottom,
                      ),
                    ),
                    // The column is as tall as the screen when its content is shorter, and
                    // Mobi's slot takes the difference.
                    child: IntrinsicHeight(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _TopBar(
                            onBack: widget.onBack,
                            backLabel: widget.backLabel,
                          ),
                          _StatusLines(offline: offline, expired: showExpired),
                          Expanded(
                            child: _HeroSlot(
                              controller: _mobi,
                              entrance: widget.entrance,
                            ),
                          ),
                          const SizedBox(height: MmSpace.s8),
                          widget.child,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The 48 dp top bar: the mark centred, the back arrow (when there is one) with its glyph on the
/// content's left edge.
class _TopBar extends StatelessWidget {
  const _TopBar({required this.onBack, required this.backLabel});

  final VoidCallback? onBack;
  final String backLabel;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MmTarget.min,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // The wordmark alone: a "mo" tile beside it read as "mo mockmob".
          const ExcludeSemantics(child: Wordmark(height: 22)),
          if (onBack != null)
            Align(
              alignment: Alignment.centerLeft,
              child: BackKey(onPressed: onBack!, label: backLabel),
            ),
        ],
      ),
    );
  }
}

/// One quiet status line per condition, in the flow under the top bar: a glyph and the words,
/// no box. It eases open and closed, and Mobi's slot below absorbs the height.
class _StatusLines extends StatelessWidget {
  const _StatusLines({required this.offline, required this.expired});

  final bool offline;
  final bool expired;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: Motion.of(context, Motion.ui),
      curve: Motion.out,
      alignment: Alignment.topCenter,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (offline)
            const _StatusLine(
              icon: LucideIcons.wifiOff,
              message: AuthCopy.offlineBanner,
            ),
          if (expired)
            const _StatusLine(
              icon: LucideIcons.info,
              message: AuthCopy.sessionExpired,
            ),
        ],
      ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s6),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: ExcludeSemantics(
                child: Icon(icon, size: 16, color: colors.ink),
              ),
            ),
            const SizedBox(width: MmSpace.s8),
            Flexible(
              child: Text(
                message,
                textAlign: TextAlign.center,
                style: context.mmType.small.copyWith(color: colors.ink2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Reports no intrinsic height of its own, so a flexible slot built from it never pushes the
/// screen into scrolling; it only takes what the rest of the column leaves.
class _NoIntrinsicHeight extends SingleChildRenderObjectWidget {
  const _NoIntrinsicHeight({required Widget super.child});

  @override
  RenderObject createRenderObject(BuildContext context) =>
      _RenderNoIntrinsicHeight();
}

class _RenderNoIntrinsicHeight extends RenderProxyBox {
  @override
  double computeMinIntrinsicHeight(double width) => 0;

  @override
  double computeMaxIntrinsicHeight(double width) => 0;
}

/// Mobi's slot: Mobi as the hero in a pool of volt light, as large as the slot allows (up to
/// [_heroHeight]) and never smaller than [_heroFloor].
class _HeroSlot extends StatelessWidget {
  const _HeroSlot({required this.controller, required this.entrance});

  final MobiController controller;
  final MobiAct entrance;

  static const double _heroHeight = 232;
  static const double _heroFloor = 72;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: _heroFloor),
      child: _NoIntrinsicHeight(
        // Anchored to the heading below it: the slot's spare height goes above Mobi.
        child: Align(
          alignment: Alignment.bottomCenter,
          child: FittedBox(
            child: SizedBox(
              width: 300,
              height: _heroHeight + 16,
              child: _MobiHero(
                controller: controller,
                entrance: entrance,
                height: _heroHeight,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MobiHero extends StatelessWidget {
  const _MobiHero({
    required this.controller,
    required this.entrance,
    required this.height,
  });

  final MobiController controller;
  final MobiAct entrance;
  final double height;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final night = colors.isNight;
    // The pool of light the hero stands in: volt at the centre, nothing at the rim. It fades and
    // swells in once as the screen opens (a still pool under reduced motion).
    final glow = DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          colors: [
            colors.volt.withValues(alpha: night ? 0.26 : 0.5),
            colors.volt.withValues(alpha: night ? 0.1 : 0.2),
            colors.volt.withValues(alpha: 0),
          ],
          stops: const [0, 0.5, 1],
        ),
      ),
    );

    return Stack(
      alignment: Alignment.center,
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: IgnorePointer(
            child: TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 0, end: 1),
              duration: Motion.of(
                context,
                Motion.emphasizedDuration + Motion.glideDuration,
              ),
              curve: Motion.emphasized,
              builder: (context, t, child) => Opacity(
                opacity: t,
                child: Transform.scale(scale: 0.8 + 0.2 * t, child: child),
              ),
              child: OverflowBox(
                maxWidth: 400,
                maxHeight: 400,
                child: SizedBox(width: 340, height: 340, child: glow),
              ),
            ),
          ),
        ),
        Mobi(
          pose: MobiPose.idle,
          size: height,
          controller: controller,
          entrance: entrance,
        ),
      ],
    );
  }
}

/// A 48 dp back arrow whose glyph sits on the content's left edge (the key extends 13 dp past
/// it, so the touch target stays 48 dp); it sinks into a sunken square while pressed. No ripple.
class BackKey extends StatefulWidget {
  const BackKey({
    super.key,
    required this.onPressed,
    this.label = AuthCopy.back,
  });

  final VoidCallback onPressed;
  final String label;

  @override
  State<BackKey> createState() => _BackKeyState();
}

class _BackKeyState extends State<BackKey> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Transform.translate(
      offset: const Offset(-(MmTarget.min - 22) / 2, 0),
      child: Semantics(
        button: true,
        label: widget.label,
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
      ),
    );
  }
}

/// One plain line of what went wrong and what to do. Colour is the second signal; the icon and
/// the words carry it. Read out when it appears. [centered] sets it under a centred field.
class ProblemLine extends StatelessWidget {
  const ProblemLine({super.key, required this.message, this.centered = false});

  final String message;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        mainAxisAlignment: centered
            ? MainAxisAlignment.center
            : MainAxisAlignment.start,
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
          Flexible(
            child: Text(
              message,
              textAlign: centered ? TextAlign.center : TextAlign.start,
              style: context.mmType.small.copyWith(color: colors.ink),
            ),
          ),
        ],
      ),
    );
  }
}
