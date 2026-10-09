import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getSupabaseClient } from '../utils/supabaseClient';
import { competitionNow, isSundayPractice, syncCompetitionClock } from '../utils/competitionClock';
import { getWeekId } from '../utils/dateUtils';

interface Winner { name: string; playerId: string; points: number; weekId: string; }
interface CompetitionState { practiceOnly: boolean; winner: Winner | null; loading: boolean; unavailable: boolean; }
const CompetitionContext = createContext<CompetitionState>({ practiceOnly: isSundayPractice(), winner: null, loading: true, unavailable: false });
export const useCompetition = () => useContext(CompetitionContext);

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [practiceOnly, setPracticeOnly] = useState(isSundayPractice);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let week = getWeekId(competitionNow());
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error('Competition service unavailable');
        const { data, error } = await client.rpc('get_competition_status');
        if (error || !data || !Number.isFinite(data.serverTime)) throw new Error('Competition service unavailable');
        if (!stopped) {
          syncCompetitionClock(data.serverTime);
          setPracticeOnly(isSundayPractice());
          setWinner(data.lastWeekWinner ?? null);
          setUnavailable(false);
        }
      } catch {
        if (!stopped) setUnavailable(true);
      } finally {
        busy = false;
        if (!stopped) setLoading(false);
      }
    };
    const tick = () => {
      setPracticeOnly(isSundayPractice());
      const currentWeek = getWeekId(competitionNow());
      if (week !== currentWeek) { week = currentWeek; setWinner(null); void refresh(); }
    };
    const onFocus = () => { tick(); void refresh(); };
    void refresh();
    const clock = window.setInterval(tick, 1000);
    const poll = window.setInterval(refresh, 60000);
    window.addEventListener('focus', onFocus);
    return () => { stopped = true; clearInterval(clock); clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, []);
  return <CompetitionContext.Provider value={{ practiceOnly, winner, loading, unavailable }}>{children}</CompetitionContext.Provider>;
}
