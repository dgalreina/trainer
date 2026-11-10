import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorText, NumberInput } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { formatDay, timeInDay } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { useSettings } from '@/lib/settings';

const MIN_KG = 20;
const MAX_KG = 400;

/** Ventana para registrar una pesada en un día y a una hora concretos (la hora llega propuesta). */
export function WeighInSheet({
  visible,
  day,
  time: initialTime,
  onClose,
}: {
  visible: boolean;
  day: string;
  /** "HH:MM" con el que se abre. */
  time: string;
  onClose: () => void;
}) {
  const { addWeight } = useMe();
  const { dayStartMinutes } = useSettings();
  const [kg, setKg] = useState('');
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La hora se propone al abrir: no se arrastra la de una vez anterior.
  useEffect(() => {
    if (!visible) return;
    setKg('');
    setTime(initialTime);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    const weight = Number.parseFloat(kg.replace(',', '.'));
    if (!Number.isFinite(weight) || weight < MIN_KG || weight > MAX_KG) {
      return setError(`Escribe un peso entre ${MIN_KG} y ${MAX_KG} kg`);
    }
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
      return setError('Elige una hora válida');
    }

    // La hora se coloca dentro del día del usuario: antes de su hora de inicio, es de la madrugada siguiente.
    const moment = timeInDay(day, time, dayStartMinutes);

    setSaving(true);
    setError(null);
    try {
      await addWeight({ date: moment.toISOString(), weightKg: Math.round(weight * 10) / 10 });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la pesada');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
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
      <Button variant="secondary" title="Cancelar" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-end' },
  kg: { width: 110, gap: Spacing.two },
  time: { flex: 1, gap: Spacing.two },
});
