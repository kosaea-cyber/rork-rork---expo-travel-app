import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { LocalizedString } from '@/lib/db/types';
import Colors from '@/constants/colors';

interface LocalizedInputProps {
  label: string;
  value: LocalizedString;
  onChange: (value: LocalizedString) => void;
  multiline?: boolean;
  placeholder?: string;
}

export default function LocalizedInput({ label, value, onChange, multiline, placeholder }: LocalizedInputProps) {
  const handleChange = (lang: keyof LocalizedString, text: string) => {
    onChange({
      ...value,
      [lang]: text,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.langLabel}>EN</Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          value={value?.en || ''}
          onChangeText={(text) => handleChange('en', text)}
          multiline={multiline}
          placeholder={`${placeholder || label} (English)`}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.langLabel}>AR</Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea, { textAlign: 'right' }]}
          value={value?.ar || ''}
          onChangeText={(text) => handleChange('ar', text)}
          multiline={multiline}
          placeholder={`${placeholder || label} (Arabic)`}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.langLabel}>DE</Text>
        <TextInput
          style={[styles.input, multiline && styles.textArea]}
          value={value?.de || ''}
          onChangeText={(text) => handleChange('de', text)}
          multiline={multiline}
          placeholder={`${placeholder || label} (German)`}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  langLabel: {
    width: 30,
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.tint,
    marginTop: 12,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fafafa',
    minHeight: 40,
  },
  textArea: {
    minHeight: 80,
  },
});
