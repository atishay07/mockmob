// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../learn2_links.dart';

/// A chapter feed (packet F).
class FeedScreen extends StatelessWidget {
  const FeedScreen({super.key, required this.launch});

  final FeedLaunch launch;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
