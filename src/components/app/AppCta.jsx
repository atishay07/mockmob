import { getAppCta, qrSvg } from './appLinks';
import './app.css';

/** Truthful Android call to action. Server component: reads env only on the server. */
export async function AppCta({ id }) {
  const cta = getAppCta();
  const svg = cta.state === 'none' ? '' : await qrSvg(cta.href);
  return (
    <div className="app-cta" id={id}>
      <div className="app-cta__actions">
        {cta.href ? (
          <a href={cta.href} className="mm-btn mm-btn--primary" rel="noopener">{cta.label}</a>
        ) : null}
        {svg ? (
          <figure className="app-qr">
            <div className="app-qr__img" role="img" aria-label={`QR code for ${cta.label}`} dangerouslySetInnerHTML={{ __html: svg }} />
            <figcaption>Scan with your Android phone.</figcaption>
          </figure>
        ) : null}
      </div>
      {cta.note ? <p className="app-cta__note">{cta.note}</p> : null}
    </div>
  );
}
