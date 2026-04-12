'use client';

import { usePromptStore, usePromptHistory } from '@/store/usePromptStore';
import PromptBuilderComponent from '@/components/PromptBuilder';
import { useRouter } from 'next/navigation';

export default function CreatorPromptPage() {
  const router = useRouter();
  const {
    globalParams,
    scenes,
    currentPrompt,
    generatePrompt,
  } = usePromptStore();

  const { promptHistory, addToHistory } = usePromptHistory();

  const handleGenerateFromBuilder = () => {
    const finalPrompt = generatePrompt();
    addToHistory(finalPrompt);
  };

  const handleConfirmAndGotoCreator = () => {
    router.push('/creator/image');
  };

  const handleCopyPrompt = async () => {
    if (!currentPrompt) return;
    try {
      await navigator.clipboard.writeText(currentPrompt);
      alert('✓ 提示詞已複製到剪貼板');
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadPrompt = () => {
    if (!currentPrompt) return;
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(currentPrompt)}`
    );
    element.setAttribute('download', `prompt-${Date.now()}.txt`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div style={{ display: 'flex', gap: '20px', height: '100vh', padding: '20px', background: '#fff' }}>
      <div style={{ flex: 1, overflow: 'auto', borderRight: '1px solid #e0e0e0', paddingRight: '20px' }}>
        <PromptBuilderComponent
          onPromptGenerated={handleGenerateFromBuilder}
        />
      </div>

      <div style={{ width: '350px', overflow: 'auto' }}>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Current Prompt</h3>
            <div style={{
              background: '#f5f5f5',
              padding: '12px',
              borderRadius: '6px',
              minHeight: '80px',
              maxHeight: '150px',
              overflow: 'auto',
              fontSize: '12px',
              fontFamily: 'monospace',
              border: '1px solid #e0e0e0',
            }}>
              {currentPrompt ? <code>{currentPrompt}</code> : <p style={{ color: '#999', margin: 0 }}>編輯左側</p>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleCopyPrompt}
              disabled={!currentPrompt}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: currentPrompt ? '#007AFF' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPrompt ? 'pointer' : 'not-allowed',
                fontSize: '12px',
              }}
            >
              📋 Copy
            </button>
            <button
              onClick={handleDownloadPrompt}
              disabled={!currentPrompt}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: currentPrompt ? '#007AFF' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: currentPrompt ? 'pointer' : 'not-allowed',
                fontSize: '12px',
              }}
            >
              ⬇ Download
            </button>
          </div>

          <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Statistics</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>字數：</span>
              <strong>{currentPrompt.length}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>分鏡數：</span>
              <strong>{scenes.filter((s) => s.description).length}</strong>
            </div>
          </div>

          <button
            onClick={handleConfirmAndGotoCreator}
            style={{
              width: '100%',
              padding: '12px',
              background: '#34C759',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            ◈ Generate Image
          </button>
        </div>
      </div>
    </div>
  );
}
