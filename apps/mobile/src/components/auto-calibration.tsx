import { nextExtraBurn } from '@trainer/shared';
import { useEffect, useRef, useState } from 'react';

import { todayISO } from '@/lib/dates';
import { useDiets } from '@/lib/diets';
import { useFoods } from '@/lib/foods';
import { useSettings } from '@/lib/settings';
import { getItem, setItem } from '@/lib/storage';
import { useTrainings } from '@/lib/trainings';
import { useWeightTrend } from '@/lib/weight-trend';

const LAST_RUN_KEY = 'trainer.extra-burn.last-run';

/**
 * El recálculo automático del gasto extra (moverte, digerir…): una vez al día, con la app abierta, compara el peso con las calorías de
 * las últimas semanas (como «Mi peso») y, si hay datos suficientes, acerca el gasto aplicado a lo que dice el peso. No pinta nada.
 * Hasta que toca no pide nada: solo se monta el cálculo (12 semanas de datos) el día en que hay que hacerlo.
 */
export function AutoCalibration() {
  const { settings, loaded } = useSettings();
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (!loaded || !settings.extraBurnAuto) {
      setDue(false);
      return;
    }
    let cancelled = false;
    getItem(LAST_RUN_KEY).then((day) => !cancelled && setDue(day !== todayISO()));
    return () => {
      cancelled = true;
    };
  }, [loaded, settings.extraBurnAuto]);

  return due ? <Runner onDone={() => setDue(false)} /> : null;
}

/** Espera a tener todos los datos, aplica el resultado una vez y anota que hoy ya está hecho. */
function Runner({ onDone }: { onDone: () => void }) {
  const { settings, setExtraBurn } = useSettings();
  const { trend, loading, error } = useWeightTrend();
  // Siempre lo último: si mientras se calculaba se apagó el automático o se quitó el gasto, no se repone.
  const latest = useRef(settings);
  latest.current = settings;
  const { loading: dietsLoading } = useDiets();
  const { foods } = useFoods();
  const { loading: trainingsLoading } = useTrainings();
  const done = useRef(false);

  // Sin el catálogo de alimentos, las dietas ni las rutinas no se pueden dar los días por comidos: se espera.
  const ready = !loading && !error && !dietsLoading && !trainingsLoading && foods.length > 0 && trend !== null;

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    (async () => {
      const next = nextExtraBurn(latest.current.extraBurnKcal, trend.calibration);
      try {
        if (next !== null && latest.current.extraBurnAuto) await setExtraBurn(next);
        await setItem(LAST_RUN_KEY, todayISO());
      } catch {
        // Sin conexión: se vuelve a intentar la próxima vez que se abra la app.
      }
      onDone();
    })();
  }, [ready, trend, setExtraBurn, onDone]);

  return null;
}
