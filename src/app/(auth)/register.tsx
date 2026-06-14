import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff } from 'lucide-react-native';

const { height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length === 0) return '';
    if (digits.length < 3) return `(${digits}`;
    if (digits.length < 8) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleRegister = async () => {
    if (!name || !phone || !email || !password || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha todos os campos.');
      return;
    }
  if (password !== confirmPassword) {
    Alert.alert('Atenção', 'As senhas não coincidem.');
    return;
  }
  if (password.length < 6) {
    Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
    return;
  }

  setLoading(true);
  try {
    // 1. Espera o processo de cadastro e criação no Firestore
    await signUp({ name, phone, email, password });
    
    // 2. ADICIONE ESTA LINHA PARA REDIRECIONAR:
    setTimeout(() => {
    router.replace('/');
  }, 500);

  } catch (error: any) {
    const msg =
      error.code === 'auth/email-already-in-use'
        ? 'Este e-mail já está cadastrado.'
        : 'Erro ao criar conta. Tente novamente.';
    Alert.alert('Erro', msg);
  } finally {
    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 20}
    >
      {/* Mapa só na parte superior */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          initialRegion={{
            latitude: -22.9068,
            longitude: -43.1729,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
        />
      </View>

      {/* Card do formulário com sombra */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.scrollView}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Cadastro</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Nome completo"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="(99) 99999-0000"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={phone}
              onChangeText={(text) => setPhone(formatPhoneNumber(text))}
              keyboardType="phone-pad"
              maxLength={15}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Senha"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPassword ? <Eye style={{ color: '#fff' }} /> : <EyeOff style={{ color: '#fff' }} />}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Confirme a senha"
                placeholderTextColor="rgba(255,255,255,0.7)"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showConfirm ? <Eye style={{ color: '#fff' }} /> : <EyeOff style={{ color: '#fff' }} />}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Cadastrar</Text>
              }
            </TouchableOpacity>
          </View>

          
        </View>
        <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.loginLink}>Possui conta? Faça o login</Text>
          </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },

  // Mapa só no topo — altura fixa de 30% da tela
  mapContainer: {
    height: height * 0.16,
    width: '100%',
  },
  map: {
    flex: 1,
  },

  // ScrollView preenche o restante
  scrollView: {
    flex: 1,
    
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: -10,
    paddingBottom: 40,
  },

  // Card branco com sombra
  card: {
    backgroundColor: '#fff',
    borderRadius: 13,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.99,
    shadowRadius: 10,
    elevation: 8,
    alignItems: 'center',
  },

  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 20,
  },

  form: {
    width: '100%',
    gap: 20,
  },

  input: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
    width: '100%',
  },
  inputWrapper: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },

  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    borderWidth: 2,
    borderColor: '#3730D4',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  loginLink: {
    color: '#2563EB',
    fontSize: 14,
    marginTop: 40,
    textDecorationLine: 'underline',
    fontWeight: '600',
    alignSelf: 'center',
  },
});