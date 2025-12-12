import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, Dimensions, ScrollView, NativeScrollEvent, NativeSyntheticEvent, I18nManager } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useDataStore } from '@/store/dataStore';
import { HeroSlide } from '@/lib/db/types';
import { FileStorage } from '@/lib/db/files';

const { width } = Dimensions.get('window');
const SLIDER_HEIGHT = 500;

function HeroSlideItem({ slide, language, isRTL, router }: { slide: HeroSlide, language: any, isRTL: boolean, router: any }) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const u = await FileStorage.resolve(slide.imageUrl);
      setUri(u);
    };
    load();
  }, [slide.imageUrl]);

  if (!uri) return <View style={[styles.slide, { backgroundColor: '#1a1a1a' }]} />;

  return (
    <View style={styles.slide}>
      <ImageBackground
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(10, 25, 47, 0.95)']}
          style={styles.gradient}
        >
          <View style={[styles.content, isRTL && styles.contentRTL]}>
            <Text style={[styles.title, isRTL && styles.textRTL]}>
              {getLocalized(slide.title, language)}
            </Text>
            <Text style={[styles.subtitle, isRTL && styles.textRTL]}>
              {getLocalized(slide.subtitle, language)}
            </Text>
            <TouchableOpacity
              style={[styles.button, isRTL && styles.buttonRTL]}
              onPress={() => {
                  if (slide.ctaLink && slide.ctaLink.startsWith('/')) {
                       router.push(slide.ctaLink as any);
                  }
              }}
            >
              <Text style={styles.buttonText}>
                {getLocalized(slide.ctaLabel, language)}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

export default function Hero() {
  const router = useRouter();
  const { appContent, initData } = useDataStore();
  const language = useI18nStore((state) => state.language);
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [heroBg, setHeroBg] = useState<string | null>(null);

  useEffect(() => {
    initData();
  }, []);

  useEffect(() => {
    if (appContent?.images?.heroBackground) {
        FileStorage.resolve(appContent.images.heroBackground).then(setHeroBg);
    }
  }, [appContent]);

  // Filter active slides and sort by order
  const slides = (appContent?.heroSlides || [])
    .filter(s => s.isActive)
    .sort((a, b) => a.order - b.order);

  // Fallback to legacy single hero if no slides exist
  const hasSlides = slides.length > 0;
  
  // Auto-play logic
  useEffect(() => {
    if (!hasSlides) return;
    
    const interval = setInterval(() => {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= slides.length) {
        nextIndex = 0;
      }
      
      scrollViewRef.current?.scrollTo({
        x: nextIndex * width,
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [currentIndex, hasSlides, slides.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / width);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const isRTL = language === 'ar';

  if (!hasSlides) {
    // Legacy Single Hero View (Fallback)
    return (
      <View style={styles.container}>
        <ImageBackground
          source={{ uri: heroBg || 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80' }}
          style={styles.image}
        >
          <LinearGradient
            colors={['transparent', 'rgba(10, 25, 47, 0.9)']}
            style={styles.gradient}
          >
            <View style={[styles.content, isRTL && styles.contentRTL]}>
              <Text style={[styles.title, isRTL && styles.textRTL]}>{getLocalized(appContent.hero.title, language)}</Text>
              <Text style={[styles.subtitle, isRTL && styles.textRTL]}>{getLocalized(appContent.hero.subtitle, language)}</Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push('/(tabs)/services')}
              >
                <Text style={styles.buttonText}>{getLocalized(appContent.hero.buttonText, language)}</Text>
              </TouchableOpacity>
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
          <HeroSlideItem 
            key={slide.id} 
            slide={slide} 
            language={language} 
            isRTL={isRTL} 
            router={router} 
          />
        ))}
      </ScrollView>

      {/* Dots Indicator */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              currentIndex === index && styles.activeDot
            ]}
          />
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
  buttonRTL: {
     // button itself doesn't need RTL change if text is centered, but position is handled by contentRTL
  },
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
