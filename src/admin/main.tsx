import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '../styles/tokens.css';
import '../styles/admin.css';
import { AdminApp } from './App.tsx';

createRoot(document.getElementById('admin')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
