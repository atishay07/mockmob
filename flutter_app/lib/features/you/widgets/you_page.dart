import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/theme/theme.dart';

/// The frame of a You sub-screen: a back key, a title and a scrolling body at most 600 dp wide.
/// The hub passes [showBack] false because it is a tab root.
class YouPage extends StatelessWidget {
  const YouPage({
    super.key,
    required this.title,
    required this.children,
    this.showBack = true,
    this.large = false,
    this.padBottom = MmSpace.s32,
  });

  final String title;
  final List<Widget> children;
  final bool showBack;

  /// Uses the 28 sp headline (the hub) instead of the 22 sp title.
  final bool large;
  final double padBottom;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: MmSpace.contentMaxWidth),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(showBack ? MmSpace.s4 : MmSpace.gutter, MmSpace.s8, MmSpace.gutter, MmSpace.s8),
                    child: Row(
                      children: [
                        if (showBack) const BackKey(),
                        Expanded(
                          child: Semantics(
                            header: true,
                            child: Padding(
                              padding: EdgeInsets.only(top: large ? MmSpace.s8 : 0),
                              child: Text(title, style: large ? type.headline : type.title),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                SliverList.list(children: children),
                SliverToBoxAdapter(child: SizedBox(height: padBottom)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A 48 dp back key. It pops the current page; the predictive back gesture does the same.
class BackKey extends StatelessWidget {
  const BackKey({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    return Semantics(
      button: true,
      label: 'Back',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).maybePop(),
        child: SizedBox(
          width: MmTarget.tab,
          height: MmTarget.tab,
          child: Icon(LucideIcons.arrowLeft, size: 24, color: colors.ink),
        ),
      ),
    );
  }
}

/// Horizontal padding every body block of a You screen shares.
const EdgeInsets youGutter = EdgeInsets.symmetric(horizontal: MmSpace.gutter);

/// A short sentence-case group heading above a block of rows.
class GroupHeading extends StatelessWidget {
  const GroupHeading(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    final type = context.mmType;
    return Padding(
      padding: const EdgeInsets.fromLTRB(MmSpace.gutter, MmSpace.group, MmSpace.gutter, MmSpace.s8),
      child: Semantics(header: true, child: Text(text, style: type.label.copyWith(color: context.mmColors.ink2))),
    );
  }
}
