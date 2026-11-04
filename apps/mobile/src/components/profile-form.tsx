import {
  ACTIVITY_LEVELS,
  GOALS,
  SEXES,
  ageFromBirthDate,
  type ActivityLevel,
  type Goal,
  type Sex,
} from '@trainer/shared';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DateField } from '@/components/date-field';
import { Button, Chip, ErrorText, Field, NumberInput } from '@/components/form';
import { OptionRows } from '@/components/option-rows';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, formatTime, isoOf, isValidISODate, todayISO } from '@/lib/dates';
import { useMe } from '@/lib/me';
import { ACTIVITY_LABELS, GOAL_LABELS, SEX_LABELS } from '@/lib/profile-labels';

const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 250;
const SAVED_VISIBLE_MS = 2500;

/** Formulario con los datos personales: nombre, edad, sexo, altura, actividad, objetivo y notas. */
export function ProfileForm() {
  const theme = useTheme();
  const { profile, loading, saveProfile, latestWeight } = useMe();

  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El formulario se rellena una sola vez, cuando el perfil ya se ha cargado.
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current || loading) return;
    initialized.current = true;
    setName(profile.name ?? '');
    setBirthDate(profile.birthDate ?? '');
    setSex(profile.sex);
    setHeight(profile.heightCm === null ? '' : String(profile.heightCm));
    setActivity(profile.activityLevel);
    setGoal(profile.goal);
    setNotes(profile.notes ?? '');
  }, [loading, profile]);

  const age = isValidISODate(birthDate) ? ageFromBirthDate(birthDate, todayISO()) : null;

  async function save() {
    const heightNumber = height.trim() === '' ? null : Number.parseFloat(height.replace(',', '.'));
    if (heightNumber !== null && !(heightNumber >= MIN_HEIGHT_CM && heightNumber <= MAX_HEIGHT_CM)) {
      return setError(`La altura va de ${MIN_HEIGHT_CM} a ${MAX_HEIGHT_CM} cm`);
    }
    if (birthDate !== '' && !isValidISODate(birthDate)) return setError('Elige una fecha de nacimiento válida');

    setSaving(true);
    setError(null);
    try {
      await saveProfile({
        name: name.trim() || null,
        birthDate: birthDate || null,
        sex,
        heightCm: heightNumber,
        activityLevel: activity,
        goal,
        notes: notes.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se han podido guardar tus datos');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color={theme.primary} />;

  const weightDate = latestWeight ? new Date(latestWeight.date) : null;

  return (
    <View style={styles.form}>
      <Field label="Nombre" value={name} onChangeText={setName} placeholder="Cómo quieres que te llame" />

      <DateField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} />
      {age !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          {age} años
        </ThemedText>
      )}

      <ThemedText type="smallBold" themeColor="textSecondary">
        Sexo (para calcular las calorías)
      </ThemedText>
      <View style={styles.chips}>
        {SEXES.map((value) => (
          <Chip
            key={value}
            label={SEX_LABELS[value]}
            active={sex === value}
            onPress={() => setSex(sex === value ? null : value)}
          />
        ))}
      </View>

      {sex === 'no_indicado' && (
        <ThemedText type="small" themeColor="textSecondary">
          Se calculará con un valor intermedio entre hombre y mujer.
        </ThemedText>
      )}

      <View style={styles.heightRow}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heightLabel}>
          Altura (cm)
        </ThemedText>
        <NumberInput accessibilityLabel="Altura en centímetros" placeholder="cm" value={height} onChangeText={setHeight} />
      </View>

      <Card tone="primarySoft" style={styles.weightCard}>
        <ThemedText type="small" themeColor="textSecondary">
          Peso actual
        </ThemedText>
        {latestWeight && weightDate ? (
          <>
            <ThemedText type="subtitle">{latestWeight.weightKg.toLocaleString('es-ES')} kg</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDay(isoOf(weightDate))}, {formatTime(weightDate)}
            </ThemedText>
          </>
        ) : (
          <ThemedText themeColor="textSecondary">Aún no te has pesado. Regístralo en la pestaña Calendario.</ThemedText>
        )}
      </Card>

      <ThemedText type="smallBold" themeColor="textSecondary">
        Nivel de actividad
      </ThemedText>
      <OptionRows
        options={ACTIVITY_LEVELS.map((value) => ({ value, ...ACTIVITY_LABELS[value] }))}
        selected={activity}
        onSelect={setActivity}
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        Objetivo
      </ThemedText>
      <View style={styles.chips}>
        {GOALS.map((value) => (
          <Chip
            key={value}
            label={GOAL_LABELS[value]}
            active={goal === value}
            onPress={() => setGoal(goal === value ? null : value)}
          />
        ))}
      </View>

      <Field
        label="Lesiones y notas"
        value={notes}
        onChangeText={setNotes}
        placeholder="Lo que tu entrenador debe tener en cuenta"
        multiline
        numberOfLines={4}
        style={styles.notes}
      />

      <ErrorText message={error} />
      <Button title={saved ? 'Guardado ✓' : 'Guardar mis datos'} onPress={save} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  heightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  heightLabel: { flex: 1 },
  weightCard: { gap: Spacing.half },
  notes: { minHeight: 96, textAlignVertical: 'top' },
});
