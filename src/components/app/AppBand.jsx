import { APP_FEATURES } from './appFeatures';
import { AppCta } from './AppCta';
import './app.css';

/** Homepage band for the Android app. Server component; the call to action follows env only. */
export function AppBand() {
  return (
    <section className="app-band" id="android-app" aria-labelledby="app-band-title">
      <div className="mm-wrap">
        <div className="app-band__grid">
          <div className="app-band__head">
            <h2 className="app-band__title" id="app-band-title">MockMob on Android.</h2>
            <p className="app-band__lede">The web app does the practice. The Android app adds the small things that get you back to it tonight: a next step, a recap, a reminder when a task is real.</p>
            <AppCta />
          </div>
          <ul className="app-list">
            {APP_FEATURES.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default AppBand;
