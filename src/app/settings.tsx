import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
} from 'react-native';

export default function SettingsScreen() {
  const [vibration, setVibration] = useState(true);
  const [notifications, setNotifications] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Configurações
      </Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>
            Vibração nos alertas
          </Text>

          <Switch
            value={vibration}
            onValueChange={setVibration}
            trackColor={{
              false: '#D1D1D6',
              true: '#2563EB',
            }}
          />
        </View>

        <View style={styles.separator} />

        <View style={styles.row}>
          <Text style={styles.label}>
            Notificações
          </Text>

          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{
              false: '#D1D1D6',
              true: '#2563EB',
            }}
          />
        </View>
      </View>

      <View style={styles.aboutCard}>
        <Text style={styles.aboutTitle}>
          Sobre
        </Text>

        <Text style={styles.aboutText}>
          Alerta Rio v1.0
        </Text>

        <Text style={styles.aboutText}>
          Sistema de monitoramento de áreas de risco.
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

  title: {
    marginTop: 50,
    marginBottom: 24,
    fontSize: 34,
    fontWeight: '700',
    color: '#2563EB',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  separator: {
    height: 1,
    backgroundColor: '#F2F2F7',
    marginVertical: 16,
  },

  label: {
    fontSize: 15,
    color: '#1C1C1E',
    fontWeight: '500',
  },

  aboutCard: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },

  aboutTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    color: '#1C1C1E',
  },

  aboutText: {
    color: '#6B7280',
    marginBottom: 6,
  },
});