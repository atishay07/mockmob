// PLACEHOLDER (APP-1101 section 2): the packet that owns this file replaces it wholly, keeping the constructor.
import 'package:flutter/material.dart';

import '../../../core/theme/theme.dart';

/// Learn home, embedded in Practice's Learn door (packet H).
class LearnHome extends StatelessWidget {
  const LearnHome({super.key, this.subject, this.find = false, this.query});

  final String? subject;
  final bool find;
  final String? query;

  @override
  Widget build(BuildContext context) => Scaffold(backgroundColor: context.mmColors.ground, body: const SizedBox.expand());
}
