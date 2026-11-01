// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// The chapter page (packet C).
class ChapterPage extends StatelessWidget {
  const ChapterPage({super.key, required this.chapterKey, this.minutes});

  final String chapterKey;
  final int? minutes;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
