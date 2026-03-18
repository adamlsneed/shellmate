import { useState } from 'react';
import { describeTool } from '../../theme.js';
import { FriendlyToolStatus } from '../common/FriendlyToolStatus.jsx';

const TOOL_ICONS  = { shell_exec: '$ ', file_read: '> ', file_write: '< ', file_list: '# ', web_search: '@ ', web_fetch: '~ ' };
const TOOL_LABELS = { shell_exec: 'Shell', file_read: 'Read', file_write: 'Write', file_list: 'List', web_search: 'Search', web_fetch: 'Fetch' };

export default function ToolCallDisplay({ name, input, result, isExecuting, friendly = true }) {
  const [expanded, setExpanded] = useState(false);

  // Friendly mode — just show a human-readable status line
  if (friendly) {
    return <FriendlyToolStatus name={name} input={input} result={result} isExecuting={isExecuting} />;
  }

  // Advanced mode — original collapsible display
  const icon = TOOL_ICONS[name] || '⚙ ';
  const label = TOOL_LABELS[name] || name;
  const summary = (() => {
    if (!input) return '';
    if (input.command) return input.command.slice(0, 60);
    if (input.path)    return input.path;
    if (input.query)   return input.query;
    if (input.url)     return input.url.slice(0, 60);
    return JSON.stringify(input).slice(0, 60);
  })();

  return (
    <div className="my-1 rounded bg-navy-950 border border-gray-800 text-xs font-mono overflow-hidden">
      <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 text-left">
        {isExecuting
          ? <span className="inline-block w-4 h-4 border-2 border-shell-400 border-t-transparent rounded-full animate-spin" />
          : <span className="text-shell-400">{icon}</span>
        }
        <span className="text-gray-300 font-semibold">{label}</span>
        <span className="text-gray-500 truncate flex-1">{summary}</span>
        <span className="text-gray-600">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-800">
          <div className="mt-2">
            <div className="text-gray-500 mb-1">Input</div>
            <pre className="text-gray-300 whitespace-pre-wrap break-all">{typeof input === 'string' ? input : JSON.stringify(input, null, 2)}</pre>
          </div>
          {result && (
            <div className="mt-2">
              <div className="text-gray-500 mb-1">Output</div>
              <pre className="text-green-400 whitespace-pre-wrap break-all max-h-48 overflow-auto">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
