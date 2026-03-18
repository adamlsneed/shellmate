import { useState, useEffect, useRef } from 'react';
import { useAIConfig } from '../../store/aiConfig.js';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import SimpleAISetup from '../ai/SimpleAISetup.jsx';
import ConversationPhase from './ConversationPhase.jsx';
import SimpleCapabilities from './SimpleCapabilities.jsx';
import { BigButton } from '../common/BigButton.jsx';

const STEP = { AUTH: 0, CHAT: 1, FINISHING: 2, READY: 3, CAPABILITIES: 4 };

export default function SimpleSetup({ onComplete }) {
  const { configured } = useAIConfig();
  const { conversationComplete, teamSpec, populateSimpleDefaults } = useTeamSpecStore();
  const [step, setStep] = useState(configured ? STEP.CHAT : STEP.AUTH);
  const [error, setError] = useState('');
  const finishAttempted = useRef(false);

  // When AI conversation is done, auto-finish setup
  useEffect(() => {
    if (conversationComplete && step === STEP.CHAT && !finishAttempted.current) {
      finishAttempted.current = true;
      finishSetup();
    }
  }, [conversationComplete, step]);

  async function finishSetup() {
    setStep(STEP.FINISHING);
    setError('');

    try {
      // Fill in any gaps with sensible defaults — returns the updated spec to avoid stale closure
      const updatedSpec = populateSimpleDefaults();

      // Generate workspace files
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSpec: updatedSpec }),
      });
      if (!genRes.ok) throw new Error('Failed to generate files');
      const { files } = await genRes.json();

      // Rewrite paths: workspace-main/X → ~/.shellmate/workspace/X (server resolves ~)
      const workspaceRoot = '~/.shellmate/workspace';
      const rewritten = files.map(f => {
        const match = f.path.match(/^workspace-main\/(.+)$/);
        return match ? { ...f, path: `${workspaceRoot}/${match[1]}` } : f;
      });

      const writeRes = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: rewritten, force: true }),
      });
      if (!writeRes.ok) throw new Error('Failed to write files');

      // Register agent in config (same pattern as GenerateStep.jsx)
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMainAgent: true }),
      });

      setStep(STEP.READY);
    } catch (err) {
      console.error('Setup error:', err);
      setError("Something went wrong during setup. Let's try again.");
      setStep(STEP.CHAT);
      finishAttempted.current = false;
    }
  }

  // Step 0: Access code / sign in
  if (step === STEP.AUTH) {
    return <SimpleAISetup onDone={() => setStep(STEP.CHAT)} />;
  }

  // Step 2: Finishing (auto-generating)
  if (step === STEP.FINISHING) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <span className="inline-block w-10 h-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-h2 text-[var(--text-primary)] mb-2">Setting things up...</h2>
        <p className="text-body text-[var(--text-secondary)]">This only takes a moment.</p>
      </div>
    );
  }

  // Step 4: Optional capabilities
  if (step === STEP.CAPABILITIES) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] overflow-y-auto">
        <SimpleCapabilities
          onDone={onComplete}
          onSkip={onComplete}
        />
      </div>
    );
  }

  // Step 3: Ready — choose to start chatting or set up more features
  if (step === STEP.READY) {
    const name = teamSpec.agent?.name?.replace("'s Helper", '') || 'friend';
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-6xl mb-6">🐢</div>
        <h1 className="text-h1 text-[var(--text-primary)] mb-3">
          All set, {name}!
        </h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-md">
          Shellmate is ready to help. You can start chatting right away, or set up extra features like web search and smart home control.
        </p>
        <div className="w-full max-w-sm space-y-3">
          <BigButton onClick={onComplete} className="w-full px-12">
            Start chatting
          </BigButton>
          <button
            onClick={() => setStep(STEP.CAPABILITIES)}
            className="w-full px-6 py-4 rounded-friendly border-2 border-[var(--border)] text-body text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)] transition-colors"
          >
            Set up extra features (web search, smart home, and more)
          </button>
        </div>
      </div>
    );
  }

  // Step 1: Friendly conversation
  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="text-center pt-6 pb-2 px-6">
        <div className="text-4xl mb-2">🐢</div>
        <h2 className="text-h2 text-[var(--text-primary)]">Let's get to know you</h2>
        <p className="text-body text-[var(--text-secondary)]">Just a few quick questions</p>
      </div>

      {error && (
        <div className="mx-6 mt-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-friendly text-body">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <ConversationPhase simpleMode={true} />
      </div>
    </div>
  );
}
