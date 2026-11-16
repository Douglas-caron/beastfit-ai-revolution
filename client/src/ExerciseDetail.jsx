import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { AnimatedExercise } from './components/AnimatedExercise.jsx';
import { DataTable, Panel, Pill, StatCard } from './components/widgets.jsx';

export function ExerciseDetail({ id }) {
  const [exercise, setExercise] = useState(null);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await api(`/api/exercises/${id}`);
        setExercise(data);
        setRelated(await api(`/api/exercises?group=${encodeURIComponent(data.grupo_muscular)}`));
      } catch (err) { setError(err.message); }
    }
    load();
  }, [id]);

  if (error) return <div className="empty error">{error}</div>;
  if (!exercise) return <div className="loader">Carregando exercicio animado...</div>;

  return (
    <section className="content-stack">
      <div className="exercise-hero">
        <AnimatedExercise exercise={exercise} />
        <div>
          <p className="eyebrow">{exercise.grupo_muscular} - {exercise.equipamento}</p>
          <h2>{exercise.nome}</h2>
          <p>{exercise.descricao}</p>
          <div className="pill-row">
            <Pill>{exercise.nivel}</Pill>
            <Pill>{exercise.padrao_movimento}</Pill>
            <Pill tone={exercise.contraindicacoes === 'sem contraindicacao padrao' ? 'good' : 'warn'}>{exercise.contraindicacoes}</Pill>
          </div>
        </div>
      </div>
      <div className="grid three">
        <StatCard label="series sugeridas" value={exercise.nivel === 'avancado' ? '4-5' : '3-4'} hint="adaptavel pela IA" hot />
        <StatCard label="RPE alvo" value={exercise.nivel === 'iniciante' ? '6/10' : '7-8/10'} hint="seguranca primeiro" />
        <StatCard label="descanso" value={exercise.grupo_muscular === 'cardio' ? '45s' : '60-90s'} hint="recalculado por fadiga" />
      </div>
      <Panel title="Exercicios relacionados" eyebrow="atlas muscular">
        <DataTable rows={related} max={12} />
      </Panel>
    </section>
  );
}
