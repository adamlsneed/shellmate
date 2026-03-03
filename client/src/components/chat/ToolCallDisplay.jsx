import { useState } from 'react';

const TOOL_ICONS = {
  shell_exec: '$ ',
  file_read: '> ',
  file_write: '< ',
  file_list: '# ',
  web_search: '@ ',
  web_fetch: '~ ',
};

const TOOL_LABELS = {
  shell_exec: 'Shell',
  file_read: 'Read',
  file_write: 'Write',
  file_list: 'List',
  web_search: 'Search',
  web_fetch: 'Fetch',
};

export default function ToolCallDisplay({ name, input, result, isExecuting }) {
  const [expanded, setExpanded] = useState(false);

  const icon = TOOL_ICONS[name] || '? ';
  const label = TOOL_LABELS[name] || name;

  // Summarize input for collapsed view
  const summary = name === 'shell_exec' ? input?.command
    : name === 'file_read' ? input?.path
    : name === 'file_write' ? input?.path
    : name === 'file_list' ? input?.path
    : name === 'web_search' ? input?.query
    : name === 'web_fetch' ? input?.url
    : JSON.stringify(input).slice(0, 60);

  return (
    <div className="my-2 border border-gray-700/50 rounded-lg bg-gray-800/30 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors"
      >
        {isExecuting ? (
          <span className="w-3.5 h-3.5 border border-shell-400 border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          <span className="text-xs font-mono text-shell-400 shrink-0">{icon}</span>
        )}
        <span className="text-xs font-semibold text-gray-300">{label}</span>
        <span className="text-xs text-gray-500 truncate flex-1">{summary}</span>
        <span className="text-xs text-gray-600 shrink-0">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-700/50 px-3 py-2 space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Input</p>
            <pre className="text-xs font-mono text-gray-300 bg-navy-950 rounded p-2 overflow-x-auto max-h-32 scrollbar-thin whitespace-pre-wrap">
              {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {result !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Output</p>
              <pre className="text-xs font-mono text-green-400 bg-navy-950 rounded p-2 overflow-x-auto max-h-48 scrollbar-thin whitespace-pre-wrap">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
