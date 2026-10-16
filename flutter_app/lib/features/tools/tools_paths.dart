/// The Colleges area's routes. `/colleges` is the tab (branch 3) and `/colleges/cutoff` the Check a
/// score sheet over it; Compass, a programme, Combo and the 2027 guide stay root pages under
/// `/tools/...`, pushed from Colleges, Today's colleges card and Practice, so Back returns to the
/// tab they came from. `/tools` alone redirects to `/colleges` (app-ia-1016.md section 8).
abstract final class ToolsPaths {
  static const String colleges = '/colleges';
  static const String collegesCutoff = '/colleges/cutoff';
  static const String hub = '/tools';
  static const String compass = '/tools/compass';
  static const String combo = '/tools/combo';
  static const String guide2027 = '/tools/guide-2027';

  static String programme(String groupId) => '$compass/${Uri.encodeComponent(groupId)}';

  /// Website paths that now open these screens (for the ActionRouter's deep links).
  static const Map<String, String> webAliases = {
    '/admission-compass': compass,
    '/cuet-cutoff-calculator': collegesCutoff,
    '/cuet-subject-combination': combo,
    '/cuet-2027': guide2027,
  };

  /// The website's previous-year questions guide (MockMob does not hold a verified past-paper
  /// set, so this stays a page on the site).
  static const String pyqGuideWebPath = '/cuet-previous-year-questions';
}
