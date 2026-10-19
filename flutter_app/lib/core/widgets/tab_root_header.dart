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
          // A tab root that shows as a pushed page (Colleges over the bar, D105) leads with Back.
          if (account) ...[const TabRootLeading(), const SizedBox(width: MmSpace.s12)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (overline != null) Text(overline!, style: type.caption.copyWith(color: colors.ink2)),
                if (title != null) Semantics(header: true, child: _Title(title!, style: type.screenTitle)),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: MmSpace.s12), trailing!],
        ],
      ),
    );
  }
}

/// The screen's title: up to two lines (a title wider than the room beside the account key and the trailing key wraps
/// at its words instead of being cut to "Practi..."), and where one word alone is wider than the room at large text
/// the title takes the largest size that holds it whole, never below the normal size (walk L1, 19 Oct, text 1.6).
class _Title extends StatelessWidget {
  const _Title(this.text, {required this.style});

  final String text;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    final base = MediaQuery.textScalerOf(context);
    return LayoutBuilder(
      builder: (context, box) {
        var scaler = base;
        if (box.maxWidth.isFinite) {
          var widest = 0.0;
          for (final word in text.split(RegExp(r'\s+'))) {
            final painter = TextPainter(text: TextSpan(text: word, style: style), textDirection: TextDirection.ltr, textScaler: base, maxLines: 1)..layout();
            if (painter.width > widest) widest = painter.width;
            painter.dispose();
          }
          if (widest > box.maxWidth) {
            final shrunk = base.scale(1) * (box.maxWidth / widest) * 0.98;
            scaler = TextScaler.linear(shrunk < 1 ? 1 : shrunk);
          }
        }
        return Text(text, style: style, textScaler: scaler, maxLines: 2, overflow: TextOverflow.ellipsis);
      },
    );
  }
}
