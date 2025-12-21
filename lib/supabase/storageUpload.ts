import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase/client';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const DEFAULT_COMPRESS = 0.82;

export type PickedImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type UploadImageResult = {
  publicUrl: string;
  path: string;
  bucket: string;
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

function mimeToExt(mimeType: string | null | undefined): 'jpg' | 'png' | 'webp' | 'heic' | null {
  const m = mimeType?.toLowerCase();
  if (!m) return null;
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('jpg') || m.includes('jpeg')) return 'jpg';
  if (m.includes('heic')) return 'heic';
  return null;
}

async function getUriBlob(uri: string): Promise<Blob> {
  const blobRes = await fetch(uri);
  const blob = await blobRes.blob();
  return blob;
}

async function maybeCompressImage(params: {
  asset: PickedImageAsset;
}): Promise<{ uri: string; contentType: string; ext: string; blob: Blob }>
{
  const ext = mimeToExt(params.asset.mimeType) ?? guessExtFromAsset(params.asset);

  let format: ImageManipulator.SaveFormat = ImageManipulator.SaveFormat.JPEG;
  if (ext === 'png') format = ImageManipulator.SaveFormat.PNG;
  if (ext === 'webp') format = ImageManipulator.SaveFormat.WEBP;

  const origBlob = await getUriBlob(params.asset.uri);
  console.log('[storage] picked image size', { bytes: origBlob.size, maxBytes: MAX_IMAGE_BYTES });

  if (origBlob.size > MAX_IMAGE_BYTES) {
    console.log('[storage] image too large, attempting compression');
  }

  try {
    const result = await ImageManipulator.manipulateAsync(
      params.asset.uri,
      [{ resize: { width: MAX_DIMENSION } }],
      {
        compress: DEFAULT_COMPRESS,
        format,
      },
    );

    const nextBlob = await getUriBlob(result.uri);

    console.log('[storage] manipulated image size', {
      bytes: nextBlob.size,
      uriPrefix: result.uri.slice(0, 24),
    });

    const finalExt = format === ImageManipulator.SaveFormat.PNG ? 'png' : format === ImageManipulator.SaveFormat.WEBP ? 'webp' : 'jpg';
    const contentType = guessContentType(finalExt, null);

    if (nextBlob.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (${Math.round(nextBlob.size / 1024 / 1024)}MB). Max is 5MB.`);
    }

    return { uri: result.uri, contentType, ext: finalExt, blob: nextBlob };
  } catch (e) {
    console.error('[storage] manipulate failed, using original', e);

    if (origBlob.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image is too large (${Math.round(origBlob.size / 1024 / 1024)}MB). Max is 5MB.`);
    }

    const contentType = guessContentType(ext, params.asset.mimeType);
    return { uri: params.asset.uri, contentType, ext, blob: origBlob };
  }
}

export function getStoragePathFromPublicUrl(params: { publicUrl: string; bucket: string }): string | null {
  try {
    const u = new URL(params.publicUrl);
    const pieces = u.pathname.split('/').filter(Boolean);
    const idx = pieces.findIndex((p) => p === 'object');
    if (idx === -1) return null;

    const mode = pieces[idx + 1];
    const bucket = pieces[idx + 2];
    if (mode !== 'public') return null;
    if (bucket !== params.bucket) return null;

    const path = pieces.slice(idx + 3).join('/');
    return path || null;
  } catch {
    return null;
  }
}

export async function deleteStorageObject(params: { bucket?: string; path: string }): Promise<void> {
  const bucket = params.bucket ?? 'app-media';
  const path = params.path.replace(/^\/+|\/+$/g, '');

  console.log('[storage] deleting object', { bucket, path });
  const res = await supabase.storage.from(bucket).remove([path]);
  if (res.error) {
    console.error('[storage] delete error', res.error);
    throw new Error(res.error.message);
  }
}

export async function deleteStorageObjectByPublicUrl(params: { bucket?: string; publicUrl: string }): Promise<void> {
  const bucket = params.bucket ?? 'app-media';
  const path = getStoragePathFromPublicUrl({ publicUrl: params.publicUrl, bucket });
  if (!path) {
    console.log('[storage] skip delete (not a public URL for this bucket)', { bucket, publicUrlPrefix: params.publicUrl.slice(0, 40) });
    return;
  }

  await deleteStorageObject({ bucket, path });
}

export async function uploadImageToSupabaseStorage(params: {
  asset: PickedImageAsset;
  folder: string;
  bucket?: string;
}): Promise<UploadImageResult>
{
  const bucket = params.bucket ?? 'app-media';

  const { contentType, ext, blob } = await maybeCompressImage({ asset: params.asset });

  const id = Crypto.randomUUID();
  const ts = Date.now();

  const safeFolder = params.folder.replace(/^\/+|\/+$/g, '');
  const path = `${safeFolder}/${ts}-${id}.${ext}`;

  console.log('[storage] uploading image', {
    bucket,
    folder: safeFolder,
    path,
    contentType,
  });

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

  console.log('[storage] upload success', { bucket, path, publicUrl });

  return { publicUrl, path, bucket };
}

export async function pickAndUploadImage(params: {
  folder: string;
  bucket?: string;
}): Promise<UploadImageResult | null>
{
  const asset = await pickImageAssetFromLibrary();
  if (!asset) return null;
  return uploadImageToSupabaseStorage({ asset, folder: params.folder, bucket: params.bucket });
}
