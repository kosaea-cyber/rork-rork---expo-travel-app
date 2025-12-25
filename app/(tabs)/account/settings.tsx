import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useI18nStore, type Language } from '@/constants/i18n';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase/client';

export default function SettingsScreen() {
  const { language, setLanguage, t } = useI18nStore();
  const user = useAuthStore((s) => s.user);

  const toggleLanguage = useCallback(
    async (lang: Language) => {
      console.log('[settings] language switch', { lang, hasUser: Boolean(user) });

      await setLanguage(lang);

      if (!user?.id) return;

      try {
        const res = await supabase
          .from('profiles')
          .update({ preferred_language: lang })
          .eq('id', user.id);

        if (res.error) {
          console.error('[settings] update preferred_language error', res.error);
          Alert.alert('Could not update language', res.error.message);
        }
      } catch (e) {
        console.error('[settings] update preferred_language unexpected error', e);
        Alert.alert('Could not update language', 'Unexpected error. Please try again.');
      }
    },
    [setLanguage, user]
  );

  const CheckIcon = ({ visible }: { visible: boolean }) =>
    visible ? <Ionicons name="checkmark" size={22} color={Colors.tint} /> : <View style={{ width: 22 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('language')}</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.option} onPress={() => toggleLanguage('en')} activeOpacity={0.8}>
          <Text style={styles.optionText}>English</Text>
          <CheckIcon visible={language === 'en'} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.option} onPress={() => toggleLanguage('ar')} activeOpacity={0.8}>
          <Text style={styles.optionText}>العربية</Text>
          <CheckIcon visible={language === 'ar'} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.option} onPress={() => toggleLanguage('de')} activeOpacity={0.8}>
          <Text style={styles.optionText}>Deutsch</Text>
          <CheckIcon visible={language === 'de'} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Contact Info</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>+965 1234 5678</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>info@ruwasielite.com</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  optionText: {
    fontSize: 16,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  value: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
