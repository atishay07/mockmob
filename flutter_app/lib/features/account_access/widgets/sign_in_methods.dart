import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/haptics/haptics.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../access_copy.dart';
import '../access_gateway.dart';
import '../access_routes.dart';
import 'google_button.dart';
import 'password_sign_in_form.dart';

enum SignInMethod { emailCode, password }

/// Air above and below the "or" divider, so the Google key and the method choice read as two
/// separate ways in (the group gap).
const double _orGap = MmSpace.s24;

/// Every way to sign in, for the sign-in screen: Google on top (one tap when it works), then a
/// choice between the email code (the screen's own form, passed in as [emailCode]) and a
/// password, and the phone when the build has it. One method works at a time; the others wait.
class SignInMethods extends ConsumerStatefulWidget {
  const SignInMethods({
    super.key,
    required this.emailCode,
    this.initialMethod = SignInMethod.emailCode,
    this.initialEmail = '',
    this.onForgotPassword,
    this.onPhone,
    this.busy = false,
    this.onBusyChanged,
    this.onSignedIn,
  });

  /// The existing email-code block (email field and "Send code").
  final Widget emailCode;
  final SignInMethod initialMethod;

  /// Prefills the password form's email.
  final String initialEmail;

  /// Defaults to opening [AccountAccessRoutes.forgotPassword].
  final VoidCallback? onForgotPassword;

  /// Defaults to opening [AccountAccessRoutes.phoneSignIn].
  final VoidCallback? onPhone;

  /// The screen's own email-code form is working (sending a code): hold Google, the method
  /// choice and the phone key until it is done.
  final bool busy;

  /// Tells the screen when Google or the password form is working, so it can hold its own keys.
  final ValueChanged<bool>? onBusyChanged;

  /// Google or the password signed the student in (on the spot or through the browser). The
  /// router moves on by itself; this is for what the screen does besides.
  final VoidCallback? onSignedIn;

  @override
  ConsumerState<SignInMethods> createState() => _SignInMethodsState();
}

class _SignInMethodsState extends ConsumerState<SignInMethods> {
  late SignInMethod _method = widget.initialMethod;
  late SignInMethod _previous = widget.initialMethod;
  bool _googleBusy = false;
  bool _passwordBusy = false;

  bool get _otherBusy => _googleBusy || _passwordBusy;

  void _setBusy({bool? google, bool? password}) {
    final before = _otherBusy;
    setState(() {
      _googleBusy = google ?? _googleBusy;
      _passwordBusy = password ?? _passwordBusy;
    });
    if (before != _otherBusy) widget.onBusyChanged?.call(_otherBusy);
  }

