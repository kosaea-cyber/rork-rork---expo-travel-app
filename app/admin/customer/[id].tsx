import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Globe, Trash2, Ban, CheckCircle } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { User, Booking, Conversation } from '@/lib/db/types';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, b, c] = await Promise.all([
        db.users.findUnique({ id }),
        db.bookings.findMany({ customerId: id }),
        db.conversations.findMany({ customerId: id }),
      ]);
      setUser(u || null);
      setBookings(b);
      setConversations(c);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await db.users.update(user.id, { status: newStatus });
    loadData();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.tint} /></View>;
  if (!user) return <View style={styles.center}><Text>User not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.headerName}>{user.name}</Text>
          <Text style={styles.headerEmail}>{user.email}</Text>
          <View style={[styles.statusBadge, { backgroundColor: user.status === 'active' ? '#4CAF50' : '#E91E63' }]}>
            <Text style={styles.statusText}>{user.status}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Details</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Phone size={18} color="#666" />
            <Text style={styles.rowText}>{user.phone || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <MapPin size={18} color="#666" />
            <Text style={styles.rowText}>{user.country || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Globe size={18} color="#666" />
            <Text style={styles.rowText}>{user.nationality || 'N/A'} ({user.preferredLanguage})</Text>
          </View>
          <View style={styles.row}>
            <Calendar size={18} color="#666" />
            <Text style={styles.rowText}>Joined: {new Date(user.createdAt).toLocaleDateString()}</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: user.status === 'active' ? '#FFF0F0' : '#F0FFF4' }]} 
              onPress={handleToggleStatus}
            >
              {user.status === 'active' ? <Ban size={18} color="#E91E63" /> : <CheckCircle size={18} color="#4CAF50" />}
              <Text style={{ color: user.status === 'active' ? '#E91E63' : '#4CAF50', fontWeight: '600' }}>
                {user.status === 'active' ? 'Suspend Account' : 'Activate Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bookings ({bookings.length})</Text>
        {bookings.length === 0 ? (
          <Text style={styles.emptyText}>No bookings found</Text>
        ) : (
          bookings.map(booking => (
            <TouchableOpacity 
              key={booking.id} 
              style={styles.itemCard}
              onPress={() => router.push(`/admin/booking/${booking.id}`)}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{booking.reference}</Text>
                <Text style={[styles.itemStatus, { color: booking.status === 'confirmed' ? '#4CAF50' : '#FF9800' }]}>
                  {booking.status}
                </Text>
              </View>
              <Text style={styles.itemSub}>{new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      <View style={[styles.section, { marginBottom: 40 }]}>
        <Text style={styles.sectionTitle}>Conversations ({conversations.length})</Text>
        {conversations.length === 0 ? (
          <Text style={styles.emptyText}>No conversations found</Text>
        ) : (
          conversations.map(conv => (
            <TouchableOpacity 
              key={conv.id} 
              style={styles.itemCard}
              onPress={() => router.push(`/admin/message/${conv.id}`)}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{conv.subject}</Text>
                <Text style={styles.itemStatus}>{conv.status}</Text>
              </View>
              <Text style={styles.itemSub}>Last active: {new Date(conv.lastMessageAt).toLocaleDateString()}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: Colors.tint,
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  headerContent: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  statusBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    fontSize: 16,
    color: '#333',
  },
  actions: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  itemCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: Colors.tint,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontWeight: '600',
    fontSize: 16,
  },
  itemStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  itemSub: {
    color: '#666',
    fontSize: 12,
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
});
