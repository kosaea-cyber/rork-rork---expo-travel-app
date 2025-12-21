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
import { useAppImagesStore } from '@/store/appImagesStore';
import { supabase, supabaseConnectionCheck } from '@/lib/supabase/client';
import { useProfileStore } from '@/store/profileStore';

export default function LoginScreen() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const authBackground = useAppImagesStore((s) => s.imagesByKey.authBackground);

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);

  const setProfile = useProfileStore((s) => s.setProfile);
  const clearProfile = useProfileStore((s) => s.clearProfile);

  useEffect(() => {
    (async () => {
      try {
        await supabaseConnectionCheck();
      } catch (e) {
        console.error('[auth/login] supabaseConnectionCheck failed (non-blocking)', e);
      }

    })();
  }, []);

  const handleLogin = useCallback(async () => {
    console.log('[login] pressed');

    const normalizedEmail = email.trim().toLowerCase();
    console.log('[login] email', normalizedEmail);

    if (!normalizedEmail || !password) {
      Alert.alert('Missing info', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[login] starting signInWithPassword');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      console.log('[auth/login] signInWithPassword result', {
        hasSession: Boolean(data.session),
        hasUser: Boolean(data.user),
        error: error?.message,
      });

      if (error) {
        console.error('[auth/login] signInWithPassword error', {
          message: error.message,
          status: (error as { status?: number } | null)?.status ?? null,
          name: (error as { name?: string } | null)?.name ?? null,
        });

        const msg = error.message.toLowerCase();
        if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
          Alert.alert(
            'Email not confirmed',
            'Please confirm your email address. If you did not receive the email, tap “Resend confirmation email”.'
          );
          return;
        }

        if (msg.includes('invalid login credentials')) {
          Alert.alert('Login failed', 'Invalid email or password.');
          return;
        }

        Alert.alert('Login failed', error.message);
        return;
      }

      if (!data.session || !data.user) {
        Alert.alert('Login failed', 'No session returned. Please try again.');
        return;
      }

      console.log('[login] success user id', data.user.id);

      const fetchProfile = async () => {
        const res = await supabase
          .from('profiles')
          .select('id, role, preferred_language, is_blocked')
          .eq('id', data.user.id)
          .maybeSingle();

        console.log('[auth/login] profiles select result', {
          hasProfile: Boolean(res.data),
          error: res.error?.message,
          code: (res.error as { code?: string } | null)?.code,
        });

        return res;
      };

      let profileRes = await fetchProfile();

      if (!profileRes.data && !profileRes.error) {
        console.log('[auth/login] profile missing; retrying once in 1000ms');
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
        profileRes = await fetchProfile();
      }

      if (profileRes.error) {
        clearProfile();
        Alert.alert('Login failed', `Profile fetch failed: ${profileRes.error.message}`);
        return;
      }

      if (!profileRes.data) {
        clearProfile();
        Alert.alert(
          'Profile not ready',
          'We could not find your profile yet. Please wait a moment and try again.'
        );
        return;
      }

      if (profileRes.data.is_blocked) {
        console.warn('[auth/login] blocked profile attempted login', { userId: data.user.id });
        clearProfile();
        await supabase.auth.signOut();
        Alert.alert('Account disabled', 'Your account has been disabled. Please contact support.');
        return;
      }

      setProfile({
        role: profileRes.data.role,
        preferredLanguage: profileRes.data.preferred_language,
      });

      try {
        await useI18nStore.getState().hydrateFromProfile(profileRes.data.preferred_language);
      } catch (e) {
        console.error('[auth/login] hydrateFromProfile failed (non-blocking)', e);
      }

      console.log('[login] role from profiles', profileRes.data.role);

      router.replace('/(tabs)/home');
    } catch (e) {
      console.error('[auth/login] unexpected error', e);
      Alert.alert('Login failed', 'Unexpected error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [email, password, router, setProfile, clearProfile]);

  const handleResendConfirmation = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    console.log('[login] resend confirmation pressed', { normalizedEmail });

    if (!normalizedEmail) {
      Alert.alert('Email required', 'Enter your email first.');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: normalizedEmail });
      if (error) {
        console.error('[login] resend confirmation error', error);
        Alert.alert('Could not resend', error.message);
        return;
      }

      Alert.alert('Sent', 'Confirmation email sent. Please check your inbox and spam folder.');
    } catch (e) {
      console.error('[login] resend confirmation unexpected error', e);
      Alert.alert('Could not resend', 'Unexpected error. Please try again.');
    } finally {
      setIsResending(false);
    }
  }, [email]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ImageBackground
        source={{
          uri:
            authBackground ||
            'https://images.unsplash.com/photo-1548013146-72479768bada?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
        }}
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

          <TouchableOpacity
            testID="auth-login-resend-confirmation"
            style={[styles.linkButton, (isLoading || isResending) && styles.linkButtonDisabled]}
            onPress={handleResendConfirmation}
            disabled={isLoading || isResending}
          >
            <Text style={styles.linkText}>
              {isResending ? 'Resending…' : 'Resend confirmation email'}
            </Text>
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
  linkButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  linkButtonDisabled: {
    opacity: 0.6,
  },
  linkText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
