import React from 'react';

const PRESETS = [
  { id: 'this_month', label: 'This month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'custom', label: 'Custom date' },
];

export function PeriodFilter({ preset, onPreset, customStart, customEnd, onCustomStart, onCustomEnd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
      <div className="timeframe-pill-container">
        {PRESETS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPreset(item.id)}
            style={{
              border: 'none',
              background: preset === item.id ? 'var(--primary)' : 'transparent',
              color: preset === item.id ? 'var(--primary-foreground)' : 'var(--text-muted)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.785rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <>
          <input className="input" type="date" aria-label="Start date" value={customStart} onChange={(event) => onCustomStart(event.target.value)} />
          <input className="input" type="date" aria-label="End date" value={customEnd} onChange={(event) => onCustomEnd(event.target.value)} />
        </>
      )}
    </div>
  );
}

export default PeriodFilter;
