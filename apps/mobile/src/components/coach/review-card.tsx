import type { CoachReview } from '@trainer/shared';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

/**
 * Las mejoras que el entrenador dejó la última vez que hiciste esta rutina, arriba al empezar el entreno. Son solo
 * texto: las cumples (✓) o las descartas (✕) y desaparecen; si no tocas nada, siguen ahí. Sin mejoras (o sin IA), no sale.
 */
export function ReviewCard({ routineId }: { routineId: string }) {
  const theme = useTheme();
  const [review, setReview] = useState<CoachReview | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CoachReview | null>(`/coach/reviews/pending?routineId=${encodeURIComponent(routineId)}`)
      .then((r) => !cancelled && setReview(r))
      // Sin conexión o sin IA: simplemente no hay tarjeta.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  if (!review || review.suggestions.length === 0) return null;

  function resolve(suggestionId: string, status: 'done' | 'dismissed') {
    if (!review) return;
    const reviewId = review.id;
    // Desaparece al instante; si el servidor falla, vuelve a salir la próxima vez que se abra.
    setReview((r) => (r ? { ...r, suggestions: r.suggestions.filter((s) => s.id !== suggestionId) } : r));
    api.post(`/coach/reviews/${reviewId}/suggestions/${suggestionId}`, { status }).catch(() => {});
  }

  return (
    <Card tone="skySoft">
      <ThemedText type="smallBold" style={{ color: theme.aiText }}>
        Mejoras de tu entrenador
      </ThemedText>
      {review.suggestions.map((s) => (
        <View key={s.id} style={styles.row}>
          <ThemedText type="small" style={styles.text}>
            {s.text}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cumplida"
            onPress={() => resolve(s.id, 'done')}
            hitSlop={8}
            style={[styles.button, { borderColor: theme.aiText }]}>
            <ThemedText type="smallBold" style={{ color: theme.aiText }}>
              ✓
            </ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Descartar" onPress={() => resolve(s.id, 'dismissed')} hitSlop={8} style={styles.button}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ✕
            </ThemedText>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  text: { flex: 1 },
  button: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
