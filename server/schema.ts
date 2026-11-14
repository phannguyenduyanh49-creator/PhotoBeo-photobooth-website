import { z } from 'zod';
import { filters } from '../src/lib/filters';
import { layouts, frames } from '../src/lib/layouts';
import { stickers } from '../src/lib/wall';

const adjustment = z.number().finite().min(-100).max(100);
const percent = z.number().finite().min(0).max(100);
export const editSchema = z.object({
  filterId: z.string().refine(id => filters.some(f => f.id === id)), intensity: percent,
  brightness: adjustment, contrast: adjustment, saturation: adjustment, warmth: adjustment,
  tint: adjustment, highlights: adjustment, shadows: adjustment, grain: percent, vignette: percent,
}).strict();
export const registrationSchema = z.object({
  consent: z.literal(true), requestId: z.uuid(),
  layoutId: z.string().refine(id => layouts.some(l => l.id === id)),
  options: z.object({
    frame: z.string().refine(id => frames.some(f => f.id === id)),
    color: z.string().regex(/^#[a-fA-F0-9]{6}$/), caption: z.string().max(50), showDate: z.boolean(),
  }).strict(),
  photos: z.array(z.object({ originalSrc: z.string().max(5_600_000), edit: editSchema }).strict()).min(1).max(6),
}).strict().refine(value => layouts.find(l => l.id === value.layoutId)?.count === value.photos.length, { message: 'Số ảnh không khớp bố cục.' });

export const wallItemSchema = z.object({
  id: z.uuid(), type: z.enum(['photo', 'sticker', 'note', 'tape']),
  x: z.number().finite().min(0).max(1200), y: z.number().finite().min(0).max(900),
  width: z.number().finite().min(40).max(1100), height: z.number().finite().min(30).max(820),
  rotation: z.number().finite().min(-180).max(180), photoId: z.uuid().optional(),
  stickerId: z.string().refine(id => stickers.some(s => s.id === id)).optional(),
  text: z.string().max(200).optional(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/).optional(),
}).strict().superRefine((item, ctx) => {
  if (item.x + item.width > 1200.01 || item.y + item.height > 900.01) ctx.addIssue({ code: 'custom', message: 'Đối tượng ngoài trang giấy.' });
  if (item.type === 'photo' && !item.photoId) ctx.addIssue({ code: 'custom', message: 'Thiếu ảnh đã đăng ký.' });
  if (item.type !== 'photo' && item.photoId) ctx.addIssue({ code: 'custom', message: 'Loại đối tượng không hợp lệ.' });
  if (item.type === 'sticker' && !item.stickerId) ctx.addIssue({ code: 'custom', message: 'Sticker không hợp lệ.' });
});
export const wallSchema = z.object({
  items: z.array(wallItemSchema).max(60), background: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  revision: z.number().int().min(0),
}).strict().refine(w => new Set(w.items.map(i => i.id)).size === w.items.length, { message: 'ID đối tượng bị trùng.' });
