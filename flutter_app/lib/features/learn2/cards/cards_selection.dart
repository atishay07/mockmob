// What a card list remembers about its rows (the website's `usePick` and the list's open row): which row is open, which show
// their NCERT line, which are picked, whether pick mode is on and whether "Show answers" is on. Held by the screen, not by
// the rows, so a row built again as it scrolls back into view looks as the student left it.
library;

import 'package:flutter/foundation.dart';

class CardsSelection extends ChangeNotifier {
  String? _openId;
  bool _showAnswers = false;
  bool _mode = false;
  final Set<String> _shown = {};
  final Set<String> _picked = {};

  /// The one open row.
  String? get openId => _openId;
  bool get showAnswers => _showAnswers;

  /// Rows whose "Show" was pressed.
  Set<String> get shown => _shown;

  /// The picked cards, in the order they were picked.
  Set<String> get picked => _picked;

  /// Pick mode: on until Done, and on while anything is picked.
  bool get picking => _mode || _picked.isNotEmpty;

  bool isOpen(String id) => _openId == id;

  void toggleOpen(String id) {
    _openId = _openId == id ? null : id;
    notifyListeners();
  }

  void toggleShown(String id) {
    if (!_shown.remove(id)) _shown.add(id);
    notifyListeners();
  }

  void setShowAnswers(bool value) {
    if (_showAnswers == value) return;
    _showAnswers = value;
    notifyListeners();
  }

  void togglePick(String id) {
    if (!_picked.remove(id)) _picked.add(id);
    notifyListeners();
  }

  /// Clear: nothing picked, the mode stays as it is.
  void clearPicks() {
    if (_picked.isEmpty) return;
    _picked.clear();
    notifyListeners();
  }

  void startPicking() {
    _mode = true;
    notifyListeners();
  }

  /// Done: nothing picked and the mode off.
  void stopPicking() {
    _picked.clear();
    _mode = false;
    notifyListeners();
  }

  /// The picked cards that are still in [ids] (a new search or a new filter may have dropped some), in pick order.
  List<String> pickedIn(Iterable<String> ids) {
    final present = ids.toSet();
    return [for (final id in _picked) if (present.contains(id)) id];
  }
}
