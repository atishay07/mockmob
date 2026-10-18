// Joining sentences for a screen reader's label (final walk: "keeps your run..", "from Quick 10..",
// "2 more saved..", "starts Monday.."). A builder that puts ". " between parts, or a "." after a
// part, doubled the stop whenever the part was already a sentence. These two never do.

/// [text] as one sentence: trimmed, and given a full stop unless it already ends in one (or in a
/// question or exclamation mark, or an ellipsis). Empty stays empty.
String endSentence(String text) {
  final t = text.trim();
  if (t.isEmpty) return t;
  return RegExp(r'[.!?…]$').hasMatch(t) ? t : '$t.';
}

/// The non-empty [parts] as sentences, one space between them: "Share Capital. 245 marks open.
/// 49 of 52 missed." A part that already ends a sentence gets no second stop.
String joinSentences(Iterable<String?> parts) => [
  for (final p in parts)
    if (p != null && p.trim().isNotEmpty) endSentence(p),
].join(' ');
