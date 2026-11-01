// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';
import '../learn2_links.dart';

/// A run (packet R).
class LearnRunScreen extends StatelessWidget {
  const LearnRunScreen({super.key, required this.launch});

  final RunLaunch launch;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
