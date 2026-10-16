import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/api/api.dart';
import '../../../core/auth/auth_state.dart';
import '../../../core/router/routes.dart';
import '../../../core/settings/changed_row.dart';
import '../../../core/theme/theme.dart';
import '../../../core/widgets/widgets.dart';
import '../../account_access/access_gateway.dart' show accessMethodsProvider;
import '../../account_access/access_routes.dart' show AccountAccessRoutes;
import '../../account_access/state/password_hints.dart' show passwordNudgeProvider;
import '../../credits/credits_routes.dart' show openCreditsPage;
import '../copy.dart';
import '../data/student_target.dart';
import '../edit_copy.dart';
import '../widgets/you_page.dart';
import '../widgets/you_row.dart';
import '../you_routes.dart';
import 'name_sheet.dart';
import 'plan_card.dart';
import 'security_rows.dart';
import 'sign_out_flow.dart';

/// Hairlines of a flat list start where the row text starts: 4 dp, a 28 dp bare icon, 16 dp.
const double _flatInset = 28 + MmSpace.s16;

/// Account (spec 5.12.4, WEB-PARITY F2 and F3): the plan (the credit balance is the hero), the
/// name (edited in a sheet and saved to the profile), the subjects, the email, security
/// (password, a phone when the build has phone sign-in, ending other devices' sessions), sign out
/// and the way to ask for deletion. Everything below the plan is a bare list on the ground, with
/// one page margin. Plan and credits come from `/api/auth/me` through the auth snapshot. No
/// price, no purchase.
class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  bool _signingOut = false;
  bool _failed = false;
  DateTime? _nameSavedAt;

  /// The 56 dp Mobi by the balance: a greeting after a saved name, a wave at a confirmed sign out.
  final MobiController _mobi = MobiController();

  @override
  void dispose() {
    _mobi.dispose();
    super.dispose();
  }

  Future<void> _signOut() async {
    if (_signingOut) return;
    // Busy from the first tap, so a second tap cannot open a second sheet while the phone is read.
    setState(() {
      _signingOut = true;
      _failed = false;
    });
    final pending = await pendingWork(ref);
    if (!mounted) return;
    final confirmed = await confirmSignOut(context, pending: pending.count, unknown: pending.unknown);
    if (!mounted) return;
    if (!confirmed) {
      setState(() => _signingOut = false);
      return;
    }
    // The student has confirmed: Mobi waves goodbye while the sign out goes through.
    _mobi.react(MobiMoments.act(MobiEvent.goodbye));
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

  Future<void> _editName() async {
    final saved = await showNameSheet(context);
    if (saved != null && mounted) {
      setState(() => _nameSavedAt = ref.read(nowProvider)());
      ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.account);
      // The sheet closes only after the server answered, so this is an acknowledged save: Mobi
      // says hello to the name that is now on the account.
      final first = saved.trim().split(RegExp(r'\s+')).first;
      if (first.isNotEmpty) {
        _mobi.say(YouCopy.hubGreeting(first), live: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authSnapshotProvider);
    final target = ref.watch(studentTargetProvider);
    final name = auth.name?.trim();
    final hasName = name != null && name.isNotEmpty;
    final subjects = auth.subjects.isNotEmpty ? auth.subjects : target.subjects;
    final nudge = ref.watch(passwordNudgeProvider).value ?? false;
    final phoneOn = ref.watch(accessMethodsProvider.select((m) => m.phone));

    return YouPage(
      title: YouCopy.accountTitle,
      children: [
        PlanCard(auth: auth, mobi: _mobi),
        // Both pools and every use of them live on Credits; the plan card shows Practice credits.
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s8, youText, 0),
          child: Align(
            alignment: Alignment.centerLeft,
            child: KeyButton.quiet(label: YouCopy.seeHistory, semanticsLabel: YouCopy.seeHistoryLabel, onPressed: () => openCreditsPage(context)),
          ),
        ),
        const GroupHeading(YouCopy.accountProfile, top: MmSpace.s32),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
              icon: LucideIcons.pencilLine,
              title: YouCopy.accountName,
              note: hasName ? name : EditCopy.nameAdd,
              onTap: _editName,
            ),
            YouRow(
              flat: true,
              icon: LucideIcons.bookOpen,
              title: YouCopy.fieldSubjects,
              note: subjects.isEmpty ? EditCopy.notSet : subjects.map(subjectDisplayName).join(', '),
              onTap: () => openYouPage(context, YouPaths.subjects),
            ),
            if (auth.email != null)
              YouFactRow(
                icon: LucideIcons.atSign,
                title: YouCopy.accountEmail,
                note: auth.email,
                semanticsLabel: '${YouCopy.accountEmail}. ${auth.email}. ${YouCopy.accountEmailNote}',
              ),
          ],
        ),
        if (auth.email != null) const ProfileFootnote(YouCopy.accountEmailNote),
        if (_nameSavedAt != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(youText, MmSpace.s12, MmSpace.gutter, 0),
            child: ReceiptLine(text: EditCopy.nameSaved(_nameSavedAt!)),
          ),
        const GroupHeading(YouCopy.accountSecurity),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            if (nudge)
              PasswordNudgeRow(onSetPassword: () => context.push(AccountAccessRoutes.setPassword))
            else
              YouRow(
                flat: true,
                icon: LucideIcons.keyRound,
                title: YouCopy.accountPassword,
                note: YouCopy.accountPasswordNote,
                onTap: () => context.push(AccountAccessRoutes.setPassword),
              ),
            if (phoneOn)
              YouRow(
                flat: true,
                icon: LucideIcons.smartphone,
                title: YouCopy.accountAddPhone,
                note: YouCopy.accountAddPhoneNote,
                onTap: () => context.push(AccountAccessRoutes.addPhone),
              ),
            const SignOutOthersRow(),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(youText, MmSpace.s32, youText, 0),
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
        const SizedBox(height: MmSpace.s24),
        YouPanel(
          flat: true,
          inset: _flatInset,
          children: [
            YouRow(
              flat: true,
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
