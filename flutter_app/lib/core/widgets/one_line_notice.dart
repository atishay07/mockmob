import 'package:flutter/material.dart';

/// The smallest share of its size a header notice is drawn at before it wraps (and, on Review, before the Ask pill gives it
/// room).
const double noticeFloor = 0.84;

/// A header notice ("Offline. Last loaded 7:26 AM.", "Not refreshed. Last loaded 7:39 PM.") on one line wherever it can be, so
/// the header never grows when it appears and the time at the end is never cut (v15 walk: next to the Ask pill the line wrapped
/// to two and the card under it moved down 13 dp; v15.1 walk: beside Mobi on Today at 360 dp it ended in "7:39 P..."). It is
/// drawn a step smaller, never under [noticeFloor] of its size, when that is what it takes; only a line that still does not fit
/// (a large system text size) wraps, which is slower to read but never loses the time.
class OneLineNotice extends StatelessWidget {
  const OneLineNotice(this.message, {super.key, required this.style});

  final String message;
  final TextStyle style;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        final painter = TextPainter(
          text: TextSpan(text: message, style: style),
          textDirection: Directionality.of(context),
          textScaler: MediaQuery.textScalerOf(context),
          maxLines: 1,
        )..layout();
        final natural = painter.width;
        painter.dispose();
        if (natural <= box.maxWidth) return Text(message, style: style, maxLines: 1);
        if (natural * noticeFloor <= box.maxWidth) {
          return FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft, child: Text(message, style: style, maxLines: 1, softWrap: false));
        }
        return Text(message, style: style);
      },
    );
  }
}
