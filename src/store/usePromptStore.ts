import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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

interface PromptMetadata {
  createdAt: number;
  sourceComponent: 'promptBuilder' | 'manual';
  tags?: string[];
}

interface PromptState {
  globalParams: GlobalParams;
  scenes: Scene[];
  setGlobalParams: (params: Partial<GlobalParams>) => void;
  setScenes: (scenes: Scene[]) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addScene: () => void;
  deleteScene: (id: string) => void;
  moveScene: (id: string, direction: 'up' | 'down') => void;
  currentPrompt: string;
  basePrompt: string;
  scenePrompts: string[];
  metadata: PromptMetadata;
  generatePrompt: () => string;
  setCurrentPrompt: (prompt: string) => void;
  clearPrompt: () => void;
  promptHistory: Array<{ prompt: string; timestamp: number; metadata: PromptMetadata }>;
  addToHistory: (prompt: string) => void;
  clearHistory: () => void;
  restoreFromHistory: (index: number) => void;
  generationType: 'image' | 'video';
  setGenerationType: (type: 'image' | 'video') => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  generationResult: { imageUrl?: string; videoUrl?: string; timestamp?: number } | null;
  setGenerationResult: (result: any) => void;
}

const INITIAL_GLOBAL_PARAMS: GlobalParams = {
  subject: '',
  action: '',
  environment: '',
  camera: '',
  style: '',
  language: 'English',
  negativePrompt: '',
};

const INITIAL_SCENES: Scene[] = [
  { id: '1', name: 'Scene 1', description: '', overrides: {} },
  { id: '2', name: 'Scene 2', description: '', overrides: {} },
  { id: '3', name: 'Scene 3', description: '', overrides: {} },
];

export const usePromptStore = create<PromptState>()(
  devtools(
    persist(
      (set, get) => ({
        globalParams: INITIAL_GLOBAL_PARAMS,
        scenes: INITIAL_SCENES,
        currentPrompt: '',
        basePrompt: '',
        scenePrompts: [],
        metadata: { createdAt: Date.now(), sourceComponent: 'promptBuilder' },
        promptHistory: [],
        generationType: 'image',
        isGenerating: false,
        generationResult: null,

        setGlobalParams: (params) =>
          set((state) => ({ globalParams: { ...state.globalParams, ...params } }), false, 'setGlobalParams'),

        setScenes: (scenes) => set({ scenes }, false, 'setScenes'),

        updateScene: (id, updates) =>
          set(
            (state) => ({
              scenes: state.scenes.map((scene) =>
                scene.id === id ? { ...scene, ...updates } : scene
              ),
            }),
            false,
            'updateScene'
          ),

        addScene: () =>
          set(
            (state) => {
              const newId = String(Math.max(...state.scenes.map((s) => parseInt(s.id)), 0) + 1);
              return {
                scenes: [
                  ...state.scenes,
                  { id: newId, name: `Scene ${newId}`, description: '', overrides: {} },
                ],
              };
            },
            false,
            'addScene'
          ),

        deleteScene: (id) =>
          set(
            (state) => ({ scenes: state.scenes.filter((scene) => scene.id !== id) }),
            false,
            'deleteScene'
          ),

        moveScene: (id, direction) =>
          set(
            (state) => {
              const index = state.scenes.findIndex((scene) => scene.id === id);
              if (
                (direction === 'up' && index > 0) ||
                (direction === 'down' && index < state.scenes.length - 1)
              ) {
                const newScenes = [...state.scenes];
                const targetIndex = direction === 'up' ? index - 1 : index + 1;
                [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]];
                return { scenes: newScenes };
              }
              return state;
            },
            false,
            'moveScene'
          ),

        generatePrompt: () => {
          const state = get();
          const { globalParams, scenes } = state;

          const parts: string[] = [];
          if (globalParams.subject) parts.push(globalParams.subject);
          if (globalParams.action) parts.push(globalParams.action);
          if (globalParams.environment) parts.push(`in ${globalParams.environment}`);
          if (globalParams.camera) parts.push(`${globalParams.camera} shot`);
          if (globalParams.style) parts.push(globalParams.style);

          const basePrompt = parts.join(', ');

          const scenePrompts = scenes
            .filter((scene) => scene.description.trim())
            .map((scene) => {
              let sceneText = scene.description;
              if (scene.overrides.subject && globalParams.subject) {
                sceneText = sceneText.replace(globalParams.subject, scene.overrides.subject);
              }
              return sceneText;
            });

          let finalPrompt = basePrompt;
          if (scenePrompts.length > 0) {
            finalPrompt += ` | ${scenePrompts.join(' | ')}`;
          }

          if (globalParams.negativePrompt) {
            finalPrompt += ` | Negative: ${globalParams.negativePrompt}`;
          }

          const prompt = finalPrompt.trim();

          set(
            {
              currentPrompt: prompt,
              basePrompt,
              scenePrompts,
              metadata: { createdAt: Date.now(), sourceComponent: 'promptBuilder' },
            },
            false,
            'generatePrompt'
          );

          return prompt;
        },

        setCurrentPrompt: (prompt) =>
          set(
            { currentPrompt: prompt, metadata: { createdAt: Date.now(), sourceComponent: 'manual' } },
            false,
            'setCurrentPrompt'
          ),

        clearPrompt: () =>
          set({ currentPrompt: '', basePrompt: '', scenePrompts: [] }, false, 'clearPrompt'),

        addToHistory: (prompt) =>
          set(
            (state) => ({
              promptHistory: [
                { prompt, timestamp: Date.now(), metadata: state.metadata },
                ...state.promptHistory,
              ].slice(0, 50),
            }),
            false,
            'addToHistory'
          ),

        clearHistory: () => set({ promptHistory: [] }, false, 'clearHistory'),

        restoreFromHistory: (index) =>
          set(
            (state) => {
              const historyItem = state.promptHistory[index];
              if (historyItem) {
                return { currentPrompt: historyItem.prompt, metadata: historyItem.metadata };
              }
              return state;
            },
            false,
            'restoreFromHistory'
          ),

        setGenerationType: (type) => set({ generationType: type }, false, 'setGenerationType'),

        setIsGenerating: (generating) => set({ isGenerating: generating }, false, 'setIsGenerating'),

        setGenerationResult: (result) => set({ generationResult: result }, false, 'setGenerationResult'),
      }),
      {
        name: 'prompt-builder-store',
        partialize: (state) => ({
          globalParams: state.globalParams,
          scenes: state.scenes,
          currentPrompt: state.currentPrompt,
          promptHistory: state.promptHistory,
        }),
      }
    )
  )
);

