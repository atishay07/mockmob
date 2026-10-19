// R7 the podium (M7). Owner: RESULTS agent.
// STUB from the foundation commit: the owning agent replaces this file.

import 'package:flutter/material.dart';

class PodiumScreen extends StatelessWidget {
  const PodiumScreen({super.key, required this.gameId});
  final String gameId;

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('PodiumScreen')));
}
