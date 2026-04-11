import { useState, useCallback } from 'react';

interface PromptBuilderProps {
  onPromptGenerated?: (prompt: string) => void;
  onBack?: () => void;
  initialPrompt?: string;
  showSoraGeneration?: boolean;
}

interface GlobalParams {
  subject: string;
  action: string;
  environment: string;
  camera: string;
  style: string;
  language: string;
  negativePrompt: string;
}

interface SceneOverride {
  subject?: string;
  action?: string;
  camera?: string;
}

interface Scene {
  id: string;
  name: string;
  description: string;
  overrides: SceneOverride;
}

/**
 * PromptBuilder 組件
 * 用於組合和編輯提示詞，支援全域參數和分鏡編輯
 */
export default function PromptBuilder({
  onPromptGenerated,
  onBack,
  initialPrompt = '',
  showSoraGeneration = false,
}: PromptBuilderProps) {
  // 全域參數
  const [globalParams, setGlobalParams] = useState<GlobalParams>({
    subject: '',
    action: '',
    environment: '',
    camera: '',
    style: '',
    language: 'English',
    negativePrompt: '',
  });

  // 分鏡編輯器
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', name: 'Scene 1', description: '', overrides: {} },
    { id: '2', name: 'Scene 2', description: '', overrides: {} },
    { id: '3', name: 'Scene 3', description: '', overrides: {} },
  ]);

  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  /**
   * 構建最終提示詞
   */
  const buildFinalPrompt = useCallback((): string => {
    const parts: string[] = [];

    // 基本提示詞
    if (globalParams.subject) parts.push(globalParams.subject);
    if (globalParams.action) parts.push(globalParams.action);
    if (globalParams.environment) parts.push(`in ${globalParams.environment}`);
    if (globalParams.camera) parts.push(`${globalParams.camera} shot`);
    if (globalParams.style) parts.push(globalParams.style);

    const basePrompt = parts.join(', ');

    // 分鏡提示詞（如果有非空場景）
    const scenePrompts = scenes
      .filter((scene) => scene.description.trim())
      .map((scene) => {
        let sceneText = scene.description;
        // 應用場景特定的覆蓋參數
        if (scene.overrides.subject) {
          sceneText = sceneText.replace(globalParams.subject, scene.overrides.subject);
        }
        return sceneText;
      });

    let finalPrompt = basePrompt;
    if (scenePrompts.length > 0) {
      finalPrompt += ` | ${scenePrompts.join(' | ')}`;
    }

    // 添加 Negative Prompt
    if (globalParams.negativePrompt) {
      finalPrompt += ` | Negative: ${globalParams.negativePrompt}`;
    }

    return finalPrompt.trim();
  }, [globalParams, scenes]);

  /**
   * 處理複製到生成器
   */
  const handleCopyToGenerator = () => {
    const finalPrompt = buildFinalPrompt();

    // 複製到剪貼板
    navigator.clipboard.writeText(finalPrompt).then(() => {
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    });

    // 觸發回調（導航回 Imagen）
    if (onPromptGenerated) {
      onPromptGenerated(finalPrompt);
    }
  };

  /**
   * 下載提示詞為 .txt 文件
   */
  const handleDownloadPrompt = () => {
    const finalPrompt = buildFinalPrompt();
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(finalPrompt)}`
    );
    element.setAttribute('download', 'prompt.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  /**
   * 新增場景
   */
  const handleAddScene = () => {
    const newId = String(Math.max(...scenes.map((s) => parseInt(s.id)), 0) + 1);
    setScenes([
      ...scenes,
      { id: newId, name: `Scene ${newId}`, description: '', overrides: {} },
    ]);
  };

  /**
   * 刪除場景
   */
  const handleDeleteScene = (id: string) => {
    setScenes(scenes.filter((scene) => scene.id !== id));
  };

  /**
   * 上下移動場景
   */
  const handleMoveScene = (id: string, direction: 'up' | 'down') => {
    const index = scenes.findIndex((scene) => scene.id === id);
    if (
      (direction === 'up' && index > 0) ||
      (direction === 'down' && index < scenes.length - 1)
    ) {
      const newScenes = [...scenes];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newScenes[index], newScenes[targetIndex]] = [
        newScenes[targetIndex],
        newScenes[index],
      ];
      setScenes(newScenes);
    }
  };

  /**
   * 更新場景內容
   */
  const handleUpdateScene = (id: string, field: string, value: string) => {
    setScenes(
      scenes.map((scene) =>
        scene.id === id ? { ...scene, [field]: value } : scene
      )
    );
  };

  const finalPrompt = buildFinalPrompt();

  return (
    <div style={{ padding: '20px' }}>
      {/* 標題 */}
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ margin: '0 0 5px 0', fontSize: '24px' }}>Prompt Builder</h1>
        <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
          組合和編輯提示詞，用於圖像和影片生成
        </p>
      </div>

      {/* 主容器：左中右三欄 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
        {/* 左側：全域參數 */}
        <div style={{ borderRight: '1px solid #e0e0e0', paddingRight: '20px' }}>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Global Parameters</h2>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Subject</label>
            <input
              type="text"
              placeholder="e.g., Cyberpunk rider"
              value={globalParams.subject}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, subject: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Action</label>
            <input
              type="text"
              placeholder="e.g., speeding through streets"
              value={globalParams.action}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, action: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Environment</label>
            <input
              type="text"
              placeholder="e.g., neon-lit Tokyo"
              value={globalParams.environment}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, environment: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Camera</label>
            <select
              value={globalParams.camera}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, camera: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            >
              <option value="">Select camera angle...</option>
              <option value="wide">Wide shot</option>
              <option value="close-up">Close-up</option>
              <option value="aerial">Aerial</option>
              <option value="tracking">Tracking</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Style</label>
            <input
              type="text"
              placeholder="e.g., cinematic, 4K, high detail"
              value={globalParams.style}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, style: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Language</label>
            <select
              value={globalParams.language}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, language: e.target.value })
              }
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box' }}
            >
              <option value="English">English</option>
              <option value="中文">中文</option>
              <option value="日本語">日本語</option>
              <option value="Français">Français</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600' }}>Negative Prompt</label>
            <textarea
              placeholder="e.g., blurry, low quality, distorted"
              value={globalParams.negativePrompt}
              onChange={(e) =>
                setGlobalParams({ ...globalParams, negativePrompt: e.target.value })
              }
              rows={3}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* 中間：分鏡編輯器 */}
        <div style={{ borderRight: '1px solid #e0e0e0', paddingRight: '20px' }}>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Scene Editor</h2>

          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              style={{
                background: '#f9f9f9',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '12px',
                border: '1px solid #e0e0e0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600' }}>{scene.name}</h3>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => handleMoveScene(scene.id, 'up')}
                    disabled={index === 0}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: index === 0 ? '#ddd' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '3px',
                      cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveScene(scene.id, 'down')}
                    disabled={index === scenes.length - 1}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: index === scenes.length - 1 ? '#ddd' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '3px',
                      cursor: index === scenes.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleDeleteScene(scene.id)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      background: '#ff6b6b',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <textarea
                placeholder={`Describe ${scene.name}...`}
                value={scene.description}
                onChange={(e) =>
                  handleUpdateScene(scene.id, 'description', e.target.value)
                }
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #e0e0e0',
                  fontSize: '11px',
                  boxSizing: 'border-box',
                  marginBottom: '8px',
                  resize: 'vertical',
                }}
              />
            </div>
          ))}

          <button
            onClick={handleAddScene}
            style={{
              width: '100%',
              padding: '10px',
              background: '#34C759',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
          >
            ⊕ Add Scene
          </button>
        </div>

        {/* 右側：輸出區 */}
        <div>
          <h2 style={{ marginTop: 0, fontSize: '16px' }}>Output</h2>

          <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '600' }}>Final Prompt</h3>
            <div style={{
              background: '#fff',
              padding: '10px',
              borderRadius: '4px',
              minHeight: '100px',
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '11px',
              fontFamily: 'monospace',
              border: '1px solid #e0e0e0',
              marginBottom: '12px',
              color: '#333',
            }}>
              <code>{finalPrompt || '(提示詞將在此顯示)'}</code>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleCopyToGenerator}
                style={{
                  padding: '10px',
                  background: '#007AFF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {copiedToClipboard ? '✓ Copied!' : '📋 Copy to Generator'}
              </button>
              <button
                onClick={handleDownloadPrompt}
                style={{
                  padding: '10px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ⬇ Download .txt
              </button>
              {onBack && (
                <button
                  onClick={onBack}
                  style={{
                    padding: '10px',
                    background: '#6c757d',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  ← Back to Image
                </button>
              )}
            </div>
          </div>

          {/* 快速示例 */}
          <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '600' }}>Quick Examples</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => {
                  setGlobalParams({
                    ...globalParams,
                    subject: 'Astronaut',
                    action: 'floating in space',
                    environment: 'nebula',
                    camera: 'wide',
                    style: 'cinematic, 8K',
                  });
                }}
                style={{
                  padding: '8px',
                  background: '#f0f0f0',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Space Explorer
              </button>
              <button
                onClick={() => {
                  setGlobalParams({
                    ...globalParams,
                    subject: 'Cyberpunk hacker',
                    action: 'typing furiously',
                    environment: 'dark neon-lit room',
                    camera: 'close-up',
                    style: 'film noir, 4K',
                  });
                }}
                style={{
                  padding: '8px',
                  background: '#f0f0f0',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                }}
              >
                Hacker
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
