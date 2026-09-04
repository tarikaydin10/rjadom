import { useI18n } from '../i18n';

export type TabId = 'today' | 'map' | 'chronicle' | 'us';

const TABS: TabId[] = ['today', 'map', 'chronicle', 'us'];

interface Props {
  active: TabId;
  onChange(tab: TabId): void;
}

export function TabBar({ active, onChange }: Props) {
  const { t } = useI18n();
  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <button
          key={tab}
          className={tab === active ? 'tabs__item tabs__item--active' : 'tabs__item'}
          onClick={() => onChange(tab)}
          aria-current={tab === active ? 'page' : undefined}
        >
          {t(`tabs.${tab}`)}
        </button>
      ))}
    </nav>
  );
}
