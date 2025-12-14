import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { AppSettings } from '@/lib/db/types';
import LocalizedInput from '@/components/admin/LocalizedInput';

export default function ManageContent() {
  const router = useRouter();
  const { appContent, updateAppContent } = useDataStore();
  
  const [form, setForm] = useState<AppSettings>(appContent);


  useEffect(() => {
    if (appContent) {
      setForm(appContent);
    }
  }, [appContent]);

  const handleSave = async () => {
    try {
      await updateAppContent(form);
      Alert.alert('Success', 'Content updated successfully');
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save content');
    }
  };

  const updateSection = (section: keyof AppSettings, key: string, value: any) => {
    setForm(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof AppSettings],
        [key]: value
      }
    }));
  };

  return (
    <ScrollView style={styles.container}>
      
      {/* HERO SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hero Section</Text>
        
        <LocalizedInput
          label="Title"
          value={form.hero.title}
          onChange={(val) => updateSection('hero', 'title', val)}
        />

        <LocalizedInput
          label="Subtitle"
          value={form.hero.subtitle}
          onChange={(val) => updateSection('hero', 'subtitle', val)}
          multiline
        />

        <LocalizedInput
          label="Button Text"
          value={form.hero.buttonText}
          onChange={(val) => updateSection('hero', 'buttonText', val)}
        />
      </View>

      {/* ABOUT SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Us Section</Text>
        
        <LocalizedInput
          label="Main Title"
          value={form.about.section1Title}
          onChange={(val) => updateSection('about', 'section1Title', val)}
        />

        <LocalizedInput
          label="Description"
          value={form.about.section1Content}
          onChange={(val) => updateSection('about', 'section1Content', val)}
          multiline
        />

        <LocalizedInput
          label="Mission Title"
          value={form.about.missionTitle}
          onChange={(val) => updateSection('about', 'missionTitle', val)}
        />

        <LocalizedInput
          label="Mission Content"
          value={form.about.missionContent}
          onChange={(val) => updateSection('about', 'missionContent', val)}
          multiline
        />

        <LocalizedInput
          label="Vision Title"
          value={form.about.visionTitle}
          onChange={(val) => updateSection('about', 'visionTitle', val)}
        />

        <LocalizedInput
          label="Vision Content"
          value={form.about.visionContent}
          onChange={(val) => updateSection('about', 'visionContent', val)}
          multiline
        />
      </View>

      {/* CONTACT SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Info</Text>
        
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={form.contact.phone}
          onChangeText={(text) => updateSection('contact', 'phone', text)}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={form.contact.email}
          onChangeText={(text) => updateSection('contact', 'email', text)}
        />

        <Text style={styles.label}>WhatsApp</Text>
        <TextInput
          style={styles.input}
          value={form.contact.whatsapp}
          onChangeText={(text) => updateSection('contact', 'whatsapp', text)}
        />

        <LocalizedInput
          label="Address"
          value={form.contact.address}
          onChange={(val) => updateSection('contact', 'address', val)}
          multiline
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
    marginBottom: 16,
    color: Colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#555',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 40,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
