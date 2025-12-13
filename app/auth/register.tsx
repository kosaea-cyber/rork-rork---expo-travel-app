import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { supabase, supabaseConnectionCheck } from '@/lib/supabase/client';

export default function RegisterScreen() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const { appContent, initData } = useDataStore();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const language = useI18nStore((state) => state.language);

  useEffect(() => {
    (async () => {
      try {
        await supabaseConnectionCheck();
      } catch (e) {
        console.error('[auth/register] supabaseConnectionCheck failed (non-blocking)', e);
      }

      try {
        await initData();
      } catch (e) {
        console.error('[auth/register] initData failed (non-blocking)', e);
      }
    })();
  }, [initData]);

  const [formData, setFormData] = useState<{ 
    name: string;
    email: string;
    phone: string;
    password: string;
    country: string;
    nationality: string;
  }>({
    name: '',
    email: '',
    phone: '',
    password: '',
    country: '',
    nationality: '',
  });

  const handleChange = (key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = useCallback(async () => {
    if (!formData.email || !formData.password) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      console.log('[auth/register] signUp result', {
        hasUser: Boolean(data.user),
        hasSession: Boolean(data.session),
        error: error?.message,
      });

      if (error) {
        Alert.alert('Registration failed', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert('Registration failed', 'No user returned. Please try again.');
        return;
      }

      Alert.alert(
        'Account created',
        'Account created. Please check your email if confirmation is enabled, then login.'
      );
      router.replace('/auth/login');
    } catch (e) {
      console.error('[auth/register] unexpected error', e);
      Alert.alert('Registration failed', 'Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData.email, formData.password, router]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ImageBackground
        source={{ uri: appContent.images?.authBackground || 'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80' }}
        style={styles.background}
      >
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('register')}</Text>
          <Text style={styles.subtitle}>Join the elite experience</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('fullName')}</Text>
            <TextInput
              testID="auth-register-full-name"
              style={styles.input}
              value={formData.name}
              onChangeText={(v) => handleChange('name', v)}
              placeholder="John Doe"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              testID="auth-register-email"
              style={styles.input}
              value={formData.email}
              onChangeText={(v) => handleChange('email', v)}
              placeholder="name@example.com"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('phone')}</Text>
            <TextInput
              testID="auth-register-phone"
              style={styles.input}
              value={formData.phone}
              onChangeText={(v) => handleChange('phone', v)}
              placeholder="+1234567890"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('country')}</Text>
            <TextInput
              testID="auth-register-country"
              style={styles.input}
              value={formData.country}
              onChangeText={(v) => handleChange('country', v)}
              placeholder="Kuwait"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>
          
           <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('nationality')}</Text>
            <TextInput
              testID="auth-register-nationality"
              style={styles.input}
              value={formData.nationality}
              onChangeText={(v) => handleChange('nationality', v)}
              placeholder="Kuwaiti"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              testID="auth-register-password"
              style={styles.input}
              value={formData.password}
              onChangeText={(v) => handleChange('password', v)}
              placeholder="••••••••"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            testID="auth-register-submit"
            style={styles.button}
            onPress={handleRegister}
            disabled={isLoading || !formData.email || !formData.password}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.buttonText}>{t('register')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 25, 47, 0.85)',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.tint,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    gap: 20,
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
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