export const useCurrentPrompt = () => {
  const currentPrompt = usePromptStore((state) => state.currentPrompt);
  return currentPrompt;
};

export const usePromptBuilder = () => {
  const globalParams = usePromptStore((state) => state.globalParams);
  const scenes = usePromptStore((state) => state.scenes);
  const setGlobalParams = usePromptStore((state) => state.setGlobalParams);
  const setScenes = usePromptStore((state) => state.setScenes);
  const updateScene = usePromptStore((state) => state.updateScene);
  const addScene = usePromptStore((state) => state.addScene);
  const deleteScene = usePromptStore((state) => state.deleteScene);
  const moveScene = usePromptStore((state) => state.moveScene);
  const generatePrompt = usePromptStore((state) => state.generatePrompt);

  return {
    globalParams,
    scenes,
    setGlobalParams,
    setScenes,
    updateScene,
    addScene,
    deleteScene,
    moveScene,
    generatePrompt,
  };
};

export const useCreatorGeneration = () => {
  const generationType = usePromptStore((state) => state.generationType);
  const isGenerating = usePromptStore((state) => state.isGenerating);
  const generationResult = usePromptStore((state) => state.generationResult);
  const setGenerationType = usePromptStore((state) => state.setGenerationType);
  const setIsGenerating = usePromptStore((state) => state.setIsGenerating);
  const setGenerationResult = usePromptStore((state) => state.setGenerationResult);

  return {
    generationType,
    isGenerating,
    generationResult,
    setGenerationType,
    setIsGenerating,
    setGenerationResult,
  };
};

export const usePromptHistory = () => {
  const promptHistory = usePromptStore((state) => state.promptHistory);
  const addToHistory = usePromptStore((state) => state.addToHistory);
  const clearHistory = usePromptStore((state) => state.clearHistory);
  const restoreFromHistory = usePromptStore((state) => state.restoreFromHistory);

  return {
    promptHistory,
    addToHistory,
    clearHistory,
    restoreFromHistory,
  };
};
