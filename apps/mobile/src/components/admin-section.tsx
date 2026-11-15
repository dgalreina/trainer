import { AI_PLANS, type AdminOverview, type AdminUser, type AiPlan } from '@trainer/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Chip, Field } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';

const PLAN_LABEL: Record<AiPlan, string> = { gratis: 'Sin IA', prueba: 'Prueba', pro: 'Pro' };
/** Usuarios por página. */
const PAGE_SIZE = 20;
const number = (n: number) => n.toLocaleString('es-ES');
const euros = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €`;

/** «noviembre de 2026» a partir de «2026-11». */
function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function UserCard({ user, onPlan }: { user: AdminUser; onPlan: (plan: AiPlan) => void }) {
  const theme = useTheme();
  const share = user.capTokens > 0 ? Math.min(1, user.totalTokens / user.capTokens) : 0;
  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="smallBold">{user.name || user.email || 'Sin cuenta'}</ThemedText>
          {user.name && user.email ? (
            <ThemedText type="small" themeColor="textSecondary">
              {user.email}
            </ThemedText>
          ) : null}
        </View>
        {user.isAdmin ? (
          <ThemedText type="small" themeColor="textSecondary">
            Admin
          </ThemedText>
        ) : null}
      </View>

      {user.capTokens > 0 ? (
        <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
          <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: share >= 1 ? theme.amber : theme.teal }]} />
        </View>
      ) : null}
      <ThemedText type="small">
        {number(user.totalTokens)}
        {user.capTokens > 0 ? ` de ${number(user.capTokens)}` : ''} tokens · {user.calls}{' '}
        {user.calls === 1 ? 'llamada' : 'llamadas'} · {euros(user.costEur)}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {user.lastUsedAt
          ? `Última vez: ${new Date(user.lastUsedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
          : 'Sin uso este mes'}
      </ThemedText>

      {/* A un administrador no se le cambia el plan: siempre es Pro. */}
      {user.isAdmin ? null : (
        <View style={styles.plans}>
          {AI_PLANS.map((plan) => (
            <Chip key={plan} compact label={PLAN_LABEL[plan]} active={user.plan === plan} onPress={() => onPlan(plan)} />
          ))}
        </View>
      )}
    </Card>
  );
}

/**
 * «Admin» (solo administradores): quién usa la app y cuánta IA gasta cada uno este mes, y el plan de cada uno. Solo
 * números: nunca se ven conversaciones ni datos de salud de nadie.
 */
export function AdminSection() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    try {
      setData(await api.get<AdminOverview>('/admin/users'));
      setError(false);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function setPlan(user: AdminUser, plan: AiPlan) {
    if (plan === user.plan) return;
    try {
      await api.patch(`/admin/users/${user.userId}/plan`, { plan });
      await load();
    } catch {
      setError(true);
    }
  }

  // Búsqueda por nombre o email (sin distinguir mayúsculas ni acentos) y páginas de PAGE_SIZE. El resumen de arriba cuenta a todos.
  const visible = useMemo(() => {
    const fold = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = fold(query.trim());
    const all = data?.users ?? [];
    return q ? all.filter((u) => fold(`${u.name ?? ''} ${u.email ?? ''}`).includes(q)) : all;
  }, [data, query]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);

  if (!data) {
    return (
      <ThemedText themeColor="textSecondary">{error ? 'No se ha podido cargar el panel.' : 'Cargando…'}</ThemedText>
    );
  }

  return (
    <>
      <Card>
        <ThemedText type="smallBold">Gasto de IA en {monthLabel(data.month)}</ThemedText>
        <ThemedText type="subtitle">{euros(data.totals.costEur)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {number(data.totals.totalTokens)} tokens · {number(data.totals.calls)} llamadas · {data.totals.users}{' '}
          {data.totals.users === 1 ? 'usuario' : 'usuarios'}. Coste estimado: el real está en la factura de Anthropic.
        </ThemedText>
      </Card>
      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          No se ha podido actualizar. Inténtalo de nuevo.
        </ThemedText>
      ) : null}
      <Field
        placeholder="Buscar por nombre o email"
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setPage(0);
        }}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {visible.length === 0 ? (
        <ThemedText themeColor="textSecondary">Ningún usuario coincide.</ThemedText>
      ) : (
        visible
          .slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)
          .map((user) => <UserCard key={user.userId} user={user} onPlan={(plan) => void setPlan(user, plan)} />)
      )}
      {pages > 1 ? (
        <View style={styles.pager}>
          <View style={current === 0 ? styles.off : undefined} pointerEvents={current === 0 ? 'none' : 'auto'}>
            <Chip label="‹ Anterior" active={false} onPress={() => setPage(current - 1)} />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {current + 1} de {pages} · {visible.length} usuarios
          </ThemedText>
          <View style={current >= pages - 1 ? styles.off : undefined} pointerEvents={current >= pages - 1 ? 'none' : 'auto'}>
            <Chip label="Siguiente ›" active={false} onPress={() => setPage(current + 1)} />
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  headerText: { flex: 1, gap: Spacing.half },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  off: { opacity: 0.35 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  plans: { flexDirection: 'row', gap: Spacing.two },
});
