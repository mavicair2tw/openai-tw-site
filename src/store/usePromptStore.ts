'use client';

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

interface Scene {
  id: string;
  name: string;
  description: string;
  overrides: { subject?: string; action?: string; camera?: string };
}

interface PromptState {
  globalParams: GlobalParams;
  scenes: Scene[];
  currentPrompt: string;
  setGlobalParams: (params: Partial<GlobalParams>) => void;
  setScenes: (scenes: Scene[]) => void;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  addScene: () => void;
  deleteScene: (id: string) => void;
  moveScene: (id: string, direction: 'up' | 'down') => void;
  generatePrompt: () => string;
  setCurrentPrompt: (prompt: string) => void;
  promptHistory: Array<{ prompt: string; timestamp: number }>;
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

export const usePromptStore = create<PromptState>()(
  devtools(
    persist(
      (set, get) => ({
        globalParams: { subject: '', action: '', environment: '', camera: '', style: '', language: 'English', negativePrompt: '' },
        scenes: [
          { id: '1', name: 'Scene 1', description: '', overrides: {} },
          { id: '2', name: 'Scene 2', description: '', overrides: {} },
          { id: '3', name: 'Scene 3', description: '', overrides: {} },
        ],
        currentPrompt: '',
        promptHistory: [],
        generationType: 'image',
        isGenerating: false,
        generationResult: null,

        setGlobalParams: (params) => set((state) => ({ globalParams: { ...state.globalParams, ...params } })),
        setScenes: (scenes) => set({ scenes }),
        updateScene: (id, updates) => set((state) => ({ scenes: state.scenes.map((s) => s.id === id ? { ...s, ...updates } : s) })),
        addScene: () => set((state) => {
          const newId = String(Math.max(...state.scenes.map((s) => parseInt(s.id)), 0) + 1);
          return { scenes: [...state.scenes, { id: newId, name: `Scene ${newId}`, description: '', overrides: {} }] };
        }),
        deleteScene: (id) => set((state) => ({ scenes: state.scenes.filter((s) => s.id !== id) })),
        moveScene: (id, direction) => set((state) => {
          const index = state.scenes.findIndex((s) => s.id === id);
          if ((direction === 'up' && index > 0) || (direction === 'down' && index < state.scenes.length - 1)) {
            const newScenes = [...state.scenes];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            [newScenes[index], newScenes[targetIndex]] = [newScenes[targetIndex], newScenes[index]];
            return { scenes: newScenes };
          }
          return state;
        }),
        generatePrompt: () => {
          const state = get();
          const parts: string[] = [];
          if (state.globalParams.subject) parts.push(state.globalParams.subject);
          if (state.globalParams.action) parts.push(state.globalParams.action);
          if (state.globalParams.environment) parts.push(`in ${state.globalParams.environment}`);
          if (state.globalParams.camera) parts.push(`${state.globalParams.camera} shot`);
          if (state.globalParams.style) parts.push(state.globalParams.style);
          let prompt = parts.join(', ');
          const scenePrompts = state.scenes.filter((s) => s.description).map((s) => s.description);
          if (scenePrompts.length) prompt += ` | ${scenePrompts.join(' | ')}`;
          if (state.globalParams.negativePrompt) prompt += ` | Negative: ${state.globalParams.negativePrompt}`;
          set({ currentPrompt: prompt.trim() });
          return prompt.trim();
        },
        setCurrentPrompt: (prompt) => set({ currentPrompt: prompt }),
        addToHistory: (prompt) => set((state) => ({ promptHistory: [{ prompt, timestamp: Date.now() }, ...state.promptHistory].slice(0, 50) })),
        clearHistory: () => set({ promptHistory: [] }),
        restoreFromHistory: (index) => set((state) => ({ currentPrompt: state.promptHistory[index]?.prompt || '' })),
        setGenerationType: (type) => set({ generationType: type }),
        setIsGenerating: (generating) => set({ isGenerating: generating }),
        setGenerationResult: (result) => set({ generationResult: result }),
      }),
      { name: 'prompt-builder-store' }
    )
  )
);

export const usePromptHistory = () => {
  const promptHistory = usePromptStore((state) => state.promptHistory);
  const addToHistory = usePromptStore((state) => state.addToHistory);
  const clearHistory = usePromptStore((state) => state.clearHistory);
  const restoreFromHistory = usePromptStore((state) => state.restoreFromHistory);
  return { promptHistory, addToHistory, clearHistory, restoreFromHistory };
};

export const useCreatorGeneration = () => {
  const generationType = usePromptStore((state) => state.generationType);
  const isGenerating = usePromptStore((state) => state.isGenerating);
  const generationResult = usePromptStore((state) => state.generationResult);
  const setGenerationType = usePromptStore((state) => state.setGenerationType);
  const setIsGenerating = usePromptStore((state) => state.setIsGenerating);
  const setGenerationResult = usePromptStore((state) => state.setGenerationResult);
  return { generationType, isGenerating, generationResult, setGenerationType, setIsGenerating, setGenerationResult };
};
