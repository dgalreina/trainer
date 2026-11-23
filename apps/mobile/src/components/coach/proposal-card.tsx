import { dayLabel, type CoachProposal, type Training, type TrainingProposal } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DietProposalCard } from '@/components/coach/diet-proposal-card';
import { ActionButton } from '@/components/coach/proposal-button';
import { SupersetMark } from '@/components/superset-mark';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { chainBlocks } from '@/lib/superset';
import { api } from '@/lib/api';
import { useCoach } from '@/lib/coach';
import { todayISO } from '@/lib/dates';
import { useSettings } from '@/lib/settings';
import { useTrainings } from '@/lib/trainings';

/** «4 × 10-10-9-8»: las series de un ejercicio de un vistazo. */
const setsText = (sets: { reps?: number }[]) => `${sets.length} × ${sets.map((s) => s.reps ?? '?').join('-')}`;

/**
 * El entrenamiento que propone el entrenador, como tarjeta bajo su mensaje. Nada se guarda hasta que el usuario pulsa
 * «Guardar como mi entrenamiento». Ya guardada, se puede abrir o marcar como actual; descartada, queda una línea discreta.
 */
function TrainingProposalCard({
  messageId,
  proposal,
  onRequestChanges,
}: {
  messageId: string;
  proposal: TrainingProposal;
  /** «Pedir cambios»: deja el cuadro de texto listo para que el usuario diga qué cambiar. */
  onRequestChanges: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { updateProposal, setOpen: setChatOpen } = useCoach();
  const { reload } = useTrainings();
  const { settings, setActiveTraining } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { training, status } = proposal;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido completar.');
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      const created = await api.post<Training>(`/coach/proposals/${proposal.id}/accept`, {
        startDate: todayISO(),
        setActive: false,
      });
      updateProposal(messageId, { ...proposal, status: 'accepted', trainingId: created.id });
      await reload();
    });

  const discard = () =>
    run(async () => {
      await api.post(`/coach/proposals/${proposal.id}/reject`, {});
      updateProposal(messageId, { ...proposal, status: 'rejected' });
    });

  if (status === 'rejected') {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
        Propuesta descartada.
      </ThemedText>
    );
  }

  const isActive = proposal.trainingId !== undefined && settings.activeTrainingId === proposal.trainingId;

  return (
    <View style={[styles.card, { borderColor: theme.skySoft, backgroundColor: theme.background }]}>
      <ThemedText type="smallBold" style={{ color: theme.aiText }}>
        {status === 'accepted' ? 'Guardado en tus entrenos' : 'Entrenamiento propuesto'}
      </ThemedText>
      <ThemedText type="smallBold">{training.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {training.routines.length} {training.routines.length === 1 ? 'día' : 'días'} · {training.durationWeeks}{' '}
        {training.durationWeeks === 1 ? 'semana' : 'semanas'}
      </ThemedText>

      <View style={styles.routines}>
        {training.routines.map((routine, i) => (
          <View key={i}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              onPress={() => setOpen(open === i ? null : i)}
              style={[styles.routineRow, { backgroundColor: theme.tealSoft }]}>
              <ThemedText type="small" style={styles.routineTitle}>
                {dayLabel(i)}
                {routine.name ? ` · ${routine.name}` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {routine.slots.length} ej. {open === i ? '▴' : '▾'}
              </ThemedText>
            </Pressable>
            {open === i ? (
              <View style={styles.exercises}>
                {chainBlocks(routine.slots).map((block, k) => (
                  <View key={k} style={block.length > 1 ? [styles.chain, { borderLeftColor: theme.primary }] : undefined}>
                    {block.map(({ item: slot, index: j }, pos) => (
                      <View key={j}>
                        <View style={styles.exerciseRow}>
                          <ThemedText type="small" style={styles.exerciseName}>
                            {block.length > 1 ? `${k + 1}${String.fromCharCode(97 + pos)}  ` : ''}
                            {slot.exerciseName}
                            {slot.technique && slot.technique !== 'ss' ? ` (${slot.technique.toUpperCase()})` : ''}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {setsText(slot.sets)}
                          </ThemedText>
                        </View>
                        {pos < block.length - 1 ? <SupersetMark /> : null}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      ) : null}

      {status === 'pending' ? (
        <View style={styles.actions}>
          <ActionButton label="Guardar como mi entrenamiento" onPress={save} disabled={busy} />
          <View style={styles.row}>
            <ActionButton label="Pedir cambios" kind="secondary" onPress={onRequestChanges} disabled={busy} />
            <ActionButton label="Descartar" kind="secondary" onPress={discard} disabled={busy} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.row}>
            {proposal.trainingId ? (
              <ActionButton
                label="Ver entrenamiento"
                onPress={() => {
                  // El chat es pantalla completa y va por encima de todo: hay que cerrarlo para ver la pantalla.
                  setChatOpen(false);
                  router.push({ pathname: '/entrenamiento/[id]', params: { id: proposal.trainingId as string } });
                }}
              />
            ) : null}
            {proposal.trainingId && !isActive ? (
              <ActionButton
                label="Marcar como actual"
                kind="secondary"
                disabled={busy}
                onPress={() => run(() => setActiveTraining(proposal.trainingId as string))}
              />
            ) : null}
          </View>
          {isActive ? (
            <ThemedText type="small" themeColor="textSecondary">
              Es tu entrenamiento actual.
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.card, padding: Spacing.three, gap: Spacing.two, maxWidth: '96%' },
  note: { paddingHorizontal: Spacing.two },
  routines: { gap: Spacing.one },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Radius.control,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  routineTitle: { flex: 1, fontWeight: '700' },
  exercises: { gap: Spacing.one, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  chain: { borderLeftWidth: 4, paddingLeft: Spacing.two, borderRadius: 4 },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  exerciseName: { flex: 1 },
  actions: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});

/** La tarjeta de lo que propone el entrenador en el chat: un entrenamiento o una dieta. */
export function ProposalCard({
  messageId,
  proposal,
  onRequestChanges,
}: {
  messageId: string;
  proposal: CoachProposal;
  onRequestChanges: () => void;
}) {
  return proposal.kind === 'diet' ? (
    <DietProposalCard messageId={messageId} proposal={proposal} onRequestChanges={onRequestChanges} />
  ) : (
    <TrainingProposalCard messageId={messageId} proposal={proposal} onRequestChanges={onRequestChanges} />
  );
}
