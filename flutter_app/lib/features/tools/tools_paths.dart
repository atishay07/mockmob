/// The CUET tools' routes. Pushed over the shell (root navigator), reached from You and from a
/// quiet link under Today's road. See `tools_routes.dart` for the registration.
abstract final class ToolsPaths {
  static const String hub = '/tools';
  static const String compass = '/tools/compass';
  static const String combo = '/tools/combo';
  static const String guide2027 = '/tools/guide-2027';

  static String programme(String groupId) => '$compass/${Uri.encodeComponent(groupId)}';

  /// Website paths that now open these screens (for the ActionRouter's deep links).
  static const Map<String, String> webAliases = {
    '/admission-compass': compass,
    '/cuet-cutoff-calculator': compass,
    '/cuet-subject-combination': combo,
    '/cuet-2027': guide2027,
  };

  /// The website's previous-year questions guide (MockMob does not hold a verified past-paper
  /// set, so this stays a page on the site).
  static const String pyqGuideWebPath = '/cuet-previous-year-questions';
}
