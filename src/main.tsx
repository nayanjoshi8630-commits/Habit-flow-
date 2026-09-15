import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { StatusBar, Style } from '@capacitor/status-bar';

// Configure Android Native Status Bar
StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
StatusBar.setBackgroundColor({ color: '#020617' }).catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
