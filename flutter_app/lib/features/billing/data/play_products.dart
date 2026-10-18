/// The Google Play products the app can sell. The ids are the website's own ids, so the server
/// grants the same entitlement for a Play purchase as for a web one:
///
/// * Pro: `pro_cuet_2027`, a non-consumable (bought once, owned until the server says otherwise).
/// * AI credit packs: the website's three top-ups, consumables (bought again any time).
///
/// Nothing about a price lives here. The price a student sees is Google Play's own localized
/// string for the product ([ProductDetails.price]); the app never writes one.
library;

enum PlayProductKind { pro, aiCreditPack }

class PlayProduct {
  const PlayProduct({required this.id, required this.kind, this.credits});

  /// The Play Console product id (the website's plan id).
  final String id;
  final PlayProductKind kind;

  /// AI credits a pack adds. Null for Pro.
  final int? credits;

  /// A pack is consumed once the server has granted it, so it can be bought again. Pro is only
  /// acknowledged.
  bool get consumable => kind == PlayProductKind.aiCreditPack;
}

abstract final class PlayProducts {
  static const String proId = 'pro_cuet_2027';

  static const PlayProduct pro = PlayProduct(id: proId, kind: PlayProductKind.pro);

  /// The website's three AI credit top-ups, smallest first (`ai_credits_prepos_<rupees>_<credits>`).
  static const List<PlayProduct> packs = [
    PlayProduct(id: 'ai_credits_prepos_10_50', kind: PlayProductKind.aiCreditPack, credits: 50),
    PlayProduct(id: 'ai_credits_prepos_20_150', kind: PlayProductKind.aiCreditPack, credits: 150),
    PlayProduct(id: 'ai_credits_prepos_50_400', kind: PlayProductKind.aiCreditPack, credits: 400),
  ];

  static const List<PlayProduct> all = [pro, ...packs];

  static Set<String> get ids => {for (final p in all) p.id};

  static PlayProduct? byId(String id) {
    for (final p in all) {
      if (p.id == id) return p;
    }
    return null;
  }
}
