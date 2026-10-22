import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Building,
  DollarSign,
  Sparkles,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateUtils';
import { getRecentIncomeSelections, setCachedIncomeSelection } from '../../utils/incomeCache';

/**
 * Modern SaaS Hierarchical Combobox & Multiple Selector for Expense-Income Reference.
 *
 * Combines best-in-class UI patterns:
 * 1. Searchable Combobox with floating popover & keyboard/click-outside support.
 * 2. Expandable Company Groups (Class) with nested Income items (Sub-Class) and counts.
 * 3. Multi-Select Checkboxes with removable chips in the trigger.
 * 4. Recently Used / Created (Cached) entries pinned at the top.
 * 5. Desktop and mobile touch responsiveness.
 */
export const CompanyIncomeSelect = ({
  companies = [],
  incomes = [],
  companyId = '',
  incomeId = '',
  incomeIds = null,
  incomeAllocations = null,
  expenseAmount = 0,
  userId = null,
  onChange,
  placeholder = 'Link to Income (Optional)',
  disabled = false,
  variant = 'full', // 'full' (Quick Entry card) | 'compact' (Spreadsheet table cell)
  className = '',
  style = {},
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState(() => new Set());
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Normalize current selected income IDs array
  const selectedIncomeIds = useMemo(() => {
    if (Array.isArray(incomeIds)) {
      return incomeIds.filter(Boolean);
    }
    if (incomeId) {
      return [incomeId];
    }
    return [];
  }, [incomeId, incomeIds]);

  // Read recently used items from cache
  const recentItems = useMemo(() => {
    return getRecentIncomeSelections(userId);
  }, [userId, isOpen, companyId, incomeId]);

  // Group incomes by companyId
  const incomesByCompany = useMemo(() => {
    const map = new Map();
    for (const comp of companies) {
      map.set(comp.id, []);
    }
    for (const inc of incomes) {
      if (!inc.companyId) continue;
      if (!map.has(inc.companyId)) {
        map.set(inc.companyId, []);
      }
      map.get(inc.companyId).push(inc);
    }
    return map;
  }, [companies, incomes]);

  // Initialize expanded companies: default to company of current selection or active companies
  useEffect(() => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (companyId) {
        next.add(companyId);
      }
      // If none expanded yet, expand companies that have incomes
      if (next.size === 0) {
        for (const [cId, list] of incomesByCompany.entries()) {
          if (list.length > 0) next.add(cId);
        }
      }
      return next;
    });
  }, [companyId, incomesByCompany]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filtered companies & incomes based on searchQuery
  const { filteredCompanies, matchingIncomeMap, totalMatches } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        filteredCompanies: companies,
        matchingIncomeMap: incomesByCompany,
        totalMatches: incomes.length,
      };
    }

    const matchingMap = new Map();
    const resultCompanies = [];
    let count = 0;

    for (const comp of companies) {
      const compNameMatches = comp.name.toLowerCase().includes(q);
      const allCompIncomes = incomesByCompany.get(comp.id) || [];
      const matchingIncomes = allCompIncomes.filter((inc) => {
        const sourceMatch = (inc.source || '').toLowerCase().includes(q);
        const notesMatch = (inc.notes || '').toLowerCase().includes(q);
        const amountMatch = String(inc.amount || '').includes(q);
        const dateMatch = (inc.date || '').includes(q);
        return sourceMatch || notesMatch || amountMatch || dateMatch;
      });

      if (compNameMatches || matchingIncomes.length > 0) {
        resultCompanies.push(comp);
        matchingMap.set(comp.id, compNameMatches ? allCompIncomes : matchingIncomes);
        count += compNameMatches ? allCompIncomes.length : matchingIncomes.length;
      }
    }

    return {
      filteredCompanies: resultCompanies,
      matchingIncomeMap: matchingMap,
      totalMatches: count,
    };
  }, [companies, incomesByCompany, searchQuery, incomes.length]);

  // When search query is active, auto-expand matching companies
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingIds = new Set(filteredCompanies.map((c) => c.id));
      setExpandedCompanies(matchingIds);
    }
  }, [searchQuery, filteredCompanies]);

  const toggleCompanyExpand = (cId, e) => {
    if (e) e.stopPropagation();
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(cId)) {
        next.delete(cId);
      } else {
        next.add(cId);
      }
      return next;
    });
  };

  const handleExpandAll = (e) => {
    e.stopPropagation();
    setExpandedCompanies(new Set(companies.map((c) => c.id)));
  };

  const handleCollapseAll = (e) => {
    e.stopPropagation();
    setExpandedCompanies(new Set());
  };

  // Toggle selection for a specific income (supports multi-incomes from multiple companies)
  const handleToggleIncome = (inc) => {
    if (!inc) return;
    const isCurrentlySelected = selectedIncomeIds.includes(inc.id);
    let nextIds = [];

    if (isCurrentlySelected) {
      nextIds = selectedIncomeIds.filter((id) => id !== inc.id);
    } else {
      // Allow multi-selection of incomes across multiple companies simultaneously
      nextIds = [...selectedIncomeIds, inc.id];
    }

    const selectedIncomes = incomes.filter((i) => nextIds.includes(i.id));
    // Determine the primary companyId: either current company if it has selected incomes, or the first selected income's company
    const targetCompanyId = selectedIncomes.length > 0
      ? (companyId && selectedIncomes.some((i) => i.companyId === companyId) ? companyId : selectedIncomes[0].companyId)
      : (companyId || (companies[0]?.id || ''));

    const comp = companies.find((c) => c.id === targetCompanyId);

    // Save to persistent recent cache
    setCachedIncomeSelection(userId, {
      companyId: inc.companyId,
      companyName: companies.find((c) => c.id === inc.companyId)?.name || '',
      incomeId: inc.id,
      incomeSource: inc.source,
      incomeAmount: inc.amount,
      incomeDate: inc.date,
    });

    if (onChange) {
      onChange({
        companyId: targetCompanyId,
        incomeId: nextIds[0] || null,
        incomeIds: nextIds,
        selectedIncomes,
        company: comp,
      });
    }
  };

  // Select general unlinked company option
  const handleSelectCompanyUnlinked = (comp) => {
    if (!comp) return;
    setCachedIncomeSelection(userId, {
      companyId: comp.id,
      companyName: comp.name || '',
      incomeId: null,
    });

    if (onChange) {
      onChange({
        companyId: comp.id,
        incomeId: null,
        incomeIds: [],
        selectedIncomes: [],
        company: comp,
      });
    }
  };

  // Remove single selected chip
  const handleRemoveChip = (incId, e) => {
    if (e) e.stopPropagation();
    const nextIds = selectedIncomeIds.filter((id) => id !== incId);
    const selectedIncomes = incomes.filter((i) => nextIds.includes(i.id));
    const targetCompanyId = selectedIncomes.length > 0
      ? (companyId && selectedIncomes.some((i) => i.companyId === companyId) ? companyId : selectedIncomes[0].companyId)
      : companyId;
    const comp = companies.find((c) => c.id === targetCompanyId);

    if (onChange) {
      onChange({
        companyId: targetCompanyId,
        incomeId: nextIds[0] || null,
        incomeIds: nextIds,
        selectedIncomes,
        company: comp,
      });
    }
  };

  // Clear all selections (Set to unlinked general expense)
  const handleClearAll = (e) => {
    if (e) e.stopPropagation();
    if (onChange) {
      onChange({
        companyId: companyId || '',
        incomeId: null,
        incomeIds: [],
        selectedIncomes: [],
        company: activeCompanyObj || null,
      });
    }
  };

  // Selected income objects
  const selectedIncomesList = useMemo(() => {
    return selectedIncomeIds
      .map((id) => incomes.find((i) => i.id === id))
      .filter(Boolean);
  }, [selectedIncomeIds, incomes]);

  const activeCompanyObj = companies.find((c) => c.id === companyId);

  return (
    <div
      ref={containerRef}
      className={`company-income-combobox ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        userSelect: 'none',
        fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      {/* TRIGGER BUTTON (Shadcn Multiple Selector Trigger with Removable Chips) */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.35rem',
          minHeight: variant === 'compact' ? '34px' : '40px',
          padding: variant === 'compact' ? '0.2rem 0.5rem' : '0.35rem 0.65rem',
          background: 'var(--bg-input)',
          border: `1px solid ${isOpen ? 'var(--ring)' : 'var(--border-color)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease',
          boxShadow: isOpen
            ? '0 0 0 1px var(--ring), 0 2px 6px -1px rgba(0,0,0,0.1)'
            : 'inset 0 1px 1px rgba(0,0,0,0.04)',
        }}
      >
        {/* Left Side: Removable Chips or Placeholder */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.35rem',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          {selectedIncomesList.length > 0 ? (
            selectedIncomesList.map((inc) => {
              const comp = companies.find((c) => c.id === inc.companyId);
              const alloc = Array.isArray(incomeAllocations)
                ? incomeAllocations.find((a) => a.incomeId === inc.id)
                : null;
              const hasCustomAlloc = alloc && typeof alloc.amount === 'number' && selectedIncomeIds.length > 1;

              return (
                <span
                  key={inc.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.2rem 0.5rem',
                    background: 'color-mix(in srgb, var(--accent) 55%, var(--card))',
                    border: '1px solid color-mix(in srgb, var(--border) 80%, rgba(255,255,255,0.08))',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: variant === 'compact' ? '0.72rem' : '0.78rem',
                    color: 'var(--text-main)',
                    fontWeight: 500,
                    maxWidth: variant === 'compact' ? '180px' : '320px',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  title={`${comp ? comp.name + ' → ' : ''}${inc.source} (₹${Number(inc.amount).toLocaleString('en-IN')} total${
                    hasCustomAlloc ? `, ₹${Number(alloc.amount).toLocaleString('en-IN')} allocated` : ''
                  })`}
                >
                  <DollarSign size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {comp ? `${comp.name}: ` : ''}
                    {inc.source}
                  </span>
                  <span
                    className="mono"
                    style={{
                      color: hasCustomAlloc ? 'var(--success)' : 'var(--text-muted)',
                      fontWeight: hasCustomAlloc ? 700 : 500,
                      fontSize: '0.72rem',
                      flexShrink: 0,
                    }}
                  >
                    {hasCustomAlloc
                      ? `Used: ₹${Number(alloc.amount).toLocaleString('en-IN')}`
                      : `₹${Number(inc.amount).toLocaleString('en-IN')}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleRemoveChip(inc.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '0 2px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-muted)',
                      transition: 'all 0.12s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--danger)';
                      e.currentTarget.style.transform = 'scale(1.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Remove link"
                  >
                    <X size={12} />
                  </button>
                </span>
              );
            })
          ) : (
            <span
              style={{
                fontSize: variant === 'compact' ? '0.78rem' : '0.85rem',
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {placeholder}
            </span>
          )}
        </div>

        {/* Right Side Controls: Clear All + Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          {selectedIncomesList.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear all linked incomes"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>
      </div>

      {/* FLOATING POPOVER DROPDOWN (Shadcn Combobox + Nested Groups with GlassKit styling) */}
      {isOpen && (
        <div
          role="listbox"
          className="glass-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: variant === 'compact' ? 'auto' : 0,
            minWidth: variant === 'compact' ? '330px' : '100%',
            maxWidth: '480px',
            background: 'color-mix(in srgb, var(--card) 92%, transparent)',
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 20px 48px -8px rgba(0,0,0,0.5), 0 0 0 1px var(--border-color), inset 0 1px 0 0 rgba(255,255,255,0.08)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '410px',
          }}
        >
          {/* 1. SEARCH INPUT HEADER */}
          <div
            style={{
              padding: '0.55rem 0.75rem',
              borderBottom: '1px solid var(--border-color)',
              background: 'color-mix(in srgb, var(--bg-surface) 60%, transparent)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search income, payee, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.825rem',
                color: 'var(--text-main)',
                width: '100%',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '3px',
                }}
              >
                <X size={13} />
              </button>
            ) : (
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '3px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.02em',
                }}
              >
                ESC
              </span>
            )}
          </div>

          {/* 2. SUB-HEADER TOOLBAR (Expand/Collapse All Toggle) */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.35rem 0.75rem',
              background: 'color-mix(in srgb, var(--bg-app) 70%, transparent)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}
          >
            <span style={{ fontWeight: 500 }}>
              {searchQuery ? `${totalMatches} matching result${totalMatches === 1 ? '' : 's'}` : 'Expandable Company Groups'}
            </span>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleExpandAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                Expand all
              </button>
              <span style={{ opacity: 0.4 }}>•</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  padding: '0.1rem 0.3rem',
                  borderRadius: '3px',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                Collapse all
              </button>
            </div>
          </div>

          {/* 3. SCROLLABLE GROUPS & OPTIONS LIST */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: '0.35rem 0',
              maxHeight: '290px',
            }}
          >
            {/* 0. DEFAULT UNLINKED GENERAL EXPENSE OPTION */}
            {!searchQuery && (
              <div
                onClick={handleClearAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  background: selectedIncomeIds.length === 0 ? 'var(--bg-surface-hover)' : 'transparent',
                  fontSize: '0.8rem',
                  borderBottom: '1px solid var(--border-color)',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = selectedIncomeIds.length === 0 ? 'var(--bg-surface-hover)' : 'transparent')}
              >
                <div
                  style={{
                    width: '15px',
                    height: '15px',
                    borderRadius: '3px',
                    border: `1.5px solid ${selectedIncomeIds.length === 0 ? 'var(--primary)' : 'var(--border-color)'}`,
                    background: selectedIncomeIds.length === 0 ? 'var(--primary)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {selectedIncomeIds.length === 0 && <Check size={11} style={{ color: 'var(--primary-foreground)' }} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: selectedIncomeIds.length === 0 ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    — None (Unlinked General Expense) —
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Default operational expense not linked to any revenue stream
                  </span>
                </div>
              </div>
            )}

            {/* A. RECENTLY USED / CREATED (CACHED) SECTION */}
            {!searchQuery && recentItems.length > 0 && (
              <div style={{ marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid var(--border-color)' }}>
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Sparkles size={11} style={{ color: 'var(--primary)' }} />
                  <span>Recently Used / Created (Cached)</span>
                </div>

                {recentItems.map((rec, i) => {
                  const isChecked = rec.incomeId ? selectedIncomeIds.includes(rec.incomeId) : companyId === rec.companyId && selectedIncomeIds.length === 0;

                  return (
                    <div
                      key={rec.incomeId || `rec_${rec.companyId}_${i}`}
                      onClick={() => {
                        if (rec.incomeId) {
                          const inc = incomes.find((x) => x.id === rec.incomeId) || {
                            id: rec.incomeId,
                            companyId: rec.companyId,
                            source: rec.incomeSource,
                            amount: rec.incomeAmount,
                            date: rec.incomeDate,
                          };
                          handleToggleIncome(inc);
                        } else {
                          const comp = companies.find((c) => c.id === rec.companyId);
                          handleSelectCompanyUnlinked(comp);
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.35rem 0.75rem',
                        cursor: 'pointer',
                        background: isChecked ? 'var(--bg-surface-hover)' : 'transparent',
                        fontSize: '0.8rem',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = isChecked ? 'var(--bg-surface-hover)' : 'transparent')}
                    >
                      {/* Checkbox */}
                      <div
                        style={{
                          width: '15px',
                          height: '15px',
                          borderRadius: '3px',
                          border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                          background: isChecked ? 'var(--primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.1s ease',
                        }}
                      >
                        {isChecked && <Check size={11} style={{ color: 'var(--primary-foreground)' }} />}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rec.companyName ? `${rec.companyName} → ` : ''}
                            {rec.incomeSource || 'Unlinked General Expense'}
                          </span>
                          <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.05rem 0.35rem' }}>
                            Recent
                          </span>
                        </div>
                        {rec.incomeAmount ? (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            ₹{Number(rec.incomeAmount).toLocaleString('en-IN')}
                            {rec.incomeDate ? ` • ${formatDisplayDate(rec.incomeDate)}` : ''}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* B. HIERARCHICAL COMPANY (CLASS) -> INCOMES (SUB-CLASS) ACCORDIONS */}
            {filteredCompanies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
                <Search size={22} style={{ marginBottom: '0.35rem', opacity: 0.5 }} />
                <div>No income entries found matching "{searchQuery}"</div>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    marginTop: '0.35rem',
                    fontWeight: 600,
                  }}
                >
                  Clear search
                </button>
              </div>
            ) : (
              filteredCompanies.map((comp) => {
                const isExpanded = expandedCompanies.has(comp.id);
                const compIncomes = matchingIncomeMap.get(comp.id) || [];
                const isCompUnlinkedSelected = companyId === comp.id && selectedIncomeIds.length === 0;

                return (
                  <div key={comp.id} style={{ marginBottom: '0.25rem' }}>
                    {/* COMPANY HEADER (CLASS) */}
                    <div
                      onClick={(e) => toggleCompanyExpand(comp.id, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.75rem',
                        background: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        borderTop: '1px solid var(--border-color)',
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-surface) 80%, transparent)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, overflow: 'hidden' }}>
                        <ChevronRight
                          size={13}
                          style={{
                            color: 'var(--text-muted)',
                            transform: isExpanded ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                            flexShrink: 0,
                          }}
                        />
                        <Building size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {comp.name}
                        </span>
                      </div>

                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', flexShrink: 0, border: '1px solid var(--border-color)' }}
                      >
                        {compIncomes.length} {compIncomes.length === 1 ? 'income' : 'incomes'}
                      </span>
                    </div>

                    {/* EXPANDABLE INCOMES LIST (SUB-CLASS) */}
                    {isExpanded && (
                      <div style={{ padding: '0.15rem 0' }}>
                        {/* 1. Unlinked option for this company */}
                        <div
                          onClick={() => handleSelectCompanyUnlinked(comp)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.35rem 0.75rem 0.35rem 1.75rem',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            background: isCompUnlinkedSelected ? 'var(--bg-surface-hover)' : 'transparent',
                            color: isCompUnlinkedSelected ? 'var(--primary)' : 'var(--text-muted)',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = isCompUnlinkedSelected ? 'var(--bg-surface-hover)' : 'transparent')}
                        >
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: `1.5px solid ${isCompUnlinkedSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                              background: isCompUnlinkedSelected ? 'var(--primary)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          >
                            {isCompUnlinkedSelected && <Check size={11} style={{ color: 'var(--primary-foreground)', strokeWidth: 3 }} />}
                          </div>
                          <span style={{ fontStyle: 'italic' }}>
                            🏷️ {comp.name} — (General Unlinked Expense)
                          </span>
                        </div>

                        {/* 2. List of incomes under this company */}
                        {compIncomes.map((inc) => {
                          const isChecked = selectedIncomeIds.includes(inc.id);

                          return (
                            <div
                              key={inc.id}
                              onClick={() => handleToggleIncome(inc)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.35rem 0.75rem 0.35rem 1.75rem',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                background: isChecked ? 'var(--bg-surface-hover)' : 'transparent',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface-hover)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = isChecked ? 'var(--bg-surface-hover)' : 'transparent')}
                            >
                              {/* Multi-Select Checkbox (Linear rounded style) */}
                              <div
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '4px',
                                  border: `1.5px solid ${isChecked ? 'var(--primary)' : 'var(--border-color)'}`,
                                  background: isChecked ? 'var(--primary)' : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                                  boxShadow: isChecked ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                }}
                              >
                                {isChecked && <Check size={11} style={{ color: 'var(--primary-foreground)', strokeWidth: 3 }} />}
                              </div>

                              {/* Income Details */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, minWidth: 0, gap: '0.5rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {inc.source}
                                  </span>
                                  {inc.notes && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {inc.notes}
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                                  <span className="mono" style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.8rem' }}>
                                    ₹{Number(inc.amount).toLocaleString('en-IN')}
                                  </span>
                                  {inc.date && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                      {formatDisplayDate(inc.date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {compIncomes.length === 0 && (
                          <div style={{ padding: '0.35rem 0.75rem 0.35rem 1.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            (No incomes recorded for this company)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* 4. POPOVER FOOTER / SUMMARY BAR */}
          <div
            style={{
              padding: '0.5rem 0.85rem',
              borderTop: '1px solid var(--border-color)',
              background: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              {selectedIncomeIds.length > 0 ? (
                (() => {
                  const sel = incomes.filter((i) => selectedIncomeIds.includes(i.id));
                  const compCount = new Set(sel.map((i) => i.companyId)).size;
                  return `${selectedIncomeIds.length} ${selectedIncomeIds.length === 1 ? 'income' : 'incomes'} linked ${
                    compCount > 1 ? `(across ${compCount} entities)` : ''
                  }`;
                })()
              ) : activeCompanyObj ? (
                `1 company (general unlinked)`
              ) : (
                'No revenue linked'
              )}
            </span>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {(selectedIncomeIds.length > 0 || activeCompanyObj) && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: '0.2rem 0.45rem',
                    borderRadius: 'var(--radius-xs)',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="btn btn-primary"
                style={{
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  height: '28px',
                  fontWeight: 600,
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
