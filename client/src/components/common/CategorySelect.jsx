import React, { useMemo } from 'react';

/**
 * Reusable Category Selector that groups categories by Section / Letter.
 * Ensures the relationship "Section / Letter → Category" is immediately obvious.
 *
 * e.g.
 * C — Compliance
 *   • Statutory Filings & Registrations
 *   • Financial Compliance
 * O — Operations
 *   • Infrastructure & Utilities
 *   • Procurement & Consumables
 */
export const CategorySelect = ({
  categories = [],
  value = '',
  onChange,
  placeholder = '— Select Category —',
  required = false,
  disabled = false,
  className = 'select',
  style = {},
  includeAddNew = false,
  onAddNew,
  ...props
}) => {
  // Group categories by section/letter (group / groupLabel)
  const groupedCategories = useMemo(() => {
    const groups = new Map();

    // Standard CORE BRIGHT section order preference
    const order = ['C', 'O', 'R', 'E', 'B', 'I', 'G', 'H', 'T'];

    for (const cat of categories) {
      const groupKey = (cat.group || 'O').toUpperCase();
      const groupLabel = cat.groupLabel || `${groupKey} — Other`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          items: [],
        });
      }
      groups.get(groupKey).items.push(cat);
    }

    // Sort groups according to CORE BRIGHT order, followed by custom alphabetical
    const sortedGroups = Array.from(groups.values()).sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.key.localeCompare(b.key);
    });

    // Sort items within each group alphabetically
    for (const g of sortedGroups) {
      g.items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return sortedGroups;
  }, [categories]);

  const handleChange = (e) => {
    const selectedVal = e.target.value;
    if (selectedVal === '__ADD_NEW__') {
      if (onAddNew) onAddNew();
      return;
    }
    if (onChange) onChange(e);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      required={required}
      disabled={disabled}
      className={className}
      style={{
        ...style,
      }}
      {...props}
    >
      <option value="">{placeholder}</option>

      {includeAddNew && (
        <option value="__ADD_NEW__" style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
          + Add New Category...
        </option>
      )}

      {groupedCategories.map((group) => (
        <optgroup key={group.key} label={`Section ${group.label}`}>
          {group.items.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {group.key} — {cat.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default CategorySelect;
