import { getGeometry, type Layout } from '../lib/layouts';

export function LayoutThumbnail({ layout, color = '#ffe4ee' }: { layout: Layout; color?: string }) {
  const g = getGeometry(layout);
  return <svg className="layout-thumbnail" viewBox={`0 0 ${g.width} ${g.height}`} aria-hidden="true">
    <rect width={g.width} height={g.height} rx="24" fill={color} />
    {g.cells.map((cell, i) => <rect key={i} {...cell} rx="12" fill="#cfa3b3" opacity=".66" />)}
    <path d={`M ${g.width * .32} ${g.height - g.footer / 2} h ${g.width * .36}`} stroke="#b78094" strokeWidth="20" strokeLinecap="round" />
  </svg>;
}
