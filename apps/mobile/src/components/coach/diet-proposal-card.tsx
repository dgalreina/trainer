import type { Diet, DietProposal, Macros } from '@trainer/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionButton } from '@/components/coach/proposal-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { useCoach } from '@/lib/coach';
import { todayISO } from '@/lib/dates';
import { useDiets } from '@/lib/diets';
import { GOAL_LABELS } from '@/lib/profile-labels';
import { useSettings } from '@/lib/settings';

/** «160 g prot · 230 g hid · 70 g gras» */
const macrosText = (m: Macros) => `${Math.round(m.protein)} g prot · ${Math.round(m.carbs)} g hid · ${Math.round(m.fat)} g gras`;

/**
 * La dieta que propone el entrenador, como tarjeta bajo su mensaje. Las calorías y macros las ha calculado el código con
 * el catálogo de alimentos. Nada se guarda hasta que el usuario pulsa «Guardar como mi dieta».
 */
export function DietProposalCard({
  messageId,
  proposal,
  onRequestChanges,
}: {
  messageId: string;
  proposal: DietProposal;
  /** «Pedir cambios»: deja el cuadro de texto listo para que el usuario diga qué cambiar. */
  onRequestChanges: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const { updateProposal } = useCoach();
  const { reload } = useDiets();
  const { settings, setActiveDiet } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { diet, status } = proposal;

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
      const created = await api.post<Diet>(`/coach/proposals/${proposal.id}/accept`, {
        startDate: todayISO(),
        setActive: false,
      });
      updateProposal(messageId, { ...proposal, status: 'accepted', dietId: created.id });
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

  const isActive = proposal.dietId !== undefined && settings.activeDietId === proposal.dietId;

  return (
    <View style={[styles.card, { borderColor: theme.skySoft, backgroundColor: theme.background }]}>
      <ThemedText type="smallBold" style={{ color: theme.aiText }}>
        {status === 'accepted' ? 'Guardada en tus dietas' : 'Dieta propuesta'}
      </ThemedText>
      <ThemedText type="smallBold">{diet.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {GOAL_LABELS[diet.goal]} · {diet.meals.length} {diet.meals.length === 1 ? 'comida' : 'comidas'}
      </ThemedText>
      <ThemedText type="smallBold">{Math.round(diet.totals.kcal)} kcal al día</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {macrosText(diet.totals)}
      </ThemedText>

      <View style={styles.meals}>
        {diet.meals.map((meal, i) => (
          <View key={i}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open === i }}
              onPress={() => setOpen(open === i ? null : i)}
              style={[styles.mealRow, { backgroundColor: theme.tealSoft }]}>
              <ThemedText type="small" style={styles.mealTitle}>
                {meal.time} · {meal.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {Math.round(meal.macros.kcal)} kcal {open === i ? '▴' : '▾'}
              </ThemedText>
            </Pressable>
            {open === i ? (
              <View style={styles.foods}>
                {meal.items.map((item, j) => (
                  <View key={j} style={styles.foodRow}>
                    <ThemedText type="small" style={styles.foodName}>
                      {item.foodName}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {Math.round(item.grams)} g
                    </ThemedText>
                  </View>
                ))}
                <ThemedText type="small" themeColor="textSecondary">
                  {macrosText(meal.macros)}
                </ThemedText>
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
          <ActionButton label="Guardar como mi dieta" onPress={save} disabled={busy} />
          <View style={styles.row}>
            <ActionButton label="Pedir cambios" kind="secondary" onPress={onRequestChanges} disabled={busy} />
            <ActionButton label="Descartar" kind="secondary" onPress={discard} disabled={busy} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.row}>
            {proposal.dietId ? (
              <ActionButton
                label="Ver dieta"
                onPress={() => router.push({ pathname: '/mi-dieta/[id]', params: { id: proposal.dietId as string } })}
              />
            ) : null}
            {proposal.dietId && !isActive ? (
              <ActionButton
                label="Marcar como actual"
                kind="secondary"
                disabled={busy}
                onPress={() => run(() => setActiveDiet(proposal.dietId as string))}
              />
            ) : null}
          </View>
          {isActive ? (
            <ThemedText type="small" themeColor="textSecondary">
              Es tu dieta actual.
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
  meals: { gap: Spacing.one },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Radius.control,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  mealTitle: { flex: 1, fontWeight: '700' },
  foods: { gap: Spacing.one, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  foodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  foodName: { flex: 1 },
  actions: { gap: Spacing.two },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
