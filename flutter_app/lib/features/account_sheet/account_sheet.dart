// The Account sheet (owner, APK v8 review, 15 Oct 2026): "There should be a proper account
// setting option easily accessible", and "Where's the option to do light or dark mode?". It rises
// from the avatar on every tab root's top row: who is signed in, the plan, both credit balances
// with what each one pays for, the theme as one instant switch, the settings rows, and sign out.
// Every row opens the screen that already owns that setting; nothing here is a second copy of it.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_state.dart';
import '../../core/mascot/mascot.dart' show MobiAct, MobiCharacter;
import '../../core/copy/formatters.dart' show formatDayMonth;
import '../../core/models/ai_credits.dart';
import '../../core/repositories/credits_repository.dart';
import '../../core/repositories/remote_state.dart';
import '../../core/router/routes.dart';
import '../../core/settings/appearance_settings.dart';
import '../../core/settings/changed_row.dart';
import '../../core/storage/app_prefs.dart' show ThemeChoice;
import '../../core/theme/theme.dart';
import '../../core/widgets/account/account_avatar.dart';
import '../../core/widgets/widgets.dart';
import '../you/account/sign_out_flow.dart' show confirmSignOut, pendingWork, performSignOut;
import '../you/widgets/you_row.dart' show YouPanel, YouRow;
import '../you/widgets/you_motion.dart' show YouIconMotion;
import '../you/you_providers.dart' show supportMailerProvider;
import 'account_copy.dart';

/// Opens the Account sheet over everything (the root navigator), so it covers the bar too.
Future<void> showAccountSheet(BuildContext context) {
  return showMmSheet<void>(context: context, builder: (context) => const AccountSheet());
}

/// Where the rows lead. Each path is an existing screen.
abstract final class AccountSheetPaths {
  static const account = AppRoutes.youAccount;
  static const notifications = AppRoutes.youNotifications;
  static const studyDays = AppRoutes.youRhythm;
  static const privacy = AppRoutes.youPrivacy;
  static const help = AppRoutes.youHelp;
  static const ask = AppRoutes.ask;
}

class AccountSheet extends ConsumerStatefulWidget {
  const AccountSheet({super.key});

  @override
  ConsumerState<AccountSheet> createState() => _AccountSheetState();
}

class _AccountSheetState extends ConsumerState<AccountSheet> {
  bool _signingOut = false;
  bool _signOutFailed = false;

  /// Closes the sheet and opens [path] over the app, so Back from that screen lands where the
  /// student was, not in a half-open sheet.
  void _open(String path) {
    final router = GoRouter.of(context);
    Navigator.of(context).maybePop();
    unawaited(router.push(path));
  }

  Future<void> _contact() async {
    final ok = await ref.read(supportMailerProvider).compose();
    // No mail app: Help shows the address with a key to copy it.
    if (!ok && mounted) _open(AccountSheetPaths.help);
  }

  void _chooseTheme(ThemeMode mode) {
    final choice = switch (mode) {
      ThemeMode.dark => ThemeChoice.dark,
      ThemeMode.light => ThemeChoice.light,
      ThemeMode.system => ThemeChoice.system,
    };
    // The theme swaps this frame (the app's cross-fade carries it); saving it is a convenience.
    unawaited(ref.read(themeModeProvider.notifier).choose(choice).catchError((Object _) {}));
    ref.read(changedSettingsRowProvider.notifier).mark(ChangedRowKeys.appearance);
  }

