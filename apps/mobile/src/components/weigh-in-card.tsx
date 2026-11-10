import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorText, NumberInput } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { formatDay, startOfDay } from '@/lib/dates';
import { confirmAction } from '@/lib/confirm';
import { useMe } from '@/lib/me';

const MIN_KG = 20;
const MAX_KG = 400;

/**
 * Ventana para registrar una pesada en un día y a una hora concretos (la hora llega propuesta) o, si llega
 * `weightId`, para editar una que ya existe: cambiar los kilos y la hora, o borrarla.
 */
export function WeighInSheet({
  visible,
  day,
  time: initialTime,
  weightId,
  kg: initialKg = '',
  onClose,
}: {
  visible: boolean;
  day: string;
  /** "HH:MM" con el que se abre. */
  time: string;
  /** La pesada que se edita; sin él, se crea una nueva. */
  weightId?: string;
  /** Los kilos con los que se abre (al editar). */
  kg?: string;
  onClose: () => void;
}) {
  const { addWeight, updateWeight, removeWeight } = useMe();
  const [kg, setKg] = useState('');
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La hora se propone al abrir: no se arrastra la de una vez anterior.
  useEffect(() => {
    if (!visible) return;
    setKg(initialKg);
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

    const moment = startOfDay(day);
    moment.setHours(Number(match[1]), Number(match[2]));

    setSaving(true);
    setError(null);
    try {
      const weightKg = Math.round(weight * 10) / 10;
      if (weightId) await updateWeight(weightId, { date: moment.toISOString(), weightKg });
      else await addWeight({ date: moment.toISOString(), weightKg });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido guardar la pesada');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!weightId) return;
    const ok = await confirmAction('Borrar pesada', 'Se borrará esta pesada.', 'Borrar');
    if (!ok) return;
    setSaving(true);
    try {
      await removeWeight(weightId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido borrar la pesada');
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
          <NumberInput field accessibilityLabel="Peso en kilos" placeholder="kg" value={kg} onChangeText={setKg} />
        </View>
        <View style={styles.time}>
          <TimeField label="Hora" value={time} onChange={setTime} />
        </View>
      </View>
      <ErrorText message={error} />
      <Button title="Guardar pesada" onPress={save} loading={saving} />
      {weightId ? <Button variant="danger" title="Borrar pesada" onPress={remove} disabled={saving} /> : null}
      <Button variant="secondary" title="Cancelar" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  kg: { width: 110, gap: Spacing.two },
  time: { flex: 1, gap: Spacing.two },
});
