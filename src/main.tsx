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

/**
 * Give the screen back to iOS after the keyboard.
 *
 * In a home-screen app the first keyboard takes the top inset off the layout
 * viewport — 62pt on a Dynamic Island phone — and iOS does not put it back
 * when the keyboard goes. The viewport stays that much shorter than the screen
 * until the app is force-quit, and everything measured against it (dvh, a
 * sticky tab bar) stops that far above the bottom edge, with bare background
 * beneath. No meta tag prevents it; a scrolling document does not either.
 *
 * What works is making iOS measure again: hide the root for one frame and show
 * it. Done only when the viewport really is shorter than the screen — in
 * standalone with viewport-fit=cover the two are the same height — so a page
 * that never lost anything never blinks.
 *
 * Watched through the visual viewport, not through focus. The keyboard's own
 * dismiss key leaves the field focused, and a field that unmounts (the
 * passphrase, on unlock) never blurs at all — neither would have fired. The
 * visual viewport resizes whenever the keyboard comes or goes; the check runs
 * once it has been still for a moment, and never while the keyboard is up.
 */
function healViewport(): void {
  if (!window.matchMedia('(display-mode: standalone)').matches) return;

  const short = (): boolean => {
    const scale = window.visualViewport?.scale ?? 1;
    const viewport = Math.max(window.innerWidth, window.innerHeight) * scale;
    const screen = Math.max(window.screen.width, window.screen.height);
    return viewport < screen - 2;
  };

  const keyboardUp = (): boolean => {
    const visual = window.visualViewport;
    return visual !== null && visual.height < window.innerHeight - 80;
  };

  const heal = () => {
    if (keyboardUp() || !short()) return;
    const root = document.getElementById('root');
    if (!root) return;
    const y = window.scrollY;
    root.style.display = 'none';
    void root.offsetHeight;
    root.style.display = '';
    window.scrollTo(0, y);
  };

  let pending = 0;
  const settle = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(heal, 300);
  };
  window.visualViewport?.addEventListener('resize', settle);
  document.addEventListener('focusout', settle);
}

healViewport();

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
