import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api.dart';
import '../../../core/models/json_helpers.dart';
import 'subjects.dart';

/// A CUET subject MockMob has no practice for yet, as `GET /api/subjects` names it.
class UnofferedSubject {
  const UnofferedSubject({required this.id, required this.name, this.reason, this.language = false});

  final String id;
  final String name;

  /// A CUET language paper (official codes 101 to 199): listed together as one line.
  final bool language;

  /// The server's own words (`practiceReason`), when it gives a short one.
  final String? reason;
}

/// The picker's view of the registry: which practice subjects the server confirms, and the
/// subjects it lists without practice. Without the network the 15 known subjects stand alone.
class SubjectRegistry {
  const SubjectRegistry({this.offered = SheetSubject.values, this.unoffered = const [], this.live = false});

  /// The practice subjects (all 15 until the server says otherwise).
  final List<SheetSubject> offered;
  final List<UnofferedSubject> unoffered;

  /// True when this came from the server.
  final bool live;

  static const SubjectRegistry offline = SubjectRegistry();

  bool offers(SheetSubject s) => offered.contains(s);

  /// Reads the `GET /api/subjects` rows. Merged legacy rows (Applied Mathematics) are left out:
  /// their subject is already listed under the name it is examined as.
  static SubjectRegistry fromRows(List<Json> rows) {
    if (rows.isEmpty) return offline;
    final offered = <SheetSubject>{};
    final unoffered = <UnofferedSubject>[];
    for (final j in rows) {
      final id = asStringOr(j['id'], '');
      final practice = asStringOr(j['practice'], 'unknown');
      if (id.isEmpty || practice == 'merged') continue;
      final known = SheetSubject.byId(id);
      if (practice == 'supported' && known != null) {
        offered.add(known);
      } else if (practice != 'retired') {
        final reason = asString(j['practiceReason']);
        unoffered.add(UnofferedSubject(
          id: id,
          name: known?.label ?? _shortName(asStringOr(j['name'], id)),
          reason: reason != null && reason.length <= 80 ? reason : null,
          language: _isLanguageCode(asStringOr(j['officialCode'], '')),
        ));
      }
    }
    if (offered.isEmpty) return offline;
    unoffered.sort((a, b) => a.name.compareTo(b.name));
    return SubjectRegistry(offered: [for (final s in SheetSubject.values) if (offered.contains(s)) s], unoffered: unoffered, live: true);
  }

  static bool _isLanguageCode(String code) => code.length == 3 && code.startsWith('1');

  /// "Fine Arts / Visual Arts" reads as "Fine Arts".
  static String _shortName(String name) => name.split(' / ').first.trim();
}

/// `GET /api/subjects` (public, cacheable), read once per run when the picker opens. Any failure
/// falls back to the known list, so the onboarding never waits on the network.
final onboardingRegistryProvider = FutureProvider<SubjectRegistry>((ref) async {
  try {
    final res = await ref.watch(apiClientProvider).get('/api/subjects', options: const ApiOptions(authenticated: false));
    return SubjectRegistry.fromRows(asJsonList(res.data));
  } on Object {
    return SubjectRegistry.offline;
  }
});
