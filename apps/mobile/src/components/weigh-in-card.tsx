import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText, NumberInput } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { formatDay, formatTime, startOfDay, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';

const MIN_KG = 20;
const MAX_KG = 400;

/** Hora con la que se propone la pesada: ahora si es hoy; a primera hora de la mañana en otro día. */
function defaultTime(day: string): string {
  return day === todayISO() ? formatTime(new Date()) : '08:00';
}

/** Formulario para registrar una pesada en un día y a una hora concretos. */
export function WeighInCard({ day }: { day: string }) {
  const { addWeight } = useMe();
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState('');
  const [time, setTime] = useState(() => defaultTime(day));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    // La hora se propone al abrir, no al montar: si no, "ahora" sería la de cuando se abrió la app.
    setTime(defaultTime(day));
    setError(null);
    setOpen(true);
  }

  async function save() {
    const weight = Number.parseFloat(kg.replace(',', '.'));
    if (!Number.isFinite(weight) || weight < MIN_KG || weight > MAX_KG) {
      return setError(`Escribe un peso entre ${MIN_KG} y ${MAX_KG} kg`);
    }
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      return setError('Elige una hora válida');
    }

    const moment = startOfDay(day);
    moment.setHours(Number(match[1]), Number(match[2]));

    setSaving(true);
    setError(null);
    try {
      await addWeight({ date: moment.toISOString(), weightKg: Math.round(weight * 10) / 10 });
      setKg('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la pesada');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <Button variant="secondary" title="+ Registrar peso" onPress={openForm} />;

  return (
    <Card style={styles.card}>
      <ThemedText type="smallBold">Peso del {formatDay(day)}</ThemedText>
      <View style={styles.row}>
        <View style={styles.kg}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Peso
          </ThemedText>
          <NumberInput accessibilityLabel="Peso en kilos" placeholder="kg" value={kg} onChangeText={setKg} />
        </View>
        <View style={styles.time}>
          <TimeField label="Hora" value={time} onChange={setTime} />
        </View>
      </View>
      <ErrorText message={error} />
      <Button title="Guardar pesada" onPress={save} loading={saving} />
      <Button variant="secondary" title="Cancelar" onPress={() => setOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-end' },
  kg: { width: 110, gap: Spacing.two },
  time: { flex: 1, gap: Spacing.two },
});
