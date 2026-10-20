// Lives outside lib/features/social on purpose, like mob_v3_bank.dart: the explainer's sample trap is a
// real CUET Accountancy question whose text says "years' purchase", which the Mob's no-selling scan
// would read as copy. It is content, not copy: 2 years' purchase of 30,000 is 60,000 (C); 45,000 (B)
// counts 1.5 years (MOB-EXPLAINER.md 2, the spec 5.3 fixture).

abstract final class MobExplainerSample {
  static const String stem = "Goodwill at 2 years' purchase of average profits of 30,000 is";
  static const List<String> options = ['30,000', '45,000', '60,000', '90,000'];
}
