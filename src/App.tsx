import { useState, useEffect, useMemo, useCallback, type FormEvent } from 'react';
import type { WorkoutSet } from './types';
import { loadSets, saveSets } from './store';

const DEFAULT_EXERCISES = [
  'ベンチプレス', 'スクワット', 'デッドリフト', 'オーバーヘッドプレス',
  'バーベルロウ', '懸垂', 'ラットプルダウン', 'レッグプレス',
  'ダンベルカール', 'トライセプスエクステンション', 'レッグカール', 'カーフレイズ',
  'ダンベルプレス', 'ケーブルフライ', 'フェイスプル', 'ルーマニアンデッドリフト',
];

function dateStr(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function today(): string {
  return dateStr(Date.now());
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function WeightChart({ sets, exercise }: { sets: WorkoutSet[]; exercise: string }) {
  const data = useMemo(() => {
    const exerciseSets = sets.filter(s => s.exercise === exercise);
    const byDate: Record<string, { maxWeight: number; ts: number }> = {};
    for (const s of exerciseSets) {
      const ds = dateStr(s.timestamp);
      if (!byDate[ds] || s.weight > byDate[ds].maxWeight) {
        byDate[ds] = { maxWeight: s.weight, ts: s.timestamp };
      }
    }
    return Object.entries(byDate)
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(-14)
      .map(([date, v]) => ({ date, weight: v.maxWeight, ts: v.ts }));
  }, [sets, exercise]);

  if (data.length === 0) return null;

  const maxW = Math.max(...data.map(d => d.weight));
  const minW = Math.min(...data.map(d => d.weight));
  const range = maxW - minW || 1;
  const padded = range * 0.15;
  const yMin = Math.max(0, minW - padded);
  const yMax = maxW + padded;
  const yRange = yMax - yMin || 1;

  const W = 400;
  const H = 160;
  const PL = 44;
  const PR = 12;
  const PT = 12;
  const PB = 28;
  const cw = W - PL - PR;
  const ch = H - PT - PB;

  const points = data.map((d, i) => ({
    x: PL + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw),
    y: PT + ch - ((d.weight - yMin) / yRange) * ch,
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  const yTicks = [yMin, yMin + yRange / 2, yMax].map(v => Math.round(v));

  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`}>
      {yTicks.map(v => {
        const y = PT + ch - ((v - yMin) / yRange) * ch;
        return (
          <g key={v}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fill="var(--text-dim)" fontSize="10" fontFamily="var(--mono)">
              {v}
            </text>
          </g>
        );
      })}
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="var(--accent)" />
          <text
            x={p.x}
            y={H - PB + 16}
            textAnchor="middle"
            fill="var(--text-dim)"
            fontSize="9"
            fontFamily="var(--mono)"
          >
            {formatDate(p.ts)}
          </text>
          <text
            x={p.x}
            y={p.y - 8}
            textAnchor="middle"
            fill="var(--text-strong)"
            fontSize="10"
            fontWeight="700"
            fontFamily="var(--mono)"
          >
            {p.weight}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function App() {
  const [sets, setSets] = useState<WorkoutSet[]>(loadSets);
  const [exercise, setExercise] = useState(DEFAULT_EXERCISES[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [prFlash, setPrFlash] = useState<{ exercise: string; weight: number; reps: number } | null>(null);
  const [newSetId, setNewSetId] = useState<string | null>(null);
  const [graphExercise, setGraphExercise] = useState<string | null>(null);

  useEffect(() => {
    saveSets(sets);
  }, [sets]);

  const todayStr = today();

  const allExercises = useMemo(() => {
    const fromHistory = [...new Set(sets.map(s => s.exercise).reverse())];
    const rest = DEFAULT_EXERCISES.filter(e => !fromHistory.includes(e));
    return [...fromHistory, ...rest];
  }, [sets]);

  const loggedExercises = useMemo(
    () => [...new Set(sets.map(s => s.exercise))],
    [sets],
  );

  const todaySets = useMemo(
    () => sets.filter(s => dateStr(s.timestamp) === todayStr).reverse(),
    [sets, todayStr],
  );

  const totalVolume = useMemo(
    () => sets.reduce((sum, s) => sum + s.weight * s.reps, 0),
    [sets],
  );

  const level = Math.floor(Math.sqrt(totalVolume / 1000)) + 1;
  const levelMin = Math.pow(level - 1, 2) * 1000;
  const levelMax = Math.pow(level, 2) * 1000;
  const levelProgress = totalVolume > 0 ? Math.min((totalVolume - levelMin) / (levelMax - levelMin), 1) : 0;

  const streak = useMemo(() => {
    const dates = new Set(sets.map(s => dateStr(s.timestamp)));
    let count = 0;
    const d = new Date();
    if (!dates.has(dateStr(d.getTime()))) {
      d.setDate(d.getDate() - 1);
    }
    while (dates.has(dateStr(d.getTime()))) {
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  }, [sets]);

  const prs = useMemo(() => {
    const records: Record<string, { weight: number; reps: number; date: number }> = {};
    for (const s of sets) {
      if (!records[s.exercise] || s.weight > records[s.exercise].weight) {
        records[s.exercise] = { weight: s.weight, reps: s.reps, date: s.timestamp };
      }
    }
    return records;
  }, [sets]);

  const currentExercise = customMode ? customName : exercise;

  const lastSet = useMemo(() => {
    for (let i = sets.length - 1; i >= 0; i--) {
      if (sets[i].exercise === currentExercise) return sets[i];
    }
    return null;
  }, [sets, currentExercise]);

  const handleExerciseChange = useCallback((name: string) => {
    setExercise(name);
    const last = sets.findLast(s => s.exercise === name);
    if (last) {
      setWeight(String(last.weight));
      setReps(String(last.reps));
    } else {
      setWeight('');
      setReps('');
    }
  }, [sets]);

  const adjustWeight = useCallback((delta: number) => {
    setWeight(prev => {
      const val = parseFloat(prev) || 0;
      return String(Math.max(0, val + delta));
    });
  }, []);

  const adjustReps = useCallback((delta: number) => {
    setReps(prev => {
      const val = parseInt(prev) || 0;
      return String(Math.max(0, val + delta));
    });
  }, []);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    const r = parseInt(reps);
    const name = customMode ? customName.trim() : exercise;
    if (!name || isNaN(w) || isNaN(r) || w <= 0 || r <= 0) return;

    const id = crypto.randomUUID();
    const newSet: WorkoutSet = { id, exercise: name, weight: w, reps: r, timestamp: Date.now() };

    const currentPr = prs[name];
    if (!currentPr || w > currentPr.weight) {
      setPrFlash({ exercise: name, weight: w, reps: r });
      setTimeout(() => setPrFlash(null), 2500);
    }

    setSets(prev => [...prev, newSet]);
    setNewSetId(id);
    setTimeout(() => setNewSetId(null), 600);

    if (customMode) {
      setCustomMode(false);
      setExercise(name);
      setCustomName('');
    }
  }, [weight, reps, exercise, customMode, customName, prs]);

  const handleDelete = useCallback((id: string) => {
    setSets(prev => prev.filter(s => s.id !== id));
  }, []);

  return (
    <div className="app">
      {prFlash && (
        <div className="pr-overlay">
          <div className="pr-title">新記録</div>
          <div className="pr-exercise">{prFlash.exercise}</div>
          <div className="pr-detail">{prFlash.weight}kg x {prFlash.reps}</div>
        </div>
      )}

      <header className="header">
        <div className="header-top">
          <h1 className="title">筋肉ログ</h1>
          <div className="header-chips">
            <div className="chip">Lv.{level}</div>
            {streak > 0 && <div className="chip">{streak}日連続</div>}
          </div>
        </div>
        <div className="level-bar">
          <div className="level-fill" style={{ width: `${levelProgress * 100}%` }} />
        </div>
      </header>

      <form className="log-form" onSubmit={handleSubmit}>
        <div className="exercise-row">
          {customMode ? (
            <input
              className="exercise-input"
              type="text"
              placeholder="種目名を入力"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              autoFocus
            />
          ) : (
            <select
              className="exercise-select"
              value={exercise}
              onChange={e => handleExerciseChange(e.target.value)}
            >
              {allExercises.map(ex => (
                <option key={ex} value={ex}>{ex}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="add-exercise-btn"
            onClick={() => {
              setCustomMode(!customMode);
              setCustomName('');
            }}
          >
            {customMode ? '<' : '+'}
          </button>
        </div>

        {lastSet && !customMode && (
          <div className="last-set-hint">
            前回: {lastSet.weight}kg x {lastSet.reps}
          </div>
        )}

        <div className="input-row">
          <div className="input-group">
            <label>重量 (kg)</label>
            <div className="input-controls">
              <button type="button" onClick={() => adjustWeight(-2.5)}>-2.5</button>
              <input
                type="number"
                step="0.5"
                inputMode="decimal"
                placeholder="0"
                value={weight}
                onChange={e => setWeight(e.target.value)}
              />
              <button type="button" onClick={() => adjustWeight(2.5)}>+2.5</button>
            </div>
          </div>
          <div className="input-group">
            <label>回数</label>
            <div className="input-controls">
              <button type="button" onClick={() => adjustReps(-1)}>-1</button>
              <input
                type="number"
                step="1"
                inputMode="numeric"
                placeholder="0"
                value={reps}
                onChange={e => setReps(e.target.value)}
              />
              <button type="button" onClick={() => adjustReps(1)}>+1</button>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="log-btn"
          disabled={!weight || !reps || (customMode && !customName.trim())}
        >
          記録する
        </button>
      </form>

      {todaySets.length > 0 ? (
        <section className="session">
          <h2>セッション</h2>
          {todaySets.map(s => {
            const isPr = prs[s.exercise]?.date === s.timestamp && prs[s.exercise]?.weight === s.weight;
            return (
              <div
                key={s.id}
                className={`set-row${s.id === newSetId ? ' new' : ''}${isPr ? ' is-pr' : ''}`}
              >
                <span className="set-name">{s.exercise}</span>
                <span className="set-detail">{s.weight}kg x {s.reps}</span>
                {isPr && <span className="pr-badge">最高</span>}
                <button
                  type="button"
                  className="set-del"
                  onClick={() => handleDelete(s.id)}
                >
                  x
                </button>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="empty-state">
          最初のセットを記録しよう
        </div>
      )}

      {loggedExercises.length > 0 && (
        <section className="graph-section">
          <h2>グラフ</h2>
          <div className="graph-exercise-list">
            {loggedExercises.map(ex => (
              <button
                key={ex}
                type="button"
                className={`graph-exercise-btn${graphExercise === ex ? ' active' : ''}`}
                onClick={() => setGraphExercise(graphExercise === ex ? null : ex)}
              >
                {ex}
              </button>
            ))}
          </div>
          {graphExercise && (
            <div className="graph-container">
              <WeightChart sets={sets} exercise={graphExercise} />
            </div>
          )}
        </section>
      )}

      {Object.keys(prs).length > 0 && (
        <section className="records">
          <h2>自己ベスト</h2>
          {Object.entries(prs)
            .sort((a, b) => b[1].date - a[1].date)
            .map(([ex, pr]) => (
              <div key={ex} className="record-row">
                <span className="record-name">{ex}</span>
                <span className="record-weight">{pr.weight}kg x {pr.reps}</span>
                <span className="record-date">{formatDate(pr.date)}</span>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
