// The devices the home page's exam screen sits in, drawn in CSS in the Desk Light palette (exam-device.css), no photo.
// - The desktop monitor (D6, LK92, 5 Nov 2026): a bezel with its chin, the glass, a neck and a foot. Every part is sized in
//   the device's own width (cqw), and the glass is a 16:10 size container whose screen is laid out at 880 x 550 design
//   pixels and scaled with it (exam-screen.css, --u). It shows from 761 px, exactly as the owner approved it.
// - The phone (R3-D6, LK106, 5 Nov 2026): below 761 px the monitor's screen was a 4 px miniature, so phones get a phone of
//   the monitor's own material (its warm charcoal bezel, hairline edge and camera, the stand's aluminium as the rim and the
//   keys, the same one soft shadow) holding a phone-native screen in real pixels (`phone`).
// `ref` lands on the root, which is on screen whichever device shows, so the demo clock runs only while it is seen.
import '@/app/exam-device.css';

export function ExamDevice({ children, phone, ref }) {
  return (
    <div className="xs-device" ref={ref}>
      <div className="xs-monitor">
        <div className="xs-bezel">
          <div className="xs-glass">{children}</div>
        </div>
        <div className="xs-neck" aria-hidden="true" />
        <div className="xs-foot" aria-hidden="true" />
      </div>
      {phone ? (
        <div className="xs-phone">
          <div className="xs-phone__body">
            <i className="xs-phone__keys" aria-hidden="true" />
            <div className="xs-phone__glass">{phone}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
