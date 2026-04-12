'use client';

import { useEffect, useState } from 'react';
import { usePromptStore, useCreatorGeneration } from '@/store/usePromptStore';
import { useRouter } from 'next/navigation';

export default function ImagenPage() {
  const router = useRouter();
  const currentPrompt = usePromptStore((state) => state.currentPrompt);
  const setCurrentPrompt = usePromptStore((state) => state.setCurrentPrompt);
  const addToHistory = usePromptStore((state) => state.addToHistory);

  const {
    isGenerating,
    generationResult,
    setIsGenerating,
    setGenerationResult,
  } = useCreatorGeneration();

  const [editingPrompt, setEditingPrompt] = useState(currentPrompt);
  const [aspectRatio, setAspectRatio] = useState('1:1');

  useEffect(() => {
    if (currentPrompt) {
      setEditingPrompt(currentPrompt);
    }
  }, [currentPrompt]);

  const handleGenerateImage = async () => {
    if (!editingPrompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      setCurrentPrompt(editingPrompt);
      addToHistory(editingPrompt);

      const response = await fetch('/api/imagen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editingPrompt,
          aspectRatio,
          mode: 'text-to-image',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      setGenerationResult({
        imageUrl: data.imageUrl,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerateImage();
  };

  const handleDownload = () => {
    if (generationResult?.imageUrl) {
      const link = document.createElement('a');
      link.href = generationResult.imageUrl;
      link.download = `imagen-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100vh', padding: '20px', background: '#fff' }}>
      <div style={{ width: '350px', overflow: 'auto', borderRight: '1px solid #e0e0e0', paddingRight: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Prompt</label>
          <textarea
            value={editingPrompt}
            onChange={(e) => setEditingPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            maxLength={4000}
            rows={6}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e0e0e0',
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'vertical',
              boxSizing: 'border-box',
              color: '#111827',
              background: '#ffffff',
            }}
          />
          <div style={{ fontSize: '11px', color: '#999', marginTop: '5px' }}>
            {editingPrompt.length} / 4000
          </div>

          {currentPrompt && editingPrompt === currentPrompt && (
            <div style={{ marginTop: '8px', padding: '8px', background: '#e8f5e9', borderRadius: '4px', fontSize: '12px', color: '#2e7d32' }}>
              ✓ 提示詞來自 PromptBuilder
            </div>
          )}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Aspect ratio</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {['1:1', '16:9', '9:16'].map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  padding: '8px',
                  background: aspectRatio === ratio ? '#007AFF' : '#f0f0f0',
                  color: aspectRatio === ratio ? '#fff' : '#000',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {ratio === '1:1' && '◻ Square'}
                {ratio === '16:9' && '▬ Landscape'}
                {ratio === '9:16' && '▮ Portrait'}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerateImage}
          disabled={isGenerating || !editingPrompt.trim()}
          style={{
            width: '100%',
            padding: '12px',
            background: isGenerating || !editingPrompt.trim() ? '#ccc' : '#007AFF',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: isGenerating || !editingPrompt.trim() ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate Image →'}
        </button>

        <button
          onClick={() => router.push('/')}
          style={{
            width: '100%',
            padding: '12px',
            background: '#6c757d',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          ← Back to Prompt Builder
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isGenerating && (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Generating…</p>
            <p style={{ color: '#999', fontSize: '12px' }}>This usually takes 5–15 seconds</p>
          </div>
        )}

        {generationResult?.imageUrl && !isGenerating && (
          <div>
            <img src={generationResult.imageUrl} alt="Generated" style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDownload}
                style={{ flex: 1, padding: '12px', background: '#34C759', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                ↓ Download
              </button>
              <button
                onClick={handleRegenerate}
                style={{ flex: 1, padding: '12px', background: '#FF9500', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                ↺ Regenerate
              </button>
            </div>
          </div>
        )}

        {!generationResult && !isGenerating && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <p style={{ fontSize: '18px', marginBottom: '10px' }}>Your image will appear here</p>
            <p style={{ fontSize: '12px' }}>Write a prompt and hit generate</p>
          </div>
        )}
      </div>
    </div>
  );
}
