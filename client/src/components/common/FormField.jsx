export function FormField({ label, hint, value, onChange, type = 'text', placeholder, mono }) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm text-gray-300 font-medium mb-1">{label}</label>}
      {hint && <p className="text-xs text-gray-500 mb-2">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-shell-500 ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}
