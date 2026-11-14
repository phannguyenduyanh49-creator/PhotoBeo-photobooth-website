import { useEffect, useRef, type RefObject } from 'react';
import { applyFilter, defaultEdit, type EditRecipe } from '../../lib/filters';
import { coverRect } from '../../lib/layouts';

export function CameraPreview({ videoRef, edit, mirror, before }: { videoRef: RefObject<HTMLVideoElement | null>; edit: EditRecipe; mirror: boolean; before: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recipe = useRef({ edit, mirror, before }); recipe.current = { edit, mirror, before };
  useEffect(() => {
    let frame = 0, last = 0;
    const canvas = canvasRef.current!; canvas.width = 480; canvas.height = 360;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const draw = (time: number) => {
      const video = videoRef.current;
      if (video && video.readyState >= 2 && time - last > 90 && !document.hidden) {
        last = time;
        const crop = coverRect(video.videoWidth, video.videoHeight, 480, 360);
        ctx.save(); if (recipe.current.mirror) { ctx.translate(480, 0); ctx.scale(-1, 1); }
        ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, 480, 360); ctx.restore();
        applyFilter(ctx, recipe.current.before ? defaultEdit : recipe.current.edit);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [videoRef]);
  return <canvas ref={canvasRef} className="camera-processed" aria-label="Camera với màu đã chỉnh" />;
}
