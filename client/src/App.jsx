import { useState } from 'react';
import PreflightCheck from './components/PreflightCheck.jsx';
import WizardShell from './components/wizard/WizardShell.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  if (!ready) return <PreflightCheck onReady={() => setReady(true)} />;
  return <WizardShell />;
}
