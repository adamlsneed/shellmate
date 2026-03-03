import { useState } from 'react';

export default function FileTreePanel({ files }) {
  const [selected, setSelected] = useState(null);

  if (!files || files.length === 0) return null;

  const selectedFile = files.find(f => f.path === selected);

  return (
    <div className="grid grid-cols-2 gap-4 h-full">
      <div className="overflow-auto scrollbar-thin">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Files to write ({files.length})</p>
        <ul className="space-y-1">
          {files.map(f => (
            <li key={f.path}>
              <button
                onClick={() => setSelected(selected === f.path ? null : f.path)}
                className={`w-full text-left text-xs px-2 py-1.5 rounded font-mono truncate transition-colors ${
                  selected === f.path
                    ? 'bg-shell-600/30 text-shell-300 border border-shell-600/50'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                📄 {f.path}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-auto scrollbar-thin">
        {selectedFile ? (
          <>
            <p className="text-xs text-gray-500 mb-2 font-mono truncate">{selectedFile.path}</p>
            <pre className="text-xs text-gray-300 bg-navy-900 rounded p-3 overflow-auto whitespace-pre-wrap">
              {selectedFile.content}
            </pre>
          </>
        ) : (
          <p className="text-xs text-gray-600 mt-8 text-center">Click a file to preview</p>
        )}
      </div>
    </div>
  );
}
