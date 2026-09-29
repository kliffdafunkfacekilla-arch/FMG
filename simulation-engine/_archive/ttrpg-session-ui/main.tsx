import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('react-hud') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
