import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDataStore } from '@/store/dataStore';
import { useI18nStore, getLocalized } from '@/constants/i18n';
import { useEffect } from 'react';

function Accordion({ item }: { item: any }) {
  const [expanded, setExpanded] = React.useState(false);
  const language = useI18nStore((state) => state.language);

  return (
    <View style={styles.accordionContainer}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setExpanded(!expanded)}
      >
        <View style={{ flex: 1 }}>
            <Text style={styles.category}>{getLocalized(item.category, language)}</Text>
            <Text style={styles.question}>{getLocalized(item.question, language)}</Text>
        </View>
        {expanded ? (
          <ChevronUp color={Colors.tint} size={20} />
        ) : (
          <ChevronDown color={Colors.textSecondary} size={20} />
        )}
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.body}>
          <Text style={styles.answer}>{getLocalized(item.answer, language)}</Text>
        </View>
      )}
    </View>
  );
}

export default function FAQScreen() {
  const { faqs, initData } = useDataStore();

  useEffect(() => {
    initData();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={faqs}
        renderItem={({ item }) => <Accordion item={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  accordionContainer: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  category: {
    color: Colors.tint,
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  question: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  body: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border, // Optional separator
  },
  answer: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
