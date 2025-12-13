import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  I18nManager,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useI18nStore, type Language } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { supabase } from '@/lib/supabase/client';

const { width } = Dimensions.get('window');
const SLIDER_HEIGHT = 500;

type HeroSlideRow = {
  id: string;
  image_url: string;
  title_en: string | null;
  title_ar: string | null;
  title_de: string | null;
  subtitle_en: string | null;
  subtitle_ar: string | null;
  subtitle_de: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
};

function getLocalizedDbField(row: HeroSlideRow, field: 'title' | 'subtitle', lang: Language): string {
  const key = `${field}_${lang}` as const;
  const fallbackEn = `${field}_en` as const;
  const value = row[key as keyof HeroSlideRow];
  if (typeof value === 'string' && value.length > 0) return value;
  const en = row[fallbackEn as keyof HeroSlideRow];
  if (typeof en === 'string' && en.length > 0) return en;
  return '';
}

function HeroSlideItem({
  slide,
  language,
  isRTL,
  router,
}: {
  slide: HeroSlideRow;
  language: Language;
  isRTL: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const title = useMemo(() => getLocalizedDbField(slide, 'title', language), [slide, language]);
  const subtitle = useMemo(() => getLocalizedDbField(slide, 'subtitle', language), [slide, language]);

  return (
    <View style={styles.slide}>
      <ImageBackground source={{ uri: slide.image_url }} style={styles.image} resizeMode="cover">
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(10, 25, 47, 0.95)']}
          style={styles.gradient}
        >
          <View style={[styles.content, isRTL && styles.contentRTL]}>
            <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={3}>
              {title}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]} numberOfLines={4}>
              {subtitle}
            </Text>

            <TouchableOpacity testID={`hero-slide-${slide.id}-cta`} style={[styles.button, isRTL && styles.buttonRTL]} onPress={() => router.push('/(tabs)/services')}>
              <Text style={styles.buttonText}>Explore</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

export default function Hero() {
  const router = useRouter();
  const language = useI18nStore((state) => state.language);
  const { appContent, initData } = useDataStore();

  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [slides, setSlides] = useState<HeroSlideRow[]>([]);
  const [slidesLoading, setSlidesLoading] = useState<boolean>(true);
  const [slidesError, setSlidesError] = useState<string | null>(null);

  useEffect(() => {
    initData();
  }, [initData]);

  const loadSlides = useCallback(async () => {
    setSlidesLoading(true);
    setSlidesError(null);

    try {
      const res = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      console.log('[hero] hero_slides query', {
        count: res.data?.length ?? 0,
        error: res.error?.message ?? null,
      });

      if (res.error) {
        setSlides([]);
        setSlidesError(res.error.message);
        return;
      }

      setSlides((res.data ?? []) as HeroSlideRow[]);
    } catch (e) {
      console.error('[hero] hero_slides query unexpected error', e);
      setSlides([]);
      setSlidesError('Failed to load hero slides.');
    } finally {
      setSlidesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  const hasSlides = slides.length > 0;
  const isRTL = language === 'ar';

  useEffect(() => {
    if (!hasSlides) return;

    const interval = setInterval(() => {
      const nextIndex = currentIndex + 1 >= slides.length ? 0 : currentIndex + 1;
      scrollViewRef.current?.scrollTo({ x: nextIndex * width, animated: true });
      setCurrentIndex(nextIndex);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentIndex, hasSlides, slides.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    if (index !== currentIndex) setCurrentIndex(index);
  };

  if (!hasSlides) {
    return (
      <View style={styles.container}>
        <ImageBackground
          source={{
            uri:
              appContent?.images?.heroBackground ||
              'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
          }}
          style={styles.image}
        >
          <LinearGradient colors={['transparent', 'rgba(10, 25, 47, 0.9)']} style={styles.gradient}>
            <View style={[styles.content, isRTL && styles.contentRTL]}>
              <Text style={[styles.title, isRTL && styles.textRTL]}>{appContent ? appContent.hero.title[language] : ''}</Text>
              <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{appContent ? appContent.hero.subtitle[language] : ''}</Text>

              <TouchableOpacity testID="hero-fallback-cta" style={styles.button} onPress={() => router.push('/(tabs)/services')}>
                <Text style={styles.buttonText}>{appContent ? appContent.hero.buttonText[language] : 'Explore'}</Text>
              </TouchableOpacity>

              {slidesLoading ? (
                <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color={Colors.tint} />
                  <Text style={{ color: '#cfd8e3' }}>Loading slides…</Text>
                </View>
              ) : slidesError ? (
                <TouchableOpacity testID="hero-retry" onPress={loadSlides} style={{ marginTop: 12 }}>
                  <Text style={{ color: Colors.tint, fontWeight: '700' }}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        bounces={false}
        style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }}
      >
        {slides.map((slide) => (
          <HeroSlideItem key={slide.id} slide={slide} language={language} isRTL={isRTL} router={router} />
        ))}
      </ScrollView>

      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View key={index} style={[styles.dot, currentIndex === index && styles.activeDot]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: SLIDER_HEIGHT,
    width: width,
    position: 'relative',
  },
  slide: {
    width: width,
    height: SLIDER_HEIGHT,
  },
  image: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  gradient: {
    height: '100%',
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 60,
  },
  content: {
    gap: 16,
    maxWidth: width * 0.9,
    alignItems: 'flex-start',
  },
  contentRTL: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 8,
    textAlign: 'left',
  },
  subtitle: {
    color: '#e0e0e0',
    fontSize: 18,
    marginTop: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 6,
    textAlign: 'left',
    lineHeight: 26,
  },
  textRTL: {
    textAlign: 'right',
  },
  button: {
    backgroundColor: Colors.tint,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 50,
    marginTop: 10,
    shadowColor: Colors.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonRTL: {},
  buttonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  pagination: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    width: 24,
    backgroundColor: Colors.tint,
  },
});
