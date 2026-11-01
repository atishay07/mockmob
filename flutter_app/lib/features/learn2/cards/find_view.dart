// PLACEHOLDER (APP-1101 section 2): packet H2 replaces this file wholly, keeping the constructor.
import 'package:flutter/material.dart';

/// Find, in place inside Learn home (packet H2): the shelves before typing, results after two characters.
/// [query] is the search field's text (owned by Learn home); [onOpenCards] is not needed by the caller.
class FindPanel extends StatelessWidget {
  const FindPanel({super.key, required this.subject, required this.query});

  /// The subject id the search runs in.
  final String subject;

  /// What the student typed in Learn home's search field.
  final String query;

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
