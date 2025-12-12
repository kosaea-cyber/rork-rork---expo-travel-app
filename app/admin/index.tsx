import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { LayoutDashboard, Package, Calendar, LogOut, FileText, Edit3, Users, MessageSquare, Image as ImageIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/constants/i18n';
import { trpc } from '@/lib/trpc';

export default function AdminDashboard() {
  const router = useRouter();
  const t = useI18nStore((state) => state.t);
  const logout = useAuthStore((state) => state.logout);
  
  // Use trpc hooks
  const customersQuery = trpc.customers.list.useQuery();
  const bookingsQuery = trpc.bookings.listAllBookings.useQuery();
  const conversationsQuery = trpc.chat.listAllConversations.useQuery();

  const customers = customersQuery.data || [];
  const bookings = bookingsQuery.data || [];
  const conversations = conversationsQuery.data || [];

  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const openConversations = conversations.filter(c => c.status === 'open').length;
  const newCustomersThisMonth = customers.filter(c => {
    const d = new Date(c.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const menuItems = [
    {
      title: t('adminCustomers'),
      icon: Users,
      route: '/admin/customers',
      color: '#E91E63',
      description: 'Manage users & profiles',
      badge: newCustomersThisMonth > 0 ? `${newCustomersThisMonth} new` : undefined
    },
    {
      title: t('adminBookings'),
      icon: Calendar,
      route: '/admin/bookings',
      color: '#FF9800',
      description: 'View and manage bookings',
      badge: pendingBookings > 0 ? pendingBookings : undefined
    },
    {
      title: t('adminMessages'),
      icon: MessageSquare,
      route: '/admin/messages',
      color: '#2196F3',
      description: 'Chat with customers',
      badge: openConversations > 0 ? openConversations : undefined
    },
    {
      title: t('adminServices'),
      icon: LayoutDashboard,
      route: '/admin/services',
      color: '#4CAF50',
      description: 'Manage service categories'
    },
    {
      title: t('adminPackages'),
      icon: Package,
      route: '/admin/packages',
      color: '#9C27B0', 
      description: 'Manage travel packages'
    },
    {
      title: t('adminBlogs'),
      icon: FileText,
      route: '/admin/blogs',
      color: '#673AB7',
      description: 'Manage blog posts'
    },
    {
      title: t('adminContent'),
      icon: Edit3,
      route: '/admin/content',
      color: '#607D8B',
      description: 'Edit static content'
    },
    {
      title: 'Hero Slider',
      icon: ImageIcon,
      route: '/admin/hero',
      color: '#E91E63',
      description: 'Manage homepage slider'
    },
    {
      title: 'App Images',
      icon: ImageIcon,
      route: '/admin/images',
      color: '#FF5722',
      description: 'Manage backgrounds & global images'
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.welcome}>{t('adminDashboard')}</Text>
        <Text style={styles.subtitle}>Manage your application content</Text>
        
        <View style={styles.statsRow}>
           <View style={styles.statBox}>
             <Text style={styles.statValue}>{customers.length}</Text>
             <Text style={styles.statLabel}>{t('totalCustomers')}</Text>
           </View>
           <View style={styles.statBox}>
             <Text style={styles.statValue}>{bookings.length}</Text>
             <Text style={styles.statLabel}>{t('activeBookings')}</Text>
           </View>
           <View style={styles.statBox}>
             <Text style={styles.statValue}>{conversations.length}</Text>
             <Text style={styles.statLabel}>Chats</Text>
           </View>
        </View>
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
});
