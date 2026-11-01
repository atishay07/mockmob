// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Explore: the chapter feed covers (packet E).
class ExploreScreen extends StatelessWidget {
  const ExploreScreen({super.key, this.subject});

  final String? subject;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
