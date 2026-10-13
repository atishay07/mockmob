import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import 'sign_out_flow.dart';

/// Account (spec 5.12.4): email, plan, sign out and the way to ask for deletion. The plan line
/// comes from the server's `/api/auth/me` through the auth snapshot. No price, no purchase link.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _signingOut = false;
  bool _failed = false;

  Future<void> _signOut() async {
    final unsent = await unsentAnswers(ref);
    if (!mounted) return;
    final confirmed = await confirmSignOut(context, unsent: unsent);
    if (!confirmed || !mounted) return;
    setState(() {
      _signingOut = true;
      _failed = false;
    });
    try {
      await performSignOut(ref);
    } on Object {
      if (mounted) {
        setState(() {
          _signingOut = false;
          _failed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authSnapshotProvider);
    final plan = auth.isPro
        ? (auth.premiumUntil == null ? YouCopy.planActive : YouCopy.planActiveUntil(auth.premiumUntil!.toLocal()))
        : YouCopy.accountPlanOff;

    return YouPage(
      title: YouCopy.accountTitle,
      children: [
        const SizedBox(height: MmSpace.s8),
        YouPanel(
          children: [
            if (auth.name != null && auth.name!.trim().isNotEmpty) _Fact(label: YouCopy.accountName, value: auth.name!),
            if (auth.email != null) _Fact(label: YouCopy.accountEmail, value: auth.email!),
            _Fact(label: YouCopy.accountPlan, value: plan, note: YouCopy.planHonoured),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.s24, MmSpace.gutter, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_failed) ...[
                const InlineBanner(message: YouCopy.signOutFailed, tone: BannerTone.error),
                const SizedBox(height: MmSpace.s16),
              ],
              KeyButton.secondary(label: YouCopy.signOut, loading: _signingOut, onPressed: _signingOut ? null : _signOut),
            ],
          ),
        ),
        const SizedBox(height: MmSpace.s32),
        YouPanel(
          children: [
            YouRow(
              icon: LucideIcons.trash2,
              title: YouCopy.deleteRow,
              note: YouCopy.deleteRowNote,
              destructive: true,
              onTap: () => context.push(AppRoutes.youDelete),
            ),
          ],
        ),
      ],
    );
  }
}

/// One label and value pair with a hairline under it. Values wrap; they never truncate.
class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value, this.note});

  final String label;
  final String value;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return RowFrame(
      semanticsLabel: note == null ? '$label. $value' : '$label. $value. $note',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: type.caption.copyWith(color: colors.ink3)),
          const SizedBox(height: 2),
          Text(value, style: type.labelLarge.copyWith(fontSize: 16)),
          if (note != null) ...[
            const SizedBox(height: MmSpace.s4),
            Text(note!, style: type.caption.copyWith(color: colors.ink2)),
          ],
        ],
      ),
    );
  }
}
