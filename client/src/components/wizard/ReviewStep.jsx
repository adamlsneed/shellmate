import { useState, useRef, useEffect } from 'react';
import { useTeamSpecStore } from '../../store/teamSpec.js';
import { useWizard } from '../../hooks/useWizard.js';

// ─── Inline editable text ────────────────────────────────────────────────────
function InlineEdit({ value, onSave, multiline, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
  }

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
      <Tag
        ref={ref}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        rows={multiline ? 3 : undefined}
        className={`bg-gray-900 border border-shell-500 rounded px-2 py-1 text-sm text-gray-100 w-full focus:outline-none ${className}`}
      />
    );
  }

  return (
    <span
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`cursor-pointer hover:bg-gray-700/50 rounded px-1 -mx-1 transition-colors ${className}`}
      title="Click to edit"
    >
      {value}
    </span>
  );
}

// ─── Editable rule list ──────────────────────────────────────────────────────
function EditableRuleList({ rules, onChange, label }) {
  const [adding, setAdding] = useState(false);
  const [newRule, setNewRule] = useState('');
  const addRef = useRef(null);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  function updateRule(idx, text) {
    const next = [...rules];
    next[idx] = text;
    onChange(next);
  }

  function removeRule(idx) {
    onChange(rules.filter((_, i) => i !== idx));
  }

  function commitAdd() {
    const trimmed = newRule.trim();
    if (trimmed) onChange([...rules, trimmed]);
    setNewRule('');
    setAdding(false);
  }

  function handleAddKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitAdd(); }
    if (e.key === 'Escape') { setNewRule(''); setAdding(false); }
  }

  return (
    <div>
      <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">{label}</p>
      <ul className="space-y-1">
        {rules.map((r, i) => (
          <li key={i} className="text-xs text-red-300 flex items-start gap-1.5 group">
            <span className="mt-0.5 shrink-0">✕</span>
            <span className="flex-1">
              <InlineEdit
                value={r}
                onSave={text => text ? updateRule(i, text) : removeRule(i)}
                className="text-xs text-red-300"
              />
            </span>
            <button
              onClick={() => removeRule(i)}
              className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity shrink-0 ml-1"
              title="Remove rule"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {adding ? (
        <div className="mt-2">
          <input
            ref={addRef}
            value={newRule}
            onChange={e => setNewRule(e.target.value)}
            onBlur={commitAdd}
            onKeyDown={handleAddKey}
            placeholder="e.g. Never delete files without asking"
            className="bg-gray-900 border border-shell-500 rounded px-2 py-1 text-xs text-gray-100 w-full focus:outline-none"
          />
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-2 text-xs text-gray-500 hover:text-shell-400 transition-colors"
        >
          + Add rule
        </button>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ReviewStep() {
  const teamSpec = useTeamSpecStore(s => s.teamSpec);
  const updateAgent = useTeamSpecStore(s => s.updateAgent);
  const { advance, goBack } = useWizard();
  const [showRaw, setShowRaw] = useState(false);

  const agent = teamSpec.agent || {};
  const neverList = Array.isArray(agent.never) ? agent.never : [];
  const macApps = Array.isArray(agent.mac_apps) ? agent.mac_apps : [];
  const useCases = Array.isArray(agent.use_cases) ? agent.use_cases : [];
  const hasAgent = !!(agent.name || agent.mission);

  return (
    <div className="max-w-2xl">
      {/* No spec warning */}
      {!hasAgent && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 mb-4">
          <p className="text-yellow-300 text-sm">
            The conversation didn't produce a complete agent spec yet.
            Go back and continue the conversation, or the files will be generated with placeholder values.
          </p>
        </div>
      )}

      {/* Safety hint */}
      {neverList.length < 2 && hasAgent && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-xl p-4 mb-4">
          <p className="text-yellow-300 text-sm">
            Consider adding rules about when your helper should ask before acting.
          </p>
        </div>
      )}

      {/* Agent card */}
      {hasAgent && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-4">
          {/* Name + ID */}
          <div className="mb-3">
            <h3 className="font-semibold text-white text-lg">
              <InlineEdit
                value={agent.name || 'Unnamed'}
                onSave={text => updateAgent({ name: text })}
              />
            </h3>
            <code className="text-xs text-gray-500">{agent.id}</code>
          </div>

          {/* Personality */}
          {agent.personality && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Personality</p>
              <p className="text-sm text-gray-300">
                <InlineEdit
                  value={agent.personality}
                  onSave={text => updateAgent({ personality: text })}
                  multiline
                  className="text-sm text-gray-300"
                />
              </p>
            </div>
          )}

          {/* Mission */}
          <div className="mb-4">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1 font-medium">Mission</p>
            <p className="text-sm text-gray-300">
              <InlineEdit
                value={agent.mission || '// TODO'}
                onSave={text => updateAgent({ mission: text })}
                multiline
                className="text-sm text-gray-300"
              />
            </p>
          </div>

          {/* Mac apps */}
          {macApps.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Mac apps</p>
              <div className="flex flex-wrap gap-1.5">
                {macApps.map((app, i) => (
                  <span
                    key={i}
                    className="inline-block bg-shell-900/40 border border-shell-700/50 text-shell-300 text-xs rounded-full px-2.5 py-0.5"
                  >
                    {app}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Use cases */}
          {useCases.length > 0 && (
            <div className="mb-4">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-medium">Use cases</p>
              <ul className="space-y-1">
                {useCases.map((uc, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-shell-500 mt-0.5 shrink-0">•</span>
                    <InlineEdit
                      value={uc}
                      onSave={text => {
                        const next = [...useCases];
                        if (text) { next[i] = text; } else { next.splice(i, 1); }
                        updateAgent({ use_cases: next });
                      }}
                      className="text-sm text-gray-300"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Failure + escalation */}
          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            {agent.failure && (
              <div>
                <p className="text-gray-500 uppercase tracking-wider mb-1 font-medium">When stuck</p>
                <p className="text-gray-300">
                  <InlineEdit
                    value={agent.failure}
                    onSave={text => updateAgent({ failure: text })}
                    className="text-xs text-gray-300"
                  />
                </p>
              </div>
            )}
            {agent.escalation && (
              <div>
                <p className="text-gray-500 uppercase tracking-wider mb-1 font-medium">Asks you first</p>
                <InlineEdit
                  value={agent.escalation}
                  onSave={text => updateAgent({ escalation: text })}
                  multiline
                  className="text-xs text-gray-300"
                />
              </div>
            )}
          </div>

          {/* Never rules */}
          <div className="pt-4 border-t border-gray-700">
            <EditableRuleList
              rules={neverList}
              onChange={next => updateAgent({ never: next })}
              label="Will never"
            />
          </div>
        </div>
      )}

      {/* Raw JSON toggle (for technical users) */}
      <div className="mb-6">
        <button
          onClick={() => setShowRaw(v => !v)}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {showRaw ? '▾ Hide technical details' : '▸ Show technical details'}
        </button>
        {showRaw && (
          <pre className="mt-2 bg-gray-900 border border-gray-700 rounded-xl p-4 text-xs text-green-400 font-mono overflow-auto max-h-64 scrollbar-thin">
            {JSON.stringify(teamSpec, null, 2)}
          </pre>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={goBack} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition-colors">
          ← Go back
        </button>
        <button
          onClick={advance}
          className="px-6 py-2.5 bg-green-700 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          Looks good — generate files →
        </button>
      </div>
    </div>
  );
}
