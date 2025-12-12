import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { HeroSlide } from '@/lib/db/types';
import { Plus, Trash2, ArrowUp, ArrowDown, Save, Image as ImageIcon } from 'lucide-react-native';
import LocalizedInput from '@/components/admin/LocalizedInput';
import * as ImagePicker from 'expo-image-picker';
import { AsyncImage } from '@/components/AsyncImage';
import { trpc } from '@/lib/trpc';

export default function ManageHero() {
  const router = useRouter();
  
  // Queries & Mutations
  const { data: slides = [], isLoading: loading, refetch } = trpc.hero.listSlides.useQuery();
  const createMutation = trpc.hero.createSlide.useMutation();
  const updateMutation = trpc.hero.updateSlide.useMutation();
  const deleteMutation = trpc.hero.deleteSlide.useMutation();
  const reorderMutation = trpc.hero.reorderSlides.useMutation();

  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<HeroSlide>>({});

  const handleEdit = (slide: HeroSlide) => {
    setEditingId(slide.id);
    setFormData(JSON.parse(JSON.stringify(slide))); // Deep copy
  };

  const handleCreate = () => {
    const newSlide: Partial<HeroSlide> = {
      imageUrl: '',
      title: { en: '', ar: '', de: '' },
      subtitle: { en: '', ar: '', de: '' },
      ctaLabel: { en: 'Learn More', ar: 'اعرف المزيد', de: 'Mehr erfahren' },
      ctaLink: '/services',
      isActive: true,
      order: slides.length + 1
    };
    setEditingId('new');
    setFormData(newSlide);
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Slide', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
              await deleteMutation.mutateAsync({ id });
              refetch();
          } catch (e) {
              Alert.alert('Error', 'Failed to delete');
          }
        }
      }
    ]);
  };

  const handleSave = async () => {
    if (!formData.imageUrl) {
      Alert.alert('Error', 'Image is required');
      return;
    }
    if (!formData.title?.en) {
      Alert.alert('Error', 'English title is required');
      return;
    }

    setSaving(true);
    
    try {
        if (editingId === 'new') {
           await createMutation.mutateAsync(formData as any);
        } else if (editingId) {
           await updateMutation.mutateAsync({
               id: editingId,
               data: formData as any
           });
        }
        
        await refetch();
        setSaving(false);
        setEditingId(null);
        Alert.alert('Success', 'Hero slides updated');
    } catch (e) {
        setSaving(false);
        Alert.alert('Error', 'Failed to save');
        console.error(e);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({});
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === slides.length - 1) return;
    
    // Optimistic update logic is hard, let's just calculate new order ids and send
    const newSlides = [...slides];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newSlides[index], newSlides[targetIndex]] = [newSlides[targetIndex], newSlides[index]];
    
    // We send array of IDs in new order
    const ids = newSlides.map(s => s.id);
    
    try {
        await reorderMutation.mutateAsync(ids);
        refetch();
    } catch (e) {
        Alert.alert('Error', 'Failed to reorder');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        setSaving(true);
        const asset = result.assets[0];
        
        const formDataUpload = new FormData();
        formDataUpload.append('file', {
            uri: asset.uri,
            name: asset.fileName || `upload_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg'
        } as any);

        const baseUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'http://localhost:8081';
        const res = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            body: formDataUpload,
            headers: {
                'Content-Type': 'multipart/form-data',
            }
        });
        
        if (!res.ok) throw new Error('Upload failed');
        
        const data = await res.json();
        // Construct full URL
        const fullUrl = `${baseUrl}${data.url}`;
        
        setFormData(prev => ({ ...prev, imageUrl: fullUrl }));
        setSaving(false);
      } catch (e) {
        setSaving(false);
        Alert.alert('Error', 'Failed to upload image');
        console.error(e);
      }
    }
  };

  if (loading) return <ActivityIndicator size="large" color={Colors.tint} style={{ marginTop: 50 }} />;

  return (
    <ScrollView style={styles.container}>
      {/* List of Slides */}
      {!editingId && (
        <View>
           <TouchableOpacity style={styles.addButton} onPress={handleCreate}>
             <Plus color="white" size={24} />
             <Text style={styles.addButtonText}>Add New Slide</Text>
           </TouchableOpacity>

           {slides.map((slide, index) => (
             <View key={slide.id} style={styles.slideCard}>
               <AsyncImage uri={slide.imageUrl} style={styles.thumbnail} />
               <View style={styles.slideInfo}>
                 <Text style={styles.slideTitle}>{slide.title.en}</Text>
                 <Text style={styles.slideSubtitle}>{slide.isActive ? 'Active' : 'Inactive'} • Order: {slide.order}</Text>
               </View>
               <View style={styles.actions}>
                 <TouchableOpacity onPress={() => handleMove(index, 'up')} disabled={index === 0}>
                   <ArrowUp size={20} color={index === 0 ? '#ccc' : Colors.text} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => handleMove(index, 'down')} disabled={index === slides.length - 1}>
                   <ArrowDown size={20} color={index === slides.length - 1 ? '#ccc' : Colors.text} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => handleEdit(slide)}>
                    <Text style={{ color: Colors.tint, fontWeight: 'bold', marginLeft: 8 }}>Edit</Text>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => handleDelete(slide.id)}>
                   <Trash2 size={20} color={Colors.error} style={{ marginLeft: 8 }} />
                 </TouchableOpacity>
               </View>
             </View>
           ))}
        </View>
      )}

      {/* Editor Form */}
      {editingId && (
        <View style={styles.editor}>
           <Text style={styles.editorTitle}>{editingId === 'new' ? 'New Slide' : 'Edit Slide'}</Text>
           
           <View style={styles.section}>
             <Text style={styles.label}>Image</Text>
             {formData.imageUrl ? (
               <AsyncImage uri={formData.imageUrl} style={styles.previewImage} />
             ) : (
                <View style={styles.placeholderImage}>
                    <Text style={{ color: '#999' }}>No Image</Text>
                </View>
             )}
             <View style={styles.imageActions}>
                <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                   <ImageIcon color="white" size={20} />
                   <Text style={{ color: 'white', marginLeft: 8 }}>Upload Image</Text>
                </TouchableOpacity>
                <TextInput 
                   style={styles.urlInput} 
                   placeholder="Or enter URL..." 
                   value={formData.imageUrl}
                   onChangeText={(t) => setFormData(prev => ({...prev, imageUrl: t}))}
                />
             </View>
           </View>

           <View style={styles.section}>
             <Text style={styles.label}>Title</Text>
             <LocalizedInput 
               label="Title"
               value={formData.title as any}
               onChange={(val) => setFormData(prev => ({ ...prev, title: val }))}
             />
           </View>

           <View style={styles.section}>
             <Text style={styles.label}>Subtitle</Text>
             <LocalizedInput 
               label="Subtitle"
               value={formData.subtitle as any}
               onChange={(val) => setFormData(prev => ({ ...prev, subtitle: val }))}
               multiline
             />
           </View>

           <View style={styles.section}>
             <Text style={styles.label}>Button Label</Text>
             <LocalizedInput 
               label="CTA Label"
               value={formData.ctaLabel as any}
               onChange={(val) => setFormData(prev => ({ ...prev, ctaLabel: val }))}
             />
           </View>

           <View style={styles.section}>
             <Text style={styles.label}>Link (Route)</Text>
             <TextInput 
               style={styles.input}
               value={formData.ctaLink}
               onChangeText={(t) => setFormData(prev => ({...prev, ctaLink: t}))}
               placeholder="/(tabs)/services"
             />
           </View>

           <View style={styles.row}>
             <Text style={styles.label}>Active</Text>
             <Switch 
               value={formData.isActive}
               onValueChange={(v) => setFormData(prev => ({...prev, isActive: v}))}
             />
           </View>

           <View style={styles.formActions}>
             <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
               <Text style={styles.cancelText}>Cancel</Text>
             </TouchableOpacity>
             <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave} disabled={saving}>
               {saving ? <ActivityIndicator color="white" /> : (
                 <>
                   <Save color="white" size={20} />
                   <Text style={styles.saveText}>Save Slide</Text>
                 </>
               )}
             </TouchableOpacity>
           </View>
        </View>
      )}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  slideCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: {
    width: 60,
    height: 40,
    borderRadius: 4,
    backgroundColor: '#eee',
  },
  slideInfo: {
    flex: 1,
    marginLeft: 12,
  },
  slideTitle: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  slideSubtitle: {
    color: '#666',
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editor: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
  },
  editorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    color: Colors.tint,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },
  previewImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#eee',
    resizeMode: 'cover'
  },
  placeholderImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderRadius: 8,
  },
  imageActions: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center'
  },
  uploadButton: {
      backgroundColor: Colors.tint,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderRadius: 8,
  },
  urlInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ddd',
      padding: 10,
      borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: Colors.tint,
  },
  cancelText: {
    color: '#333',
    fontWeight: '600',
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
