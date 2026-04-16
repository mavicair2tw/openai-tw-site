'use client';

import { useState } from \'react\';

export default function VideoPromptBuilder() {
  const [resolution, setResolution] = useState(\'1080p\');
  const [duration, setDuration] = useState(\'10\');
  const [ratio, setRatio] = useState(\'16:9\');
  const [rhythm, setRhythm] = useState(\'\');
  const [shots, setShots] = useState(\'\');
  const [narration, setNarration] = useState(\'\');
  const [visualStyle, setVisualStyle] = useState(\'\');
  const [cameraMovement, setCameraMovement] = useState(\'\');
  const [generatedPrompt, setGeneratedPrompt] = useState(\'\');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);

  const handleGeneratePrompt = () => {
    const prompt = `Generate a ${duration}-second video in ${resolution} with ${ratio} ratio. Rhythm segmentation: ${rhythm}. Shot design: ${shots}. Narration/Subtitles: ${narration}. Visual style: ${visualStyle}. Camera movement: ${cameraMovement}.`;
    setGeneratedPrompt(prompt);
  };

  const handleGenerateVideo = async () => {
    if (!generatedPrompt) return;
    setIsGeneratingVideo(true);
    try {
      const response = await fetch(\'/api/video-create\', {
        method: \'POST\',
        headers: { \'Content-Type\': \'application/json\' },
        body: JSON.stringify({ prompt: generatedPrompt, aspectRatio: ratio }),
      });
      const data = await response.json();
      if (data.videoUrl) {
        // Handle success, perhaps redirect or update gallery
        alert(\'Video generated successfully!\');
      } else {
        alert(\'Video generation failed.\');
      }
    } catch (error) {
      alert(\'Error generating video.\');
    }
    setIsGeneratingVideo(false);
  };

  return (
    <div style={{ padding: \'20px\', background: \'#fff\' }}>
      <h2>Video Prompt Builder</h2>
      <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
        <option>480p</option>
        <option>720p</option>
        <option>1080p</option>
        <option>4K</option>
      </select>
      <select value={duration} onChange={(e) => setDuration(e.target.value)}>
        <option>5</option>
        <option>10</option>
        <option>15</option>
        <option>20</option>
      </select>
      <select value={ratio} onChange={(e) => setRatio(e.target.value)}>
        <option>2:3</option>
        <option>3:2</option>
        <option>1:1</option>
        <option>9:16</option>
        <option>16:9</option>
      </select>
      <textarea placeholder="Rhythm segmentation" value={rhythm} onChange={(e) => setRhythm(e.target.value)} />
      <textarea placeholder="Shot design" value={shots} onChange={(e) => setShots(e.target.value)} />
      <textarea placeholder="Narration/Subtitles" value={narration} onChange={(e) => setNarration(e.target.value)} />
      <textarea placeholder="Visual style" value={visualStyle} onChange={(e) => setVisualStyle(e.target.value)} />
      <textarea placeholder="Camera movement" value={cameraMovement} onChange={(e) => setCameraMovement(e.target.value)} />
      <button onClick={handleGeneratePrompt} disabled={isGenerating}>Generate Prompt</button>
      <textarea readOnly value={generatedPrompt} />
      <button onClick={handleGenerateVideo} disabled={isGeneratingVideo || !generatedPrompt}>Generate Video</button>
    </div>
  );
}
