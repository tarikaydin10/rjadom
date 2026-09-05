import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Vorübergehend. Beantwortet genau eine Frage: warum die App im Standalone-Modus
 * in einem Rahmen sitzt statt bis in die Ecken zu laufen.
 *
 * Ein `?debug=1` hilft hier nicht — die PWA startet immer auf `start_url: '/'`,
 * ein Parameter überlebt den Start vom Home-Bildschirm nicht. Also sichtbar,
 * bis man es wegtippt.
 *
 * Wieder entfernen, sobald die Zahlen abgelesen sind.
 */

/** Das breiteste Element der Seite, samt seiner Breite. Wenn irgendetwas den
 *  Layout-Viewport über `width=device-width` hinaus aufspannt, steht es hier. */
function widest(): string {
  let worst: Element | null = null;
  let max = 0;
  for (const el of Array.from(document.querySelectorAll('*'))) {
    const r = el.getBoundingClientRect();
    if (r.right > max) {
      max = r.right;
      worst = el;
    }
  }
  if (!worst) return '-';
  const name = worst.tagName.toLowerCase() + (worst.className && typeof worst.className === 'string' ? '.' + worst.className.trim().split(/\s+/).join('.') : '');
  return `${Math.round(max)}px ${name.slice(0, 48)}`;
}

export function ViewportDebug() {
  const [rows, setRows] = useState<Array<[string, string]>>([]);
  const [hidden, setHidden] = useState(false);

  // Nach dem Commit, nicht im Render: vorher gibt es .app und .tabs im DOM noch
  // nicht, und beide Zeilen kamen deshalb als "-" zurück.
  useLayoutEffect(() => {
    const measure = () => {
      const root = getComputedStyle(document.documentElement);
      const app = document.querySelector('.app')?.getBoundingClientRect();
      const tabs = document.querySelector('.tabs')?.getBoundingClientRect();
      const vv = window.visualViewport;
      const de = document.documentElement;

      setRows([
        ['display-mode', ['standalone', 'fullscreen', 'minimal-ui', 'browser'].find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? '?'],
        ['inner', `${window.innerWidth} x ${window.innerHeight}`],
        ['screen', `${window.screen.width} x ${window.screen.height} dpr${window.devicePixelRatio}`],
        ['vv scale', vv ? `${vv.scale} → ${Math.round(vv.width)} x ${Math.round(vv.height)}` : '-'],
        ['scroll w/h', `${de.scrollWidth} x ${de.scrollHeight}`],
        ['client w/h', `${de.clientWidth} x ${de.clientHeight}`],
        ['widest', widest()],
        ['safe t/r/b/l', ['--safe-top', '--safe-right', '--safe-bottom', '--safe-left'].map((v) => root.getPropertyValue(v).trim() || '0px').join(' ')],
        ['tabbar', `${root.getPropertyValue('--tabbar-content').trim()} + safe`],
        ['.app', app ? `${Math.round(app.left)},${Math.round(app.top)} ${Math.round(app.width)}x${Math.round(app.height)}` : '-'],
        ['.tabs', tabs ? `${Math.round(tabs.left)},${Math.round(tabs.top)} ${Math.round(tabs.width)}x${Math.round(tabs.height)}` : '-'],
        ['unter .tabs', tabs ? `${Math.round(window.innerHeight - tabs.bottom)}px bis Viewport` : '-'],
      ]);
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  // Ein zweiter Blick, nachdem Schriften und Himmelsband fertig sind — die
  // Messung direkt nach dem ersten Commit kann noch ein Zwischenstand sein.
  useEffect(() => {
    const t = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (hidden) return null;

  return (
    <div
      onClick={() => setHidden(true)}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        left: 8,
        right: 8,
        zIndex: 9999,
        background: 'rgba(20,16,12,0.88)',
        color: '#f4efe6',
        font: '10px/1.45 ui-monospace, Menlo, monospace',
        padding: '8px 10px',
        borderRadius: 8,
      }}
    >
      {rows.map(([k, v]) => (
        <div key={k}>
          <span style={{ opacity: 0.6 }}>{k}: </span>
          {v}
        </div>
      ))}
      <div style={{ opacity: 0.5, marginTop: 4 }}>tippen zum Ausblenden</div>
    </div>
  );
}
