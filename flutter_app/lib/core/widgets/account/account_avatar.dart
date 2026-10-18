import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../features/account_sheet/account_sheet.dart' show showAccountSheet;
import '../../auth/auth_state.dart';
import '../../router/routes.dart';
import '../../theme/theme.dart';
import '../hit_slop.dart';
import '../pressable.dart';

/// The student's initial: the first letter of their name, or of their email when there is no
/// name yet. Null when neither is known (the avatar then draws a person glyph).
String? accountInitial(String? name, String? email) {
  for (final source in [name, email]) {
    final text = source?.trim() ?? '';
    if (text.isEmpty) continue;
    final first = String.fromCharCode(text.runes.first);
    if (RegExp(r'[0-9A-Za-zÀ-￿]').hasMatch(first)) return first.toUpperCase();
  }
  return null;
}

/// The student's disc: their initial set in the title cut on a raised well, inside a hairline
/// ring that turns volt on Pro. Pure paint, no touch; [AccountAvatarButton] makes it a key.
class AccountAvatar extends StatelessWidget {
  const AccountAvatar({super.key, required this.initial, this.size = 40, this.pro = false});

  final String? initial;
  final double size;
  final bool pro;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    final letter = initial;
    return SizedBox.square(
      dimension: size,
      child: DecoratedBox(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [colors.raised2, colors.raised],
          ),
          border: Border.all(color: pro ? colors.volt : colors.lineStrong, width: pro ? 1.5 : 1),
        ),
        child: Center(
          child: letter == null
              ? Icon(LucideIcons.user, size: size * 0.45, color: colors.ink2)
              : Text(
                  letter,
                  textScaler: TextScaler.noScaling,
                  style: type.title.copyWith(fontSize: size * 0.42, height: 1, color: colors.ink, fontWeight: FontWeight.w700),
                ),
        ),
      ),
    );
  }
}

/// The account key on every tab root's top row: the student's initial at 40 dp, answering a
/// finger anywhere in 48 dp, pressing on the shared spring with a selection tick. Opens the
/// Account sheet (name, plan, both credit balances, appearance, settings, sign out).
class AccountAvatarButton extends ConsumerWidget {
  const AccountAvatarButton({super.key});

  /// The drawn disc. The touch target is 48 dp ([MmHitSlop]), so the disc lines up with the gutter.
  static const double visual = 40;

  /// What TalkBack reads.
  static const String semanticsLabel = 'Account and settings';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final name = ref.watch(authSnapshotProvider.select((a) => a.name));
    final email = ref.watch(authSnapshotProvider.select((a) => a.email));
    final pro = ref.watch(authSnapshotProvider.select((a) => a.isPro));
    // 4 dp all round: the 40 dp disc answers anywhere in 48 by 48.
    return MmHitSlop(
      slop: const EdgeInsets.all((48 - visual) / 2),
      child: MmPressable(
        semanticsLabel: semanticsLabel,
        haptic: MmPressHaptic.selection,
        pressedScale: 0.92,
        focusRadius: BorderRadius.circular(visual / 2),
        onTap: () => showAccountSheet(context),
        builder: (context, pressed, focused) => AccountAvatar(initial: accountInitial(name, email), pro: pro),
      ),
    );
  }
}

/// Whether a screen built as a tab root is showing as a pushed page: Your papers inside Practice and
/// Colleges over the bar (D105) were tab roots before the Mob took a tab. Such a screen leads with a
/// back key instead of the account key, so a student who arrived there can always see the way back.
/// A real tab root is the first page of its branch and is never pushed.
bool showsAsPushedPage(BuildContext context) =>
    (ModalRoute.of(context)?.canPop ?? false) || context.dependOnInheritedWidgetOfExactType<PushedPageMarker>() != null;

/// Marks a page over the bar that may have been opened with nothing under it (Colleges reached by a
/// link): its tab-root header still leads with the back key, which then goes to Today.
class PushedPageMarker extends InheritedWidget {
  const PushedPageMarker({super.key, required super.child});

  @override
  bool updateShouldNotify(PushedPageMarker oldWidget) => false;
}

/// The back key a pushed tab-root screen leads with: the same 24 dp arrow on the gutter as every
/// pushed page's header (MmPageHeader), in a 48 dp target. It pops, or goes to Today when a link
/// opened the screen with nothing under it.
class PushedBackKey extends StatelessWidget {
  const PushedBackKey({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return MmHitSlop(
      slop: const EdgeInsets.fromLTRB(MmSpace.s12, 2, MmSpace.s8, 2),
      child: MmPressable(
        semanticsLabel: 'Back',
        haptic: MmPressHaptic.selection,
        focusRadius: MmRadius.smallAll,
        onTap: () => context.canPop() ? context.pop() : context.go(AppRoutes.today),
        builder: (context, pressed, _) => SizedBox(
          width: 40,
          height: 44,
          child: Align(
            alignment: Alignment.centerLeft,
            child: Icon(LucideIcons.arrowLeft, size: 24, color: pressed ? colors.ink2 : colors.ink),
          ),
        ),
      ),
    );
  }
}

/// The leading key of a tab root's top row: the account key, or the back key when the screen shows
/// as a pushed page ([showsAsPushedPage]).
class TabRootLeading extends StatelessWidget {
  const TabRootLeading({super.key});

  @override
  Widget build(BuildContext context) => showsAsPushedPage(context) ? const PushedBackKey() : const AccountAvatarButton();
}

/// Puts the account key before a tab root's own header row, for headers that are not the shared
/// [TabRootHeader] (Today's greeting row, Review's title row). The header keeps all its width but
/// the key's. Shown as a pushed page (Your papers inside Practice), it leads with the back key.
class AccountLeading extends StatelessWidget {
  const AccountLeading({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const TabRootLeading(),
        const SizedBox(width: MmSpace.s12),
        Expanded(child: child),
      ],
    );
  }
}
