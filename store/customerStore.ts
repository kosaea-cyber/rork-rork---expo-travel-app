import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CustomerStatus = 'active' | 'suspended';
export type CustomerLanguage = 'en' | 'ar' | 'de';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  nationality: string;
  language: CustomerLanguage;
  status: CustomerStatus;
  registeredDate: string;
  bookingsCount: number;
  notes?: string;
}

interface CustomerState {
  customers: Customer[];
  isLoading: boolean;
  fetchCustomers: () => Promise<void>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  toggleCustomerStatus: (id: string) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

// Mock Data Generation
const generateMockCustomers = (): Customer[] => {
  const mocks: Customer[] = [
    {
      id: 'user_123',
      name: 'Ahmed Al-Kuwaiti',
      email: 'ahmed@example.com',
      phone: '+965 1234 5678',
      country: 'Kuwait',
      nationality: 'Kuwaiti',
      language: 'ar',
      status: 'active',
      registeredDate: '2023-11-15',
      bookingsCount: 3,
      notes: 'VIP client, prefers luxury transportation.',
    },
    {
      id: 'user_124',
      name: 'Sarah Schmidt',
      email: 'sarah.s@example.de',
      phone: '+49 151 1234567',
      country: 'Germany',
      nationality: 'German',
      language: 'de',
      status: 'active',
      registeredDate: '2024-01-20',
      bookingsCount: 1,
      notes: 'Interested in medical tourism packages.',
    },
    {
      id: 'user_125',
      name: 'John Smith',
      email: 'john.smith@example.com',
      phone: '+1 555 0123',
      country: 'USA',
      nationality: 'American',
      language: 'en',
      status: 'suspended',
      registeredDate: '2023-12-05',
      bookingsCount: 0,
      notes: 'Payment failed multiple times.',
    },
    {
      id: 'user_126',
      name: 'Fatima Al-Sayed',
      email: 'fatima@example.com',
      phone: '+971 50 123 4567',
      country: 'UAE',
      nationality: 'Emirati',
      language: 'ar',
      status: 'active',
      registeredDate: '2024-02-10',
      bookingsCount: 2,
    },
    {
      id: 'user_127',
      name: 'Hans Muller',
      email: 'hans.m@example.de',
      phone: '+49 170 9876543',
      country: 'Germany',
      nationality: 'German',
      language: 'de',
      status: 'active',
      registeredDate: '2024-03-01',
      bookingsCount: 1,
    },
  ];
  return mocks;
};

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  isLoading: false,

  fetchCustomers: async () => {
    set({ isLoading: true });
    try {
      const stored = await AsyncStorage.getItem('db_customers');
      if (stored) {
        set({ customers: JSON.parse(stored), isLoading: false });
      } else {
        const mock = generateMockCustomers();
        await AsyncStorage.setItem('db_customers', JSON.stringify(mock));
        set({ customers: mock, isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateCustomer: async (id, updates) => {
    const newCustomers = get().customers.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    set({ customers: newCustomers });
    await AsyncStorage.setItem('db_customers', JSON.stringify(newCustomers));
  },

  toggleCustomerStatus: async (id) => {
    const newCustomers: Customer[] = get().customers.map((c) =>
      c.id === id
        ? { ...c, status: (c.status === 'active' ? 'suspended' : 'active') as CustomerStatus }
        : c
    );
    set({ customers: newCustomers });
    await AsyncStorage.setItem('db_customers', JSON.stringify(newCustomers));
  },

  deleteCustomer: async (id) => {
    const newCustomers = get().customers.filter((c) => c.id !== id);
    set({ customers: newCustomers });
    await AsyncStorage.setItem('db_customers', JSON.stringify(newCustomers));
  },
}));
