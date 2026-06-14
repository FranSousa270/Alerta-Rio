import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { User, Mail, MapPin, AlertTriangle, Shield } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';
import { dangerZones } from '@/data/zonaDePerigo';

type ReportStats = {
  total: number;
  pending: number;   // 0 confirmações
  medium: number;    // 1-9 confirmações
  high: number;      // 10+ confirmações
  myReports: number; // criados pelo usuário logado
};

export default function ProfileScreen() {
  const { user } = useAuth();
  const db = getFirestore();

  const [reportStats, setReportStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const docs = snapshot.docs.map((d) => d.data());
      setReportStats({
        total:     docs.length,
        pending:   docs.filter((d) => d.confirmations.length === 0).length,
        medium:    docs.filter((d) => d.confirmations.length >= 1 && d.confirmations.length < 10).length,
        high:      docs.filter((d) => d.confirmations.length >= 10).length,
        myReports: docs.filter((d) => d.createdBy === user?.uid).length,
      });
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const staticZones = dangerZones.length;
  const staticByLevel = {
    alto:  dangerZones.filter((z) => z.riskLevel === 'alto').length,
    medio: dangerZones.filter((z) => z.riskLevel === 'medio').length,
    baixo: dangerZones.filter((z) => z.riskLevel === 'baixo').length,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meu Perfil</Text>
      </View>

      {/* Card de perfil */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <User size={42} color="#fff" />
        </View>
        <Text style={styles.name}>{user?.displayName || 'Usuário'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Info de email */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Mail size={20} color="#2563EB" />
          </View>
          <View>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Zonas monitoradas (estáticas) */}
      <View style={styles.statsCard}>
        <View style={styles.cardTitleRow}>
          <Shield size={18} color="#2563EB" />
          <Text style={styles.cardTitle}>Zonas monitoradas</Text>
        </View>

        <View style={styles.statMainRow}>
          <Text style={styles.statBigNumber}>{staticZones}</Text>
          <Text style={styles.statBigLabel}>áreas cadastradas</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statRow}>
          <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} /> 
          <Text style={styles.statText}>Alto risco</Text>
          <Text style={styles.statValue}>{staticByLevel.alto}</Text>
        </View>
        <View style={styles.statRow}>
          <View style= {[styles.dot, { backgroundColor: '#FF9500' }]} />
          <Text style={styles.statText}>Médio risco</Text>
          <Text style={styles.statValue}>{staticByLevel.medio}</Text>
        </View>
        <View style={styles.statRow}>
          <View style={[styles.dot, { backgroundColor: '#FFCC00' }]} />
          <Text style={styles.statText}>Baixo risco</Text>
          <Text style={styles.statValue}>{staticByLevel.baixo}</Text>
        </View>
      </View>

      {/* Reports de usuários (Firestore) */}
      <View style={styles.statsCard}>
        <View style={styles.cardTitleRow}>
          <AlertTriangle size={18} color="#FF9500" />
          <Text style={styles.cardTitle}>Reports de usuários</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginTop: 12 }} />
        ) : (
          <>
            <View style={styles.statMainRow}>
              <Text style={styles.statBigNumber}>{reportStats?.total ?? 0}</Text>
              <Text style={styles.statBigLabel}>reports no total</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: '#FFCC00' }]} />
              <Text style={styles.statText}>Pendentes</Text>
              <Text style={styles.statValue}>{reportStats?.pending ?? 0}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: '#FF9500' }]} />
              <Text style={styles.statText}>Perigo médio</Text>
              <Text style={styles.statValue}>{reportStats?.medium ?? 0}</Text>
            </View>
            <View style={styles.statRow}>
              <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.statText}>Perigo máximo</Text>
              <Text style={styles.statValue}>{reportStats?.high ?? 0}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.statRow}>
              <MapPin size={14} color="#2563EB" />
              <Text style={[styles.statText, { marginLeft: 6 }]}>Seus reports</Text>
              <Text style={[styles.statValue, { color: '#2563EB' }]}>
                {reportStats?.myReports ?? 0}
              </Text>
            </View>
          </>
        )}
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
    marginTop: 16,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  statBigNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  statBigLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E5EA',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statText: {
    flex: 1,
    fontSize: 14,
    color: '#3C3C43',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
    dot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  marginRight: 10,
},
  },
); 