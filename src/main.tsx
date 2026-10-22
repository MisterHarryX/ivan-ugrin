import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/booking.css';
import './styles/psychology.css';
import './styles/ivan.css';
import { App } from './App.tsx';
import { site } from './config/site.ts';
import { getContent } from './lib/api.ts';
import { applyOverrides } from './lib/overrides.ts';
import { rememberPristine } from './lib/pristine.ts';
import { startTracking } from './lib/tracker.ts';
import { hasPageEdits, setPageEdits } from './lib/liveLayer.ts';
import { themeToCss } from './theme/themeCss.ts';

async function boot() {
  const content = await getContent(2500);
  rememberPristine(site, content);
  if (content) applyOverrides(site, content);
  document.title = site.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', site.meta.description);
  const theme = document.getElementById('theme-tokens');
  if (theme) theme.textContent = themeToCss(site.theme);
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
  requestAnimationFrame(() => {
    if (content && hasPageEdits(content)) setPageEdits(content);
    startTracking();
  });
}
void boot();
