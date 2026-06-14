import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  Modal,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  FlatList,
  Alert,
  PanResponder,
} from 'react-native';
import { MapPin, Clock } from 'lucide-react-native';
import MapView, { Polygon, Marker, Polyline, PROVIDER_GOOGLE, Camera } from 'react-native-maps';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { useRouter } from 'expo-router';
import { dangerZones, DangerZone } from '@/data/zonaDePerigo';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

const ALERT_RADIUS_KM = 1;
const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY!;

type AlertZone = DangerZone & { distanceKm: number };
type Coordinate = { latitude: number; longitude: number };
type GeocodingSuggestion = { label: string; lat: number; lng: number };

type UserReport = {
  id: string;
  topLeft: Coordinate;
  bottomRight: Coordinate;
  confirmations: string[];
  createdBy: string;
  createdAt: any;
};

function reportColor(confirmations: number): string {
  if (confirmations >= 10) return '#FF3B30';
  if (confirmations >= 1)  return '#FF9500';
  return '#FFCC00';
}

function rectCoordinates(topLeft: Coordinate, bottomRight: Coordinate): Coordinate[] {
  return [
    { latitude: topLeft.latitude,     longitude: topLeft.longitude },
    { latitude: topLeft.latitude,     longitude: bottomRight.longitude },
    { latitude: bottomRight.latitude, longitude: bottomRight.longitude },
    { latitude: bottomRight.latitude, longitude: topLeft.longitude },
  ];
}

