import React from 'react';

export function PageHeader({ page, overline, children }) {
  return (
    <section className="page-hero">
      <div>
        <p className="eyebrow">{overline || page?.group || 'BeastFit AI'}</p>
        <h2>{page?.title || 'Pagina'}</h2>
        <p>{page?.objective || 'Operacao inteligente, segura e auditavel para redes de academias.'}</p>
      </div>
      <div className="hero-orb" aria-hidden="true">
        <span />
      </div>
      {children}
    </section>
  );
}
