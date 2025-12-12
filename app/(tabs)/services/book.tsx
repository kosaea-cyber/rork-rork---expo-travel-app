import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useBookingStore } from '@/store/bookingStore';
import { MOCK_PACKAGES } from '@/mocks/data';

import { useAuthStore } from '@/store/authStore';

export default function BookingRequestScreen() {
  const { packageId } = useLocalSearchParams<{ packageId: string }>();
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const language = useI18nStore((state) => state.language);
  const addBooking = useBookingStore((state) => state.addBooking);
  const isLoading = useBookingStore((state) => state.isLoading);
  const user = useAuthStore((state) => state.user);
  
  const pkg = MOCK_PACKAGES.find(p => p.id === packageId);

  const [startDate, setStartDate] = useState('');
  const [travelers, setTravelers] = useState('1');
  const [notes, setNotes] = useState('');

  const handleRequest = async () => {
    if (!startDate || !pkg || !user) return;

    await addBooking({
      packageId: pkg.id,
      packageTitle: getLocalized(pkg.title, language),
      startDate: startDate,
      endDate: 'TBD', // Simplified
      travelers: parseInt(travelers, 10) || 1,
      notes,
      customerId: user.id,
      customerName: user.name,
      customerEmail: user.email,
      type: (pkg.categoryId.charAt(0).toUpperCase() + pkg.categoryId.slice(1)) as any,
      serviceCategoryId: pkg.categoryId,
    });

    Alert.alert('Success', t('bookingRequestSent'), [
      { text: 'OK', onPress: () => router.navigate('/(tabs)/bookings') }
    ]);
  };

  if (!pkg) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.subtitle}>Request booking for:</Text>
      <Text style={styles.pkgTitle}>{getLocalized(pkg.title, language)}</Text>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Preferred Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2025-12-01"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Number of Travelers</Text>
          <TextInput
            style={styles.input}
            value={travelers}
            onChangeText={setTravelers}
            keyboardType="number-pad"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Notes / Special Requests</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleRequest}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>{isLoading ? t('loading') : t('submit')}</Text>
        </TouchableOpacity>
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
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  pkgTitle: {
    color: Colors.tint,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 32,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: Colors.card,
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
