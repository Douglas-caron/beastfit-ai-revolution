import React, { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { Layout } from './components/Layout.jsx';
import { PageFactory } from './PageFactory.jsx';
import { pageMeta } from './pages.js';
import { StudentProfile } from './StudentProfile.jsx';
import { ExerciseDetail } from './ExerciseDetail.jsx';
import { WorkoutPage } from './WorkoutPage.jsx';
import { RecommendationDetail } from './RecommendationDetail.jsx';

function currentPath() {
  return window.location.pathname || '/';
}

export default function App() {
  const [path, setPath] = useState(currentPath());
  const [summary, setSummary] = useState(null);

  function navigate(next) {
    window.history.pushState({}, '', next);
    setPath(currentPath());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    api('/api/summary').then(setSummary).catch(() => {});
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const route = useMemo(() => matchRoute(path), [path]);

  return (
    <Layout path={path} navigate={navigate} summary={summary}>
      {route.kind === 'student' && <StudentProfile id={route.id} navigate={navigate} />}
      {route.kind === 'exercise' && <ExerciseDetail id={route.id} navigate={navigate} />}
      {route.kind === 'workout' && <WorkoutPage slug={route.slug} navigate={navigate} />}
      {route.kind === 'recommendation' && <RecommendationDetail id={route.id} navigate={navigate} />}
      {route.kind === 'page' && <PageFactory page={route.page} navigate={navigate} />}
    </Layout>
  );
}

function matchRoute(path) {
  const student = path.match(/^\/alunos\/(\d+)$/);
  if (student) return { kind: 'student', id: Number(student[1]) };
  const exercise = path.match(/^\/exercicios\/(\d+)$/);
  if (exercise) return { kind: 'exercise', id: Number(exercise[1]) };
  const workout = path.match(/^\/treinos\/([^/]+)$/);
  if (workout) return { kind: 'workout', slug: workout[1] };
  const recommendation = path.match(/^\/recomendacoes\/(\d+)$/);
  if (recommendation) return { kind: 'recommendation', id: Number(recommendation[1]) };
  const page = pageMeta.find((item) => item.path === path) || pageMeta.find((item) => item.path === '/') || pageMeta[0];
  return { kind: 'page', page };
}
