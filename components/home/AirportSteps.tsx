import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';

const steps = [
  { icon: 'document-text-outline', title: 'Planning' },
  { icon: 'airplane-outline', title: 'Arrival' },
  { icon: 'car-outline', title: 'Transfer' },
  { icon: 'bed-outline', title: 'Stay' },
  { icon: 'checkmark-circle-outline', title: 'Enjoy' },
] as const;

export default function AirportSteps() {
  const t = useI18nStore((state) => state.t);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('airportSteps')}</Text>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View key={`${step.title}-${index}`} style={styles.stepItem}>
            <View style={styles.iconCircle}>
              <Ionicons name={step.icon} color={Colors.tint} size={20} />
            </View>

            {/* لو بدك خطوط بين الخطوات لاحقاً نعملها بشكل نظيف (سهل) */}
            <Text style={styles.stepText}>{step.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stepItem: {
    alignItems: 'center',
    width: 60,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
});
