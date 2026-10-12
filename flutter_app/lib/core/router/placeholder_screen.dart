import 'package:flutter/material.dart';

import '../theme/theme.dart';

/// Stands in for a feature screen until its module replaces the builder in `screens.dart`.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key, required this.title, required this.route, this.isSheet = false});

  final String title;

  /// The route template, for example `/practice/setup/:mode`.
  final String route;

  /// Sheet routes render a sheet body (no `Scaffold`), because `MmSheetPage` supplies the frame.
  final bool isSheet;

  @override
  Widget build(BuildContext context) {
    final colors = context.mmColors;
    final type = context.mmType;
    if (isSheet) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: MmSpace.s24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Semantics(header: true, child: Text(title, style: type.title, textAlign: TextAlign.center)),
            const SizedBox(height: MmSpace.s8),
            Text(route, style: type.small.copyWith(color: colors.ink3), textAlign: TextAlign.center),
          ],
        ),
      );
    }
    return Scaffold(
      backgroundColor: colors.ground,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(MmSpace.gutter),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Semantics(header: true, child: Text(title, style: type.headline, textAlign: TextAlign.center)),
                const SizedBox(height: MmSpace.s8),
                Text(route, style: type.small.copyWith(color: colors.ink3), textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
