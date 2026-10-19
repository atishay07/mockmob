// The canonical earn table (spec 0.4, F5), the app's copy of `src/lib/mob/folds.mjs`. A contract test
// keeps the two equal. Words (names, lines, rules) are in copy_v3.dart.

import '../data/mob_v3_models.dart';

class FoldRule {
  const FoldRule(this.fold, this.folds, this.source, {this.mobEarned = false});

  final FoldKey fold;

  /// Creases in the card corner: 1 starter, 2 earned yourself, 3 earned with your Mob.
  final int folds;

  /// The server's source key; null for a starter.
  final String? source;
  final bool mobEarned;
}

const List<FoldRule> foldCatalog = [
  FoldRule(FoldKey.dart, 1, null),
  FoldRule(FoldKey.dogear, 1, null),
  FoldRule(FoldKey.hexa, 1, null),
  FoldRule(FoldKey.kandil, 1, null),
  FoldRule(FoldKey.hop, 3, 'mob_quest', mobEarned: true),
  FoldRule(FoldKey.crane, 3, 'mob_traps', mobEarned: true),
  FoldRule(FoldKey.stamp, 3, 'mob_weeks', mobEarned: true),
  FoldRule(FoldKey.naav, 2, 'first_full_mock'),
  FoldRule(FoldKey.tally, 2, 'clean_games'),
  FoldRule(FoldKey.patang, 2, 'beat_best'),
  FoldRule(FoldKey.sticky, 2, 'fixes_held'),
  FoldRule(FoldKey.cutting, 2, 'came_back'),
];

FoldRule foldRuleOf(FoldKey k) => foldCatalog.firstWhere((r) => r.fold == k);

/// Den objects by Mob chain week (spec 0.4).
const Map<int, List<String>> denItemsByWeek = {
  2: ['den_stamp'],
  4: ['stamp', 'desk_bell'],
  8: ['brass_lamp'],
  12: ['foil_seal'],
  20: ['den_stamp_row'],
};

/// Personal chain milestones and their rewards (spec 0.4).
const Map<int, String?> chainMilestones = {3: 'rest_pass', 7: 'rest_pass', 14: null, 21: 'rest_pass', 30: 'foil', 50: 'ribbon', 75: 'ribbon', 100: 'ribbon', 150: 'ribbon'};
