// The monitor the home page's exam screen sits in (D6, LK92, 5 Nov 2026), drawn in CSS in the Desk Light palette
// (exam-device.css), no photo: a bezel with its chin, the glass, a neck and a foot. Every part is sized in the device's own
// width (cqw), and the glass is a 16:10 size container whose screen is laid out at 880 x 550 design pixels and scaled with
// it (exam-screen.css, --u). It is the one device at every width (R4-H6, owner LK129, 6 Nov 2026: round 3's drawn phone is
// gone; phones see this monitor, smaller, and a full-screen key beside it, ExamScreen.jsx).
// `ref` lands on the root, so the demo clock runs only while the monitor is seen.
import '@/app/exam-device.css';

export function ExamDevice({ children, ref }) {
  return (
    <div className="xs-device" ref={ref}>
      <div className="xs-monitor">
        <div className="xs-bezel">
          <div className="xs-glass">{children}</div>
        </div>
        <div className="xs-neck" aria-hidden="true" />
        <div className="xs-foot" aria-hidden="true" />
      </div>
    </div>
  );
}
