/// Binds each number to the word after it with a no-break space, so a narrow screen never leaves
/// "(30" at the end of one line and "students)." at the start of the next. The website does this
/// with `text-wrap: pretty`; Flutter has no such setting, so the finished sentence from the server
/// is set with its numbers held to their words. The words and digits are not changed.
String keepNumbersWithWords(String line) => line.replaceAllMapped(_numberThenWord, (m) => '${m[1]} ');

final RegExp _numberThenWord = RegExp(r'(\d) (?=[A-Za-z(])');
