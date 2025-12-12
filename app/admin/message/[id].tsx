import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { Message, Conversation } from '@/lib/db/types';

export default function ConversationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    const c = await db.conversations.findById(id);
    if (c) {
      setConversation(c);
      const m = await db.messages.findMany(c.id);
      setMessages(m);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !conversation) return;
    
    await db.messages.create({
      id: Math.random().toString(36).substr(2, 9),
      conversationId: conversation.id,
      senderId: 'admin',
      text: inputText,
      createdAt: new Date().toISOString(),
      isRead: false
    });
    
    setInputText('');
    loadData();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAdmin = item.senderId === 'admin';
    return (
      <View style={[styles.bubbleWrapper, isAdmin ? styles.adminWrapper : styles.userWrapper]}>
        <View style={[styles.bubble, isAdmin ? styles.adminBubble : styles.userBubble]}>
          <Text style={[styles.msgText, isAdmin ? styles.adminText : styles.userText]}>{item.text}</Text>
          <Text style={[styles.timeText, isAdmin ? styles.adminTime : styles.userTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{conversation?.subject || 'Chat'}</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a reply..."
            placeholderTextColor="#999"
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Send color="white" size={20} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: Colors.tint,
    padding: 20,
    paddingTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleWrapper: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  adminWrapper: {
    justifyContent: 'flex-end',
  },
  userWrapper: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  adminBubble: {
    backgroundColor: Colors.tint,
    borderBottomRightRadius: 4,
  },
  userBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  msgText: {
    fontSize: 16,
  },
  adminText: {
    color: 'white',
  },
  userText: {
    color: '#333',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  adminTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  userTime: {
    color: '#999',
  },
  inputBar: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
