import { Stack, useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useEffect } from 'react';

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Verifica se o usuário está tentando acessar rotas de autenticação
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Se não está logado e não está no login/register, manda para o login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Se está logado e tentou entrar no (auth), manda para a home
      router.replace('/');
    }
  }, [user, loading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="index" />
      <Stack.Screen name="map" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}