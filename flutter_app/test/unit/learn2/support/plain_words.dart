// The app joins a number to its unit with a no-break space (4 Nov walk, I9: "2 / min", "back in 3 / days"); the website's words
// do not. The parity tests compare the two with that one space read as a plain one, so nothing else may differ.
const String nbsp = '\u00A0';

/// [x] with every no-break space in it (strings, lists, maps, at any depth) read as a plain space.
Object? plain(Object? x) => switch (x) {
  String s => s.replaceAll(nbsp, ' '),
  List l => [for (final e in l) plain(e)],
  Map m => {for (final e in m.entries) e.key: plain(e.value)},
  _ => x,
};
