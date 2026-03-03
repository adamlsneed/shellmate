import { useState, useEffect } from 'react';
import PreflightCheck from './components/PreflightCheck.jsx';
import WizardShell from './components/wizard/WizardShell.jsx';
import ChatApp from './components/chat/ChatApp.jsx';

export default function App() {
  const [state, setState] = useState('loading'); // loading | preflight | wizard | chat

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    try {
      const res = await fetch('/api/setup-status');
      const data = await res.json();
      if (data.setupComplete) {
        setState('chat');
      } else {
        setState('preflight');
      }
    } catch {
      setState('preflight');
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="text-4xl">🐢</div>
        <p className="text-gray-400 text-sm animate-pulse">Loading...</p>
      </div>
    );
  }

  if (state === 'preflight') {
    return <PreflightCheck onReady={() => setState('wizard')} />;
  }

  if (state === 'wizard') {
    return <WizardShell onComplete={() => setState('chat')} />;
  }

  // chat
  return <ChatApp onSettings={() => setState('wizard')} />;
}
