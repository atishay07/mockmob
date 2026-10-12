import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens a page on www.mockmob.in in a Custom Tab. Only `ActionRouter` produces the URLs it
/// is given. Replaceable in tests.
abstract interface class ExternalLinkOpener {
  Future<bool> open(Uri uri);
}

class CustomTabLinkOpener implements ExternalLinkOpener {
  const CustomTabLinkOpener();

  @override
  Future<bool> open(Uri uri) async {
    if (uri.scheme != 'https') return false;
    try {
      return await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
    } on Object {
      return false;
    }
  }
}

final externalLinkOpenerProvider = Provider<ExternalLinkOpener>((ref) => const CustomTabLinkOpener());
