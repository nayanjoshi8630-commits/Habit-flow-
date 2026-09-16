import React, { useState } from 'react';

export const GeminiApiKeyModal: React.FC<{ onKeySaved: () => void }> = ({ onKeySaved }) => {
  const [keyInput, setKeyInput] = useState('');
  const [error, setError] = useState('');

  const handleOpenStudio = () => {
    window.open('https://aistudio.google.com/app/apikey', '_blank');
  };

  const handleSave = () => {
    const trimmed = keyInput.trim();
    if (!trimmed.startsWith('AIza')) {
      setError('Please paste a valid key starting with "AIza..."');
      return;
    }
    localStorage.setItem('habitflow_user_gemini_key', trimmed);
    setError('');
    onKeySaved();
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-indigo-500/30 text-left space-y-4 max-w-sm mx-auto shadow-xl">
      <div className="flex items-center space-x-2">
        <span className="text-xl">✨</span>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">
          Connect Free Gemini AI
        </h3>
      </div>

      {/* Brief 3-Step Workflow */}
      <div className="space-y-2 text-xs text-slate-300">
        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            1
          </span>
          <p>Tap below to open Google AI Studio in your browser.</p>
        </div>

        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            2
          </span>
          <p>Sign in with Google, tap <b>Create API key</b>, and copy it.</p>
        </div>

        <div className="flex items-start gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
          <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-[10px] shrink-0">
            3
          </span>
          <p>Paste your key here to activate autonomous routines.</p>
        </div>
      </div>

      <button
        onClick={handleOpenStudio}
        className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/40 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
      >
        <span>Open Google AI Studio</span>
        <span>↗</span>
      </button>

      <div className="space-y-2 pt-1">
        <input
          type="password"
          placeholder="Paste key here (AIzaSy...)"
          value={keyInput}
          onChange={(e) => {
            setKeyInput(e.target.value);
            if (error) setError('');
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"
        />

        {error && <p className="text-[11px] text-rose-400 px-1">{error}</p>}

        <button
          onClick={handleSave}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-md shadow-indigo-600/25"
        >
          Save & Activate Engine
        </button>
      </div>
    </div>
  );
};
