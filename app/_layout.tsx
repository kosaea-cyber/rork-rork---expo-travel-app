import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { initI18n } from "@/constants/i18n";
import { StatusBar } from "expo-status-bar";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { user, isGuest, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initI18n();
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "auth";
    const isAuthenticated = user || isGuest;

    console.log('RootLayout Check:', { 
      segments, 
      inAuthGroup, 
      user: !!user, 
      isGuest, 
      isAuthenticated 
    });

    if (isLoading) return;

    // Hide splash screen once we know auth state
    SplashScreen.hideAsync();

    if (!isAuthenticated && !inAuthGroup) {
      console.log('Redirecting to Welcome');
      router.replace("/auth/welcome");
    } else if (user && inAuthGroup && !isGuest) {
      console.log('Redirecting to Home (Authenticated User in Auth Group)');
      router.replace("/(tabs)/home");
    }
  }, [user, isGuest, isLoading, segments]);

  if (isLoading) {
    return null; // Or a custom splash component
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" />
          <Slot />
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
