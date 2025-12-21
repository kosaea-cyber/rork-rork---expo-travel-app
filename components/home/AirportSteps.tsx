import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Plane, FileText, Hotel, Car, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';

const steps = [
  { icon: FileText, title: 'Planning' },
  { icon: Plane, title: 'Arrival' },
  { icon: Car, title: 'Transfer' },
  { icon: Hotel, title: 'Stay' },
  { icon: CheckCircle, title: 'Enjoy' },
];

export default function AirportSteps() {
  const t = useI18nStore((state) => state.t);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('airportSteps')}</Text>
      <View style={styles.stepsContainer}>
        {steps.map((Step, index) => {
           const Icon = Step.icon;
           return (
            <View key={index} style={styles.stepItem}>
              <View style={styles.iconCircle}>
                <Icon color={Colors.tint} size={20} />
              </View>
              {index < steps.length - 1 && <View style={styles.line} />}
              <Text style={styles.stepText}>{Step.title}</Text>
            </View>
           );
        })}
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
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    top: 20,
    left: 40, // Half width + offset
    width: 40, // Distance to next
    height: 1,
    backgroundColor: Colors.border,
    zIndex: 0,
    // Note: This static line approach is tricky with flex. 
    // Simplified for demo: just removing lines for now to keep it clean or use absolute positioning if needed.
    // Let's remove the line for simplicity in this flex layout or implement better.
    // Hiding line for now.
    display: 'none',
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
  },
});
