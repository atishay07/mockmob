/// The Google Play products the app can sell (owner D135/D136, 19 Oct 2026):
///
/// * Pro: the monthly auto-renewing subscription `pro_monthly`, bought on its base plan `monthly`.
///   Google Play renews it; the server keeps Pro in step with Google. The one-time
///   `pro_cuet_2027` is not sold on Play, so it is not here.
/// * Credit packs: the website's top-ups of the one credits balance (owner D78, 18 Oct 2026: one
///   balance, one set of packs, usable for everything), consumables (bought again any time).
///
/// Nothing about a price lives here. The price a student sees is Google Play's own localized
/// string for the product ([ProductDetails.price]); the app never writes one.
library;

enum PlayProductKind { proSubscription, creditPack }

class PlayProduct {
  const PlayProduct({required this.id, required this.kind, this.credits, this.featured = false, this.basePlanId});

  /// The Play Console product id (the website's plan id).
  final String id;
  final PlayProductKind kind;

  /// Credits a pack adds (AI or Practice, by [kind]). Null for Pro.
  final int? credits;

  /// The pack the website features. Shown in the list like the others.
  final bool featured;

  /// For a subscription: the Play Console base plan the app buys (its offer token is the base
  /// plan's own, with no offer on top).
  final String? basePlanId;

  bool get isSubscription => kind == PlayProductKind.proSubscription;

  /// A pack is consumed once the server has granted it, so it can be bought again. The
  /// subscription is only acknowledged (by the server).
  bool get consumable => kind == PlayProductKind.creditPack;
}

abstract final class PlayProducts {
  static const String proId = 'pro_monthly';
  static const String proBasePlan = 'monthly';

  static const PlayProduct pro = PlayProduct(id: proId, kind: PlayProductKind.proSubscription, basePlanId: proBasePlan);

  /// Google Play's own page for this subscription, where the student changes the payment method,
  /// turns renewal off or on, or cancels.
  static final Uri manageSubscriptionUrl = Uri.parse('https://play.google.com/store/account/subscriptions?sku=$proId&package=in.mockmob.app');

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
