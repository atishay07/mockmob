// Owner I14, the Ask Mobi remainder (20 Oct): two chapters lost the same 39 marks, so Ask Mobi's record door names both
// as a tie ("marks slipped in each of ... , tied as your biggest leak"), never just the first. 360 dp, Night and Day.
import 'package:flutter/material.dart';
import 'package:mockmob/core/repositories/remote_state.dart';
import 'package:mockmob/features/insights/data/insights_models.dart';
import 'package:mockmob/features/insights/screens/ask_screen.dart';

import '../../unit/insights/support/insights_fixtures.dart';
import 'insights_golden_support.dart';

/// The rich record with Money and banking losing the same 39 marks as Partnership (4 wrong and 3 blank each).
PrepInsights _tied() {
  final json = richInsightsJson();
  List<dynamic>? ranked;
  void find(Object? node) {
    if (ranked != null) return;
    if (node is Map) {
      final r = node['ranked'];
      if (r is List && r.isNotEmpty) {
        ranked = r;
        return;
      }
      node.values.forEach(find);
    } else if (node is List) {
      node.forEach(find);
    }
  }

  find(json);
  final second = ranked![1] as Map<String, dynamic>;
  second
    ..['wrong'] = 4
    ..['skip'] = 3
    ..['n'] = (second['right'] as int) + 7
    ..['open'] = 35;
  return PrepInsights.fromJson(json);
}

void main() {
  insightsGolden(
    'ask_ties_1020_360',
    () => const AskScreen(),
    size: const Size(360, 1400),
    overrides: () => insightsOverrides(insights: RemoteState(value: _tied())),
  );
}
