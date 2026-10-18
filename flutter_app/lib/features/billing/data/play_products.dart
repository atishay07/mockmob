/// The Google Play products the app can sell. The ids are the website's own ids, so the server
/// grants the same entitlement for a Play purchase as for a web one:
///
/// * Pro: `pro_cuet_2027`, a non-consumable (bought once, owned until the server says otherwise).
/// * AI credit packs and Practice credit packs: the website's top-ups, consumables (bought again any
///   time).
///
/// Nothing about a price lives here. The price a student sees is Google Play's own localized
/// string for the product ([ProductDetails.price]); the app never writes one.
library;

enum PlayProductKind { pro, aiCreditPack, practiceCreditPack }

class PlayProduct {
  const PlayProduct({required this.id, required this.kind, this.credits, this.featured = false});

  /// The Play Console product id (the website's plan id).
  final String id;
  final PlayProductKind kind;

  /// Credits a pack adds (AI or Practice, by [kind]). Null for Pro.
  final int? credits;

  /// The pack the website features. Shown in the list like the others.
  final bool featured;

  /// A pack is consumed once the server has granted it, so it can be bought again. Pro is only
  /// acknowledged.
  bool get consumable => kind != PlayProductKind.pro;
}

abstract final class PlayProducts {
  static const String proId = 'pro_cuet_2027';

  static const PlayProduct pro = PlayProduct(id: proId, kind: PlayProductKind.pro);

  /// The website's three AI credit top-ups, smallest first (`ai_credits_prepos_<rupees>_<credits>`).
  static const List<PlayProduct> aiPacks = [
    PlayProduct(id: 'ai_credits_prepos_10_50', kind: PlayProductKind.aiCreditPack, credits: 50),
    PlayProduct(id: 'ai_credits_prepos_20_150', kind: PlayProductKind.aiCreditPack, credits: 150),
    PlayProduct(id: 'ai_credits_prepos_50_400', kind: PlayProductKind.aiCreditPack, credits: 400, featured: true),
  ];

  /// The website's two Practice credit top-ups (`practice_credits_<rupees>_<credits>`).
  static const List<PlayProduct> practicePacks = [
    PlayProduct(id: 'practice_credits_19_100', kind: PlayProductKind.practiceCreditPack, credits: 100),
    PlayProduct(id: 'practice_credits_49_300', kind: PlayProductKind.practiceCreditPack, credits: 300, featured: true),
  ];

  static const List<PlayProduct> packs = [...aiPacks, ...practicePacks];

  static const List<PlayProduct> all = [pro, ...packs];

  static Set<String> get ids => {for (final p in all) p.id};

  static PlayProduct? byId(String id) {
    for (final p in all) {
      if (p.id == id) return p;
    }
    return null;
  }
}
