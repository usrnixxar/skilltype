import { getSupabaseClient } from './supabaseClient';
export const ADMIN_PLAYER_ID = '5c99b1c8-e130-4c27-a750-88e35362c581';
export interface ManagedPlayer { id: string; name: string; kind: string; points: number; online?: boolean; email?: string|null; created_at: string; }
export type ProductSection = 'showcase' | 'achievement';
export interface GiftSlide { section: ProductSection; id: string; title: string; image_path: string; enabled: boolean; sort_order: number; created_at: string; }
export async function adminRequest(sessionToken: string, action: string, payload: Record<string, unknown> = {}) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Admin service is not configured.');
  const { data, error } = await client.functions.invoke('admin-manager', { body: { ...payload, action, sessionToken } });
  if (error || !data?.success) {
    let message = data?.error;
    if (error?.context instanceof Response) message = (await error.context.json().catch(() => ({}))).error || message;
    throw new Error(message || 'Unable to connect. Please retry.');
  }
  return data;
}
export function giftImageUrl(path: string) {
  return getSupabaseClient()?.storage.from('gift-images').getPublicUrl(path).data.publicUrl || '';
}
export async function fetchGiftSlides(section: ProductSection = 'showcase'): Promise<GiftSlide[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from('gift_slides').select('id,title,image_path,enabled,sort_order,created_at,section')
    .eq('enabled', true).eq('section', section).order('sort_order').order('created_at');
  if (error) throw new Error('Gifts unavailable');
  return data || [];
}
// Convert new gift uploads to WebP before sending to the admin service.
// This reduces file size; it does not make publicly displayed images private.
export async function imageAsBase64(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024 || file.size === 0) {
    throw new Error('Choose a JPG, PNG or WebP image under 2 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not convert image.')), 'image/webp', 0.84);
    });
    if (blob.type !== 'image/webp' || blob.size > 2 * 1024 * 1024 || blob.size === 0) {
      throw new Error('Converted WebP exceeds 2 MB or is unsupported.');
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(new Error('Could not read converted image.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    bitmap.close();
  }
}
