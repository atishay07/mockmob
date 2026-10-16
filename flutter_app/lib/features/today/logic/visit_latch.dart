// L03 (owner test 15 Oct: "when I come to Home again, it has added another section like last
// week ... 1 of 4"). A block that waits on a slower read (the weekly ending card waits on rhythm)
// can land after Today is already in front of the student. Whether it shows is settled once per
// visit: anything known before the page settles (about a second after the hero paints) opens in
// place; a block that arrives later waits for the next visit (the tab shown again, or the app back
// in front) instead of pushing a new section into a page being read. A block going away applies
// at once: the student closed it.

class VisitLatch {
  bool _shown = false;
  bool _settled = false;

  /// The page has settled for this visit: late arrivals now wait.
  bool get settled => _settled;

  /// Whether the block shows now, given whether it has something to show.
  bool decide({required bool has}) {
    if (!has) return _shown = false;
    if (!_settled) return _shown = true;
    return _shown;
  }

  /// The page has been in front long enough: what shows now stays, and nothing new joins it.
  void settle() => _settled = true;

  /// The student came back to the page: a block that was waiting may open now.
  void newVisit() => _settled = false;
}
