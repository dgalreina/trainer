import { MAX_STEPS } from '@trainer/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ErrorText, NumberInput } from '@/components/form';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/time-field';
import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { formatDay, startOfDay } from '@/lib/dates';

/**
 * Ventana para anotar los pasos de un día: los que llevas andados desde las 00:00 hasta la hora que pongas (los de la app Salud
 * a esa hora). Hay un registro por día; con `stepsId` se edita (pasos y hora) o se borra.
 */
export function StepsSheet({
  visible,
  day,
  time: initialTime,
  stepsId,
  steps: initialSteps = '',
  onClose,
  onSaved,
}: {
  visible: boolean;
  day: string;
  /** "HH:MM" con el que se abre. */
  time: string;
  /** El registro que se edita; sin él, se crea uno nuevo. */
  stepsId?: string;
  /** Los pasos con los que se abre (al editar). */
  steps?: string;
  onClose: () => void;
  /** Se llama tras guardar o borrar, para recargar el calendario. */
  onSaved: () => void;
}) {
  const [steps, setSteps] = useState('');
  const [time, setTime] = useState(initialTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSteps(initialSteps);
    setTime(initialTime);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function save() {
    const count = Number.parseInt(steps.replace(/[.\s]/g, ''), 10);
    if (!Number.isFinite(count) || count < 1 || count > MAX_STEPS) {
      return setError(`Escribe los pasos del día (de 1 a ${MAX_STEPS.toLocaleString('es-ES')})`);
    }
    const match = /^(\d{2}):(\d{2})$/.exec(time);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return setError('Elige una hora válida');

    const moment = startOfDay(day);
    moment.setHours(Number(match[1]), Number(match[2]));
    if (moment.getTime() > Date.now()) return setError('Esa hora aún no ha llegado: pon los pasos que llevas hasta ahora');

    setSaving(true);
    setError(null);
    try {
      const body = { date: moment.toISOString(), day, steps: count };
      if (stepsId) await api.patch(`/me/steps/${stepsId}`, body);
      else await api.post('/me/steps', body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido guardar los pasos');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!stepsId) return;
    const ok = await confirmAction('Borrar pasos', 'Se borrarán los pasos de este día.', 'Borrar');
    if (!ok) return;
    setSaving(true);
    try {
      await api.delete(`/me/steps/${stepsId}`);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido borrar los pasos');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose}>
      <ThemedText type="smallBold">Pasos del {formatDay(day)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Los que llevas andados hoy desde las 00:00 hasta esa hora, como los marca Salud.
      </ThemedText>
      <View style={styles.row}>
        <View style={styles.steps}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Pasos
          </ThemedText>
          <NumberInput field accessibilityLabel="Pasos acumulados" placeholder="pasos" value={steps} onChangeText={setSteps} />
        </View>
        <View style={styles.time}>
          <TimeField label="Hasta las" value={time} onChange={setTime} />
        </View>
      </View>
      <ErrorText message={error} />
      <Button title="Guardar pasos" onPress={save} loading={saving} />
      {stepsId ? <Button variant="danger" title="Borrar pasos" onPress={remove} disabled={saving} /> : null}
      <Button variant="secondary" title="Cancelar" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  steps: { width: 130, gap: Spacing.two },
  time: { flex: 1, gap: Spacing.two },
});
