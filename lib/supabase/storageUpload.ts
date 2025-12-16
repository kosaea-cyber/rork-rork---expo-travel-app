import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase/client';

export type PickedImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

function guessExtFromAsset(asset: PickedImageAsset): string {
  const byMime = asset.mimeType?.toLowerCase();
  if (byMime) {
    if (byMime.includes('png')) return 'png';
    if (byMime.includes('webp')) return 'webp';
    if (byMime.includes('jpg') || byMime.includes('jpeg')) return 'jpg';
    if (byMime.includes('heic')) return 'heic';
  }

  const uri = asset.uri;
  const lastDot = uri.lastIndexOf('.');
  if (lastDot !== -1) {
    const ext = uri.slice(lastDot + 1).toLowerCase();
    if (ext && ext.length <= 5) return ext;
  }

  return 'jpg';
}

function guessContentType(ext: string, mimeType?: string | null): string {
  if (mimeType) return mimeType;
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'heic') return 'image/heic';
  return 'image/jpeg';
}

export async function pickImageAssetFromLibrary(): Promise<PickedImageAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.85,
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

export async function uploadImageToSupabaseStorage(params: {
  asset: PickedImageAsset;
  folder: string;
  bucket?: string;
}): Promise<{ publicUrl: string; path: string }>
{
  const bucket = params.bucket ?? 'app-media';
  const ext = guessExtFromAsset(params.asset);
  const contentType = guessContentType(ext, params.asset.mimeType);
  const id = Crypto.randomUUID();
  const ts = Date.now();

  const safeFolder = params.folder.replace(/^\/+|\/+$/g, '');
  const path = `${safeFolder}/${ts}-${id}.${ext}`;

  console.log('[storage] uploading image', {
    bucket,
    folder: safeFolder,
    path,
    contentType,
    uriPrefix: params.asset.uri.slice(0, 24),
  });

  const blobRes = await fetch(params.asset.uri);
  const blob = await blobRes.blob();

  const uploadRes = await supabase.storage.from(bucket).upload(path, blob, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadRes.error) {
    console.error('[storage] upload error', uploadRes.error);
    throw new Error(uploadRes.error.message);
  }

  const publicRes = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicRes.data.publicUrl;

  console.log('[storage] upload success', { path, publicUrl });

  return { publicUrl, path };
}

export async function pickAndUploadImage(params: {
  folder: string;
  bucket?: string;
}): Promise<{ publicUrl: string; path: string } | null>
{
  const asset = await pickImageAssetFromLibrary();
  if (!asset) return null;
  return uploadImageToSupabaseStorage({ asset, folder: params.folder, bucket: params.bucket });
}
