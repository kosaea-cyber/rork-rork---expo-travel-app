import React from 'react';
import { View, StyleSheet, ScrollView, StatusBar, SafeAreaView } from 'react-native';
import Colors from '@/constants/colors';
import Hero from '@/components/home/Hero';
import ServiceCategories from '@/components/home/ServiceCategories';
import FeaturedPackages from '@/components/home/FeaturedPackages';
import AirportSteps from '@/components/home/AirportSteps';
import HeaderLogo from '@/components/HeaderLogo';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
           <HeaderLogo />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Hero />
          <ServiceCategories />
          <FeaturedPackages />
          <AirportSteps />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: Colors.background,
    zIndex: 10,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
