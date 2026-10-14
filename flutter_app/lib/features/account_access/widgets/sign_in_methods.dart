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
/// separate ways in.
const double _orGap = MmSpace.s20 + MmSpace.s8;

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
      SignInMethod.emailCode => KeyedSubtree(key: const ValueKey(SignInMethod.emailCode), child: widget.emailCode),
      SignInMethod.password => PasswordSignInForm(
          key: const ValueKey(SignInMethod.password),
          initialEmail: widget.initialEmail,
          busy: _googleBusy || widget.busy,
          onBusyChanged: (v) => _setBusy(password: v),
          onSignedIn: widget.onSignedIn,
          onForgotPassword: widget.onForgotPassword ??
              () => context.push(AccountAccessRoutes.forgotPasswordFor(email: widget.initialEmail)),
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
                child: Text(AccessCopy.or, style: type.small.copyWith(color: colors.ink3)),
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
          onChanged: _otherBusy || widget.busy ? null : (m) => setState(() => _method = m),
        ),
        const SizedBox(height: MmSpace.s24),
        AnimatedSwitcher(
          duration: reduced ? Duration.zero : const Duration(milliseconds: 180),
          switchInCurve: Motion.glide,
          switchOutCurve: Motion.glide,
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
                    : widget.onPhone ?? () => context.push(AccountAccessRoutes.phoneSignIn),
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
  const _MethodTabs({required this.labels, required this.value, required this.onChanged, this.semanticsLabel});

  final Map<SignInMethod, String> labels;
  final SignInMethod value;

  /// Null holds the tabs (a method is working).
  final ValueChanged<SignInMethod>? onChanged;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.mmColors;
    final type = context.mmType;
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
              Positioned(left: 0, right: 0, bottom: 0, child: Divider(height: 1, thickness: 1, color: colors.line)),
              AnimatedAlign(
                alignment: Alignment(n == 1 ? 0 : -1 + 2 * index / (n - 1), 1),
                duration: Motion.of(context, Motion.glideDuration),
                curve: Motion.emphasized,
                child: FractionallySizedBox(
                  widthFactor: 1 / n,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: MmSpace.s24),
                    child: DecoratedBox(
                      decoration: BoxDecoration(color: colors.accentText, borderRadius: MmRadius.pillAll),
                      child: const SizedBox(height: 3),
                    ),
                  ),
                ),
              ),
              Row(
                children: [
                  for (var i = 0; i < n; i++)
                    Expanded(
                      child: Semantics(
                        button: true,
                        selected: i == index,
                        inMutuallyExclusiveGroup: true,
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: held || i == index
                              ? null
                              : () {
                                  ref.read(hapticsProvider).selection();
                                  onChanged!(entries[i].key);
                                },
                          child: Center(
                            child: AnimatedDefaultTextStyle(
                              duration: Motion.of(context, Motion.ui),
                              style: type.labelLarge.copyWith(
                                fontSize: 15,
                                fontWeight: i == index ? FontWeight.w700 : FontWeight.w500,
                                color: i == index ? colors.ink : colors.ink2,
                              ),
                              child: Text(entries[i].value, maxLines: 1, overflow: TextOverflow.ellipsis),
                            ),
                          ),
                        ),
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
