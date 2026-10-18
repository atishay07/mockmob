/// The Google Play products the app can sell. The ids are the website's own ids, so the server
/// grants the same entitlement for a Play purchase as for a web one:
///
/// * Pro: `pro_cuet_2027`, a non-consumable (bought once, owned until the server says otherwise).
/// * Credit packs: the website's top-ups of the one credits balance (owner D78, 18 Oct 2026: one
///   balance, one set of packs, usable for everything), consumables (bought again any time).
///
/// Nothing about a price lives here. The price a student sees is Google Play's own localized
/// string for the product ([ProductDetails.price]); the app never writes one.
library;

enum PlayProductKind { pro, creditPack }

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

  /// The website's three credit packs, smallest first (`credits_<rupees>_<credits>`).
  static const List<PlayProduct> packs = [
    PlayProduct(id: 'credits_10_50', kind: PlayProductKind.creditPack, credits: 50),
    PlayProduct(id: 'credits_29_150', kind: PlayProductKind.creditPack, credits: 150),
    PlayProduct(id: 'credits_49_300', kind: PlayProductKind.creditPack, credits: 300, featured: true),
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
