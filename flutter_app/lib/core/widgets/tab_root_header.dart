import 'package:flutter/material.dart';

import '../theme/theme.dart';
import 'account/account_avatar.dart';

/// The top row of every tab root: the account key (the student's initial, opening the Account
/// sheet), the screen's title (or Today's date line), then an optional trailing widget (the week
/// bubbles, a filter). Sits under the status bar; give it the screen's gutter.
class TabRootHeader extends StatelessWidget {
  const TabRootHeader({super.key, this.title, this.overline, this.trailing, this.account = true});

  /// Shows the account key before the title. Off only where the header is not a tab root.
  final bool account;

  /// The screen title ("Practice"), in the Bricolage title cut.
  final String? title;

  /// A small line above the title, or alone ("Tuesday, 13 October").
  final String? overline;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 56),
      child: Row(
        children: [
          if (account) ...[const AccountAvatarButton(), const SizedBox(width: MmSpace.s12)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (overline != null) Text(overline!, style: type.caption.copyWith(color: colors.ink2)),
                if (title != null) Semantics(header: true, child: Text(title!, style: type.screenTitle, maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
        ],
      ),
    );
  }
}
