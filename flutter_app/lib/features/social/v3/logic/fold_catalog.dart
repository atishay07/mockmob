// The canonical earn table (spec 0.4, F5), the app's copy of `src/lib/mob/folds.mjs`. A contract test
// keeps the two equal. Words (names, lines, rules) are in copy_v3.dart.

import '../data/mob_v3_models.dart';

class FoldRule {
  const FoldRule(this.fold, this.folds, this.source, this.paper, {this.mobEarned = false});

  final FoldKey fold;

  /// The paper colour as `RRGGBB`, from the final art (`characters/final/folds.json` `paper`, 20 Oct).
  /// Spec 0.4's colour column is out of date for Hexa, Naav, Cutting and Dog-ear; this is the truth, and
  /// the server's `folds.mjs` and `assets/folds/folds.json` must say the same (contract test).
  final String paper;

  /// Creases in the card corner: 1 starter, 2 earned yourself, 3 earned with your Mob.
  final int folds;

  /// The server's source key; null for a starter.
  final String? source;
  final bool mobEarned;
}

const List<FoldRule> foldCatalog = [
  FoldRule(FoldKey.dart, 1, null, '5FBEF2'),
  FoldRule(FoldKey.dogear, 1, null, 'FF8FA0'),
  FoldRule(FoldKey.hexa, 1, null, '5562D9'),
  FoldRule(FoldKey.kandil, 1, null, 'F4B04A'),
  FoldRule(FoldKey.hop, 3, 'mob_quest', '33BFA0', mobEarned: true),
  FoldRule(FoldKey.crane, 3, 'mob_traps', 'B98CF5', mobEarned: true),
  FoldRule(FoldKey.stamp, 3, 'mob_weeks', 'EFE6D2', mobEarned: true),
  FoldRule(FoldKey.naav, 2, 'first_full_mock', 'E3DCCB'),
  FoldRule(FoldKey.tally, 2, 'clean_games', 'F2A07E'),
  FoldRule(FoldKey.patang, 2, 'beat_best', 'E2404A'),
  FoldRule(FoldKey.sticky, 2, 'fixes_held', '9BAF8E'),
  FoldRule(FoldKey.cutting, 2, 'came_back', 'B9814F'),
];

FoldRule foldRuleOf(FoldKey k) => foldCatalog.firstWhere((r) => r.fold == k);

/// The Fold's paper colour (opaque).
int foldPaperArgb(FoldKey k) => 0xFF000000 | int.parse(foldRuleOf(k).paper, radix: 16);

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
