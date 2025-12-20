import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useMemo } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { initI18n } from "@/constants/i18n";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/lib/supabase/client";
import { useAppImagesStore } from "@/store/appImagesStore";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const { user, isGuest, isLoading, checkAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    initI18n();
    checkAuth();

    try {
      void useAppImagesStore.getState().refresh();
    } catch (e) {
      console.error('[RootLayout] appImagesStore refresh failed (non-blocking)', e);
    }

    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[RootLayout] supabase auth state change', {
        event,
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      const guestMode = useAuthStore.getState().isGuest;

      if (!session && !guestMode) {
        console.log('[RootLayout] session is null -> redirect to /auth/welcome');
        router.replace('/auth/welcome' as any);
      }

      try {
        await checkAuth();
      } catch (e) {
        console.error('[RootLayout] checkAuth failed after auth state change', e);
      }
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [checkAuth, router]);

  const primaryRouteSegment = useMemo(() => {
    const segs = Array.isArray(segments) ? segments : [];
    const firstNonGroup = segs.find((s) => !(s.startsWith("(") && s.endsWith(")")));
    return firstNonGroup ?? null;
  }, [segments]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = primaryRouteSegment === ('auth' as any);
    const isAuthenticated = Boolean(user) || Boolean(isGuest);

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
      router.replace('/auth/welcome' as any);
    } else if (user && inAuthGroup && !isGuest) {
      console.log('Redirecting to Home (Authenticated User in Auth Group)');
      router.replace('/(tabs)/home' as any);
    }
  }, [user, isGuest, isLoading, segments, primaryRouteSegment, router]);

  if (isLoading) {
    return null; // Or a custom splash component
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <ErrorBoundary>
          <Slot />
        </ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
