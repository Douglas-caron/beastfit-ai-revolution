import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import { AnimatedExercise } from './components/AnimatedExercise.jsx';
import { Panel, Pill, StatCard } from './components/widgets.jsx';

export function WorkoutPage({ slug }) {
  const [page, setPage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/workout-pages/${slug}`).then(setPage).catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <div className="empty error">{error}</div>;
  if (!page) return <div className="loader">Montando pagina de treino...</div>;

  return (
    <section className="content-stack">
      <div className="workout-hero">
        <AnimatedExercise exercise={{ nome: page.title, grupo_muscular: page.focus, musculos_alvo: [] }} />
        <div>
          <p className="eyebrow">{page.category} - {page.focus}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
          <div className="pill-row"><Pill>{page.difficulty}</Pill><Pill>{page.duration_min} min</Pill><Pill>{page.goal}</Pill></div>
        </div>
      </div>
      <div className="grid four">
        <StatCard label="duracao" value={`${page.duration_min}m`} hint="tempo estimado" hot />
        <StatCard label="intensidade" value={page.difficulty} hint="ajustada por RPE" />
        <StatCard label="foco" value={page.focus} hint="musculo alvo" />
        <StatCard label="objetivo" value={page.goal} hint="periodizacao" />
      </div>
      <div className="grid two">
        {(page.blocks || []).map((block, index) => (
          <Panel key={index} title={block.title || `Bloco ${index + 1}`} eyebrow="protocolo">
            <ul className="workout-block">
              {(block.items || []).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
            </ul>
          </Panel>
        ))}
      </div>
    </section>
  );
}
