import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Upload } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { AsyncImage } from '@/components/AsyncImage';

function ImageInput({ label, value, onChange, onPickImage, uploading }: { label: string, value: string, onChange: (text: string) => void, onPickImage: () => void, uploading?: boolean }) {
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

export default function ManageImages() {
  const router = useRouter();
  const { appContent, initData, updateAppContent } = useDataStore();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  
  const [images, setImages] = useState(appContent?.images || {
    heroBackground: '',
    welcomeBackground: '',
    authBackground: '',
    logoUrl: ''
  });

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    if (appContent?.images) {
      setImages(appContent.images);
    }
  }, [appContent]);

  const handleSave = async () => {
    try {
      await updateAppContent({ images });
      Alert.alert('Success', 'Images updated successfully');
      router.back();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to save images');
    }
  };

  const updateImage = (key: keyof typeof images, value: string) => {
    setImages(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const pickImage = async (key: keyof typeof images) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingKey(key);
        const asset = result.assets[0];
        
        const formData = new FormData();
        formData.append('file', {
            uri: asset.uri,
            name: asset.fileName || `${key}.jpg`,
            type: asset.mimeType || 'image/jpeg'
        } as any);

        const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:8081';
        const res = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
        
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        const fullUrl = `${baseUrl}${data.url}`;
        
        updateImage(key, fullUrl);
        setUploadingKey(null);
      }
    } catch (error) {
      setUploadingKey(null);
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  if (!images) {
      return (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
              <Text>Loading...</Text>
          </View>
      );
  }

  return (
    <ScrollView style={styles.container}>
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

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save All Changes</Text>
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
});
