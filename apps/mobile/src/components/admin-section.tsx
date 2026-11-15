import {
  AI_PLANS,
  type AdminOverview,
  type AdminUser,
  type AiPlan,
  type AppSuggestion,
  type SuggestionStatus,
} from '@trainer/shared';
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

/** «technique_partial_sets» → «technique partial sets». */
const codeLabel = (code: string) => code.replace(/[_:.-]+/g, ' ');

/**
 * Lo que la IA quiso hacer al diseñar entrenamientos y la app no pudo representar (una técnica solo en algunas series,
 * un tempo, un ejercicio que falta…), de más a menos frecuente. Sirve para decidir qué mejorar. No dice quién lo pidió.
 */
function SuggestionsPanel() {
  const [resolved, setResolved] = useState(false);
  const [items, setItems] = useState<AppSuggestion[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<AppSuggestion[]>(`/admin/suggestions${resolved ? '?resolved=1' : ''}`));
      setError(false);
    } catch {
      setError(true);
    }
  }, [resolved]);
  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  async function setStatus(item: AppSuggestion, status: SuggestionStatus) {
    try {
      await api.patch(`/admin/suggestions/${item.id}`, { status });
      await load();
    } catch {
      setError(true);
    }
  }

  return (
    <>
      <View style={styles.plans}>
        <Chip compact label="Pendientes" active={!resolved} onPress={() => setResolved(false)} />
        <Chip compact label="Resueltas" active={resolved} onPress={() => setResolved(true)} />
      </View>
      {error ? (
        <ThemedText type="small" themeColor="textSecondary">
          No se ha podido cargar.
        </ThemedText>
      ) : null}
      {items === null ? (
        <ThemedText themeColor="textSecondary">Cargando…</ThemedText>
      ) : items.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {resolved ? 'Todavía no has resuelto ninguna.' : 'Nada pendiente: la app ha podido con todo lo que ha pedido la IA.'}
        </ThemedText>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <View style={styles.header}>
              <ThemedText type="smallBold" style={styles.headerText}>
                {codeLabel(item.code)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ×{item.count}
              </ThemedText>
            </View>
            {item.examples.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.examples[item.examples.length - 1]}
              </ThemedText>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Última vez: {new Date(item.lastSeenAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
            </ThemedText>
            <View style={styles.plans}>
              {item.status === 'open' ? (
                <>
                  <Chip compact label="Hecha" active={false} onPress={() => void setStatus(item, 'done')} />
                  <Chip compact label="Descartar" active={false} onPress={() => void setStatus(item, 'dismissed')} />
                </>
              ) : (
                <Chip compact label="Reabrir" active={false} onPress={() => void setStatus(item, 'open')} />
              )}
            </View>
          </Card>
        ))
      )}
    </>
  );
}

/**
 * «Admin» (solo administradores): quién usa la app y cuánta IA gasta cada uno este mes, y el plan de cada uno. Solo
 * números: nunca se ven conversaciones ni datos de salud de nadie.
 */
function UsersPanel() {
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

/** El panel de administración: usuarios y gasto de IA, y las sugerencias de mejora de la app. */
export function AdminSection() {
  const [view, setView] = useState<'usuarios' | 'sugerencias'>('usuarios');
  return (
    <>
      <View style={styles.plans}>
        <Chip compact label="Usuarios" active={view === 'usuarios'} onPress={() => setView('usuarios')} />
        <Chip compact label="Sugerencias" active={view === 'sugerencias'} onPress={() => setView('sugerencias')} />
      </View>
      {view === 'usuarios' ? <UsersPanel /> : <SuggestionsPanel />}
    </>
  );
}
