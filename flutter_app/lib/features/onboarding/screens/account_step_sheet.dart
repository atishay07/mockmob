import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth.dart';
import '../../../core/connectivity/connectivity.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../auth/copy.dart';
import '../../auth/sign_in_controller.dart';
import '../../auth/sign_in_state.dart';
import '../copy.dart';

/// Opens the account step over the sample result (spec 5.1.5).
Future<void> showAccountStepSheet(BuildContext context) =>
    showMmSheet<void>(context: context, builder: (_) => const AccountStepSheet());

/// "Create a free account to keep your five answers and start a mock." Two ways in, both run by
/// the auth feature (its Google call, its remembered "Before you start" route, its error words).
/// The answers stay on this phone, and say so, until the server acknowledges the import after
/// sign-in.
class AccountStepSheet extends ConsumerStatefulWidget {
  const AccountStepSheet({super.key});

  @override
  ConsumerState<AccountStepSheet> createState() => _AccountStepSheetState();
}

class _AccountStepSheetState extends ConsumerState<AccountStepSheet> {
  @override
  void initState() {
    super.initState();
    // A message left from an earlier try on the sign-in screen is not news here.
    Future.microtask(() {
      if (mounted) ref.read(signInControllerProvider.notifier).clearProblem();
    });
  }

  void _email() {
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(AppRoutes.signIn);
  }

  @override
  Widget build(BuildContext context) {
    // Signed in (the router moves on by itself): the sheet has done its job.
    ref.listen<bool>(authSnapshotProvider.select((s) => s.isSignedIn), (_, signedIn) {
      if (signedIn && mounted) Navigator.of(context).maybePop();
    });
    final offline = ref.watch(networkStatusProvider) == NetworkStatus.offline;
    final sign = ref.watch(signInControllerProvider);
    final problem = sign.problemFor(SignInStep.email);
    return AccountStepView(
      offline: offline,
      googleLoading: sign.busy == SignInBusy.google,
      error: problem == null ? null : AuthCopy.problem(problem, SignInStep.email),
      onGoogle: () => ref.read(signInControllerProvider.notifier).signInWithGoogle(),
      onEmail: _email,
      onNotNow: () => Navigator.of(context).pop(),
    );
  }
}

/// The pure layout of the account step, rendered by the goldens.
class AccountStepView extends StatelessWidget {
  const AccountStepView({
    super.key,
    required this.onGoogle,
    required this.onEmail,
    required this.onNotNow,
    this.offline = false,
    this.googleLoading = false,
    this.error,
  });

  final VoidCallback onGoogle;
  final VoidCallback onEmail;
  final VoidCallback onNotNow;
  final bool offline;
  final bool googleLoading;
  final String? error;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(header: true, child: Text(OnboardingCopy.accountTitle, style: type.title)),
        const SizedBox(height: MmSpace.s16),
        const ReceiptLine(text: OnboardingCopy.accountOnPhone, recorded: false),
        if (offline) ...[
          const SizedBox(height: MmSpace.s16),
          Text(OnboardingCopy.offlineSignIn, style: type.body.copyWith(color: colors.ink)),
        ],
        if (error != null) ...[
          const SizedBox(height: MmSpace.s16),
          Semantics(liveRegion: true, child: Text(error!, style: type.body.copyWith(color: colors.badText))),
        ],
        const SizedBox(height: MmSpace.s24),
        KeyButton(
          label: OnboardingCopy.continueWithGoogle,
          loading: googleLoading,
          onPressed: offline ? null : onGoogle,
        ),
        const SizedBox(height: MmSpace.s12),
        KeyButton.secondary(label: OnboardingCopy.useEmailCode, onPressed: offline || googleLoading ? null : onEmail),
        const SizedBox(height: MmSpace.s8),
        Align(child: KeyButton.quiet(label: OnboardingCopy.notNow, onPressed: onNotNow)),
      ],
    );
  }
}
