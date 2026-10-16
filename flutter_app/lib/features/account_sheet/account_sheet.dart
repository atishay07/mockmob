// The Account sheet (owner, APK v8 review, 15 Oct 2026): "There should be a proper account
// setting option easily accessible", and "Where's the option to do light or dark mode?". It rises
// from the avatar on every tab root's top row: who is signed in, the plan, both credit balances
// with what each one pays for (a tile opens the Credits page and its history), the theme as one
// instant switch, the settings rows, and sign out. Every row opens the screen that already owns
// that setting; nothing here is a second copy of it.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/auth/auth_state.dart';
import '../../core/router/routes.dart';
import '../../core/theme/theme.dart';
import '../../core/widgets/account/account_avatar.dart';
import '../credits/credits.dart' show CreditsPaths, creditFiguresProvider;
import '../credits/credits_screen.dart' show PlanTag;
import '../credits/widgets/credit_tile.dart' show CreditTiles;
import '../you/account/sign_out_key.dart';
import '../you/appearance/theme_switch.dart';
import '../../core/settings/changed_row.dart';
import '../../core/widgets/widgets.dart';
import '../you/copy.dart' show YouCopy;
import '../you/widgets/you_row.dart' show YouPanel, YouRow;
import '../you/widgets/you_motion.dart' show YouIconMotion;
import '../you/you_providers.dart' show supportMailerProvider;
import 'account_copy.dart';
import 'notifications_row.dart';

/// Opens the Account sheet over everything (the root navigator), so it covers the bar too.
Future<void> showAccountSheet(BuildContext context) {
  return showMmSheet<void>(context: context, builder: (context) => const AccountSheet());
}

/// Where the rows lead. Each path is an existing screen.
abstract final class AccountSheetPaths {
  static const account = AppRoutes.youAccount;
  static const notifications = AppRoutes.youNotifications;
  static const appearance = AppRoutes.youAppearance;
  static const privacy = AppRoutes.youPrivacy;
  static const help = AppRoutes.youHelp;
  static const ask = AppRoutes.ask;
  static const credits = CreditsPaths.credits;
}

class AccountSheet extends ConsumerStatefulWidget {
  const AccountSheet({super.key});

  @override
  ConsumerState<AccountSheet> createState() => _AccountSheetState();
}

class _AccountSheetState extends ConsumerState<AccountSheet> {
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

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authSnapshotProvider);
    final figures = ref.watch(creditFiguresProvider);

    return Semantics(
      scopesRoute: true,
      namesRoute: true,
      label: AccountCopy.sheetLabel,
      explicitChildNodes: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          _Identity(auth: auth, proUntil: figures.isPro ? figures.proUntil : null),
          const SizedBox(height: MmSpace.s24),
          _Caption(AccountCopy.credits),
          const SizedBox(height: MmSpace.s12),
          CreditTiles(figures: figures, mobi: true, flat: true, keyPrefix: 'account', onOpen: () => _open(AccountSheetPaths.credits)),
          const SizedBox(height: MmSpace.s24),
          _Caption(AccountCopy.appearance),
          const SizedBox(height: MmSpace.s12),
          const ThemeSwitch(),
          const SizedBox(height: MmSpace.s16),
          YouPanel(
            flat: true,
            margin: EdgeInsets.zero,
            inset: 28 + MmSpace.s16,
            children: [
              YouRow(
                flat: true,
                icon: LucideIcons.sparkles,
                motion: YouIconMotion.tilt,
                changeKey: ChangedRowKeys.appearance,
                title: YouCopy.rowFeel,
                note: YouCopy.rowFeelNote,
                onTap: () => _open(AccountSheetPaths.appearance),
              ),
              YouRow(
                flat: true,
                icon: LucideIcons.user,
                motion: YouIconMotion.hop,
                title: AccountCopy.rowAccount,
                onTap: () => _open(AccountSheetPaths.account),
              ),
              AccountNotificationsRow(onOpen: () => _open(AccountSheetPaths.notifications)),
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
          const SignOutKey(),
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
  const _Identity({required this.auth, this.proUntil});

  final AuthSnapshot auth;

  /// When Pro ends, for the line under the tag. Null for Free, and for Pro with no date.
  final DateTime? proUntil;

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
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          mainAxisSize: MainAxisSize.min,
          children: [
            PlanTag(pro: auth.isPro),
            if (auth.isPro && proUntil != null) ...[
              const SizedBox(height: 2),
              Text(AccountCopy.proUntil(proUntil!), style: type.caption.copyWith(color: colors.ink2)),
            ],
          ],
        ),
      ],
    );
  }
}
