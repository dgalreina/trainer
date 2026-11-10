import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, Chip, ErrorText } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { minutesOfTime, timeOfMinutes } from '@/lib/dates';
import { useSettings } from '@/lib/settings';
import { useThemePreference } from '@/lib/theme-preference';

/** Sesión, modo claro, catálogo de ejercicios y cerrar sesión: la parte «Mi cuenta» de «Yo». */
export function AccountSection() {
  const router = useRouter();
  const theme = useTheme();
  const { email, signOut } = useAuth();
  const { forceLight, setForceLight } = useThemePreference();
  const { dayStartMinutes, setDayStartMinutes } = useSettings();

  // A qué hora empieza el día: la normal (00:00) o una a elegir. Se guarda en el servidor, así que vale en
  // todos los dispositivos. El selector se guarda solo, un momento después del último cambio.
  const [custom, setCustom] = useState(dayStartMinutes > 0);
  const [time, setTime] = useState(timeOfMinutes(dayStartMinutes));
  const [dayError, setDayError] = useState<string | null>(null);
  // Lo último que se ha enviado: su respuesta no debe pisar lo que se esté tecleando mientras tanto.
  const sent = useRef<number | null>(null);
  useEffect(() => {
    if (dayStartMinutes > 0) setCustom(true);
    if (sent.current !== dayStartMinutes) setTime(timeOfMinutes(dayStartMinutes));
  }, [dayStartMinutes]);
  useEffect(() => {
    const valid = /^\d{2}:\d{2}$/.test(time) && Number(time.slice(0, 2)) <= 23 && Number(time.slice(3)) <= 59;
    if (!custom || !valid || minutesOfTime(time) === dayStartMinutes) return;
    const timer = setTimeout(() => save(minutesOfTime(time)), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custom, time, dayStartMinutes]);

  function save(minutes: number) {
    sent.current = minutes;
    setDayStartMinutes(minutes).then(
      () => setDayError(null),
      (err) => setDayError(err instanceof Error ? err.message : 'No se ha podido guardar'),
    );
  }

  function chooseNormal() {
    setCustom(false);
    sent.current = null;
    save(0);
  }

  function chooseCustom() {
    if (custom) return;
    setCustom(true);
    sent.current = null;
    save(600);
  }

  return (
    <>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Sesión iniciada con
        </ThemedText>
        <ThemedText>{email}</ThemedText>
      </Card>

      <Card>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold">Usar siempre modo claro</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {forceLight
                ? 'La app se ve siempre en claro.'
                : 'Desactivado: la app sigue el modo de tu móvil.'}
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel="Usar siempre modo claro"
            value={forceLight}
            onValueChange={setForceLight}
            trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
            thumbColor="#FFFFFF"
            // En la web el pulgar encendido usa `activeThumbColor` y, si no, sale verde.
            {...({ activeThumbColor: '#FFFFFF' } as object)}
          />
        </View>
      </Card>

      <Card>
        <ThemedText type="smallBold">El día empieza a las…</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {dayStartMinutes > 0
            ? `Cada día va de las ${timeOfMinutes(dayStartMinutes)} a las ${timeOfMinutes(dayStartMinutes)} del siguiente: lo que haces de madrugada cuenta en el día anterior.`
            : 'El día normal: de las 00:00 a las 24:00.'}
        </ThemedText>
        <View style={styles.chips}>
          <Chip label="Normal (00:00)" active={!custom} onPress={chooseNormal} />
          <Chip label="A mi hora" active={custom} onPress={chooseCustom} />
        </View>
        {custom && <TimeField label="Hora de inicio" value={time} onChange={setTime} />}
        <ErrorText message={dayError} />
      </Card>

      <Button
        title="Catálogo de ejercicios"
        variant="secondary"
        onPress={() => router.push('/ejercicios')}
      />
      <Button title="Cerrar sesión" variant="secondary" onPress={signOut} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rowText: { flex: 1, gap: Spacing.half },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
