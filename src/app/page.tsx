'use client';

import { usePromptStore, usePromptHistory } from '@/store/usePromptStore';
import PromptBuilderComponent from '@/components/PromptBuilder';
import { useRouter } from 'next/navigation';

export default function CreatorPromptPage() {
  const router = useRouter();
  const { scenes, currentPrompt, generatePrompt } = usePromptStore();
  const { addToHistory } = usePromptHistory();

  const handleGenerateFromBuilder = () => {
    const finalPrompt = generatePrompt();
    addToHistory(finalPrompt);
  };

  const handleGoToRoute = (route: '/image' | '/video') => {
    const finalPrompt = generatePrompt();
    if (finalPrompt) {
      addToHistory(finalPrompt);
    }
    router.push(route);
  };

  const handleCopyPrompt = async () => {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      alert('✓ Prompt copied');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadPrompt = () => {
    if (!currentPrompt) return;
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(currentPrompt)}`);
    element.setAttribute('download', `prompt-${Date.now()}.txt`);
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', minHeight: 'calc(100vh - 220px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <PromptBuilderComponent onPromptGenerated={handleGenerateFromBuilder} />
      </div>

      <div style={{ width: '360px' }}>
        <div style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.16)', borderRadius: '24px', padding: '20px', color: '#e2e8f0' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Current Prompt</h3>
            <div style={{ background: '#020617', padding: '12px', borderRadius: '14px', minHeight: '120px', maxHeight: '220px', overflow: 'auto', fontSize: '12px', fontFamily: 'monospace', border: '1px solid rgba(148,163,184,0.12)' }}>
              {currentPrompt ? currentPrompt : <p style={{ color: '#94a3b8', margin: 0 }}>Edit the studio prompt on the left.</p>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={handleCopyPrompt} disabled={!currentPrompt} style={{ flex: 1, padding: '10px 12px', background: currentPrompt ? '#2563eb' : '#475569', color: '#fff', border: 'none', borderRadius: '12px', cursor: currentPrompt ? 'pointer' : 'not-allowed' }}>Copy</button>
            <button onClick={handleDownloadPrompt} disabled={!currentPrompt} style={{ flex: 1, padding: '10px 12px', background: currentPrompt ? '#334155' : '#475569', color: '#fff', border: 'none', borderRadius: '12px', cursor: currentPrompt ? 'pointer' : 'not-allowed' }}>Download</button>
          </div>

          <div style={{ background: 'rgba(2,6,23,0.48)', padding: '12px', borderRadius: '14px', marginBottom: '20px', fontSize: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Statistics</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span>Characters</span><strong>{currentPrompt.length}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Scenes</span><strong>{scenes.filter((s) => s.description).length}</strong></div>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => handleGoToRoute('/image')} style={{ width: '100%', padding: '12px', background: '#22c55e', color: '#04130a', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
              Generate Image
            </button>
            <button onClick={() => handleGoToRoute('/video')} style={{ width: '100%', padding: '12px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>
              Generate Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
