import { useState, useEffect } from 'react';
import { Image, ImageProps, ImageStyle, StyleProp, View, StyleSheet } from 'react-native';
import { FileStorage } from '@/lib/db/files';

interface AsyncImageProps extends Omit<ImageProps, 'source'> {
  uri?: string;
  style?: StyleProp<ImageStyle>;
  source?: any; // Fallback or direct source
}

export function AsyncImage({ uri, source, style, ...props }: AsyncImageProps) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    
    const load = async () => {
      if (uri) {
        if (uri.startsWith('http') || uri.startsWith('file://') || uri.startsWith('data:')) {
            if (active) setResolvedUri(uri);
        } else {
            const url = await FileStorage.resolve(uri);
            if (active) setResolvedUri(url);
        }
      }
    };
    
    load();
    return () => { active = false; };
  }, [uri]);

  const finalSource = resolvedUri ? { uri: resolvedUri } : source;

  if (!finalSource) {
      return <View style={[style, styles.placeholder]} />;
  }

  return <Image source={finalSource} style={style} {...props} />;
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#f0f0f0',
  }
});
