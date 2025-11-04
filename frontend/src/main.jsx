import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SessionProvider } from './context/SessionContext.jsx';
import './styles/index.scss';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SessionProvider apiBaseUrl={apiBaseUrl}>
      <App />
    </SessionProvider>
  </React.StrictMode>
);
