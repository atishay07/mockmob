import 'dart:convert';

/// Takes personal and secret text out of an error report before it is stored on the phone or sent.
/// The server scrubs again with the same rules (`src/lib/server/appErrors.js`); this is the first
/// of two passes, so nothing readable leaves the device.
const _inputCap = 10000;

final _jwt = RegExp(r'\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}(?:\.[A-Za-z0-9_-]*)?');
final _authHeader = RegExp(r'\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}', caseSensitive: false);
final _secretPair = RegExp(
  r'''((?:access_?token|refresh_?token|id_?token|token|apikey|api_?key|secret|password|passwd|pwd|authorization|otp|signature)["']?\s*[=:]\s*)["']?[^\s&"',;)<>]{3,}''',
  caseSensitive: false,
);
final _email = RegExp(r'[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,255}\.[A-Z]{2,24}', caseSensitive: false);
final _uuid = RegExp(r'\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b', caseSensitive: false);
final _keyPrefix = RegExp(r'\b(?:sb|sk|pk|rzp|re|ghp|gho|ghs|xox[a-z]|AIza|ya29)[-_.]?[A-Za-z0-9_-]{12,}');
final _ipv4 = RegExp(r'(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])');
final _ipv6 = RegExp(r'(?<![\w:])(?:[0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}(?![\w:])', caseSensitive: false);
final _indianMobile = RegExp(r'(?<![\w.:/-])(?:(?:\+|00)?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?![\w])');
final _plusNumber = RegExp(r'(?<![\w.])\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\w)');
final _digitRun = RegExp(r'(?<![\w.])\d{10,13}(?![\w.])');
final _winHome = RegExp(r'([A-Za-z]:\\Users\\)[^\\\s]+');
final _unixHome = RegExp(r'(/(?:Users|home)/)[^/\s]+');
final _opaque = RegExp(r'[A-Za-z0-9_+/=-]{24,}');
final _hasDigit = RegExp(r'\d');
final _hasLetter = RegExp(r'[A-Za-z]');

/// Emails, phone numbers, tokens, ids, network addresses and home folders become short
/// placeholders. Plain error text stays readable.
String scrubErrorText(String? value) {
  if (value == null || value.isEmpty) return '';
  var text = value.length > _inputCap ? value.substring(0, _inputCap) : value;
  text = text.replaceAll(_jwt, '[token]');
  text = text.replaceAllMapped(_authHeader, (m) => '${m[1]} [token]');
  text = text.replaceAllMapped(_secretPair, (m) => '${m[1]}[token]');
  text = text.replaceAll(_email, '[email]');
  text = text.replaceAll(_uuid, '[id]');
  text = text.replaceAll(_keyPrefix, '[token]');
  text = text.replaceAll(_ipv4, '[ip]');
  text = text.replaceAll(_ipv6, '[ip]');
  text = text.replaceAll(_indianMobile, '[phone]');
  text = text.replaceAll(_plusNumber, '[phone]');
  text = text.replaceAll(_digitRun, '[phone]');
  text = text.replaceAllMapped(_winHome, (m) => '${m[1]}[user]');
  text = text.replaceAllMapped(_unixHome, (m) => '${m[1]}[user]');
  text = text.replaceAllMapped(_opaque, (m) {
    final run = m[0]!;
    return _hasDigit.hasMatch(run) && _hasLetter.hasMatch(run) ? '[token]' : run;
  });
  return text;
}

/// At most [max] characters (not UTF-16 units), never cutting a character in half.
String trimChars(String text, int max) {
  final runes = text.runes;
  if (runes.length <= max) return text;
  return String.fromCharCodes(runes.take(max));
}

/// At most [max] bytes of UTF-8, cut on a character boundary.
String trimUtf8Bytes(String text, int max) {
  if (utf8.encode(text).length <= max) return text;
  final out = StringBuffer();
  var used = 0;
  for (final rune in text.runes) {
    final size = utf8.encode(String.fromCharCode(rune)).length;
    if (used + size > max) break;
    out.writeCharCode(rune);
    used += size;
  }
  return out.toString();
}

const maxMessageChars = 500;
const maxStackBytes = 4096;
const maxScreenChars = 64;

/// A route reduced to its shape: no query, no fragment, long ids replaced.
String? cleanScreen(String? value) {
  if (value == null) return null;
  final path = value.split(RegExp(r'[?#]')).first.trim();
  if (path.isEmpty) return null;
  final shaped = path.split('/').map((p) => p.length >= 8 && _hasDigit.hasMatch(p) ? ':id' : p).join('/');
  final clean = trimChars(scrubErrorText(shaped), maxScreenChars).trim();
  return clean.isEmpty ? null : clean;
}
