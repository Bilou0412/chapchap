import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './context/SessionContext.jsx';
import './styles/index.scss';

const resolveApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL && import.meta.env.VITE_API_BASE_URL.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    const port = protocol === 'https:' ? 443 : 4000;
    return `${protocol}//${hostname}:${port}`;
  }

  return 'http://localhost:4000';
};

const apiBaseUrl = resolveApiBaseUrl();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionProvider apiBaseUrl={apiBaseUrl}>
      <App />
    </SessionProvider>
  </React.StrictMode>
);
