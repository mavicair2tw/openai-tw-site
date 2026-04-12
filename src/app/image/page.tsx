'use client';

import { useEffect, useState } from 'react';
import { usePromptStore, useCreatorGeneration } from '@/store/usePromptStore';
import { useRouter } from 'next/navigation';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.86)',
  border: '1px solid rgba(148,163,184,0.14)',
  borderRadius: '22px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

export default function ImagenPage() {
  const router = useRouter();
  const currentPrompt = usePromptStore((state) => state.currentPrompt);
  const setCurrentPrompt = usePromptStore((state) => state.setCurrentPrompt);
  const addToHistory = usePromptStore((state) => state.addToHistory);

  const { isGenerating, generationResult, setIsGenerating, setGenerationResult } = useCreatorGeneration();

  const [editingPrompt, setEditingPrompt] = useState(currentPrompt);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (currentPrompt) {
      setEditingPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  const handleGenerateImage = async () => {
    if (!editingPrompt.trim()) {
      setErrorMessage('Please enter a prompt.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage('');
    try {
      setCurrentPrompt(editingPrompt);
      addToHistory(editingPrompt);

      const response = await fetch('/api/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: editingPrompt, aspectRatio, mode: 'text-to-image' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `API error: ${response.statusText}`);
      }

      setGenerationResult({ imageUrl: data.imageUrl, timestamp: Date.now() });
    } catch (error) {
      console.error('Error generating image:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to generate image.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generationResult?.imageUrl) return;
    const link = document.createElement('a');
    link.href = generationResult.imageUrl;
    link.download = `imagen-${Date.now()}.png`;
    link.click();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: '18px', minHeight: 'calc(100vh - 180px)' }}>
      <aside style={{ ...panelStyle, padding: '18px' }}>
        <div style={{ marginBottom: '18px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '8px' }}>Image generation</div>
          <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Image Studio</h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#94a3b8' }}>Generate still images from your prompt using the Google-first pipeline.</p>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#e2e8f0' }}>Prompt</label>
          <textarea
            value={editingPrompt}
            onChange={(e) => setEditingPrompt(e.target.value)}
            placeholder="Describe the image you want to create..."
            maxLength={4000}
            rows={8}
            style={{ width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.9)', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>{editingPrompt.length} / 4000</div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 700, color: '#e2e8f0' }}>Aspect ratio</label>
          <div style={{ display: 'grid', gap: '8px' }}>
            {['1:1', '16:9', '9:16'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  padding: '10px 12px',
                  background: aspectRatio === ratio ? '#2563eb' : 'rgba(30,41,59,0.95)',
                  color: '#fff',
                  border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  textAlign: 'left',
                  fontWeight: 700,
                }}
              >
                {ratio}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px' }}>
          <button onClick={handleGenerateImage} disabled={isGenerating || !editingPrompt.trim()} style={{ width: '100%', padding: '12px', background: isGenerating || !editingPrompt.trim() ? '#475569' : '#2563eb', color: '#fff', border: 'none', borderRadius: '14px', cursor: isGenerating || !editingPrompt.trim() ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>
          <button onClick={() => router.push('/')} style={{ width: '100%', padding: '12px', background: '#334155', color: '#fff', border: 'none', borderRadius: '14px', cursor: 'pointer', fontWeight: 700 }}>
            Back to Studio
          </button>
        </div>
      </aside>

      <section style={{ ...panelStyle, padding: '18px', display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#67e8f9', marginBottom: '6px' }}>Output</div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Generated image</h2>
          </div>
          {generationResult?.imageUrl && !isGenerating && (
            <button onClick={handleDownload} style={{ padding: '10px 14px', background: '#22c55e', color: '#04130a', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 700 }}>
              Download
            </button>
          )}
        </div>

        <div style={{ borderRadius: '18px', background: '#000', border: '1px solid rgba(148,163,184,0.12)', minHeight: '520px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {isGenerating && (
            <div style={{ textAlign: 'center', color: '#cbd5e1' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Generating…</div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>Waiting for the image provider response.</div>
            </div>
          )}

          {!isGenerating && generationResult?.imageUrl && (
            <img src={generationResult.imageUrl} alt="Generated" style={{ maxWidth: '100%', maxHeight: '100%', display: 'block' }} />
          )}

          {!isGenerating && !generationResult?.imageUrl && (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>Your image will appear here</div>
              <div style={{ fontSize: '13px' }}>Write a prompt, choose an aspect ratio, and generate.</div>
            </div>
          )}
        </div>

        {errorMessage ? (
          <div style={{ padding: '14px', background: '#3b0a0a', color: '#fecaca', border: '1px solid #7f1d1d', borderRadius: '14px' }}>
            <div style={{ fontWeight: 700, marginBottom: '6px' }}>Image generation error</div>
            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{errorMessage}</div>
          </div>
        ) : (
          <div style={{ padding: '14px', background: 'rgba(2,6,23,0.55)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '14px', fontSize: '13px' }}>
            Current route uses Google-only image generation. If it fails, the exact provider error will show here.
          </div>
        )}
      </section>
    </div>
  );
}
