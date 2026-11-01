// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// A chapter's Cards view (packet H).
class CardsViewScreen extends StatelessWidget {
  const CardsViewScreen({super.key, required this.chapterKey, this.filter});

  final String chapterKey;
  final String? filter;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
