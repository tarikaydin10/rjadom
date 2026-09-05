/**
 * How tall the screen actually is.
 *
 * The shell is pinned to the layout viewport, which is the right rectangle
 * nearly always and the wrong one at the worst moment. A phone takes height
 * away from that viewport while a keyboard is up, and iOS does not reliably
 * give all of it back afterwards — a home-screen app that has once opened the
 * answer editor can be left, for the rest of its session, with a viewport a
 * finger's width shorter than the screen. Everything pinned to it sits that far
 * above the bottom edge, the tab bar included, and from inside the layout
 * nothing looks wrong: the bar is at the foot of the app, the app is simply not
 * at the foot of the screen.
 *
 * So remember the tallest this viewport has actually been and publish it as
 * --screen-height; the shell takes whichever of the two is larger. The
 * remembered number cannot overshoot, because it is not a guess about the
 * hardware — it is a height this device really reported, in this orientation,
 * at a moment when the viewport really was that tall.
 *
 * Only in a home-screen app. In a browser tab the toolbars are entitled to that
 * height, and a shell that held on to it would run underneath the address bar.
 */

interface WebKitNavigator extends Navigator {
  /** iOS's own flag, older than the display-mode query that now duplicates it. */
  standalone?: boolean;
}

function installed(): boolean {
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  return (navigator as WebKitNavigator).standalone === true;
}

export function holdTheBottomEdge(): void {
  if (!installed()) return;

  /* Kept per orientation: portrait's height is landscape's width, and carrying
     one across to the other would push the tab bar clean off the screen. */
  let axis: 'portrait' | 'landscape' | null = null;
  let tallest = 0;

  const measure = (): void => {
    const now = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
    if (now !== axis) {
      axis = now;
      tallest = 0;
    }

    // innerHeight is the layout viewport, visualViewport what is on screen after
    // any pinch or keyboard. Either can be the honest one; the taller is.
    const seen = Math.round(Math.max(window.innerHeight, window.visualViewport?.height ?? 0));
    if (seen <= tallest) return;
    tallest = seen;
    document.documentElement.style.setProperty('--screen-height', `${tallest}px`);
  };

  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', measure);
  window.visualViewport?.addEventListener('resize', measure);
  // Coming back from the app switcher is the other moment the viewport settles.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') measure();
  });
}
