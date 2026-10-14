import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/router/external_link_opener.dart';

/// Opens a page of the MockMob website (the one host the app trusts) in a Custom Tab.
Future<bool> openWebPage(WidgetRef ref, String path) {
  final base = ref.read(appConfigProvider).apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.tryParse('$base$path');
  if (uri == null) return Future.value(false);
  return ref.read(externalLinkOpenerProvider).open(uri);
}
