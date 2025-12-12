import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Image } from 'react-native';
import { useDataStore } from '@/store/dataStore';
import { Package, LocalizedString } from '@/lib/db/types';
import Colors from '@/constants/colors';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react-native';
import LocalizedInput from '@/components/admin/LocalizedInput';

export default function AdminPackages() {
  const { packages, updatePackage, addPackage, deletePackage, initData } = useDataStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  useEffect(() => {
    initData();
  }, []);

  const handleEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingPackage({
      id: Math.random().toString(36).substr(2, 9),
      categoryId: 'wellness', // default
      title: { en: '', ar: '', de: '' },
      description: { en: '', ar: '', de: '' },
      duration: { en: '', ar: '', de: '' },
      price: { en: '', ar: '', de: '' },
      features: [],
      included: [],
      imageUrl: '',
      isFeatured: false,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!editingPackage) return;
    
    if (packages.find(p => p.id === editingPackage.id)) {
      await updatePackage(editingPackage);
    } else {
      await addPackage(editingPackage);
    }
    setModalVisible(false);
    setEditingPackage(null);
  };

  const handleDelete = async (id: string) => {
    await deletePackage(id);
  };

  const renderItem = ({ item }: { item: Package }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
        ) : null}
        <View style={styles.headerTextContainer}>
            <Text style={styles.cardTitle}>{item.title.en}</Text>
            <Text style={styles.price}>{item.price?.en}</Text>
        </View>
      </View>
      <Text style={styles.category}>{item.categoryId}</Text>
      <Text style={styles.description} numberOfLines={2}>{item.description.en}</Text>
      
      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => handleEdit(item)}>
          <Edit2 size={20} color={Colors.tint} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={() => handleDelete(item.id)}>
          <Trash2 size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
        <Plus size={24} color="white" />
        <Text style={styles.addBtnText}>Add New Package</Text>
      </TouchableOpacity>

      <FlatList
        data={packages}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {packages.find(p => p.id === editingPackage?.id) ? 'Edit Package' : 'New Package'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            {editingPackage && (
              <>
                <LocalizedInput
                  label="Title"
                  value={editingPackage.title}
                  onChange={(val) => setEditingPackage({ ...editingPackage, title: val })}
                />

                <Text style={styles.label}>Category ID</Text>
                <TextInput
                  style={styles.input}
                  value={editingPackage.categoryId}
                  onChangeText={t => setEditingPackage({ ...editingPackage, categoryId: t })}
                />

                <LocalizedInput
                  label="Price"
                  value={editingPackage.price || {en:'', ar:'', de:''}}
                  onChange={(val) => setEditingPackage({ ...editingPackage, price: val })}
                />

                <LocalizedInput
                  label="Duration"
                  value={editingPackage.duration}
                  onChange={(val) => setEditingPackage({ ...editingPackage, duration: val })}
                />

                <Text style={styles.label}>Image URL</Text>
                <TextInput
                  style={styles.input}
                  value={editingPackage.imageUrl || ''}
                  onChangeText={t => setEditingPackage({ ...editingPackage, imageUrl: t })}
                />

                <LocalizedInput
                  label="Description"
                  value={editingPackage.description}
                  onChange={(val) => setEditingPackage({ ...editingPackage, description: val })}
                  multiline
                />

                <LocalizedInput
                  label="Features (One per line)"
                  multiline
                  placeholder="Feature 1\nFeature 2"
                  value={{
                    en: editingPackage.features.map(f => f.en).join('\n'),
                    ar: editingPackage.features.map(f => f.ar).join('\n'),
                    de: editingPackage.features.map(f => f.de).join('\n'),
                  }}
                  onChange={(val) => {
                    const en = val.en.split('\n');
                    const ar = val.ar.split('\n');
                    const de = val.de.split('\n');
                    const max = Math.max(en.length, ar.length, de.length);
                    const features: LocalizedString[] = [];
                    for(let i=0; i<max; i++) {
                      if (en[i]?.trim() || ar[i]?.trim() || de[i]?.trim()) {
                        features.push({
                          en: en[i] || '',
                          ar: ar[i] || '',
                          de: de[i] || ''
                        });
                      }
                    }
                    setEditingPackage({ ...editingPackage, features });
                  }}
                />
                
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Save size={20} color="white" />
                  <Text style={styles.saveBtnText}>Save Package</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 4,
  },
  cardImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#eee',
  },
  headerTextContainer: {
    padding: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.tint,
  },
  category: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  iconBtn: {
    padding: 8,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.tint,
    margin: 16,
    padding: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 32,
    marginBottom: 32,
    gap: 8,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
