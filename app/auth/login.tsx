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
import { useProfileStore } from '@/store/profileStore';

export default function LoginScreen() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const { appContent, initData } = useDataStore();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setProfile = useProfileStore((s) => s.setProfile);
  const clearProfile = useProfileStore((s) => s.clearProfile);

  useEffect(() => {
    (async () => {
      try {
        await supabaseConnectionCheck();
      } catch (e) {
        console.error('[auth/login] supabaseConnectionCheck failed (non-blocking)', e);
      }

      try {
        await initData();
      } catch (e) {
        console.error('[auth/login] initData failed (non-blocking)', e);
      }
    })();
  }, [initData]);

  const handleLogin = useCallback(async () => {
    if (!email || !password) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      console.log('[auth/login] signInWithPassword result', {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.user),
        error: error?.message,
      });

      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }

      if (!data.session || !data.user) {
        Alert.alert('Login failed', 'No session returned. Please try again.');
        return;
      }

      const profileRes = await supabase
        .from('profiles')
        .select('id, role, preferred_language')
        .eq('id', data.user.id)
        .single();

      console.log('[auth/login] profiles select result', {
        hasProfile: Boolean(profileRes.data),
        error: profileRes.error?.message,
      });

      if (profileRes.error) {
        clearProfile();
        Alert.alert('Login failed', `Profile fetch failed: ${profileRes.error.message}`);
        return;
      }

      setProfile({
        role: profileRes.data.role,
        preferredLanguage: profileRes.data.preferred_language,
      });

      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('[auth/login] unexpected error', e);
      Alert.alert('Login failed', 'Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router, setProfile, clearProfile]);

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
          <Text style={styles.title}>{t('login')}</Text>
          <Text style={styles.subtitle}>Welcome back to Ruwasi Elite</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              testID="auth-login-email"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              testID="auth-login-password"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            testID="auth-login-submit"
            style={[styles.button, (!email || !password) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.buttonText}>{t('login')}</Text>
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
    backgroundColor: 'rgba(10, 25, 47, 0.85)', // Stronger overlay for readability
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
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
  button: {
    backgroundColor: Colors.tint,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});
