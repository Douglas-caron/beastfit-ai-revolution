import React from 'react';

const zones = {
  peitoral: ['chest'],
  costas: ['back'],
  quadriceps: ['quads'],
  posterior: ['hamstrings'],
  gluteos: ['glutes'],
  ombros: ['shoulders'],
  biceps: ['arms'],
  triceps: ['arms'],
  core: ['abs'],
  cardio: ['heart','legs'],
  fullbody: ['chest','back','abs','quads','arms','shoulders'],
  mobilidade: ['spine','shoulders','hips']
};

export function AnimatedExercise({ exercise, compact = false }) {
  const targets = new Set([...(zones[exercise?.grupo_muscular] || []), ...((exercise?.musculos_alvo || []).join(' ').includes('glute') ? ['glutes'] : [])]);
  const active = (name) => targets.has(name) ? 'hot-zone' : '';
  return <div className={`exercise-anim ${compact ? 'compact' : ''}`}>
    <svg viewBox="0 0 220 260" role="img" aria-label="corpo animado com musculos alvo">
      <defs>
        <radialGradient id="redGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#ff3434" stopOpacity="1" />
          <stop offset="100%" stopColor="#7a0000" stopOpacity=".2" />
        </radialGradient>
      </defs>
      <circle className="body-line head" cx="110" cy="34" r="18" />
      <path className="body-line" d="M110 52 L110 126" />
      <path className={`muscle-zone ${active('spine')}`} d="M105 58 C98 80 99 105 106 128 L114 128 C121 105 122 80 115 58 Z" />
      <path className={`muscle-zone ${active('chest')}`} d="M76 66 C90 54 106 58 110 76 C114 58 130 54 144 66 C142 88 126 99 110 91 C94 99 78 88 76 66 Z" />
      <path className={`muscle-zone ${active('back')}`} d="M72 82 C88 70 132 70 148 82 C145 108 129 126 110 129 C91 126 75 108 72 82 Z" />
      <path className={`muscle-zone ${active('abs')}`} d="M96 94 L124 94 L130 139 L90 139 Z" />
      <path className={`muscle-zone ${active('shoulders')}`} d="M58 66 C66 52 82 54 88 68 C80 78 66 80 58 66 Z M132 68 C138 54 154 52 162 66 C154 80 140 78 132 68 Z" />
      <path className={`muscle-zone arm-left ${active('arms')}`} d="M62 78 C44 96 38 122 42 147 C52 146 58 131 61 112 C65 98 72 89 81 80 Z" />
      <path className={`muscle-zone arm-right ${active('arms')}`} d="M158 78 C176 96 182 122 178 147 C168 146 162 131 159 112 C155 98 148 89 139 80 Z" />
      <path className={`muscle-zone ${active('hips')}`} d="M88 136 C101 128 119 128 132 136 L126 160 L94 160 Z" />
      <path className={`muscle-zone ${active('glutes')}`} d="M88 137 C95 127 108 131 110 145 C112 131 125 127 132 137 C128 153 118 162 110 160 C102 162 92 153 88 137 Z" />
      <path className={`muscle-zone leg-left ${active('quads')} ${active('legs')}`} d="M92 158 C80 185 74 218 76 246 C88 250 96 217 105 165 Z" />
      <path className={`muscle-zone leg-right ${active('quads')} ${active('legs')}`} d="M128 158 C140 185 146 218 144 246 C132 250 124 217 115 165 Z" />
      <path className={`muscle-zone ${active('hamstrings')}`} d="M78 166 C86 172 96 174 104 166 C101 197 95 226 86 246 C76 225 72 194 78 166 Z M116 166 C124 174 134 172 142 166 C148 194 144 225 134 246 C125 226 119 197 116 166 Z" />
      <circle className={`muscle-zone heart ${active('heart')}`} cx="118" cy="78" r="9" />
      <path className="motion-line one" d="M34 32 C18 70 24 108 42 142" />
      <path className="motion-line two" d="M186 32 C202 70 196 108 178 142" />
    </svg>
    <div className="anim-caption">
      <strong>{exercise?.nome || 'Exercicio inteligente'}</strong>
      <span>{exercise?.grupo_muscular || 'fullbody'} em foco</span>
    </div>
  </div>;
}

export function MuscleMap({ group = 'fullbody' }) {
  return <div className="muscle-map-card">
    <AnimatedExercise exercise={{ nome: `Ativacao ${group}`, grupo_muscular: group, musculos_alvo: [] }} />
    <p>As areas em vermelho pulsam como um GIF para indicar onde o exercicio pega. Tudo foi feito em SVG/CSS, sem depender de imagem paga.</p>
  </div>;
}
