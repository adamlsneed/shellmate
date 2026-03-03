import { useState, useEffect } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useWizard } from '../../hooks/useWizard.js';
import FileTreePanel from '../ui/FileTreePanel.jsx';

export default function GenerateStep() {
  const {
    teamSpec, generatedFiles, setGeneratedFiles,
    writeResult, setWriteResult,
    isGenerating, setIsGenerating,
    isWriting, setIsWriting,
  } = useTeamSpecStore();
  const { advance: wizAdvance } = useWizard();

  const [conflicts, setConflicts] = useState([]);
  const [force, setForce] = useState(false);
  const [error, setError] = useState('');
  const [configMerged, setConfigMerged] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    if (generatedFiles.length === 0) {
      handleGenerate();
    }
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamSpec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGeneratedFiles(data.files);

      // Check for existing workspace conflicts (single main agent)
      const conflictRes = await fetch('/api/check-paths?agents=main');
      const conflictData = await conflictRes.json();
      setConflicts(conflictData.conflicts.filter(c => c.exists));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleWrite() {
    setIsWriting(true);
    setError('');
    setConfigError('');
    try {
      const workspaceRoot = '~/.openclaw/workspace';

      // Rewrite generated file paths: workspace-main/X → ~/.openclaw/workspace/X
      const files = generatedFiles.map(f => {
        const match = f.path.match(/^workspace-main\/(.+)$/);
        if (match) {
          return { ...f, path: `${workspaceRoot}/${match[1]}` };
        }
        return f;
      });

      const writeRes = await fetch('/api/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files, force }),
      });
      const writeData = await writeRes.json();
      if (!writeRes.ok) throw new Error(writeData.error || 'Write failed');
      setWriteResult(writeData);

      // Register in openclaw.json — main agent uses agents.defaults, no agents.list needed
      const configRes = await fetch('/api/openclaw-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMainAgent: true,
        }),
      });
      if (!configRes.ok) {
        setConfigError('Files written, but failed to update openclaw.json. You may need to configure manually.');
      } else {
        setConfigMerged(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsWriting(false);
    }
  }

  const done = writeResult && (configMerged || configError);

  return (
    <div className="max-w-4xl">
      {isGenerating && (
        <div className="flex items-center gap-2 text-shell-400 mb-4">
          <span className="animate-spin">⟳</span>
          <span className="text-sm">Generating files...</span>
        </div>
      )}

      {!isGenerating && generatedFiles.length > 0 && (
        <>
          <div className="h-80 mb-6">
            <FileTreePanel files={generatedFiles} />
          </div>

          {conflicts.length > 0 && !writeResult && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 mb-4">
              <p className="text-yellow-400 text-sm font-semibold mb-2">Existing workspace detected</p>
              <ul className="text-xs text-yellow-300 space-y-1 mb-3">
                {conflicts.map(c => (
                  <li key={c.agentId}><code>{c.path}</code> already exists</li>
                ))}
              </ul>
              <label className="flex items-center gap-2 text-sm text-yellow-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={force}
                  onChange={e => setForce(e.target.checked)}
                  className="rounded"
                />
                Overwrite existing files (backs up as .bak-YYYYMMDD-HHmmss)
              </label>
            </div>
          )}

          {writeResult && (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-sm">✓</span>
                <span className="text-sm text-gray-200">
                  Written {writeResult.written?.length || 0} files to <code className="text-shell-400">~/.openclaw/workspace</code>
                  {writeResult.skipped?.length > 0 && (
                    <span className="text-gray-500"> ({writeResult.skipped.length} skipped, already existed)</span>
                  )}
                </span>
              </div>
              {configMerged && (
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-sm">✓</span>
                  <span className="text-sm text-gray-200">
                    Agent registered in <code className="text-shell-400">openclaw.json</code>
                    <span className="text-gray-500 ml-1">— gateway will pick it up on next restart</span>
                  </span>
                </div>
              )}
              {configError && (
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 text-sm">⚠</span>
                  <span className="text-sm text-yellow-300">{configError}</span>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <div className="flex gap-3 flex-wrap">
            {!writeResult && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                ↺ Regenerate
              </button>
            )}

            {!writeResult && (
              <button
                onClick={handleWrite}
                disabled={isWriting}
                className="px-6 py-2 bg-shell-600 hover:bg-shell-500 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {isWriting ? '⟳ Writing...' : 'Write to ~/.openclaw →'}
              </button>
            )}

            {done && (
              <button
                onClick={wizAdvance}
                className="px-6 py-2 bg-green-700 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Set up capabilities →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