  @override
  Widget build(BuildContext context) {
    final methods = ref.watch(accessMethodsProvider);
    final colors = context.mmColors;
    final type = context.mmType;
    final reduced = Motion.reduced(context);

    final body = switch (_method) {
      SignInMethod.emailCode => KeyedSubtree(
        key: const ValueKey(SignInMethod.emailCode),
        child: widget.emailCode,
      ),
      SignInMethod.password => PasswordSignInForm(
        key: const ValueKey(SignInMethod.password),
        initialEmail: widget.initialEmail,
        busy: _googleBusy || widget.busy,
        onBusyChanged: (v) => _setBusy(password: v),
        onSignedIn: widget.onSignedIn,
        onForgotPassword:
            widget.onForgotPassword ??
            () => context.push(
              AccountAccessRoutes.forgotPasswordFor(email: widget.initialEmail),
            ),
      ),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (methods.google) ...[
          GoogleSignInButton(
            busy: _passwordBusy || widget.busy,
            onSignedIn: widget.onSignedIn,
            onBusyChanged: (v) => _setBusy(google: v),
          ),
          const SizedBox(height: _orGap),
          Row(
            children: [
              Expanded(child: Divider(color: colors.line, height: 1)),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12),
                child: Text(
                  AccessCopy.or,
                  style: type.small.copyWith(color: colors.ink3),
                ),
              ),
              Expanded(child: Divider(color: colors.line, height: 1)),
            ],
          ),
          const SizedBox(height: _orGap),
        ],
        _MethodTabs(
          semanticsLabel: AccessCopy.methodsLabel,
          labels: const {
            SignInMethod.emailCode: AccessCopy.methodCode,
            SignInMethod.password: AccessCopy.methodPassword,
          },
          value: _method,
          onChanged: _otherBusy || widget.busy
              ? null
              : (m) => setState(() {
                  _previous = _method;
                  _method = m;
                }),
        ),
        const SizedBox(height: MmSpace.s24),
        AnimatedSwitcher(
          duration: reduced ? Duration.zero : const Duration(milliseconds: 180),
          switchInCurve: Motion.glide,
          switchOutCurve: Motion.glide,
          // The form drifts the way the tab went (12 dp, transform and opacity only): the new
          // one arrives from that side while the old one leaves the other way.
          transitionBuilder: (child, animation) {
            final incoming = child.key == ValueKey(_method);
            final side = _method.index >= _previous.index ? 1.0 : -1.0;
            return FadeTransition(
              opacity: animation,
              child: AnimatedBuilder(
                animation: animation,
                builder: (context, child) => Transform.translate(
                  offset: Offset(
                    (incoming ? 1 : -1) *
                        side *
                        MmSpace.s12 *
                        (1 - animation.value),
                    0,
                  ),
                  child: child,
                ),
                child: child,
              ),
            );
          },
          child: body,
        ),
        if (methods.phone) ...[
          const SizedBox(height: MmSpace.s12),
          Align(
            alignment: Alignment.centerLeft,
            // The quiet key carries 16 dp of inner padding; pull it back so its label lines up.
            child: Transform.translate(
              offset: const Offset(-MmSpace.s16, 0),
              child: KeyButton.quiet(
                label: AccessCopy.usePhone,
                onPressed: _otherBusy || widget.busy
                    ? null
                    : widget.onPhone ??
                          () => context.push(AccountAccessRoutes.phoneSignIn),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Two ways in as two plain tabs: the labels sit on one hairline and a volt bar glides under
/// the chosen one (a thicker label and the bar both say which, so it never rests on colour
/// alone). Unlike a pill inside a track there is one surface, not two. Changing the tab gives a
/// selection tick; the bar jumps under reduced motion. Each tab is a full-width 48 dp target.
class _MethodTabs extends ConsumerWidget {
  const _MethodTabs({
    required this.labels,
    required this.value,
    required this.onChanged,
    this.semanticsLabel,
  });

  final Map<SignInMethod, String> labels;
  final SignInMethod value;

  /// Null holds the tabs (a method is working).
  final ValueChanged<SignInMethod>? onChanged;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final entries = labels.entries.toList();
    final n = entries.length;
    final index = entries.indexWhere((e) => e.key == value).clamp(0, n - 1);
    final held = onChanged == null;

    return Semantics(
      container: true,
      label: semanticsLabel,
      child: Opacity(
        opacity: held ? 0.6 : 1,
        child: SizedBox(
          height: MmTarget.min,
          child: Stack(
            children: [
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Divider(height: 1, thickness: 1, color: colors.line),
              ),
              // One underline that slides from the old tab to the new (owner, N5).
              MmSlidingIndicator(
                index: index,
                count: n,
                verticalAlign: 1,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: colors.accentText,
                      borderRadius: MmRadius.pillAll,
                    ),
                    child: const SizedBox(height: MmSpace.s4),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < n; i++)
                    Expanded(
                      child: _Tab(
                        label: entries[i].value,
                        selected: i == index,
                        onTap: held || i == index
                            ? null
                            : () {
                                ref.read(hapticsProvider).selection();
                                onChanged!(entries[i].key);
                              },
                      ),
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

/// One tab: a full-width 48 dp target. A veil in the control radius answers the touch in the
/// same frame (sunken in both rooms: the well colour reads on Night's ground and on Day's), the
/// label thickens when chosen.
class _Tab extends StatefulWidget {
  const _Tab({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  State<_Tab> createState() => _TabState();
}

class _TabState extends State<_Tab> {
  bool _down = false;

  void _set(bool down) {
    if (_down != down) setState(() => _down = down);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final selected = widget.selected;
    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: widget.onTap == null ? null : (_) => _set(true),
        onTapCancel: () => _set(false),
        onTapUp: (_) => _set(false),
        onTap: widget.onTap,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  MmSpace.s8,
                  MmSpace.s4,
                  MmSpace.s8,
                  MmSpace.s8,
                ),
                child: IgnorePointer(
                  child: AnimatedOpacity(
                    opacity: _down ? 1 : 0,
                    duration: Motion.of(context, Motion.press),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: colors.sunken,
                        borderRadius: MmRadius.smallAll,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            AnimatedDefaultTextStyle(
              duration: Motion.of(context, Motion.ui),
              style: type.labelLarge.copyWith(
                fontSize: 15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? colors.ink : colors.ink2,
              ),
              child: Text(
                widget.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
