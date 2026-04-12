'use client';

import { useMemo } from 'react';
import { usePromptStore } from '@/store/usePromptStore';

interface PromptBuilderProps {
  onPromptGenerated?: (prompt: string) => void;
  onBack?: () => void;
  initialPrompt?: string;
  showSoraGeneration?: boolean;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  fontSize: '13px',
  boxSizing: 'border-box',
  color: '#111827',
  background: '#ffffff',
};

export default function PromptBuilder({
  onPromptGenerated,
  onBack,
}: PromptBuilderProps) {
  const {
    globalParams,
    scenes,
    setGlobalParams,
    updateScene,
    addScene,
    deleteScene,
    moveScene,
    generatePrompt,
  } = usePromptStore();

  const finalPrompt = useMemo(() => {
    const parts: string[] = [];
    if (globalParams.subject) parts.push(globalParams.subject);
    if (globalParams.action) parts.push(globalParams.action);
    if (globalParams.environment) parts.push(`in ${globalParams.environment}`);
    if (globalParams.camera) parts.push(`${globalParams.camera} shot`);
    if (globalParams.style) parts.push(globalParams.style);

    let prompt = parts.join(', ');
    const scenePrompts = scenes
      .map((scene) => scene.description.trim())
      .filter(Boolean);

    if (scenePrompts.length > 0) {
      prompt += `${prompt ? ' | ' : ''}${scenePrompts.join(' | ')}`;
    }

    if (globalParams.negativePrompt) {
      prompt += `${prompt ? ' | ' : ''}Negative: ${globalParams.negativePrompt}`;
    }

    return prompt.trim();
  }, [globalParams, scenes]);

  const handleCopyToGenerator = async () => {
    const prompt = generatePrompt();
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }

    onPromptGenerated?.(prompt);
  };

  const handleDownloadPrompt = () => {
    const prompt = generatePrompt();
    if (!prompt) return;

    const element = document.createElement('a');
    element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`);
    element.setAttribute('download', 'prompt.txt');
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const applyExample = (preset: Partial<typeof globalParams>) => {
    setGlobalParams(preset);
  };

  return (
    <div style={{ padding: '20px', color: '#111827' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '28px' }}>Prompt Builder</h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
          Build one clean prompt for image or video generation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Global Parameters</h2>

          {[
            ['subject', 'Subject', 'e.g., Cyberpunk rider'],
            ['action', 'Action', 'e.g., speeding through streets'],
            ['environment', 'Environment', 'e.g., neon-lit Tokyo'],
            ['style', 'Style', 'e.g., cinematic, 4K, high detail'],
          ].map(([key, label, placeholder]) => (
            <div key={key} style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700 }}>
                {label}
              </label>
              <input
                type="text"
                value={globalParams[key as keyof typeof globalParams] as string}
                placeholder={placeholder}
                onChange={(e) => setGlobalParams({ [key]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700 }}>
              Camera
            </label>
            <select
              value={globalParams.camera}
              onChange={(e) => setGlobalParams({ camera: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select camera angle...</option>
              <option value="wide">Wide shot</option>
              <option value="close-up">Close-up</option>
              <option value="aerial">Aerial</option>
              <option value="tracking">Tracking</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700 }}>
              Language
            </label>
            <select
              value={globalParams.language}
              onChange={(e) => setGlobalParams({ language: e.target.value })}
              style={inputStyle}
            >
              <option value="English">English</option>
              <option value="中文">中文</option>
              <option value="日本語">日本語</option>
              <option value="Français">Français</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 700 }}>
              Negative Prompt
            </label>
            <textarea
              rows={4}
              value={globalParams.negativePrompt}
              placeholder="e.g., blurry, low quality, distorted"
              onChange={(e) => setGlobalParams({ negativePrompt: e.target.value })}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ borderRight: '1px solid #e5e7eb', paddingRight: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Scenes</h2>
            <button
              onClick={addScene}
              style={{ border: 'none', borderRadius: '8px', padding: '8px 12px', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
            >
              + Add Scene
            </button>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            {scenes.map((scene, index) => (
              <div key={scene.id} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '13px' }}>{scene.name}</strong>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => moveScene(scene.id, 'up')} disabled={index === 0} style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', padding: '4px 8px', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                    <button onClick={() => moveScene(scene.id, 'down')} disabled={index === scenes.length - 1} style={{ border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', padding: '4px 8px', cursor: index === scenes.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                    <button onClick={() => deleteScene(scene.id)} style={{ border: 'none', borderRadius: '6px', background: '#ef4444', color: '#fff', padding: '4px 8px', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={scene.description}
                  placeholder={`Describe ${scene.name}...`}
                  onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Output</h2>
          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px', marginBottom: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Final Prompt</div>
            <div style={{ background: '#fff', color: '#111827', minHeight: '160px', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {finalPrompt || '(提示詞將在此顯示)'}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '10px', marginBottom: '18px' }}>
            <button onClick={handleCopyToGenerator} style={{ border: 'none', borderRadius: '10px', padding: '12px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Copy to Generator
            </button>
            <button onClick={handleDownloadPrompt} style={{ border: 'none', borderRadius: '10px', padding: '12px', background: '#475569', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Download .txt
            </button>
            {onBack && (
              <button onClick={onBack} style={{ border: 'none', borderRadius: '10px', padding: '12px', background: '#64748b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                Back
              </button>
            )}
          </div>

          <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '10px' }}>Quick Examples</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              <button onClick={() => applyExample({ subject: 'Astronaut', action: 'floating in space', environment: 'nebula', camera: 'wide', style: 'cinematic, 8K' })} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left' }}>
                Space Explorer
              </button>
              <button onClick={() => applyExample({ subject: 'Cyberpunk hacker', action: 'typing furiously', environment: 'dark neon-lit room', camera: 'close-up', style: 'film noir, 4K' })} style={{ ...inputStyle, cursor: 'pointer', textAlign: 'left' }}>
                Hacker
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
