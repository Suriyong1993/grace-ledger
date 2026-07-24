import { supabase } from '@/services/supabaseClient';

const BUCKET_NAME = 'attachments';

export interface UploadResult {
  url: string;
  path: string;
}

export async function uploadAttachment(
  file: File,
  churchId: string,
  transactionId?: string,
): Promise<UploadResult> {
  // Validate file type and size
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'text/plain',
  ];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('ไฟล์ชนิดนี้ไม่ได้รับอนุญาตให้อัปโหลด');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ขนาดไฟล์ต้องไม่เกิน 5 MB');
  }

  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = transactionId
    ? `${churchId}/${transactionId}/${filename}`
    : `${churchId}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`อัปโหลดล้มเหลว: ${error.message}`);
  }

  // Get public URL
  const { data } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return {
    url: data.publicUrl,
    path,
  };
}

export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`ลบไฟล์ล้มเหลว: ${error.message}`);
  }
}
