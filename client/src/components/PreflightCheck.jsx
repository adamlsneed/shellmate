import { useState, useEffect } from 'react';

export default function PreflightCheck({ onReady }) {
  const [status, setStatus] = useState('checking'); // checking | ok | missing

  useEffect(() => {
    check();
  }, []);

  async function check() {
    setStatus('checking');
    try {
      const res = await fetch('/api/preflight');
      const data = await res.json();
      if (data.installed) {
        setStatus('ok');
        setTimeout(onReady, 1200);
      } else {
        setStatus('missing');
      }
    } catch {
      setStatus('missing');
    }
  }

  // Checking
  if (status === 'checking') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <p className="text-gray-400 text-sm animate-pulse">Checking...</p>
      </div>
    );
  }

  // Ready
  if (status === 'ok') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <div className="flex items-center gap-2 text-green-400">
          <span className="text-xl">✓</span>
          <span className="font-semibold">Ready!</span>
        </div>
        <p className="text-sm text-gray-500">Starting the builder...</p>
      </div>
    );
  }

  // Not found
  return (
    <div className="flex flex-col items-center justify-center h-screen px-6">
      <div className="text-5xl mb-5">🐢</div>
      <h2 className="text-xl font-bold text-white mb-2">Shellmate binary not found</h2>
      <p className="text-gray-400 text-sm text-center max-w-md mb-6">
        The bundled openclaw binary wasn't detected. In dev mode this is expected if you
        haven't placed a binary in <code className="text-shell-400">resources/openclaw/</code>.
      </p>

      <div className="flex gap-3">
        <button
          onClick={check}
          className="px-5 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Check again
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
