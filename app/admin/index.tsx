import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutDashboard, Package, Calendar, LogOut, FileText, Edit3, Users, MessageSquare, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/constants/i18n';
import { supabase } from '@/lib/supabase/client';

export default function AdminDashboard() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const logout = useAuthStore((state) => state.logout);

  const [stats, setStats] = useState<{
    totalCustomers: number;
    totalBookings: number;
    pendingBookings: number;
    openConversations: number;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    setStatsError(null);

    try {
      console.log('[admin-dashboard] loading stats from supabase');

      const [customersRes, bookingsRes, pendingRes, conversationsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('conversations').select('id', { count: 'exact', head: true }),
      ]);

      const firstError =
        customersRes.error ?? bookingsRes.error ?? pendingRes.error ?? conversationsRes.error;

      console.log('[admin-dashboard] stats responses', {
        customersError: customersRes.error?.message ?? null,
        bookingsError: bookingsRes.error?.message ?? null,
        pendingError: pendingRes.error?.message ?? null,
        conversationsError: conversationsRes.error?.message ?? null,
        customersCount: customersRes.count ?? null,
        bookingsCount: bookingsRes.count ?? null,
        pendingCount: pendingRes.count ?? null,
        conversationsCount: conversationsRes.count ?? null,
      });

      if (firstError) {
        setStatsError(firstError.message);
        setStats(null);
        return;
      }

      setStats({
        totalCustomers: customersRes.count ?? 0,
        totalBookings: bookingsRes.count ?? 0,
        pendingBookings: pendingRes.count ?? 0,
        openConversations: conversationsRes.count ?? 0,
      });
    } catch (e) {
      console.error('[admin-dashboard] unexpected stats load error', e);
      setStatsError('Unexpected error loading stats. Please try again.');
      setStats(null);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/welcome');
  };

  const totalCustomers = stats?.totalCustomers ?? 0;
  const totalBookings = stats?.totalBookings ?? 0;
  const pendingBookings = stats?.pendingBookings ?? 0;
  const openConversations = stats?.openConversations ?? 0;

  const menuItems = useMemo(
    () => [
      {
        title: t('adminCustomers'),
        icon: Users,
        route: '/admin/customers',
        color: '#E91E63',
        description: 'Manage users & profiles',
      },
      {
        title: t('adminBookings'),
        icon: Calendar,
        route: '/admin/bookings',
        color: '#FF9800',
        description: 'View and manage bookings',
        badge: pendingBookings > 0 ? pendingBookings : undefined,
      },
      {
        title: t('adminMessages'),
        icon: MessageSquare,
        route: '/admin/messages',
        color: '#2196F3',
        description: 'Chat with customers',
        badge: openConversations > 0 ? openConversations : undefined,
      },
      {
        title: 'AI Settings',
        icon: Sparkles,
        route: '/admin/ai',
        color: '#10B981',
        description: 'Configure chat AI behavior',
      },
      {
        title: t('adminServices'),
        icon: LayoutDashboard,
        route: '/admin/services',
        color: '#4CAF50',
        description: 'Manage service categories',
      },
      {
        title: t('adminPackages'),
        icon: Package,
        route: '/admin/packages',
        color: '#9C27B0',
        description: 'Manage travel packages',
      },
      {
        title: t('adminBlogs'),
        icon: FileText,
        route: '/admin/blogs',
        color: '#673AB7',
        description: 'Manage blog posts',
      },
      {
        title: t('adminContent'),
        icon: Edit3,
        route: '/admin/content',
        color: '#607D8B',
        description: 'Edit static content',
      },
      {
        title: 'Hero Slider',
        icon: ImageIcon,
        route: '/admin/hero',
        color: '#E91E63',
        description: 'Manage homepage slider',
      },
      {
        title: 'App Images',
        icon: ImageIcon,
        route: '/admin/images',
        color: '#FF5722',
        description: 'Manage backgrounds & global images',
      },
    ],
    [openConversations, pendingBookings, t]
  );


  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>{t('adminDashboard')}</Text>
        <Text style={styles.subtitle}>Manage your application content</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            {isLoadingStats ? (
              <ActivityIndicator color={Colors.tint} />
            ) : (
              <Text style={styles.statValue} testID="admin-stat-total-customers">
                {totalCustomers}
              </Text>
            )}
            <Text style={styles.statLabel}>{t('totalCustomers')}</Text>
          </View>
          <View style={styles.statBox}>
            {isLoadingStats ? (
              <ActivityIndicator color={Colors.tint} />
            ) : (
              <Text style={styles.statValue} testID="admin-stat-total-bookings">
                {totalBookings}
              </Text>
            )}
            <Text style={styles.statLabel}>{t('activeBookings')}</Text>
          </View>
          <View style={styles.statBox}>
            {isLoadingStats ? (
              <ActivityIndicator color={Colors.tint} />
            ) : (
              <Text style={styles.statValue} testID="admin-stat-open-conversations">
                {openConversations}
              </Text>
            )}
            <Text style={styles.statLabel}>Chats</Text>
          </View>
        </View>

        {statsError ? (
          <TouchableOpacity
            style={styles.errorPill}
            onPress={loadStats}
            testID="admin-stats-error"
          >
            <Text style={styles.errorText} numberOfLines={2}>
              {statsError}
            </Text>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.grid}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.card}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
              <item.icon size={32} color={item.color} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDescription}>{item.description}</Text>
            </View>
            {item.badge ? (
              <View style={[styles.badge, typeof item.badge === 'string' ? { minWidth: 60 } : {}]}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={20} color={Colors.error} />
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 24,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#ffffff20',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  grid: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginTop: 24,
    marginBottom: 40,
    gap: 8,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  errorPill: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#8A1C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  retryText: {
    marginTop: 4,
    color: Colors.error,
    fontSize: 12,
    fontWeight: '700',
  },
});
