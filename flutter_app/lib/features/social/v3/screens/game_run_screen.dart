// R1 to R6, the run (M3 countdown, M4, M5, M5b, M6, M6b). Owner: RUN agent.
// STUB from the foundation commit: the owning agent replaces this file.

import 'package:flutter/material.dart';

class GameRunScreen extends StatelessWidget {
  const GameRunScreen({super.key, required this.gameId});
  final String gameId;

  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('GameRunScreen')));
}
