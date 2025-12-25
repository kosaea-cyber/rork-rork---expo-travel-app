import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Colors from '@/constants/colors';
import { supabase } from '@/lib/supabase/client';

type ProfileRole = 'admin' | 'customer';
type ProfileLanguage = 'en' | 'ar' | 'de';

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  preferred_language: ProfileLanguage | null;
  role: ProfileRole | null;
  created_at: string | null;
  is_blocked: boolean | null;
};

function roleLabel(role: ProfileRole | null | undefined): string {
  if (role === 'admin') return 'Admin';
  return 'Customer';
}

function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

function safeName(p: ProfileRow | null): string {
  const n = (p?.full_name ?? '').trim();
  if (n) return n;
  const id = p?.id ?? '';
  return id ? id.slice(0, 8) : 'Profile';
}

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [toastText, setToastText] = useState<string>('');
  const toastOpacity = useRef<Animated.Value>(new Animated.Value(0)).current;
  const toastTranslateY = useRef<Animated.Value>(new Animated.Value(8)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [fullName, setFullName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [preferredLanguage, setPreferredLanguage] = useState<ProfileLanguage>('en');
  const [role, setRole] = useState<ProfileRole>('customer');
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      console.log('[admin/customer] loadProfile', { id });
      const { data, error: qErr } = await supabase
        .from('profiles')
        .select('id, full_name, phone, preferred_language, role, created_at, is_blocked')
        .eq('id', id)
        .maybeSingle();

      console.log('[admin/customer] profiles select result', {
        hasData: Boolean(data),
        error: qErr?.message ?? null,
      });

      if (qErr) throw qErr;
      if (!data) {
        setProfile(null);
        setError('Profile not found');
        return;
      }

      const row = data as ProfileRow;
      setProfile(row);
      setFullName(row.full_name ?? '');
      setPhone(row.phone ?? '');
      setPreferredLanguage((row.preferred_language ?? 'en') as ProfileLanguage);
      setRole((row.role ?? 'customer') as ProfileRole);
      setIsBlocked(Boolean(row.is_blocked));
    } catch (e) {
      console.error('[admin/customer] loadProfile error', e);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProfile().catch((e) => console.error('[admin/customer] initial load error', e));
  }, [loadProfile]);

  const canSave = useMemo(() => {
    if (!profile) return false;
    return true;
  }, [profile]);

  const confirmRoleChangeIfNeeded = useCallback(
    async (nextRole: ProfileRole): Promise<boolean> => {
      const current = (profile?.role ?? 'customer') as ProfileRole;
      if (nextRole === current) return true;

      return await new Promise<boolean>((resolve) => {
        Alert.alert('Confirm role change', `${safeName(profile)} will become ${roleLabel(nextRole)}.`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
    },
    [profile],
  );

  const showToast = useCallback(
    (message: string) => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }

      setToastText(message);
      toastOpacity.setValue(0);
      toastTranslateY.setValue(8);

      Animated.parallel([
        Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: false }),
        Animated.timing(toastTranslateY, { toValue: 0, duration: 180, useNativeDriver: false }),
      ]).start();

      toastTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: false }),
          Animated.timing(toastTranslateY, { toValue: 8, duration: 220, useNativeDriver: false }),
        ]).start();
      }, 1500);
    },
    [toastOpacity, toastTranslateY],
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const onSave = useCallback(async () => {
    if (!id || !profile) return;
    if (!canSave) return;

    const nextRole = role;
    const ok = await confirmRoleChangeIfNeeded(nextRole);
    if (!ok) return;

    setSaving(true);
    try {
      const payload = {
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        preferred_language: preferredLanguage,
        role: nextRole,
        is_blocked: isBlocked,
      };

      console.log('[admin/customer] update payload', { id, payload });

      const { error: upErr } = await supabase.from('profiles').update(payload).eq('id', id);
      if (upErr) throw upErr;

      showToast('Saved');
      await loadProfile();
    } catch (e) {
      console.error('[admin/customer] save error', e);
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    confirmRoleChangeIfNeeded,
    fullName,
    id,
    isBlocked,
    loadProfile,
    phone,
    preferredLanguage,
    profile,
    role,
    showToast,
  ]);

  const onToggleBlocked = useCallback(() => {
    if (!profile) return;
    const next = !isBlocked;

    Alert.alert(
      next ? 'Disable account?' : 'Re-enable account?',
      next ? 'This user will be blocked from logging in.' : 'This user will be allowed to log in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Disable' : 'Enable',
          style: 'destructive',
          onPress: () => setIsBlocked(next),
        },
      ],
    );
  }, [isBlocked, profile]);

  if (loading) {
    return (
      <View style={styles.stateWrap} testID="adminCustomerLoading">
        <ActivityIndicator color={Colors.tint} />
        <Text style={styles.stateText}>Loading profile…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateWrap} testID="adminCustomerError">
        <Text style={styles.stateTitle}>Couldn’t open customer</Text>
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity
          testID="adminCustomerRetry"
          style={styles.retryBtn}
          onPress={() => {
            loadProfile().catch((e) => console.error('[admin/customer] retry load error', e));
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.stateWrap} testID="adminCustomerNotFound">
        <Text style={styles.stateTitle}>Not found</Text>
        <Text style={styles.stateText}>This profile does not exist.</Text>
      </View>
    );
  }

  const isRoleAdmin = role === 'admin';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: safeName(profile) }} />

      <ScrollView contentContainerStyle={styles.content} testID="adminCustomerScreen">
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
          testID="adminCustomerToast"
        >
          <Text style={styles.toastText}>{toastText}</Text>
        </Animated.View>

        <View style={styles.hero}>
          <TouchableOpacity testID="adminCustomerBack" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={18} color={Colors.text} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.heroMeta}>
            <View style={styles.heroBadge}>
              <Ionicons name="person-circle-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.heroBadgeText}>{profile.id}</Text>
            </View>
            <View style={styles.heroBadge}>
              <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.heroBadgeText}>{formatDateLong(profile.created_at)}</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{safeName(profile)}</Text>

          <View style={styles.heroChips}>
            <View style={[styles.chip, isRoleAdmin ? styles.chipAdmin : styles.chipCustomer]}>
              {isRoleAdmin ? (
                <Ionicons name="shield-checkmark-outline" size={14} color={'#FFD369'} />
              ) : (
                <Ionicons name="shield-outline" size={14} color={Colors.textSecondary} />
              )}
              <Text style={[styles.chipText, isRoleAdmin ? styles.chipTextAdmin : null]}>{roleLabel(role)}</Text>
            </View>

            <View style={[styles.chip, isBlocked ? styles.chipBlocked : styles.chipOk]}>
              {isBlocked ? (
                <Ionicons name="ban-outline" size={14} color="#FF5A7A" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={14} color="#42D39E" />
              )}
              <Text style={[styles.chipText, isBlocked ? styles.chipTextBlocked : styles.chipTextOk]}>
                {isBlocked ? 'Blocked' : 'Active'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit profile</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              testID="adminCustomerFullName"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor={Colors.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            <View style={styles.inputRow}>
              <Ionicons name="call-outline" size={16} color={Colors.textSecondary} />
              <TextInput
                testID="adminCustomerPhone"
                style={styles.inputRowInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Preferred language</Text>
            <View style={styles.segmentRow}>
              {(['en', 'ar', 'de'] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  testID={`adminCustomerLang-${l}`}
                  style={[styles.segment, preferredLanguage === l && styles.segmentActive]}
                  onPress={() => setPreferredLanguage(l)}
                >
                  <Ionicons name="globe-outline" size={14} color={preferredLanguage === l ? '#7AA2F7' : Colors.textSecondary} />
                  <Text style={[styles.segmentText, preferredLanguage === l && { color: '#7AA2F7' }]}>
                    {l.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Role</Text>
            <View style={styles.segmentRow}>
              {(['customer', 'admin'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  testID={`adminCustomerRole-${r}`}
                  style={[styles.segment, role === r && styles.segmentActiveRole]}
                  onPress={() => setRole(r)}
                >
                  {r === 'admin' ? (
                    <Ionicons name="shield-checkmark-outline" size={14} color={role === r ? '#FFD369' : Colors.textSecondary} />
                  ) : (
                    <Ionicons name="shield-outline" size={14} color={role === r ? '#FFD369' : Colors.textSecondary} />
                  )}
                  <Text style={[styles.segmentText, role === r && { color: '#FFD369' }]}>{roleLabel(r)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hintText}>You’ll be asked to confirm on Save.</Text>
          </View>

          <TouchableOpacity
            testID="adminCustomerSave"
            style={[styles.saveBtn, (!canSave || saving) && { opacity: 0.65 }]}
            disabled={!canSave || saving}
            onPress={() => {
              onSave().catch((e) => console.error('[admin/customer] onSave unexpected', e));
            }}
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={Colors.background} />
                <Text style={styles.saveText}>Save changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.dangerCard} testID="adminCustomerDangerZone">
          <Text style={styles.dangerTitle}>Danger zone</Text>
          <Text style={styles.dangerSubtitle}>Soft-ban by toggling blocked status.</Text>

          <TouchableOpacity
            testID="adminCustomerToggleBlocked"
            style={[styles.blockBtn, isBlocked ? styles.blockBtnEnabled : styles.blockBtnDisabled]}
            onPress={onToggleBlocked}
          >
            {isBlocked ? (
              <Ionicons name="checkmark-circle-outline" size={16} color="#42D39E" />
            ) : (
              <Ionicons name="ban-outline" size={16} color="#FF5A7A" />
            )}
            <Text style={[styles.blockBtnText, isBlocked ? { color: '#42D39E' } : { color: '#FF5A7A' }]}>
              {isBlocked ? 'Re-enable account' : 'Disable account'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>Remember to press Save after changing blocked status.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A12',
  },
  content: {
    padding: 14,
    paddingBottom: 30,
    gap: 12,
  },
  hero: {
    borderRadius: 20,
    backgroundColor: '#0A0E1C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
    gap: 12,
  },
  backBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  backText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroBadgeText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipCustomer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipAdmin: {
    backgroundColor: 'rgba(255, 211, 105, 0.14)',
    borderColor: 'rgba(255, 211, 105, 0.30)',
  },
  chipBlocked: {
    backgroundColor: 'rgba(255, 90, 122, 0.12)',
    borderColor: 'rgba(255, 90, 122, 0.22)',
  },
  chipOk: {
    backgroundColor: 'rgba(66, 211, 158, 0.10)',
    borderColor: 'rgba(66, 211, 158, 0.22)',
  },
  chipText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '900',
  },
  chipTextAdmin: {
    color: '#FFD369',
  },
  chipTextBlocked: {
    color: '#FF5A7A',
  },
  chipTextOk: {
    color: '#42D39E',
  },
  card: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  field: {
    gap: 8,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    color: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    fontSize: 14,
    fontWeight: '700',
  },
  inputRow: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputRowInput: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  segmentActive: {
    backgroundColor: 'rgba(122, 162, 247, 0.12)',
    borderColor: 'rgba(122, 162, 247, 0.26)',
  },
  segmentActiveRole: {
    backgroundColor: 'rgba(255, 211, 105, 0.14)',
    borderColor: 'rgba(255, 211, 105, 0.30)',
  },
  segmentText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  saveBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  saveText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '900',
  },
  dangerCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 90, 122, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 122, 0.14)',
    padding: 14,
    gap: 10,
  },
  dangerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  dangerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  blockBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  blockBtnDisabled: {
    backgroundColor: 'rgba(255, 90, 122, 0.10)',
    borderColor: 'rgba(255, 90, 122, 0.22)',
  },
  blockBtnEnabled: {
    backgroundColor: 'rgba(66, 211, 158, 0.10)',
    borderColor: 'rgba(66, 211, 158, 0.22)',
  },
  blockBtnText: {
    fontSize: 13,
    fontWeight: '900',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.text,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Colors.tint,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '900',
  },
  toast: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    zIndex: 50,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 26, 48, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  toastText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
});
