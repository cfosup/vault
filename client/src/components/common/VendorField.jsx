import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_VENDOR_SUGGESTIONS } from '../../graphql/queries';

export const VendorField = ({ categoryId, subcategory, value, onChange, placeholder = 'Who did you pay?' }) => {
  const [focused, setFocused] = useState(false);
  const sub = (subcategory || '').trim();
  const { data, loading } = useQuery(GET_VENDOR_SUGGESTIONS, {
    variables: { categoryId, subcategory: sub || null },
    skip: !categoryId,
    fetchPolicy: 'cache-and-network',
  });

  const typed = (value || '').trim().toLowerCase();
  const names = (data?.vendorSuggestions || []).filter((name) => name && name.toLowerCase() !== typed);
  const matches = names.filter((name) => !typed || name.toLowerCase().includes(typed));
  const showChips = Boolean(categoryId) && matches.length > 0 && (focused || !typed);

  return (
    <div className="vendor-field">
      <input
        type="text"
        className="input"
        placeholder={categoryId ? placeholder : 'Choose a category first'}
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 160)}
      />
      {showChips && (
        <div className="vendor-chips" role="listbox">
          <span className="vendor-menu-label">
            {sub ? `Used in ${sub}` : 'Used in this category'}
          </span>
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              className="vendor-chip"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(name);
                setFocused(false);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {categoryId && !loading && names.length === 0 && !typed && (
        <p className="field-hint">
          {sub
            ? 'No previous vendor for this subcategory. Type a name and it will show up next time.'
            : 'No previous vendor for this category yet.'}
        </p>
      )}
    </div>
  );
};
