import React from 'react';
import { formatNumber, formatPct } from '../api.js';

export function StatCard({ label, value, hint, hot }) {
  return <div className={`stat-card ${hot ? 'hot' : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>;
}

export function Panel({ title, eyebrow, children, action }) {
  return <section className="panel">
    <div className="panel-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>;
}

export function DataTable({ rows = [], max = 14, onRow, empty = 'Sem dados para exibir.' }) {
  const visible = rows.slice(0, max);
  if (!visible.length) return <div className="empty">{empty}</div>;
  const keys = Object.keys(visible[0]).filter((key) => !key.endsWith('_json')).slice(0, 7);
  return <div className="table-wrap"><table className="data-table"><thead><tr>{keys.map((key) => <th key={key}>{key}</th>)}</tr></thead><tbody>
    {visible.map((row, index) => <tr key={row.id || row.codigo || index} onClick={() => onRow?.(row)}>
      {keys.map((key) => <td key={key}>{formatCell(row[key])}</td>)}
    </tr>)}
  </tbody></table></div>;
}

function formatCell(value) {
  if (value == null) return '-';
  if (typeof value === 'number') {
    if (value > 0 && value < 1) return formatPct(value);
    return formatNumber(value);
  }
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 80);
  return String(value).slice(0, 90);
}

export function Gauge({ value = 0.5, label = 'score' }) {
  const v = Math.max(0, Math.min(1, Number(value || 0)));
  const degrees = Math.round(v * 180);
  return <div className="gauge" style={{ '--deg': `${degrees}deg` }}>
    <div className="gauge-arc"><div className="gauge-needle" /></div>
    <strong>{formatPct(v)}</strong>
    <span>{label}</span>
  </div>;
}

export function Sparkline({ values = [] }) {
  const clean = values.map(Number).filter((n) => !Number.isNaN(n));
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const span = max - min || 1;
  const points = clean.map((value, index) => `${(index / Math.max(clean.length - 1, 1)) * 100},${100 - ((value - min) / span) * 100}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={points} /></svg>;
}

export function BarList({ rows = [], labelKey = 'grupo', valueKey = 'valor', max = 10 }) {
  const visible = rows.slice(0, max);
  const biggest = Math.max(...visible.map((row) => Number(row[valueKey] || 0)), 1);
  return <div className="bar-list">
    {visible.map((row, i) => <div className="bar-row" key={i}>
      <span>{row[labelKey]}</span>
      <div><i style={{ width: `${(Number(row[valueKey] || 0) / biggest) * 100}%` }} /></div>
      <b>{typeof row[valueKey] === 'number' && row[valueKey] < 1 ? formatPct(row[valueKey]) : row[valueKey]}</b>
    </div>)}
  </div>;
}

export function Pill({ children, tone = 'default' }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function ActionButton({ children, onClick, danger, disabled }) {
  return <button className={`action ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
