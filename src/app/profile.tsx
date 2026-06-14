import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { User, Mail } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meu Perfil</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <User size={42} color="#fff" />
        </View>

        <Text style={styles.name}>
          {user?.displayName || 'Usuário'}
        </Text>

        <Text style={styles.email}>
          {user?.email}
        </Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Mail size={20} color="#2563EB" />
          </View>

          <View>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>
              {user?.email}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.cardTitle}>
          Estatísticas
        </Text>

        <Text style={styles.statText}>
          Alertas recebidos: 12
        </Text>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    padding: 20,
  },

  header: {
    marginTop: 50,
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#2563EB',
  },

  profileCard: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  name: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },

  email: {
    color: '#DDE8FF',
    marginTop: 4,
  },

  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EFF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  label: {
    color: '#8E8E93',
    fontSize: 13,
  },

  value: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },

  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
    color: '#1C1C1E',
  },

  statText: {
    fontSize: 15,
    marginBottom: 10,
    color: '#3C3C43',
  },
});