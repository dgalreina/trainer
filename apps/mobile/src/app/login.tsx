import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, Field, LinkButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Waves } from '@/components/waves';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { CognitoError } from '@/lib/cognito';
import { useAuth } from '@/lib/auth';

type Mode = 'signIn' | 'signUp' | 'confirm';

export default function LoginScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo ha fallado');
    } finally {
      setBusy(false);
    }
  }

  const submit = () =>
    run(async () => {
      if (!email.includes('@')) throw new Error('Escribe un email válido');

      if (mode === 'signIn') {
        try {
          await auth.signIn(email, password);
        } catch (err) {
          // Cuenta creada pero sin confirmar: se pide el código en vez de mostrar un error.
          if (err instanceof CognitoError && err.code === 'UserNotConfirmedException') {
            await auth.resendCode(email);
            go('confirm');
            setInfo('Te hemos enviado un código al email.');
            return;
          }
          throw err;
        }
      } else if (mode === 'signUp') {
        await auth.signUp(email, password);
        go('confirm');
        setInfo('Te hemos enviado un código al email.');
      } else {
        await auth.confirmSignUp(email, code);
        await auth.signIn(email, password);
      }
    });

  const resend = () =>
    run(async () => {
      await auth.resendCode(email);
      setInfo('Código reenviado.');
    });

  const title = mode === 'signIn' ? 'Entrar' : mode === 'signUp' ? 'Crear cuenta' : 'Confirma tu email';

  return (
    <ThemedView style={styles.container}>
      <Waves height={260} />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" style={styles.title}>
              Élite Trainer
            </ThemedText>
            {mode !== 'signIn' && <ThemedText themeColor="textSecondary">{title}</ThemedText>}

            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              editable={mode !== 'confirm'}
            />
            {mode !== 'confirm' && (
              <Field
                label="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                onSubmitEditing={submit}
              />
            )}
            {mode === 'signUp' && (
              <ThemedText type="small" themeColor="textSecondary">
                Mínimo 10 caracteres, con mayúsculas, minúsculas y números.
              </ThemedText>
            )}
            {mode === 'confirm' && (
              <Field
                label="Código del email"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                onSubmitEditing={submit}
              />
            )}

            <ErrorText message={error} />
            {info && <ThemedText type="small">{info}</ThemedText>}

            <Button
              title={mode === 'signIn' ? 'Entrar' : mode === 'signUp' ? 'Crear cuenta' : 'Confirmar'}
              onPress={submit}
              loading={busy}
            />

            {mode === 'signIn' && (
              <LinkButton centered title="No tengo cuenta, crear una" onPress={() => go('signUp')} />
            )}
            {mode === 'signUp' && (
              <LinkButton centered title="Ya tengo cuenta, entrar" onPress={() => go('signIn')} />
            )}
            {mode === 'confirm' && (
              <>
                <LinkButton centered title="Reenviar código" onPress={resend} />
                <LinkButton centered title="Volver" onPress={() => go('signIn')} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth / 2 },
  flex: { flex: 1 },
  // Solo el título va centrado; el resto del formulario sigue alineado a la izquierda.
  title: { textAlign: 'center' },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
  },
});
