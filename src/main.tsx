import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import { SettingsProvider } from './data/settings-context';
import { carryOverStorage } from './data/carry-over';
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

  /**
   * Never reload out from under someone mid-sentence. An answer being typed has
   * not been saved yet, and losing it to a background update would be the worst
   * possible moment for one — so the reload waits until the editor is closed or
   * empty, and takes the next opportunity.
   */
  const reloadWhenIdle = () => {
    const editor = document.querySelector<HTMLTextAreaElement>('.answer__editor');
    if (editor && editor.value.trim().length > 0) {
      window.setTimeout(reloadWhenIdle, 5000);
      return;
    }
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) {
      reloadWhenIdle();
      return;
    }
    controlled = true;
  });

  const check = () => {
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.update());
  };

  // Every occasion that could mean "a new version exists": coming back to the
  // app, regaining a connection, and a short heartbeat besides. Asking costs one
  // conditional request for a 7 KB file.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
  window.setInterval(check, 5 * 60 * 1000);
  check();
}

keepFresh();

// Before the first render, because the passphrase and the language are both
// read while it is being built.
carryOverStorage();

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
