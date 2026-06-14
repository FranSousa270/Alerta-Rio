import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert('Atenção', 'Digite seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (error: any) {
      const msg =
        error.code === 'auth/user-not-found'
          ? 'Nenhuma conta encontrada com este e-mail.'
          : 'Erro ao enviar e-mail. Tente novamente.';
      Alert.alert('Erro', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!sent ? (
          <>
            <Text style={styles.title}>Esqueceu a senha?</Text>
            <Text style={styles.subtitle}>
              Digite seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.button}
              onPress={handleSend}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.buttonText}>Enviar link</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.backLink}>Voltar ao login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.successIcon}>✉️</Text>
            <Text style={styles.title}>Link enviado!</Text>
            <Text style={styles.subtitle}>
              Enviamos um link de redefinição para{'\n'}
              <Text style={styles.emailHighlight}>{email}</Text>
              {'\n\n'}
              Acesse seu e-mail, clique no link e siga as instruções para criar uma nova senha.{'\n\n'}
              Não encontrou? Verifique a caixa de spam.
            </Text>

            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Voltar ao login</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    gap: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#fff',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  backLink: {
    color: '#2563EB',
    fontSize: 14,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
  successIcon: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 8,
  },
  emailHighlight: {
    fontWeight: '700',
    color: '#2563EB',
  },
});