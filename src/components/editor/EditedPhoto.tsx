import { useEffect, useState } from 'react';
import { renderPhoto } from '../../lib/renderPhoto';
import type { EditRecipe } from '../../lib/filters';

export function EditedPhoto({ src, edit, alt, width = 500 }: { src: string; edit: EditRecipe; alt: string; width?: number }) {
  const [rendered, setRendered] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    // Debounce expensive work while dragging sliders. The source is never mutated.
    const timer = setTimeout(() => {
      renderPhoto(src, edit, width).then(canvas => {
        if (active) { setRendered(canvas.toDataURL('image/png')); setError(false); }
      }).catch(() => { if (active) setError(true); });
    }, 35);
    return () => { active = false; clearTimeout(timer); };
  }, [src, edit, width]);
  return error ? <span className="image-error">Không đọc được ảnh</span> : <img src={rendered || src} alt={alt} draggable={false} />;
}
