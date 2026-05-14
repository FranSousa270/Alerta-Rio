import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MapView, { Polygon, Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { useRouter } from 'expo-router';
import { dangerZones, DangerZone } from '@/data/zonaDePerigo';
import { User } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const PROXIMITY_KM = 10;

type NearbyZone = DangerZone & { distanceKm: number };

export default function HomeScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [nearbyZones, setNearbyZones] = useState<NearbyZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
  (async () => {
    try {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      setLocation(currentLocation);
      checkNearbyZones(currentLocation);
    } catch (error) {
      console.log('ERRO LOCATION:', error);
    } finally {
      setLoading(false);
    }
  })();
}, []);

  const checkNearbyZones = (currentLocation: Location.LocationObject) => {
    const userPoint = turf.point([
      currentLocation.coords.longitude,
      currentLocation.coords.latitude,
    ]);

    const nearby: NearbyZone[] = [];

    dangerZones.forEach((zone) => {
      const zoneCenter = turf.point(zone.center);
      const distanceKm = turf.distance(userPoint, zoneCenter, { units: 'kilometers' });

      if (distanceKm <= PROXIMITY_KM) {
        nearby.push({ ...zone, distanceKm });
      }
    });

    nearby.sort((a, b) => a.distanceKm - b.distanceKm);
    setNearbyZones(nearby);
  };

  const riskColor = (level: DangerZone['riskLevel']) => {
    switch (level) {
      case 'alto': return '#FF3B30';
      case 'medio': return '#FF9500';
      case 'baixo': return '#FFCC00';
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      
<View style={styles.header}>
  <TouchableOpacity style={styles.profileButton}>
    <User size={28} color="#2563EB" />
  </TouchableOpacity>
  <Text style={styles.title}>Alerta Rio</Text>
  <View style={styles.headerSpacer} />
</View>

      {/* Mini Mapa */}
      <View style={styles.mapContainer}>
        {loading ? (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Obtendo localização...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            initialRegion={{
              latitude: location?.coords.latitude ?? -22.9068,
              longitude: location?.coords.longitude ?? -43.1729,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                pinColor="#2563EB"
              />
            )}

            {dangerZones.map((zone) => (
              <Polygon
                key={zone.id}
                coordinates={zone.coordinates[0].map(([lng, lat]) => ({
                  latitude: lat,
                  longitude: lng,
                }))}
                fillColor={riskColor(zone.riskLevel) + '55'}
                strokeColor={riskColor(zone.riskLevel)}
                strokeWidth={2}
              />
            ))}
          </MapView>
        )}
      </View>

      {/* Botão Comece a Navegar */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/map')}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>Comece a navegar</Text>
      </TouchableOpacity>

      {/* Card de áreas próximas */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Atenção</Text>
        <Text style={styles.cardTitle}>
          Lugares que merecem atenção próximos de você
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.zoneList}>
          {loading ? (
            <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 12 }} />
          ) : nearbyZones.length === 0 ? (
            <View style={styles.safeContainer}>
              <Text style={styles.safeIcon}>✅</Text>
              <Text style={styles.safeText}>Sem áreas de risco próximas</Text>
              <Text style={styles.safeSubText}>
                Nenhuma área perigosa em um raio de {PROXIMITY_KM} km
              </Text>
            </View>
          ) : (
            nearbyZones.map((zone) => (
              <View key={zone.id} style={styles.zoneItem}>
                <View style={styles.zoneHeader}>
                  <View style={[styles.riskDot, { backgroundColor: riskColor(zone.riskLevel) }]} />
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneDistance}>
                    {zone.distanceKm.toFixed(1)} km
                  </Text>
                </View>
                <Text style={styles.zoneTags}>{zone.tags.join(', ')}</Text>
                <Text style={styles.zoneDescription} numberOfLines={2}>
                  {zone.description}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingTop: 52,
  paddingBottom: 12,
  paddingHorizontal: 16,
  backgroundColor: '#fff',
},
profileButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: '#f2f2f77f',
  justifyContent: 'center',
  alignItems: 'center',
},
profileIcon: {
  fontSize: 18,
},
title: {
  flex: 1,
  fontSize: 38,
  fontWeight: '700',
  color: '#2563EB',
  textAlign: 'center',
},
headerSpacer: {
  width: 36, // mesmo tamanho do botão de perfil para centralizar o título
},
  mapContainer: {
    height: 220,
    backgroundColor: '#E5E5EA',
  },
  map: { flex: 1 },
  mapPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  loadingText: { fontSize: 14, color: '#8E8E93' },
  button: {
    backgroundColor: '#2563EB',
    marginHorizontal: 36,
    marginTop: 60,
    marginBottom: 40,
    paddingVertical: 16,
    borderRadius: 6,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: { fontSize: 16, color: '#da0a0a', marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 12 },
  zoneList: { flex: 1 },
  safeContainer: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  safeIcon: { fontSize: 32 },
  safeText: { fontSize: 15, fontWeight: '600', color: '#1C1C1E' },
  safeSubText: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  zoneItem: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
    gap: 4,
  },
  zoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  zoneName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', flex: 1 },
  zoneDistance: { fontSize: 13, color: '#8E8E93' },
  zoneTags: { fontSize: 13, color: '#8E8E93', marginLeft: 18 },
  zoneDescription: { fontSize: 13, color: '#3C3C43', marginLeft: 18, lineHeight: 18 },
});