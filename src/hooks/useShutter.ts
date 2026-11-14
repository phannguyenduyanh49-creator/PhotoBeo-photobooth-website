import { useEffect, useRef } from 'react';

export function useShutter() {
  const audioRef = useRef<AudioContext | null>(null);
  const prepare = () => {
    try { audioRef.current ??= new AudioContext(); void audioRef.current.resume().catch(() => {}); } catch { /* sound is optional */ }
  };
  const play = () => {
    const audio = audioRef.current;
    if (!audio || audio.state !== 'running') return;
    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .07), audio.sampleRate);
    const values = buffer.getChannelData(0);
    for (let i = 0; i < values.length; i++) values[i] = (Math.random() * 2 - 1) * Math.exp(-i / values.length * 8) * .22;
    const source = audio.createBufferSource(); source.buffer = buffer; source.connect(audio.destination); source.start();
    source.onended = () => source.disconnect();
  };
  useEffect(() => () => { void audioRef.current?.close().catch(() => {}); }, []);
  return { prepare, play };
}