function getBearing(from: Coordinate, to: Coordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export default function MapScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const db = getFirestore();

  const mapRef = useRef<MapView>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const alertedZones = useRef<Set<string>>(new Set());
  const alertedReports = useRef<Set<string>>(new Set());
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLocation = useRef<Coordinate | null>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [destination, setDestination] = useState<Coordinate | null>(null);
  const [destinationName, setDestinationName] = useState('');
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodingSuggestion[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [activeAlert, setActiveAlert] = useState<AlertZone | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Estados de report ──────────────────────────────────────────────────
  const [drawingMode, setDrawingMode]               = useState(false);
  const [drawingCorner1, setDrawingCorner1]         = useState<Coordinate | null>(null);
  const [drawingCorner2, setDrawingCorner2]         = useState<Coordinate | null>(null);
  const [isDragging, setIsDragging]                 = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedReport, setSelectedReport]         = useState<UserReport | null>(null);
  const [userReports, setUserReports]               = useState<UserReport[]>([]);
  const userReportsRef = useRef<UserReport[]>([]);
  const [savingReport, setSavingReport]             = useState(false);

  // alerta de proximidade de report
  const [reportAlert, setReportAlert]               = useState<UserReport | null>(null);
  const [reportAlertVisible, setReportAlertVisible] = useState(false);
  const reportFadeAnim = useRef(new Animated.Value(0)).current;

  // refs para o PanResponder (evita stale closures)
  const drawingModeRef = useRef(false);
  const corner1Ref     = useRef<Coordinate | null>(null);
  const isDraggingRef  = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // mantém os refs sincronizados com o state
  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);

  // ─── PanResponder: segura → arrasta → solta ─────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      // só captura o gesto se estiver em modo desenho
      onStartShouldSetPanResponder: () => drawingModeRef.current,
      onMoveShouldSetPanResponder:  () => drawingModeRef.current,

      onPanResponderGrant: (evt) => {
        if (!drawingModeRef.current) return;

        const { pageX, pageY } = evt.nativeEvent;

        // longPress de 400ms para iniciar o desenho
        longPressTimer.current = setTimeout(async () => {
          if (!mapRef.current) return;

          const coord = await mapRef.current.coordinateForPoint({ x: pageX, y: pageY });
          if (!coord) return;

          corner1Ref.current = coord;
          isDraggingRef.current = true;

          setDrawingCorner1(coord);
          setDrawingCorner2(null);
          setIsDragging(true);
          Vibration.vibrate(80);
        }, 400);
      },

      onPanResponderMove: async (evt) => {
        if (!isDraggingRef.current || !mapRef.current) return;

        const { pageX, pageY } = evt.nativeEvent;
        const coord = await mapRef.current.coordinateForPoint({ x: pageX, y: pageY });
        if (!coord) return;

        setDrawingCorner2(coord);
      },

      onPanResponderRelease: () => {
        // cancela o timer se soltar antes de 400ms
        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        if (!isDraggingRef.current) return;

        isDraggingRef.current = false;
        setIsDragging(false);

        // só abre o modal se o retângulo tiver tamanho mínimo
        if (corner1Ref.current) {
          setReportModalVisible(true);
        }
      },

      onPanResponderTerminate: () => {
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
        isDraggingRef.current = false;
        setIsDragging(false);
      },
    })
  ).current;

  // ─── Listener Firestore ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reports'), (snapshot) => {
      const reports: UserReport[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<UserReport, 'id'>),
      }));
      setUserReports(reports);
      userReportsRef.current = reports;
    });
    return () => unsub();
  }, []);

  // ─── Cores zonas estáticas ───────────────────────────────────────────────
  const riskColor = (level: DangerZone['riskLevel']) => {
    switch (level) {
      case 'alto':  return '#FF3B30';
      case 'medio': return '#FF9500';
      case 'baixo': return '#FFCC00';
    }
  };

  // ─── Câmera 3D ───────────────────────────────────────────────────────────
  const activar3DCamera = useCallback((userCoord: Coordinate, nextCoord?: Coordinate) => {
    const heading = nextCoord ? getBearing(userCoord, nextCoord) : 0;
    const camera: Camera = { center: userCoord, pitch: 50, heading, zoom: 19, altitude: 400 };
    mapRef.current?.animateCamera(camera, { duration: 1000 });
  }, []);

  const exitarModo3D = useCallback((userCoord: Coordinate) => {
    const camera: Camera = { center: userCoord, pitch: 0, heading: 0, zoom: 14, altitude: 2000 };
    mapRef.current?.animateCamera(camera, { duration: 800 });
  }, []);

  // ─── Alerta zona estática ────────────────────────────────────────────────
  const showAlert = useCallback((zone: AlertZone) => {
    setActiveAlert(zone);
    setModalVisible(true);
    Vibration.vibrate([0, 600, 200, 600, 200, 600]);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const dismissAlert = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      setActiveAlert(null);
      setShowDetails(false);
    });
  };

  const checkProximity = useCallback((loc: Location.LocationObject) => {
    const userPoint = turf.point([loc.coords.longitude, loc.coords.latitude]);
    dangerZones.forEach((zone) => {
      if (alertedZones.current.has(zone.id)) return;
      const polygon = turf.polygon(zone.coordinates);
      const distanceKm = turf.pointToPolygonDistance(userPoint, polygon, { units: 'kilometers' });
      if (distanceKm <= ALERT_RADIUS_KM) {
        alertedZones.current.add(zone.id);
        showAlert({ ...zone, distanceKm });
      }
    });
  }, [showAlert]);

  const showReportAlert = useCallback((report: UserReport) => {
    setReportAlert(report);
    setReportAlertVisible(true);
    Vibration.vibrate([0, 400, 150, 400]);
    Animated.timing(reportFadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [reportFadeAnim]);

  const dismissReportAlert = useCallback(() => {
    Animated.timing(reportFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setReportAlertVisible(false);
      setReportAlert(null);
    });
  }, [reportFadeAnim]);

  const checkReportProximity = useCallback((loc: Location.LocationObject) => {
    const userPoint = turf.point([loc.coords.longitude, loc.coords.latitude]);
    userReportsRef.current.forEach((report) => {
      // não alerta o próprio criador do report
      if (report.createdBy === user?.uid) return;
      if (alertedReports.current.has(report.id)) return;

      // calcula o centro do retângulo para medir distância
      const centerLat = (report.topLeft.latitude + report.bottomRight.latitude) / 2;
      const centerLng = (report.topLeft.longitude + report.bottomRight.longitude) / 2;
      const reportPoint = turf.point([centerLng, centerLat]);

      const distanceKm = turf.distance(userPoint, reportPoint, { units: 'kilometers' });
      if (distanceKm <= 1) {
        alertedReports.current.add(report.id);
        showReportAlert(report);
      }
    });
  }, [showReportAlert, user?.uid]);

  // ─── Localização ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(initial);
      lastLocation.current = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      centerMap(initial);
      checkProximity(initial);
      checkReportProximity(initial);

      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLoc) => {
          const newCoord: Coordinate = { latitude: newLoc.coords.latitude, longitude: newLoc.coords.longitude };
          setLocation(newLoc);
          checkProximity(newLoc);
          checkReportProximity(newLoc);
          if (is3DMode) {
            const nextPoint = routeCoords.find((coord) => {
              const d = turf.distance(
                turf.point([newCoord.longitude, newCoord.latitude]),
                turf.point([coord.longitude, coord.latitude]),
                { units: 'meters' }
              );
              return d > 20;
            });
            activar3DCamera(newCoord, nextPoint);
          }
          lastLocation.current = newCoord;
        }
      );
    })();
    return () => locationSub.current?.remove();
  }, [checkProximity, checkReportProximity, is3DMode, routeCoords, activar3DCamera]);

  const centerMap = (loc: Location.LocationObject) => {
    mapRef.current?.animateToRegion({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }, 800);
  };

  // ─── Geocoding ───────────────────────────────────────────────────────────
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    setShowSuggestions(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) { setSuggestions([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(
          `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(text)}&boundary.country=BR&size=5&lang=pt`
        );
        const json = await res.json();
        if (json.features) {
          const results: GeocodingSuggestion[] = json.features.map((f: any) => ({
            label: f.properties.label,
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }));
          setSuggestions(results);
        }
      } catch (err) {
        console.error('Erro no geocoding:', err);
      } finally {
        setLoadingSearch(false);
      }
    }, 500);
  };

  const handleSelectSuggestion = (suggestion: GeocodingSuggestion) => {
    const dest: Coordinate = { latitude: suggestion.lat, longitude: suggestion.lng };
    setDestination(dest);
    setDestinationName(suggestion.label);
    setSearchText(suggestion.label);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchRoute(dest);
  };

  // ─── Rota ────────────────────────────────────────────────────────────────
  const fetchRoute = async (dest: Coordinate) => {
    if (!location) return;
    setLoadingRoute(true);
    setRouteCoords([]);
    try {
      const { latitude, longitude } = location.coords;
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${longitude},${latitude}&end=${dest.longitude},${dest.latitude}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.features || json.features.length === 0) return;
      const coords: Coordinate[] = json.features[0].geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
      );
      setRouteCoords(coords);
      const userCoord: Coordinate = { latitude, longitude };
      const secondPoint = coords[1] ?? dest;
      setIs3DMode(true);
      setTimeout(() => { activar3DCamera(userCoord, secondPoint); }, 400);
    } catch (err) {
      console.error('Erro ao buscar rota:', err);
    } finally {
      setLoadingRoute(false);
    }
  };

  const clearDestination = () => {
    setDestination(null);
    setDestinationName('');
    setSearchText('');
    setRouteCoords([]);
    setSuggestions([]);
    setIs3DMode(false);
    if (location) {
      exitarModo3D({ latitude: location.coords.latitude, longitude: location.coords.longitude });
    }
  };

  // ─── Report: ações ───────────────────────────────────────────────────────
  const cancelDrawing = () => {
    setDrawingMode(false);
    drawingModeRef.current = false;
    setDrawingCorner1(null);
    setDrawingCorner2(null);
    corner1Ref.current = null;
    setIsDragging(false);
    isDraggingRef.current = false;
    setReportModalVisible(false);
  };

  const saveReport = async () => {
    if (!drawingCorner1 || !drawingCorner2 || !user) return;
    setSavingReport(true);
    try {
      await addDoc(collection(db, 'reports'), {
        topLeft: drawingCorner1,
        bottomRight: drawingCorner2,
        confirmations: [],
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      cancelDrawing();
    } catch (err) {
      console.error('Erro ao salvar report:', err);
      Alert.alert('Erro', 'Não foi possível salvar o report. Tente novamente.');
    } finally {
      setSavingReport(false);
    }
  };

  const handleReportPress = (report: UserReport) => {
    if (drawingMode) return; // ignora toque em reports enquanto desenha
    if (report.createdBy === user?.uid) {
      Alert.alert('Aviso', 'Você não pode confirmar seu próprio report.');
      return;
    }
    if (report.confirmations.includes(user?.uid ?? '')) {
      Alert.alert('Aviso', 'Você já confirmou este report.');
      return;
    }
    setSelectedReport(report);
    setConfirmModalVisible(true);
  };

  const confirmReport = async () => {
    if (!selectedReport || !user) return;
    try {
      await updateDoc(doc(db, 'reports', selectedReport.id), {
        confirmations: arrayUnion(user.uid),
      });
      setConfirmModalVisible(false);
      setSelectedReport(null);
    } catch (err) {
      console.error('Erro ao confirmar report:', err);
      Alert.alert('Erro', 'Não foi possível confirmar. Tente novamente.');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsBuildings={true}
        pitchEnabled={!drawingMode}
        rotateEnabled={!drawingMode}
        scrollEnabled={!drawingMode}
        zoomEnabled={!drawingMode}
        initialRegion={{
          latitude: location?.coords.latitude ?? -22.9068,
          longitude: location?.coords.longitude ?? -43.1729,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Usuário */}
        {location && (
          <Marker
            coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.userDot}>
              <View style={styles.userDotInner} />
            </View>
          </Marker>
        )}

        {/* Destino */}
        {destination && (
          <Marker coordinate={destination} pinColor="#2563EB" title={destinationName} />
        )}

        {/* Rota */}
        {routeCoords.length > 0 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor="rgba(0,0,0,0.15)" strokeWidth={7} />
            <Polyline coordinates={routeCoords} strokeColor="#2563EB" strokeWidth={5} />
          </>
        )}

        {/* Zonas de perigo estáticas */}
        {dangerZones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.coordinates[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            fillColor={riskColor(zone.riskLevel) + '40'}
            strokeColor={riskColor(zone.riskLevel)}
            strokeWidth={2.5}
          />
        ))}

        {/* Preview do retângulo sendo desenhado */}
        {drawingCorner1 && drawingCorner2 && (
          <Polygon
            coordinates={rectCoordinates(drawingCorner1, drawingCorner2)}
            fillColor="rgba(255, 204, 0, 0.25)"
            strokeColor="#FFCC00"
            strokeWidth={2.5}
          />
        )}
        {/* Marcador do primeiro canto */}
        {drawingCorner1 && (
          <Marker coordinate={drawingCorner1} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.cornerMarker} />
          </Marker>
        )}

        {/* Reports salvos no Firestore */}
        {userReports.map((report) => {
          const count = report.confirmations.length;
          const color = reportColor(count);
          return (
            <Polygon
              key={report.id}
              coordinates={rectCoordinates(report.topLeft, report.bottomRight)}
              fillColor={color + '40'}
              strokeColor={color}
              strokeWidth={2.5}
              tappable
              onPress={() => handleReportPress(report)}
            />
          );
        })}
      </MapView>

      {/* Overlay do PanResponder — só existe em modo desenho, fica sobre o mapa */}
      {drawingMode && (
        <View
          style={StyleSheet.absoluteFill}
          {...panResponder.panHandlers}
        />
      )}

      {/* ─── Painel superior ─────────────────────────────────────────── */}
      <View style={styles.topPanel}>
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => { clearDestination(); router.replace('/'); }}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Para onde você vai?"
              placeholderTextColor="#8E8E93"
              value={searchText}
              onChangeText={handleSearchChange}
              returnKeyType="search"
              autoCorrect={false}
            />
            {loadingSearch && (
              <ActivityIndicator size="small" color="#8E8E93" style={styles.searchSpinner} />
            )}
            {searchText.length > 0 && !loadingSearch && (
              <TouchableOpacity style={styles.clearButton} onPress={clearDestination}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionList}>
            <FlatList
              data={suggestions}
              keyExtractor={(_, i) => i.toString()}
              keyboardShouldPersistTaps="always"
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionIcon}>
                    <MapPin size={20} color="#8E8E93" />
                  </Text>
                  <Text style={styles.suggestionText} numberOfLines={2}>{item.label}</Text>
                  <View style={styles.suggestionMeta}>
                    <Clock size={13} color="#8E8E93" />
                    {location && (
                      <Text style={styles.suggestionDistance}>
                        {turf.distance(
                          turf.point([location.coords.longitude, location.coords.latitude]),
                          turf.point([item.lng, item.lat]),
                          { units: 'kilometers' }
                        ).toFixed(1)} km
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      {/* Loading rota */}
      {loadingRoute && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.loadingText}>Calculando rota...</Text>
        </View>
      )}

      {/* Botão sair do modo 3D */}
      {is3DMode && (
        <TouchableOpacity style={styles.exit3DButton} onPress={clearDestination}>
          <Text style={styles.exit3DText}>✕  Cancelar rota</Text>
        </TouchableOpacity>
      )}

      {/* Botão recentrar */}
      {!is3DMode && !drawingMode && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => location && centerMap(location)}
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* Botão reportar área */}
      {!is3DMode && (
        <TouchableOpacity
          style={[styles.reportButton, drawingMode && styles.reportButtonActive]}
          onPress={() => {
            if (drawingMode) {
              cancelDrawing();
            } else {
              setDrawingMode(true);
              drawingModeRef.current = true;
              setDrawingCorner1(null);
              setDrawingCorner2(null);
            }
          }}
        >
          <Text style={styles.reportButtonIcon}>⚠</Text>
          <Text style={styles.reportButtonText}>
            {drawingMode ? 'Cancelar' : 'Reportar área'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Instrução durante o desenho */}
      {drawingMode && (
        <View style={styles.drawingHint}>
          <Text style={styles.drawingHintText}>
            {!isDragging
              ? '✋ Segure e arraste para desenhar a área'
              : '📐 Arraste para ajustar o tamanho'}
          </Text>
        </View>
      )}

      {/* Legenda */}
      {!is3DMode && !drawingMode && (
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Zonas de risco</Text>
          {[
            { label: 'Alto risco',  color: '#FF3B30' },
            { label: 'Médio risco', color: '#FF9500' },
            { label: 'Recém reportada', color: '#FFCC00' },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Barra de navegação modo 3D */}
      {is3DMode && destination && (
        <View style={styles.navigationBar}>
          <View style={styles.navInfo}>
            <Text style={styles.navDestLabel}>Destino</Text>
            <Text style={styles.navDestName} numberOfLines={1}>{destinationName}</Text>
          </View>
          <View style={styles.navDivider} />
          <View style={styles.navStats}>
            <Text style={styles.navStatsLabel}>Pontos na rota</Text>
            <Text style={styles.navStatsValue}>{routeCoords.length}</Text>
          </View>
        </View>
      )}

      {/* ─── Modal alerta zona estática ──────────────────────────────── */}
      <Modal visible={modalVisible} transparent animationType="none" onRequestClose={dismissAlert}>
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          {showDetails ? (
            <View style={styles.alertCard}>
              <View style={styles.detailsHeaderRow}>
                <Text style={styles.detailsInfoIcon}>ⓘ</Text>
                <Text style={styles.detailsTitle}>{activeAlert?.name}</Text>
              </View>
              <Text style={styles.detailsDescription}>{activeAlert?.description}</Text>
              <TouchableOpacity style={styles.btnFechar} onPress={() => { setShowDetails(false); dismissAlert(); }}>
                <Text style={styles.btnFecharText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.alertCard}>
              <TouchableOpacity style={styles.closeX} onPress={dismissAlert}>
                <Text style={styles.closeXText}>×</Text>
              </TouchableOpacity>
              <Text style={styles.alertCardTitle}>Área de risco</Text>
              <Text style={styles.alertCardSubtitle}>
                Fique atento ao redor, você está próximo de{' '}
                <Text style={styles.alertCardName}>{activeAlert?.name}</Text>.
              </Text>
              <View style={styles.alertCardButtons}>
                <TouchableOpacity style={styles.btnInfo} onPress={() => setShowDetails(true)}>
                  <Text style={styles.btnInfoText}>Mais informações</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnFechar} onPress={dismissAlert}>
                  <Text style={styles.btnFecharText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </Modal>

      {/* ─── Modal confirmar report (criador) ────────────────────────── */}
      <Modal visible={reportModalVisible} transparent animationType="slide" onRequestClose={cancelDrawing}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertCardTitle}>Confirmar report</Text>
            <Text style={styles.alertCardSubtitle}>
              Você marcou uma área suspeita no mapa. Outros usuários poderão confirmar este report.
            </Text>
            <View style={styles.reportLegendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#FFCC00' }]} />
              <Text style={styles.reportLegendText}>Pendente (0 confirmações)</Text>
            </View>
            <View style={styles.reportLegendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9500' }]} />
              <Text style={styles.reportLegendText}>Perigo médio (1–9 confirmações)</Text>
            </View>
            <View style={styles.reportLegendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#FF3B30' }]} />
              <Text style={styles.reportLegendText}>Perigo máximo (10+ confirmações)</Text>
            </View>
            <View style={styles.alertCardButtons}>
              <TouchableOpacity style={styles.btnInfo} onPress={saveReport} disabled={savingReport}>
                {savingReport
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnInfoText}>Enviar report</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnFechar} onPress={cancelDrawing}>
                <Text style={styles.btnFecharText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal confirmar report (outros usuários) ─────────────────── */}
      <Modal visible={confirmModalVisible} transparent animationType="slide" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertCard}>
            <TouchableOpacity style={styles.closeX} onPress={() => setConfirmModalVisible(false)}>
              <Text style={styles.closeXText}>×</Text>
            </TouchableOpacity>
            <Text style={styles.alertCardTitle}>⚠ Área reportada</Text>
            <Text style={styles.alertCardSubtitle}>
              Outro usuário marcou esta área como suspeita.{' '}
              <Text style={{ fontWeight: '700' }}>
                {selectedReport?.confirmations.length ?? 0} pessoa(s)
              </Text>{' '}
              já confirmaram este report.
            </Text>
            <Text style={styles.alertCardSubtitle}>
              Você confirma que esta área é perigosa?
            </Text>
            <View style={styles.alertCardButtons}>
              <TouchableOpacity style={styles.btnInfo} onPress={confirmReport}>
                <Text style={styles.btnInfoText}>Sim, confirmar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnFechar} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.btnFecharText}>Não</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal alerta de proximidade de report ────────────────── */}
      <Modal visible={reportAlertVisible} transparent animationType="none" onRequestClose={dismissReportAlert}>
        <Animated.View style={[styles.modalOverlay, { opacity: reportFadeAnim }]}>
          <View style={styles.alertCard}>
            <TouchableOpacity style={styles.closeX} onPress={dismissReportAlert}>
              <Text style={styles.closeXText}>×</Text>
            </TouchableOpacity>

            <Text style={styles.alertCardTitle}>⚠ Área reportada por usuários</Text>

            <Text style={styles.alertCardSubtitle}>
              Você está a menos de 1 km de uma área marcada como suspeita.{' '}
              <Text style={{ fontWeight: '700', color: reportColor(reportAlert?.confirmations.length ?? 0) }}>
                {reportAlert?.confirmations.length ?? 0} pessoa(s)
              </Text>{' '}
              confirmaram este report.
            </Text>

            <Text style={styles.alertCardSubtitle}>
              Você confirma que esta área é perigosa?
            </Text>

            <View style={styles.alertCardButtons}>
              <TouchableOpacity
                style={styles.btnInfo}
                onPress={async () => {
                  if (!reportAlert || !user) return;
                  if (reportAlert.createdBy === user.uid) return;
                  if (reportAlert.confirmations.includes(user.uid)) {
                    dismissReportAlert();
                    return;
                  }
                  try {
                    await updateDoc(doc(db, 'reports', reportAlert.id), {
                      confirmations: arrayUnion(user.uid),
                    });
                  } catch (err) {
                    console.error('Erro ao confirmar:', err);
                  }
                  dismissReportAlert();
                }}
                disabled={
                  !reportAlert ||
                  reportAlert.confirmations.includes(user?.uid ?? '')
                }
              >
                <Text style={styles.btnInfoText}>
                  {reportAlert?.confirmations.includes(user?.uid ?? '')
                    ? 'Já confirmado'
                    : 'Sim, confirmar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnFechar} onPress={dismissReportAlert}>
                <Text style={styles.btnFecharText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  topPanel: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: {
    backgroundColor: '#fff', width: 50, height: 50, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  backIcon: { fontSize: 20, color: '#1C1C1E' },
  inputWrapper: {
    flex: 1, height: 50, backgroundColor: '#fff', borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  input: { flex: 1, fontSize: 15, color: '#1C1C1E', height: '100%' },
  clearButton: { padding: 4, marginLeft: 4 },
  clearIcon: { fontSize: 14, color: '#8E8E93' },
  searchSpinner: { marginLeft: 6 },

  suggestionList: {
    backgroundColor: '#fff', borderRadius: 12, marginTop: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5, overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  suggestionIcon: { fontSize: 16, marginTop: 1 },
  suggestionText: { flex: 1, fontSize: 14, color: '#1C1C1E', lineHeight: 20 },
  separator: { height: 0.5, backgroundColor: '#E5E5EA', marginLeft: 40 },
  suggestionMeta: { alignItems: 'center', gap: 2 },
  suggestionDistance: { fontSize: 13, color: '#8E8E93' },

  loadingOverlay: {
    position: 'absolute', top: 130, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  loadingText: { color: '#fff', fontSize: 13 },

  exit3DButton: {
    position: 'absolute', top: 130, alignSelf: 'center',
    backgroundColor: '#1C1C1E', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  exit3DText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  recenterButton: {
    position: 'absolute', bottom: 140, right: 16,
    backgroundColor: '#fff', width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  recenterIcon: { fontSize: 22, color: '#2563EB' },

  reportButton: {
    position: 'absolute', bottom: 80, right: 16,
    backgroundColor: '#2563EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  reportButtonActive: { backgroundColor: '#FF3B30' },
  reportButtonIcon: { fontSize: 16, color: '#ff0000', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  reportButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  drawingHint: {
    position: 'absolute', bottom: 140, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  drawingHintText: { color: '#fff', fontSize: 13 },

  cornerMarker: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#FFCC00', borderWidth: 2, borderColor: '#fff',
  },

  legend: {
    position: 'absolute', bottom: 40, left: 16,
    backgroundColor: '#fff', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3, gap: 6,
  },
  legendTitle: { fontSize: 12, fontWeight: '600', color: '#1C1C1E', marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: '#3C3C43' },

  navigationBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 36,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  navInfo: { flex: 1 },
  navDestLabel: { fontSize: 12, color: '#8E8E93', marginBottom: 2 },
  navDestName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  navDivider: { width: 1, height: 40, backgroundColor: '#E5E5EA', marginHorizontal: 20 },
  navStats: { alignItems: 'center' },
  navStatsLabel: { fontSize: 11, color: '#8E8E93' },
  navStatsValue: { fontSize: 20, fontWeight: '700', color: '#2563EB' },

  userDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  userDotInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#2563EB', borderWidth: 2, borderColor: '#fff',
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  alertCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 10,
    gap: 10, width: '100%',
  },
  closeX: { position: 'absolute', top: 12, right: 16, zIndex: 10 },
  closeXText: { fontSize: 22, color: '#8E8E93', lineHeight: 24 },
  alertCardTitle: { fontSize: 18, fontWeight: '700', color: '#1C1C1E', marginTop: 4 },
  alertCardSubtitle: { fontSize: 14, color: '#3C3C43', lineHeight: 20 },
  alertCardName: { fontWeight: '700', color: '#1C1C1E' },
  alertCardButtons: { flexDirection: 'row', gap: 30, marginTop: 4 },
  btnInfo: {
    flex: 1, backgroundColor: '#2563EB', borderRadius: 8,
    paddingVertical: 10, alignItems: 'center',
  },
  btnInfoText: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center', marginHorizontal: 15 },
  btnFechar: {
    backgroundColor: '#f5150a', borderRadius: 4, paddingVertical: 5,
    alignItems: 'center', paddingHorizontal: 10,
    alignSelf: 'flex-end', marginTop: 5,
  },
  btnFecharText: { color: '#fff', fontSize: 18, fontWeight: '600' },

  detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  detailsInfoIcon: { fontSize: 22, color: '#1C1C1E' },
  detailsTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  detailsDescription: { fontSize: 14, color: '#3C3C43', lineHeight: 20 },

  reportLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportLegendText: { fontSize: 13, color: '#3C3C43' },
});