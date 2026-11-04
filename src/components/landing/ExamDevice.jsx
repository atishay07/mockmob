// The desktop monitor the home page's exam screen sits in (D6, LK92, 5 Nov 2026): a bezel with its chin, the glass, a neck
// and a foot, drawn in CSS in the Desk Light palette (exam-device.css), no photo. Every part is sized in the device's own
// width (cqw), so it is the same monitor at 1440 and at 360, only smaller, and vector-crisp at every size. The glass is a
// 16:10 size container; what it holds is laid out at 880 x 550 design pixels and scaled with it (exam-screen.css, --u).
import '@/app/exam-device.css';

export function ExamDevice({ children }) {
  return (
    <div className="xs-device">
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
