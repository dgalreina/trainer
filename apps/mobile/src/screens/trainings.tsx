import { routineTitle, trainingProgress, type TrainingTemplate } from '@trainer/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Button, ErrorText } from '@/components/form';
import { Screen } from '@/components/screen';
import { SectionTabs, TemplatesPlaceholder } from '@/components/section-tabs';
import { TemplateCard } from '@/components/template-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { todayISO } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';
import { useNewTraining } from '@/lib/new-training';
import { useSettings } from '@/lib/settings';
import { progressLabel } from '@/lib/training-progress';
import { useTrainings } from '@/lib/trainings';

export function TrainingsScreen() {
  const router = useRouter();
  const { trainings, templates, templatesError, reloadTemplates, loading, error, refresh, applyTemplate } = useTrainings();
  // Al entrar se vuelve a pedir al servidor: el entrenamiento pudo cambiar desde otro sitio.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );
  const { settings, setActiveTraining } = useSettings();
  const theme = useTheme();
  const today = todayISO();
  const newTraining = useNewTraining();
  const [createError, setCreateError] = useState<string | null>(null);
  const [section, setSection] = useState<'mis' | 'plantillas'>('mis');
  const [usingId, setUsingId] = useState<string | null>(null);
  // Cerrojo síncrono: dos pulsaciones seguidas (aunque sea en otra tarjeta) no crean dos entrenamientos.
  const using = useRef(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // «Usar»: copia la plantilla a los entrenos propios, desde hoy, y la abre para ajustarla.
  async function onUseTemplate(template: TrainingTemplate) {
    if (using.current) return;
    using.current = true;
    setUsingId(template.id);
    setTemplateError(null);
    try {
      const training = await applyTemplate(template.id, todayISO());
      setSection('mis');
      router.push({ pathname: '/entrenamiento/[id]', params: { id: training.id } });
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : 'No se ha podido usar la plantilla');
    } finally {
      using.current = false;
      setUsingId(null);
    }
  }

  return (
    <Screen
      fade
      fixedTop={
        <SectionTabs
          options={[
            { key: 'mis', label: 'Mis entrenos' },
            { key: 'plantillas', label: 'Plantillas' },
          ]}
          value={section}
          onChange={setSection}
        />
      }>
      {section === 'plantillas' ? (
        templates.length === 0 ? (
          <>
            <TemplatesPlaceholder
              text={templatesError ? 'No se han podido cargar las plantillas.' : 'No hay plantillas de entreno disponibles ahora mismo.'}
            />
            {templatesError ? <Button title="Reintentar" variant="secondary" onPress={reloadTemplates} /> : null}
          </>
        ) : (
          <>
            <ThemedText type="small" themeColor="textSecondary">
              Entrenamientos de ejemplo para empezar. «Usar» te copia uno a Mis entrenos, desde hoy; luego lo ajustas a tu gusto (los pesos los pones tú).
            </ThemedText>
            <ErrorText message={templateError} />
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                using={usingId === template.id}
                disabled={usingId !== null}
                onUse={() => onUseTemplate(template)}
              />
            ))}
          </>
        )
      ) : (
        <>
          <Button
            title="Nuevo entrenamiento"
            onPress={() =>
              newTraining().then(
                () => setCreateError(null),
                (err) => setCreateError(err instanceof Error ? err.message : 'No se ha podido crear'),
              )
            }
          />
          <ErrorText message={error ?? createError} />

          {!loading && trainings.length === 0 && !error && (
            <ThemedText themeColor="textSecondary">
              Todavía no tienes ningún entrenamiento. Crea el primero con el botón de arriba y añádele
              las rutinas de cada día.
            </ThemedText>
          )}

          {trainings.map((training) => {
            const progress = trainingProgress(training, today);
            const isActive = settings.activeTrainingId === training.id;
            return (
              <Card
                key={training.id}
                tone={isActive ? 'primarySoft' : 'backgroundElement'}
                onPress={() =>
                  router.push({ pathname: '/entrenamiento/[id]', params: { id: training.id } })
                }
                style={styles.card}>
                <View style={styles.header}>
                  <ThemedText type="smallBold" style={styles.name}>
                    {training.name}
                  </ThemedText>
                  {/* El punto marca el entrenamiento actual; tocar fuera de él abre el entrenamiento. */}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`Usar ${training.name} como entrenamiento actual`}
                    hitSlop={8}
                    onPress={() => {
                      if (!isActive) setActiveTraining(training.id).catch(() => {});
                    }}
                    style={styles.dotHit}>
                    <View style={[styles.dot, { borderColor: theme.primaryText }, isActive && { backgroundColor: theme.primary }]} />
                  </Pressable>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {progressLabel(training, progress)} · {training.routines.length}{' '}
                  {training.routines.length === 1 ? 'rutina' : 'rutinas'}
                </ThemedText>
                {training.routines.length > 0 && (
                  <ThemedText type="small">{training.routines.map((r) => routineTitle(training.routines, r.id)).join(' · ')}</ThemedText>
                )}
              </Card>
            );
          })}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1 },
  dotHit: { padding: Spacing.one },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
});