  /// The existing sign-out: a warning when work is only on this phone, then the auth controller.
  Future<void> _signOut() async {
    if (_signingOut) return;
    setState(() {
      _signingOut = true;
      _signOutFailed = false;
    });
    final pending = await pendingWork(ref);
    if (!mounted) return;
    final confirmed = await confirmSignOut(context, pending: pending.count, unknown: pending.unknown);
    if (!mounted) return;
    if (!confirmed) {
      setState(() => _signingOut = false);
      return;
    }
    try {
      await performSignOut(ref);
    } on Object {
      if (mounted) {
        setState(() {
          _signingOut = false;
          _signOutFailed = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final auth = ref.watch(authSnapshotProvider);
    final credits = ref.watch(creditsRepositoryProvider);
    final mode = ref.watch(themeModeProvider);

    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      label: AccountCopy.sheetLabel,
      explicitChildNodes: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _Identity(auth: auth),
          const SizedBox(height: MmSpace.s24),
          _Caption(AccountCopy.credits),
          const SizedBox(height: MmSpace.s12),
          _CreditTiles(
            auth: auth,
            credits: credits,
            onPractice: () => _open(AccountSheetPaths.account),
            onAi: () => _open(AccountSheetPaths.ask),
          ),
          const SizedBox(height: MmSpace.s24),
          _Caption(AccountCopy.appearance),
          const SizedBox(height: MmSpace.s12),
          MmSegmented<ThemeMode>(
            semanticsLabel: AccountCopy.appearance,
            value: mode,
            segments: const [
              MmSegment(ThemeMode.dark, AccountCopy.themeDark),
              MmSegment(ThemeMode.light, AccountCopy.themeLight),
              MmSegment(ThemeMode.system, AccountCopy.themeSystem),
            ],
            onChanged: _chooseTheme,
          ),
          const SizedBox(height: MmSpace.s16),
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: 28 + MmSpace.s16,
            children: [
              YouRow(
                flat: true,
                icon: LucideIcons.user,
                motion: YouIconMotion.hop,
                title: AccountCopy.rowAccount,
                onTap: () => _open(AccountSheetPaths.account),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.bell,
                motion: YouIconMotion.swing,
                title: AccountCopy.rowNotifications,
                onTap: () => _open(AccountSheetPaths.notifications),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.calendarDays,
                motion: YouIconMotion.ping,
                title: AccountCopy.rowStudyDays,
                onTap: () => _open(AccountSheetPaths.studyDays),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.shieldCheck,
                motion: YouIconMotion.tick,
                tickIcon: LucideIcons.shield,
                title: AccountCopy.rowPrivacy,
                onTap: () => _open(AccountSheetPaths.privacy),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.lifeBuoy,
                motion: YouIconMotion.turn,
                title: AccountCopy.rowHelp,
                onTap: () => _open(AccountSheetPaths.help),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.mail,
                title: AccountCopy.rowContact,
                note: AccountCopy.contactAddress,
                external: true,
                onTap: _contact,
              ),
            ],
          ),
          const SizedBox(height: MmSpace.s24),
          KeyButton.secondary(
            label: AccountCopy.signOut,
            loading: _signingOut,
            onPressed: _signingOut ? null : _signOut,
          ),
          if (_signOutFailed) ...[
            const SizedBox(height: MmSpace.s8),
            Semantics(
              liveRegion: true,
              child: Text(AccountCopy.signOutFailed, style: type.small.copyWith(color: colors.badText), textAlign: TextAlign.center),
            ),
          ],
        ],
      ),
    );
  }
}

class _Caption extends StatelessWidget {
  const _Caption(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Text(text, style: context.mmType.caption.copyWith(color: context.mmColors.ink2)),
    );
  }
}

/// The disc at 56 dp, the name in the title cut with the email under it, and the plan tag.
class _Identity extends StatelessWidget {
  const _Identity({required this.auth});

  final AuthSnapshot auth;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final name = auth.name?.trim();
    final email = auth.email?.trim();
    final hasName = name != null && name.isNotEmpty;
    final hasEmail = email != null && email.isNotEmpty;
    final primary = hasName ? name : (hasEmail ? email : AccountCopy.noName);
    final secondary = hasName && hasEmail ? email : null;
    return Row(
      children: [
        AccountAvatar(initial: accountInitial(auth.name, auth.email), size: 56, pro: auth.isPro),
        const SizedBox(width: MmSpace.s16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Semantics(
                header: true,
                child: Text(primary, style: type.title, maxLines: 1, overflow: TextOverflow.ellipsis),
              ),
              if (secondary != null) ...[
                const SizedBox(height: 2),
                Text(secondary, style: type.small.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ],
          ),
        ),
        const SizedBox(width: MmSpace.s12),
        _PlanTag(pro: auth.isPro),
      ],
    );
  }
}

/// "Pro" inked in volt, or "Free" as a quiet outline (the plan card's tag, in small).
class _PlanTag extends StatelessWidget {
  const _PlanTag({required this.pro});

