import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Briefcase, Calendar, User } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useI18nStore } from '@/constants/i18n';
import { Platform } from 'react-native';

export default function TabLayout() {
  const t = useI18nStore((state) => state.t);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.tint,
        tabBarInactiveTintColor: Colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color }) => <Home color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: t('tabServices'),
          tabBarIcon: ({ color }) => <Briefcase color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: t('tabBookings'),
          tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabAccount'),
          tabBarIcon: ({ color }) => <User color={color} size={24} />,
        }}
      />
      {/* Hide the index route if it exists from template */}
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
