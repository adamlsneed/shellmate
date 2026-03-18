// Inject auth token into all API requests (token passed via URL by Electron)
const _shellmateParams = new URLSearchParams(window.location.search);
const _shellmateToken = _shellmateParams.get('token') || '';
if (_shellmateToken && window.history.replaceState) {
  window.history.replaceState({}, '', window.location.pathname);
}
if (_shellmateToken) {
  const _originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    if (typeof url === 'string' && url.startsWith('/api')) {
      options.headers = {
        ...options.headers,
        'X-Shellmate-Token': _shellmateToken,
      };
    }
    return _originalFetch.call(this, url, options);
  };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
