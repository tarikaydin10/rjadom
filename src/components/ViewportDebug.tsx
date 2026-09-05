import { useEffect, useState } from 'react';

/**
 * Vorübergehend. Beantwortet genau eine Frage: warum die App im Standalone-Modus
 * in einem Rahmen sitzt statt bis in die Ecken zu laufen.
 *
 * Ein `?debug=1` hilft hier nicht — die PWA startet immer auf `start_url: '/'`,
 * ein Parameter überlebt den Start vom Home-Bildschirm nicht. Also sichtbar,
 * bis man es wegtippt; die Entscheidung, ob der Rahmen vom Viewport, vom
 * Layout oder von den Safe-Area-Werten kommt, braucht keine zweite Sitzung.
 *
 * Wieder entfernen, sobald die Zahlen abgelesen sind.
 */
export function ViewportDebug() {
  const [, tick] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const redraw = () => tick((n) => n + 1);
    window.addEventListener('resize', redraw);
    window.addEventListener('orientationchange', redraw);
    window.visualViewport?.addEventListener('resize', redraw);
    window.visualViewport?.addEventListener('scroll', redraw);
    return () => {
      window.removeEventListener('resize', redraw);
      window.removeEventListener('orientationchange', redraw);
      window.visualViewport?.removeEventListener('resize', redraw);
      window.visualViewport?.removeEventListener('scroll', redraw);
    };
  }, []);

  if (hidden) return null;

  const root = getComputedStyle(document.documentElement);
  const app = document.querySelector('.app')?.getBoundingClientRect();
  const tabs = document.querySelector('.tabs')?.getBoundingClientRect();
  const vv = window.visualViewport;

  // Die vier Insets kommen aus den Variablen in styles.css, nicht direkt aus
  // env(): so steht hier derselbe Wert, mit dem das Layout tatsächlich rechnet.
  const rows: Array<[string, string]> = [
    ['display-mode', ['standalone', 'fullscreen', 'minimal-ui', 'browser'].find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? '?'],
    ['navigator.standalone', String((navigator as { standalone?: boolean }).standalone)],
    ['window inner', `${window.innerWidth} x ${window.innerHeight}`],
    ['visualViewport', vv ? `${Math.round(vv.width)} x ${Math.round(vv.height)} @${vv.scale}` : '-'],
    ['screen', `${window.screen.width} x ${window.screen.height} dpr ${window.devicePixelRatio}`],
    ['doc client', `${document.documentElement.clientWidth} x ${document.documentElement.clientHeight}`],
    ['safe t/r/b/l', ['--safe-top', '--safe-right', '--safe-bottom', '--safe-left'].map((v) => root.getPropertyValue(v).trim() || '0px').join(' ')],
    ['tabbar content/total', `${root.getPropertyValue('--tabbar-content').trim()} / ${root.getPropertyValue('--tabbar-height').trim()}`],
    ['.app rect', app ? `${Math.round(app.left)},${Math.round(app.top)} ${Math.round(app.width)}x${Math.round(app.height)}` : '-'],
    ['.tabs rect', tabs ? `${Math.round(tabs.left)},${Math.round(tabs.top)} ${Math.round(tabs.width)}x${Math.round(tabs.height)}` : '-'],
    ['unter .tabs', app && tabs ? `${Math.round(app.bottom - tabs.bottom)}px bis .app, ${Math.round(window.innerHeight - tabs.bottom)}px bis Viewport` : '-'],
  ];

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
