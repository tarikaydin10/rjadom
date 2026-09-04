import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import { SettingsProvider } from './data/settings-context';
import './styles.css';

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
