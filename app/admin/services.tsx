import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Image } from 'react-native';
import { useDataStore } from '@/store/dataStore';
import { ServiceCategory } from '@/lib/db/types';
import Colors from '@/constants/colors';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react-native';
import LocalizedInput from '@/components/admin/LocalizedInput';

export default function AdminServices() {
  const { services, updateService, addService, deleteService } = useDataStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCategory | null>(null);


  const handleEdit = (service: ServiceCategory) => {
    setEditingService(service);
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingService({
      id: Math.random().toString(36).substr(2, 9),
      title: { en: '', ar: '', de: '' },
      description: { en: '', ar: '', de: '' },
      icon: 'HelpCircle',
      slug: '',
      image: '',
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    await deleteService(id);
  };

  const handleSave = async () => {
    if (!editingService) return;
    
    if (services.find(s => s.id === editingService.id)) {
      await updateService(editingService);
    } else {
      await addService(editingService);
    }
    setModalVisible(false);
    setEditingService(null);
  };

  const renderItem = ({ item }: { item: ServiceCategory }) => (
    <View style={styles.card}>
      {item.image ? <Image source={{ uri: item.image }} style={styles.image} /> : <View style={[styles.image, { backgroundColor: '#ddd' }]} />}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{item.title.en.toUpperCase()}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
              <Edit2 size={20} color={Colors.tint} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
              <Trash2 size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.id}>ID: {item.id}</Text>
        <Text style={styles.desc}>Image URL: {item.image}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
        <Plus size={24} color="white" />
        <Text style={styles.addBtnText}>Add New Service</Text>
      </TouchableOpacity>

      <FlatList
        data={services}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
         <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {services.find(s => s.id === editingService?.id) ? 'Edit Service' : 'New Service'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <X size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.form}>
            {editingService && (
              <>
                <Text style={styles.label}>Service ID</Text>
                <TextInput
                  style={[styles.input, services.find(s => s.id === editingService.id) && { opacity: 0.5 }]}
                  value={editingService.id}
                  onChangeText={t => !services.find(s => s.id === editingService.id) && setEditingService({ ...editingService, id: t })}
                  editable={!services.find(s => s.id === editingService.id)}
                  placeholder="unique-id"
                />

                <LocalizedInput
                  label="Title (Display Name)"
                  value={editingService.title}
                  onChange={(val) => setEditingService({ ...editingService, title: val })}
                />

                <LocalizedInput
                  label="Description"
                  value={editingService.description}
                  onChange={(val) => setEditingService({ ...editingService, description: val })}
                  multiline
                />

                <Text style={styles.label}>Image URL</Text>
                <TextInput
                  style={styles.input}
                  value={editingService.image || ''}
                  onChangeText={t => setEditingService({ ...editingService, image: t })}
                />
                
                <Text style={styles.label}>Slug</Text>
                <TextInput
                  style={styles.input}
                  value={editingService.slug}
                  onChangeText={t => setEditingService({ ...editingService, slug: t })}
                />
                
                <Text style={styles.label}>Icon Name (Lucide)</Text>
                <TextInput
                  style={styles.input}
                  value={editingService.icon}
                  onChangeText={t => setEditingService({ ...editingService, icon: t })}
                />
                
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Save size={20} color="white" />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
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
  image: {
    width: '100%',
    height: 150,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  id: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  desc: {
    fontSize: 12,
    color: '#666',
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
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  note: {
    color: Colors.tint,
    fontSize: 12,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  saveBtn: {
    backgroundColor: Colors.tint,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginTop: 32,
    gap: 8,
  },
  saveBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
