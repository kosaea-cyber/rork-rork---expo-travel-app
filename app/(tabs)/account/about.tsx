import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { useI18nStore, getLocalized } from '@/constants/i18n';

export default function AboutScreen() {
  const { appContent, initData } = useDataStore();
  const language = useI18nStore((state) => state.language);

  useEffect(() => {
    initData();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Ruwasi Elite Travel</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{getLocalized(appContent.about.section1Title, language)}</Text>
        <Text style={styles.paragraph}>{getLocalized(appContent.about.section1Content, language)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{getLocalized(appContent.about.missionTitle, language)}</Text>
        <Text style={styles.paragraph}>{getLocalized(appContent.about.missionContent, language)}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{getLocalized(appContent.about.visionTitle, language)}</Text>
        <Text style={styles.paragraph}>{getLocalized(appContent.about.visionContent, language)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 24,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.tint,
    marginBottom: 8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 40,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
});