  final bool pro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: pro ? colors.volt : null,
        borderRadius: MmRadius.pillAll,
        border: pro ? null : Border.all(color: colors.lineStrong),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: MmSpace.s12, vertical: MmSpace.s4),
        child: Text(
          pro ? AccountCopy.planPro : AccountCopy.planFree,
          style: context.mmType.label.copyWith(color: pro ? colors.voltInk : colors.ink2, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// The two ledgers side by side, each with what it pays for. Practice credits come from the
/// profile (the same figure the Account screen shows); AI credits from the explanation wallet. A
/// balance that is not known reads "Not loaded", never 0.
class _CreditTiles extends StatelessWidget {
  const _CreditTiles({required this.auth, required this.credits, required this.onPractice, required this.onAi});

  final AuthSnapshot auth;
  final RemoteState<AiCredits> credits;
  final VoidCallback onPractice;
  final VoidCallback onAi;

  @override
  Widget build(BuildContext context) {
    final wallet = credits.value;
    final practiceBalance = auth.creditBalance ?? wallet?.practiceBalance;
    final String practiceFigure;
    final String practiceMeaning;
    if (auth.isPro) {
      practiceFigure = AccountCopy.unlimited;
      practiceMeaning = AccountCopy.practiceProMeaning;
    } else {
      practiceFigure = practiceBalance == null ? AccountCopy.notLoaded : '$practiceBalance';
      practiceMeaning = AccountCopy.practiceMeaning;
    }

    final aiBalance = wallet?.explanationBalance;
    final String aiFigure;
    if (aiBalance != null) {
      aiFigure = '$aiBalance';
    } else if (credits.isInitialLoading || (credits.loading && wallet == null)) {
      aiFigure = AccountCopy.checking;
    } else {
      aiFigure = AccountCopy.notLoaded;
    }
    final paused = wallet?.isPaused ?? false;
    final resetAt = wallet?.resetAt?.toLocal();
    final aiMeaning = paused ? AccountCopy.aiPaused : AccountCopy.aiMeaning;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: _CreditTile(
              key: const ValueKey('account-practice-credits'),
              title: AccountCopy.practiceTitle,
              figure: practiceFigure,
              known: auth.isPro || practiceBalance != null,
              meaning: practiceMeaning,
              semanticsLabel: AccountCopy.practiceLabel(practiceFigure, practiceMeaning),
              onTap: onPractice,
            ),
          ),
          const SizedBox(width: MmSpace.s12),
          Expanded(
            child: _CreditTile(
              key: const ValueKey('account-ai-credits'),
              title: AccountCopy.aiTitle,
              figure: aiFigure,
              known: aiBalance != null,
              meaning: aiMeaning,
              footnote: resetAt == null || paused ? null : AccountCopy.aiRenews(formatDayMonth(resetAt)),
              mobi: true,
              semanticsLabel: AccountCopy.aiLabel(aiFigure, aiMeaning),
              onTap: onAi,
            ),
          ),
        ],
      ),
    );
  }
}

class _CreditTile extends StatelessWidget {
  const _CreditTile({
    super.key,
    required this.title,
    required this.figure,
    required this.known,
    required this.meaning,
    required this.semanticsLabel,
    required this.onTap,
    this.footnote,
    this.mobi = false,
  });

  final String title;
  final String figure;

  /// False draws the figure as a quiet line ("Not loaded"), not a number.
  final bool known;
  final String meaning;
  final String? footnote;

  /// A small, still Mobi head beside the AI ledger (these are his replies). He never moves here.
  final bool mobi;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final numeric = known && int.tryParse(figure) != null;
    return MmSurface.inset(
      onTap: onTap,
      semanticsLabel: semanticsLabel,
      padding: const EdgeInsets.fromLTRB(MmSpace.s12, MmSpace.s12, MmSpace.s8, MmSpace.s12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: type.caption.copyWith(color: colors.ink2), maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (mobi) ...[
                const MobiCharacter(size: 22, head: true, still: true, shadow: false, entrance: MobiAct.idle),
                const SizedBox(width: MmSpace.s4),
              ],
              Icon(LucideIcons.chevronRight, size: 14, color: colors.ink3),
            ],
          ),
          const SizedBox(height: MmSpace.s8),
          Text(
            figure,
            style: numeric
                ? type.figureCompact.copyWith(color: colors.ink)
                : (known ? type.title : type.body.copyWith(color: colors.ink3)),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: MmSpace.s4),
          Text(meaning, style: type.small.copyWith(color: colors.ink2), maxLines: 2, overflow: TextOverflow.ellipsis),
          if (footnote != null) ...[
            const SizedBox(height: 2),
            Text(footnote!, style: type.caption.copyWith(color: colors.ink3), maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ],
      ),
    );
  }
}
