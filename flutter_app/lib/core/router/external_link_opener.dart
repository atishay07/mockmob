import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens a page on www.mockmob.in in a Custom Tab. Only `ActionRouter` produces the URLs it
/// is given. Replaceable in tests.
abstract interface class ExternalLinkOpener {
  Future<bool> open(Uri uri);
}

/// The marker on every MockMob page the app opens (L-07a, Google Play's payments policy): `from=app`. With it the
/// website leaves out its own pricing and payment links, so a page opened from the app never points to a payment
/// outside Google Play. Third-party pages (a source's own site) are opened as they are.
const String appLinkMarkerKey = 'from';
const String appLinkMarkerValue = 'app';

/// [uri] with the app marker when it is a MockMob page; any other address unchanged. The marker never replaces a query
/// the page already has.
Uri markAppLink(Uri uri) {
  final host = uri.host.toLowerCase();
  final ours = host == 'mockmob.in' || host.endsWith('.mockmob.in');
  if (!ours || uri.queryParameters[appLinkMarkerKey] == appLinkMarkerValue) return uri;
  return uri.replace(queryParameters: {...uri.queryParametersAll, appLinkMarkerKey: appLinkMarkerValue});
}

class CustomTabLinkOpener implements ExternalLinkOpener {
  const CustomTabLinkOpener();

  @override
  Future<bool> open(Uri uri) async {
    if (uri.scheme != 'https') return false;
    try {
      return await launchUrl(markAppLink(uri), mode: LaunchMode.inAppBrowserView);
    } on Object {
      return false;
    }
  }
}

final externalLinkOpenerProvider = Provider<ExternalLinkOpener>((ref) => const CustomTabLinkOpener());
