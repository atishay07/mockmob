// The den (spec 5.3 D1 to D6, M1). Owner: DEN agent.
// STUB from the foundation commit: the owning agent replaces this file.

import 'package:flutter/material.dart';

class DenScreen extends StatelessWidget {
  const DenScreen({super.key, this.asTab = false});
  final bool asTab;

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('DenScreen')));
}
