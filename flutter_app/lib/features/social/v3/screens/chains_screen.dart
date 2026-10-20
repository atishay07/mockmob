// The Chains screen is gone (Mob V4, A5). The route stays only so old entry points keep working: it opens the
// Your chain sheet (or, with [mobTab], the This week sheet) over the page underneath and takes itself off the
// stack. Nothing here draws content.

import 'package:flutter/material.dart';

import '../../../../core/theme/theme.dart';
import '../widgets/this_week_sheet.dart';
import '../widgets/your_chain_sheet.dart';

class ChainsScreen extends StatefulWidget {
  const ChainsScreen({super.key, this.mobTab = false});

  /// Opens the Mob's This week sheet (a tap on the pennant) instead of Your chain.
  final bool mobTab;

  @override
  State<ChainsScreen> createState() => _ChainsScreenState();
}

class _ChainsScreenState extends State<ChainsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final nav = Navigator.of(context, rootNavigator: true);
      final route = ModalRoute.of(context);
      // Off the stack first, so the sheet rises over the page that opened this one and Back returns to it.
      if (route != null && nav.canPop()) nav.removeRoute(route);
      final open = widget.mobTab ? showThisWeekSheet : showYourChainSheet;
      open(nav.context);
    });
  }

  @override
  Widget build(BuildContext context) => ColoredBox(color: context.mmColors.ground, child: const SizedBox.expand());
}
