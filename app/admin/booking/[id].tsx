import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, User as UserIcon, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { db } from '@/lib/db';
import { Booking, User, Package } from '@/lib/db/types';

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [customer, setCustomer] = useState<User | null>(null);
  const [pkg, setPkg] = useState<Package | null>(null); // Optional package
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const b = await db.bookings.findById(id);
    if (b) {
      setBooking(b);
      const u = await db.users.findUnique({ id: b.customerId });
      if (u) setCustomer(u);
      
      if (b.packageId) {
        // Find package (assuming we have a method or manual search)
        const packages = await db.packages.findMany();
        const p = packages.find(pkg => pkg.id === b.packageId);
        if (p) setPkg(p);
      }
    }
    setLoading(false);
  };

  const updateStatus = async (status: 'confirmed' | 'cancelled' | 'completed') => {
    if (!booking) return;
    await db.bookings.update(booking.id, { status });
    loadData();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.tint} /></View>;
  if (!booking) return <View style={styles.center}><Text>Booking not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking {booking.reference}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusRow}>
             <View style={[styles.badge, { backgroundColor: booking.status === 'confirmed' ? '#4CAF50' : booking.status === 'cancelled' ? '#F44336' : '#FF9800' }]}>
               <Text style={styles.badgeText}>{booking.status}</Text>
             </View>
             
             <View style={styles.actions}>
               {booking.status === 'pending' && (
                 <>
                   <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={() => updateStatus('confirmed')}>
                     <CheckCircle size={16} color="white" />
                     <Text style={styles.btnText}>Confirm</Text>
                   </TouchableOpacity>
                   <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => updateStatus('cancelled')}>
                     <XCircle size={16} color="white" />
                     <Text style={styles.btnText}>Cancel</Text>
                   </TouchableOpacity>
                 </>
               )}
               {booking.status === 'confirmed' && (
                  <TouchableOpacity style={[styles.btn, styles.btnComplete]} onPress={() => updateStatus('completed')}>
                     <CheckCircle size={16} color="white" />
                     <Text style={styles.btnText}>Complete</Text>
                   </TouchableOpacity>
               )}
             </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          {customer ? (
            <TouchableOpacity onPress={() => router.push(`/admin/customer/${customer.id}`)} style={styles.userRow}>
              <UserIcon size={20} color={Colors.tint} />
              <View>
                <Text style={styles.userName}>{customer.name}</Text>
                <Text style={styles.userEmail}>{customer.email}</Text>
              </View>
            </TouchableOpacity>
          ) : (
             <Text>Unknown Customer</Text>
          )}
        </View>

        <View style={styles.card}>
           <Text style={styles.sectionTitle}>Details</Text>
           <View style={styles.detailRow}>
             <Calendar size={18} color="#666" />
             <Text>{new Date(booking.startDate).toLocaleDateString()} to {new Date(booking.endDate).toLocaleDateString()}</Text>
           </View>
           <View style={styles.detailRow}>
             <UserIcon size={18} color="#666" />
             <Text>{booking.travelers} Travelers</Text>
           </View>
           {pkg && (
             <View style={styles.pkgBox}>
               <Text style={styles.pkgTitle}>Package: {pkg.title.en}</Text>
               <Text style={styles.pkgDesc}>{pkg.duration.en} | {pkg.price?.en}</Text>
             </View>
           )}
           {booking.notes && (
             <View style={styles.notesBox}>
               <Text style={styles.notesLabel}>Notes:</Text>
               <Text style={styles.notesText}>{booking.notes}</Text>
             </View>
           )}
        </View>
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
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  statusRow: {
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  btnConfirm: { backgroundColor: '#4CAF50' },
  btnCancel: { backgroundColor: '#F44336' },
  btnComplete: { backgroundColor: Colors.tint },
  btnText: { color: 'white', fontWeight: '600', fontSize: 12 },
  
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userName: { fontWeight: '600', fontSize: 16 },
  userEmail: { color: '#666', fontSize: 14 },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  pkgBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: Colors.tint,
  },
  pkgTitle: { fontWeight: '600' },
  pkgDesc: { fontSize: 12, color: '#666' },
  notesBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
  },
  notesLabel: { fontSize: 12, color: '#F57C00', fontWeight: 'bold' },
  notesText: { color: '#333', fontSize: 14, marginTop: 4 },
});
