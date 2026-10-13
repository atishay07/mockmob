// "Show me" (brief 12.1, evidence first) on Today: the shared pill, naming what it opens.
import 'package:flutter/material.dart';

import '../../../core/widgets/widgets.dart';

class ShowMeTag extends StatelessWidget {
  const ShowMeTag({super.key, required this.onTap, this.semanticsLabel});

  final VoidCallback onTap;
  final String? semanticsLabel;

  @override
  Widget build(BuildContext context) =>
      ShowMePill(onTap: onTap, semanticsLabel: semanticsLabel ?? 'Show me, the paper behind this');
}
