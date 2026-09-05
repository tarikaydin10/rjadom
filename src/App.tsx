import { useEffect, useState, useSyncExternalStore } from 'react';
import { TabBar, type TabId } from './components/TabBar';
import { Today } from './screens/Today';
import { Us } from './screens/Us';
import { Placeholder } from './screens/Placeholder';
import { Lock } from './screens/Lock';
import { isUnlocked, subscribePair } from './data/pair';
import { startSync } from './data/sync';
import { prefetchDays } from './sky/engine';

import { ViewportDebug } from './components/ViewportDebug';

function useUnlocked(): boolean {
  return useSyncExternalStore(subscribePair, isUnlocked, () => true);
}

export function App() {
  const [tab, setTab] = useState<TabId>('today');
  const unlocked = useUnlocked();
  const [, force] = useState(0);

  useEffect(() => {
    if (!unlocked) return;
    // Sun and moon for the coming week, built while the phone is idle, so a
    // midnight rollover or a scrub into tomorrow never stalls a frame.
    prefetchDays(Date.now(), 6);
    return startSync();
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="app">
        <ViewportDebug />
        <Lock onUnlocked={() => force((n) => n + 1)} />
      </div>
    );
  }

  return (
    <div className="app">
      <ViewportDebug />
      {tab === 'today' && <Today />}
      {tab === 'map' && <Placeholder title="tabs.map" note="soon.map" />}
      {tab === 'chronicle' && <Placeholder title="tabs.chronicle" note="soon.chronicle" />}
      {tab === 'us' && <Us />}
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
