import { useState, useEffect } from 'react';

export default function PreflightCheck({ onReady }) {
  const [status, setStatus] = useState('checking'); // checking | ok | migrating | error

  useEffect(() => {
    check();
  }, []);

  async function check() {
    setStatus('checking');
    try {
      const res = await fetch('/api/preflight');
      const data = await res.json();

      if (data.ready) {
        setStatus('ok');
        setTimeout(onReady, 800);
        return;
      }

      if (data.needsMigration) {
        setStatus('migrating');
        await migrate();
        return;
      }

      // Should not reach here — preflight auto-creates config dir
      setStatus('ok');
      setTimeout(onReady, 800);
    } catch {
      setStatus('error');
    }
  }

  async function migrate() {
    try {
      const res = await fetch('/api/preflight/migrate', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setStatus('ok');
        setTimeout(onReady, 800);
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <p className="text-gray-400 text-sm animate-pulse">Checking...</p>
      </div>
    );
  }

  if (status === 'ok') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <div className="flex items-center gap-2 text-green-400">
          <span className="text-xl">✓</span>
          <span className="font-semibold">Ready!</span>
        </div>
      </div>
    );
  }

  if (status === 'migrating') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <p className="text-gray-400 text-sm animate-pulse">Migrating from previous install...</p>
      </div>
    );
  }

  // error
  return (
    <div className="flex flex-col items-center justify-center h-screen px-6">
      <div className="text-5xl mb-5">🐢</div>
      <h2 className="text-xl font-bold text-white mb-2">Setup issue</h2>
      <p className="text-gray-400 text-sm text-center max-w-md mb-6">
        Something went wrong during initialization. Try again or continue to set up manually.
      </p>
      <div className="flex gap-3">
        <button
          onClick={check}
          className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Try again
        </button>
        <button
          onClick={onReady}
          className="px-5 py-2 bg-shell-600 hover:bg-shell-500 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Continue anyway
        </button>
      </div>
    </div>
  );
}
