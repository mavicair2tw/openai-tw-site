'use client';

import { useMemo } from 'react';
import { usePromptStore } from '@/store/usePromptStore';

interface PromptBuilderProps {
  onPromptGenerated?: (prompt: string) => void;
  onBack?: () => void;
}

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '14px',
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(15,23,42,0.78)',
  color: '#e2e8f0',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const cardStyle: React.CSSProperties = {
  background: 'rgba(15,23,42,0.72)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: '24px',
  padding: '20px',
  boxShadow: '0 20px 60px rgba(2,6,23,0.28)',
};

export default function PromptBuilder({ onPromptGenerated, onBack }: PromptBuilderProps) {
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
    const scenePrompts = scenes.map((scene) => scene.description.trim()).filter(Boolean);

    if (scenePrompts.length > 0) {
      prompt += `${prompt ? ' | ' : ''}${scenePrompts.join(' | ')}`;
    }

    if (globalParams.negativePrompt) {
      prompt += `${prompt ? ' | ' : ''}Negative: ${globalParams.negativePrompt}`;
    }

    return prompt.trim();
  }, [globalParams, scenes]);

  const handleSendToGenerator = async () => {
    const prompt = generatePrompt();
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }

    onPromptGenerated?.(prompt);
  };

  const applyPreset = (preset: Partial<typeof globalParams>) => {
    setGlobalParams(preset);
  };

  const stats = {
    scenes: scenes.filter((scene) => scene.description.trim()).length,
    chars: finalPrompt.length,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '24px' }}>
      <div style={{ display: 'grid', gap: '24px' }}>
        <section style={cardStyle}>
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#93c5fd', marginBottom: '8px' }}>
              Creative Brief
            </div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Build the core idea</h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#94a3b8' }}>
              Start with the concept, mood, and visual language. Then shape scenes on the right.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              ['subject', 'Subject', 'Astronaut in reflective suit'],
              ['action', 'Action', 'walking through a flooded station'],
              ['environment', 'Environment', 'brutalist sci-fi terminal at dawn'],
              ['style', 'Style', 'cinematic, realistic, moody volumetric light'],
            ].map(([key, label, placeholder]) => (
              <div key={key}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 700 }}>
                  {label}
                </label>
                <input
                  value={globalParams[key as keyof typeof globalParams] as string}
                  placeholder={placeholder}
                  onChange={(e) => setGlobalParams({ [key]: e.target.value })}
                  style={fieldStyle}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '14px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 700 }}>
                Camera
              </label>
              <select value={globalParams.camera} onChange={(e) => setGlobalParams({ camera: e.target.value })} style={fieldStyle}>
                <option value="">Select camera angle</option>
                <option value="wide">Wide shot</option>
                <option value="close-up">Close-up</option>
                <option value="aerial">Aerial</option>
                <option value="tracking">Tracking</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 700 }}>
                Language
              </label>
              <select value={globalParams.language} onChange={(e) => setGlobalParams({ language: e.target.value })} style={fieldStyle}>
                <option value="English">English</option>
                <option value="中文">中文</option>
                <option value="日本語">日本語</option>
                <option value="Français">Français</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 700 }}>
              Negative Prompt
            </label>
            <textarea
              rows={4}
              value={globalParams.negativePrompt}
              placeholder="blurry, low quality, bad anatomy, artifacts"
              onChange={(e) => setGlobalParams({ negativePrompt: e.target.value })}
              style={{ ...fieldStyle, resize: 'vertical' }}
            />
          </div>
        </section>

        <section style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#c4b5fd', marginBottom: '8px' }}>
                Scene Flow
              </div>
              <h2 style={{ margin: 0, fontSize: '24px', color: '#f8fafc' }}>Shape the sequence</h2>
            </div>
            <button
              onClick={addScene}
              style={{ border: 'none', borderRadius: '999px', padding: '10px 14px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              + Add Scene
            </button>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            {scenes.map((scene, index) => (
              <div key={scene.id} style={{ borderRadius: '18px', padding: '16px', background: 'rgba(2,6,23,0.42)', border: '1px solid rgba(148,163,184,0.12)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.14em' }}>Scene {index + 1}</div>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{scene.name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => moveScene(scene.id, 'up')} disabled={index === 0} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: '10px', background: 'rgba(15,23,42,0.9)', color: '#fff', padding: '6px 10px', cursor: index === 0 ? 'not-allowed' : 'pointer' }}>↑</button>
                    <button onClick={() => moveScene(scene.id, 'down')} disabled={index === scenes.length - 1} style={{ border: '1px solid rgba(148,163,184,0.18)', borderRadius: '10px', background: 'rgba(15,23,42,0.9)', color: '#fff', padding: '6px 10px', cursor: index === scenes.length - 1 ? 'not-allowed' : 'pointer' }}>↓</button>
                    <button onClick={() => deleteScene(scene.id)} style={{ border: 'none', borderRadius: '10px', background: '#ef4444', color: '#fff', padding: '6px 10px', cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={scene.description}
                  placeholder="Describe the beat, motion, camera energy, and emotional tone."
                  onChange={(e) => updateScene(scene.id, { description: e.target.value })}
                  style={{ ...fieldStyle, resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gap: '24px', alignContent: 'start' }}>
        <section style={cardStyle}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#67e8f9', marginBottom: '8px' }}>
            Prompt Output
          </div>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#f8fafc' }}>Ready for generation</h2>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#94a3b8' }}>
            This is the final prompt assembled from your brief and scene flow.
          </p>

          <div style={{ borderRadius: '18px', border: '1px solid rgba(148,163,184,0.12)', background: '#020617', padding: '16px', minHeight: '260px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {finalPrompt || 'Your final prompt will appear here.'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
            <button onClick={handleSendToGenerator} style={{ border: 'none', borderRadius: '14px', padding: '12px', background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Send to Generator
            </button>
            <button
              onClick={() => {
                const prompt = generatePrompt();
                if (!prompt) return;
                const element = document.createElement('a');
                element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(prompt)}`);
                element.setAttribute('download', 'prompt.txt');
                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
              }}
              style={{ border: 'none', borderRadius: '14px', padding: '12px', background: '#334155', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Download Prompt
            </button>
          </div>

          {onBack && (
            <button onClick={onBack} style={{ marginTop: '10px', width: '100%', border: 'none', borderRadius: '14px', padding: '12px', background: '#475569', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Back
            </button>
          )}
        </section>

        <section style={cardStyle}>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.16em', color: '#f9a8d4', marginBottom: '8px' }}>
            Studio Presets
          </div>
          <h2 style={{ margin: '0 0 14px 0', fontSize: '24px', color: '#f8fafc' }}>Jumpstart ideas</h2>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button onClick={() => applyPreset({ subject: 'Astronaut', action: 'floating through an abandoned orbital garden', environment: 'sunrise above Earth', camera: 'wide', style: 'cinematic, atmospheric, premium sci-fi' })} style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer' }}>
              Orbital Garden
            </button>
            <button onClick={() => applyPreset({ subject: 'Luxury concept vehicle', action: 'gliding through rain-soaked streets', environment: 'futuristic Taipei at night', camera: 'tracking', style: 'sleek, glossy, cinematic ad film' })} style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer' }}>
              Neo City Drive
            </button>
            <button onClick={() => applyPreset({ subject: 'Fashion model', action: 'turning slowly under moving light', environment: 'minimal black stage', camera: 'close-up', style: 'high-end editorial, sculptural lighting' })} style={{ ...fieldStyle, textAlign: 'left', cursor: 'pointer' }}>
              Editorial Portrait
            </button>
          </div>
        </section>

        <section style={{ ...cardStyle, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Active scenes</div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: '#f8fafc' }}>{stats.scenes}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Prompt length</div>
            <div style={{ fontSize: '30px', fontWeight: 800, color: '#f8fafc' }}>{stats.chars}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
