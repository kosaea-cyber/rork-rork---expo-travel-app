import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Upload } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { AsyncImage } from '@/components/AsyncImage';
import { supabase } from '@/lib/supabase/client';
import { pickAndUploadImage } from '@/lib/supabase/storageUpload';
import { useAppImagesStore } from '@/store/appImagesStore';

function ImageInput({
  label,
  value,
  onChange,
  onPickImage,
  uploading,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onPickImage: () => void;
  uploading?: boolean;
}) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder="https://example.com/image.jpg"
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.uploadButton} onPress={onPickImage} disabled={uploading}>
          {uploading ? <ActivityIndicator size="small" color="white" /> : <Upload size={20} color="white" />}
          <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>Upload</Text>
        </TouchableOpacity>
      </View>
      {value ? (
        <View style={styles.previewContainer}>
            <Text style={styles.previewLabel}>Preview:</Text>
            <AsyncImage uri={value} style={styles.preview} resizeMode="cover" />
        </View>
      ) : null}
    </View>
  );
}

type AppImageKey = 'heroBackground' | 'welcomeBackground' | 'authBackground' | 'logoUrl';

type AppImagesState = Record<AppImageKey, string>;

const IMAGE_KEYS: AppImageKey[] = ['heroBackground', 'welcomeBackground', 'authBackground', 'logoUrl'];

export default function ManageImages() {
  const router = useRouter();
  const [uploadingKey, setUploadingKey] = useState<AppImageKey | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [images, setImages] = useState<AppImagesState>({
    heroBackground: '',
    welcomeBackground: '',
    authBackground: '',
    logoUrl: '',
  });

  const fetchImages = useCallback(async () => {
    try {
      console.log('[admin/images] fetching app_images');
      setLoading(true);
      setErrorMessage(null);

      const res = await supabase.from('app_images').select('key,url').in('key', IMAGE_KEYS);

      console.log('[admin/images] fetch result', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });

      if (res.error) throw new Error(res.error.message);

      const next: AppImagesState = {
        heroBackground: '',
        welcomeBackground: '',
        authBackground: '',
        logoUrl: '',
      };

      for (const row of res.data ?? []) {
        const k = row.key as AppImageKey;
        if (IMAGE_KEYS.includes(k)) {
          next[k] = (row.url as string) ?? '';
        }
      }

      setImages(next);
    } catch (e) {
      console.error('[admin/images] fetch failed', e);
      setErrorMessage(e instanceof Error ? e.message : 'Failed to load images from database.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const updateImage = useCallback((key: AppImageKey, value: string) => {
    setImages((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      console.log('[admin/images] saving app_images', images);

      const payload = IMAGE_KEYS.map((key) => ({
        key,
        url: images[key] || null,
      }));

      const res = await supabase.from('app_images').upsert(payload, { onConflict: 'key' }).select('key,url');

      console.log('[admin/images] save result', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });

      if (res.error) throw new Error(res.error.message);

      try {
        await useAppImagesStore.getState().refresh();
      } catch (e) {
        console.error('[admin/images] refresh appImagesStore failed (non-blocking)', e);
      }

      Alert.alert('Success', 'Images updated successfully');
      router.back();
    } catch (e) {
      console.error('[admin/images] save failed', e);
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save images');
    } finally {
      setSaving(false);
    }
  }, [images, router]);

  const pickImage = useCallback(async (key: AppImageKey) => {
    try {
      console.log('[admin/images] pickImage pressed', { key });
      setUploadingKey(key);

      const uploaded = await pickAndUploadImage({ folder: key });
      if (!uploaded) {
        setUploadingKey(null);
        return;
      }

      updateImage(key, uploaded.publicUrl);
    } catch (e) {
      console.error('[admin/images] upload failed', e);
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setUploadingKey(null);
    }
  }, [updateImage]);

  const isBusy = useMemo(() => loading || saving, [loading, saving]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} testID="admin-images-loading">
        <ActivityIndicator />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.container, styles.stateWrap]} testID="admin-images-error">
        <Text style={styles.stateTitle}>Couldn’t load images</Text>
        <Text style={styles.stateText}>{errorMessage}</Text>
        <TouchableOpacity testID="admin-images-retry" style={styles.stateButton} onPress={fetchImages}>
          <Text style={styles.stateButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="admin-images-scroll">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Backgrounds & Images</Text>
        
        <ImageInput
          label="Hero Background (Home Screen)"
          value={images?.heroBackground || ''}
          onChange={(val) => updateImage('heroBackground', val)}
          onPickImage={() => pickImage('heroBackground')}
          uploading={uploadingKey === 'heroBackground'}
        />

        <ImageInput
          label="Welcome Screen Background"
          value={images?.welcomeBackground || ''}
          onChange={(val) => updateImage('welcomeBackground', val)}
          onPickImage={() => pickImage('welcomeBackground')}
          uploading={uploadingKey === 'welcomeBackground'}
        />

        <ImageInput
          label="Auth Screens Background (Login/Register)"
          value={images?.authBackground || ''}
          onChange={(val) => updateImage('authBackground', val)}
          onPickImage={() => pickImage('authBackground')}
          uploading={uploadingKey === 'authBackground'}
        />

        <ImageInput
          label="App Logo URL (Optional override)"
          value={images?.logoUrl || ''}
          onChange={(val) => updateImage('logoUrl', val)}
          onPickImage={() => pickImage('logoUrl')}
          uploading={uploadingKey === 'logoUrl'}
        />

      </View>

      <TouchableOpacity style={[styles.saveButton, isBusy ? { opacity: 0.7 } : null]} onPress={handleSave} disabled={isBusy} testID="admin-images-save">
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save All Changes'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: Colors.tint,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    color: '#333',
  },
  uploadButton: {
    backgroundColor: Colors.tint,
    padding: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minWidth: 90,
  },
  previewContainer: {
    marginTop: 10,
  },
  previewLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  preview: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  saveButton: {
    backgroundColor: Colors.tint,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stateWrap: {
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateTitle: {
    color: '#111',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  stateText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  stateButton: {
    marginTop: 14,
    backgroundColor: Colors.tint,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stateButtonText: {
    color: 'white',
    fontWeight: '800',
  },
});
