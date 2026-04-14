import React, { useState, useEffect } from 'react';
import { Bot, Wifi, Loader2, CheckCircle, AlertCircle, ToggleRight, ToggleLeft, Save } from 'lucide-react';
import saApi from '../../api-superadmin';

export default function SAPlatformSettingsPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Local form state
  const [ollamaUrl, setOllamaUrl] = useState('');
  const [ollamaModel, setOllamaModel] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);

  useEffect(() => {
    saApi.get('/platform-config')
      .then(r => {
        setConfig(r.data);
        setOllamaUrl(r.data.ollama_url || 'http://localhost:11434');
        setOllamaModel(r.data.ollama_model || 'llama3.2');
        setAiEnabled(r.data.ai_suggestions_enabled !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg({ text: '', type: '' });
    try {
      await saApi.put('/platform-config', {
        ollama_url: ollamaUrl,
        ollama_model: ollamaModel,
        ai_suggestions_enabled: aiEnabled,
      });
      setMsg({ text: 'Configuration saved', type: 'success' });
      setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    } catch (e) {
      setMsg({ text: e.response?.data?.detail || 'Failed to save', type: 'error' });
    } finally { setSaving(false); }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await saApi.get('/test-ollama');
      setTestResult(res.data);
    } catch (e) {
      setTestResult({ connected: false, message: e.response?.data?.detail || 'Test failed' });
    } finally { setTesting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl" data-testid="sa-platform-settings-page">
      <h1 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif' }}>Platform Settings</h1>
      <p className="text-sm text-slate-500 mb-6">Configure platform-wide integrations. These settings apply to all schools.</p>

      {msg.text && (
        <div className={`flex items-center gap-2 rounded-xl p-3 mb-5 ${msg.type === 'error' ? 'bg-rose-50 border border-rose-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} className="text-rose-600" /> : <CheckCircle size={14} className="text-emerald-600" />}
          <p className={`text-sm ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</p>
        </div>
      )}

      {/* AI Toggle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">AI Intervention Suggestions</h2>
            <p className="text-xs text-slate-400 mt-0.5">When enabled, school staff can request AI-generated intervention recommendations on student profiles.</p>
          </div>
          <button onClick={() => setAiEnabled(p => !p)} data-testid="sa-ai-toggle">
            {aiEnabled ? <ToggleRight size={32} className="text-emerald-500" /> : <ToggleLeft size={32} className="text-slate-300" />}
          </button>
        </div>
      </div>

      {/* Ollama Config */}
      <div className={`bg-white border border-slate-200 rounded-xl p-5 mb-5 space-y-4 transition-opacity ${!aiEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Ollama Configuration</h2>
        </div>
        <p className="text-xs text-slate-400">
          WellTrack connects to your local <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700">Ollama</a> instance.
          Ollama must be running on the same server as the WellTrack backend.
        </p>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Ollama API URL</label>
          <p className="text-xs text-slate-400 mb-2">Default: <code className="bg-slate-100 px-1 rounded text-[11px]">http://localhost:11434</code></p>
          <input
            type="text" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)}
            data-testid="sa-ollama-url-input"
            placeholder="http://localhost:11434"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Model Name</label>
          <p className="text-xs text-slate-400 mb-2">
            Must be pulled first: <code className="bg-slate-100 px-1 rounded text-[11px]">ollama pull {ollamaModel}</code>
          </p>
          <input
            type="text" value={ollamaModel} onChange={e => setOllamaModel(e.target.value)}
            data-testid="sa-ollama-model-input"
            placeholder="llama3.2"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-900/20"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={testConnection} disabled={testing}
            data-testid="sa-test-ollama-btn"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-60"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.connected ? 'text-emerald-600' : 'text-rose-600'}`}>
              {testResult.message}
            </span>
          )}
        </div>

        {testResult?.connected && testResult.models?.length > 0 && (
          <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <span className="font-semibold">Available models:</span>{' '}
            {testResult.models.join(', ')}
          </div>
        )}
      </div>

      {/* Save */}
      <button
        onClick={handleSave} disabled={saving}
        data-testid="sa-save-platform-config"
        className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Saving...' : 'Save Platform Settings'}
      </button>
    </div>
  );
}
