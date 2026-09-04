import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import { SettingsProvider } from './data/settings-context';
import './styles.css';

/**
 * Keep a running app in step with the server.
 *
 * The generated registration only registers the worker on page load. A phone
 * with this on its home screen may not do a real page load for days, so a
 * deployed fix can sit on the server unseen while the app keeps running last
 * week's code — which is exactly how a working passphrase came to look broken.
 *
 * So: ask for an update whenever the app comes back to the foreground and once
 * an hour, and reload when a new worker actually takes over. `clientsClaim`
 * changes which worker answers future requests; it does not replace the
 * JavaScript already running in this page. Only a reload does that.
 */
function keepFresh(): void {
  if (!('serviceWorker' in navigator)) return;

  // The very first claim, right after installing, is not an update — there is
  // nothing newer to load. Every claim after that is a new version taking over,
  // and the page has to reload to actually run it. Tracked as state rather than
  // read once at startup: read once, a first visit would latch "uncontrolled"
  // and that page would never reload again.
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) {
      window.location.reload();
      return;
    }
    controlled = true;
  });

  const check = () => {
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.setInterval(check, 60 * 60 * 1000);
}

keepFresh();

const container = document.getElementById('root');
if (!container) throw new Error('missing #root');

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </I18nProvider>
  </StrictMode>,
);
