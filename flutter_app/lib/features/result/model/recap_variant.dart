/// The outcome variants of the recap (spec 5.6.4). The server decides tone; the app never
/// decides what is poor. Keys being unavailable is a separate flag on the model, because it
/// combines with any variant.
enum RecapVariant {
  /// No tone, or a neutral one.
  standard,

  /// The student's first full or NTA-style mock in this subject.
  firstMock,

  /// At least one answer key is withdrawn, under review or changed: no figure.
  held,

  /// `recap.tone == 'lower'`: calm, no roll, no Mobi on cards 1 and 2, no ticks.
  lower,

  /// `recap.tone == 'higher'`: the comparison, one Mobi hop after the figure lands.
  higher;

  /// The analytics value.
  String get wire => switch (this) {
    standard => 'default',
    firstMock => 'first_mock',
    held => 'held',
    lower => 'lower',
    higher => 'higher',
  };

  /// The reveal may carry its light sweep, roll and ticks. Lower and held results open with a
  /// calm fade and no celebration of any kind (brief 1.1 and 10).
  bool get celebratory => this == standard || this == firstMock || this == higher;

  /// A milestone or effort token may show. Never after a lower or held result.
  bool get allowsTokens => this != lower && this != held;
}

/// Precedence: held marks first (the figure is not final), then the first mock (nothing to
/// compare), then the server's tone.
RecapVariant resolveRecapVariant({required bool hasHeld, required int? ordinal, String? tone}) {
  if (hasHeld) return RecapVariant.held;
  if (ordinal == 1) return RecapVariant.firstMock;
  return switch (tone) {
    'lower' => RecapVariant.lower,
    'higher' => RecapVariant.higher,
    _ => RecapVariant.standard,
  };
}
