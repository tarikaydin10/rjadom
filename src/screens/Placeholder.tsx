import { useI18n } from '../i18n';

/** Map and Chronicle have no design yet; an honest empty screen beats a guess. */
export function Placeholder({ title, note }: { title: string; note: string }) {
  const { t } = useI18n();
  return (
    <div className="screen">
      <h1 className="screen__title">{t(title)}</h1>
      <p className="screen__note">{t(note)}</p>
    </div>
  );
}
