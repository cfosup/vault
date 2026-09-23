import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { Tags, Folder, ChevronRight, Search } from 'lucide-react';
import { GET_CATEGORIES } from '../graphql/queries';

export const CategoriesPage = () => {
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');

  const { data, loading } = useQuery(GET_CATEGORIES);
  const categories = data?.categories || [];

  // Groups
  const groups = ['ALL', 'C', 'O', 'R', 'E', 'B', 'I', 'G', 'H', 'T'];
  const groupLabels = {
    ALL: 'All Groups',
    C: 'C — Compliance',
    O: 'O — Operations',
    R: 'R — Risk & Reserves',
    E: 'E — Equipment & Systems',
    B: 'B — Brand & Culture',
    I: 'I — Incentives & Hospitality',
    G: 'G — Growth (Marketing & Sales)',
    H: 'H — Human Resources',
    T: 'T — Tours & Events',
  };

  const filteredCategories = categories.filter((cat) => {
    const matchesGroup = selectedGroup === 'ALL' || cat.group === selectedGroup;
    const matchesSearch =
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      cat.subcategories.some((s) => s.name.toLowerCase().includes(search.toLowerCase()));
    return matchesGroup && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Chart of Accounts & Categories</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Explore the 50+ pre-seeded CORE BRIGHT financial categories and subcategories
        </p>
      </div>

      {/* Filter Chips & Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '32px' }}
            placeholder="Search categories or subcategories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {groups.map((g) => (
            <button
              key={g}
              className={`btn btn-sm ${selectedGroup === g ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedGroup(g)}
            >
              {groupLabels[g] || g}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid-2">
        {filteredCategories.map((cat) => (
          <div key={cat.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Folder size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1rem' }}>{cat.name}</h3>
              </div>
              <span className="badge badge-neutral">{cat.groupLabel || cat.group}</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
              {cat.subcategories.length === 0 ? (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>General expenses</span>
              ) : (
                cat.subcategories.map((sub, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      color: 'var(--text-main)',
                    }}
                  >
                    {sub.name}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoriesPage;
