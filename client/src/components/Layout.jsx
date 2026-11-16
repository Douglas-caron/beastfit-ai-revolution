import React, { useMemo, useState } from 'react';
import { groupedPages, pageMeta } from '../pages.js';

export function Layout({ path, navigate, children, summary }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedPages;
    return Object.fromEntries(Object.entries(groupedPages)
      .map(([group, pages]) => [group, pages.filter((p) => `${p.title} ${p.group} ${p.objective}`.toLowerCase().includes(q))])
      .filter(([, pages]) => pages.length));
  }, [query]);

  const active = pageMeta.find((p) => p.path === path) || pageMeta.find((p) => p.path === '/');

  return (
    <div className="app-shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <button className="close-menu" onClick={() => setOpen(false)}>fechar</button>
        <div className="brand" onClick={() => navigate('/')}>
          <div className="brand-mark">BF</div>
          <div>
            <strong>BeastFit AI</strong>
            <span>Revolution Gym OS</span>
          </div>
        </div>
        <div className="search-box">
          <span>buscar</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="aluno, IA, treino, LGPD..." />
        </div>
        <nav className="nav-groups">
          {Object.entries(filteredGroups).map(([group, pages]) => (
            <section key={group}>
              <h4>{group}</h4>
              {pages.map((page) => (
                <button
                  key={page.path}
                  onClick={() => { navigate(page.path); setOpen(false); }}
                  className={path === page.path ? 'nav-link active' : 'nav-link'}
                >
                  <span>{page.title}</span>
                  <small>{page.type}</small>
                </button>
              ))}
            </section>
          ))}
        </nav>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="hamburger" onClick={() => setOpen(true)}>menu</button>
          <div>
            <p className="eyebrow">{active?.group || 'Operacao'}</p>
            <h1>{active?.title || 'Dashboard'}</h1>
          </div>
          <div className="top-actions">
            <div className="mini-stat">
              <span>paginas</span>
              <strong>{summary?.pages || pageMeta.length}</strong>
            </div>
            <div className="mini-stat">
              <span>APIs</span>
              <strong>{summary?.integrations || 100}</strong>
            </div>
            <div className="status-dot"><i />online</div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
