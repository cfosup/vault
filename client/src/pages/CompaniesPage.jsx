import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FolderTree,
  Tags,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  FolderPlus,
  CornerDownRight,
  AlertTriangle,
  Building,
  ArrowRight,
  Layers,
} from 'lucide-react';
import { GET_COMPANIES, GET_CATEGORIES } from '../graphql/queries';
import {
  CREATE_COMPANY,
  UPDATE_COMPANY,
  DELETE_COMPANY,
  CREATE_CATEGORY,
  DELETE_CATEGORY,
  DELETE_CATEGORY_SECTION,
  ADD_SUBCATEGORY,
  DELETE_SUBCATEGORY,
  RESET_COMPANY_CATEGORIES_TO_CORE,
} from '../graphql/mutations';

export const CompaniesPage = () => {
  // Company CRUD state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCoreBranch, setIsCoreBranch] = useState(false);

  // Category Structure Hierarchy Manager state
  const [structureCompany, setStructureCompany] = useState(null);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionLetter, setNewSectionLetter] = useState('');
  const [newSectionName, setNewSectionName] = useState('');

  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [targetSectionGroup, setTargetSectionGroup] = useState('');
  const [targetSectionLabel, setTargetSectionLabel] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newCatSubcat, setNewCatSubcat] = useState('');

  const [activeSubcatInputCatId, setActiveSubcatInputCatId] = useState(null);
  const [newSubcatName, setNewSubcatName] = useState('');

  // Queries & Mutations
  const { data: compData, loading, refetch: refetchCompanies } = useQuery(GET_COMPANIES);
  const companies = compData?.companies || [];

  const {
    data: catData,
    loading: catLoading,
    refetch: refetchCompanyCategories,
  } = useQuery(GET_CATEGORIES, {
    variables: { companyId: structureCompany?.id || null },
    skip: !structureCompany,
    fetchPolicy: 'cache-and-network',
  });

  const [createCompany, { loading: creatingComp }] = useMutation(CREATE_COMPANY);
  const [updateCompany, { loading: updatingComp }] = useMutation(UPDATE_COMPANY);
  const [deleteCompany] = useMutation(DELETE_COMPANY);

  const [createCategory, { loading: creatingCat }] = useMutation(CREATE_CATEGORY);
  const [deleteCategory] = useMutation(DELETE_CATEGORY);
  const [deleteCategorySection] = useMutation(DELETE_CATEGORY_SECTION);
  const [addSubcategory] = useMutation(ADD_SUBCATEGORY);
  const [deleteSubcategory] = useMutation(DELETE_SUBCATEGORY);
  const [resetToCore, { loading: resettingCore }] = useMutation(RESET_COMPANY_CATEGORIES_TO_CORE);

  const companyCategories = catData?.categories || [];

  // Group company categories by Section / Letter
  const groupedSections = useMemo(() => {
    const groups = new Map();
    const order = ['C', 'O', 'R', 'E', 'B', 'I', 'G', 'H', 'T'];

    for (const cat of companyCategories) {
      const groupKey = (cat.group || 'O').toUpperCase();
      const groupLabel = cat.groupLabel || `${groupKey} — General`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          categories: [],
        });
      }
      groups.get(groupKey).categories.push(cat);
    }

    return Array.from(groups.values()).sort((a, b) => {
      const idxA = order.indexOf(a.key);
      const idxB = order.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.key.localeCompare(b.key);
    });
  }, [companyCategories]);

  // Handlers for Company CRUD
  const handleOpenCreate = () => {
    setEditingCompany(null);
    setName('');
    setDescription('');
    setIsCoreBranch(false);
    setShowCompanyModal(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCompany(c);
    setName(c.name);
    setDescription(c.description || '');
    setIsCoreBranch(!!c.isCoreBranch);
    setShowCompanyModal(true);
  };

  const handleSubmitCompany = async (e) => {
    e.preventDefault();
    try {
      if (editingCompany) {
        await updateCompany({
          variables: {
            id: editingCompany.id,
            input: { name, description, isCoreBranch },
          },
        });
      } else {
        await createCompany({
          variables: {
            input: { name, description, isCoreBranch },
          },
        });
      }
      setShowCompanyModal(false);
      refetchCompanies();
    } catch (err) {
      alert('Error saving company: ' + err.message);
    }
  };

  const handleDeleteCompany = async (id) => {
    if (!window.confirm('Delete this company? Note: Expenses and budgets tied to this company will be affected.')) {
      return;
    }
    try {
      await deleteCompany({ variables: { id } });
      if (structureCompany?.id === id) setStructureCompany(null);
      refetchCompanies();
    } catch (err) {
      alert('Error deleting company: ' + err.message);
    }
  };

  // Hierarchy Manager Handlers
  const handleOpenStructure = (company) => {
    setStructureCompany(company);
    setActiveSubcatInputCatId(null);
  };

  const handleApplyCoreBranchTemplate = async () => {
    if (!structureCompany) return;
    if (
      !window.confirm(
        `Apply the standard 10-section CORE BRIGHT chart of accounts (51 categories) to "${structureCompany.name}"? This will populate standard corporate accounts.`
      )
    ) {
      return;
    }

    try {
      await resetToCore({ variables: { companyId: structureCompany.id } });
      refetchCompanyCategories();
      alert('Successfully applied CORE BRIGHT chart of accounts to ' + structureCompany.name);
    } catch (err) {
      alert('Error applying template: ' + err.message);
    }
  };

  const handleAddSectionSubmit = (e) => {
    e.preventDefault();
    if (!newSectionLetter.trim() || !newSectionName.trim()) return;

    const letter = newSectionLetter.trim().toUpperCase().charAt(0);
    const label = `${letter} — ${newSectionName.trim()}`;

    setTargetSectionGroup(letter);
    setTargetSectionLabel(label);
    setShowAddSectionModal(false);
    setNewCatName('');
    setNewCatSubcat('');
    setShowAddCatModal(true);
  };

  const handleOpenAddCategory = (group, label) => {
    setTargetSectionGroup(group);
    setTargetSectionLabel(label);
    setNewCatName('');
    setNewCatSubcat('');
    setShowAddCatModal(true);
  };

  const handleCreateCategorySubmit = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const subcategories = newCatSubcat.trim()
        ? [{ name: newCatSubcat.trim(), items: [], isCustom: true }]
        : [];

      await createCategory({
        variables: {
          input: {
            companyId: structureCompany.id,
            name: newCatName.trim(),
            group: targetSectionGroup,
            groupLabel: targetSectionLabel,
            subcategories,
          },
        },
      });

      setShowAddCatModal(false);
      refetchCompanyCategories();
    } catch (err) {
      alert('Error adding category: ' + err.message);
    }
  };

  const handleDeleteCat = async (categoryId) => {
    if (!window.confirm('Delete this category and its subcategories from this company?')) return;
    try {
      await deleteCategory({ variables: { id: categoryId } });
      refetchCompanyCategories();
    } catch (err) {
      alert('Error deleting category: ' + err.message);
    }
  };

  const handleDeleteSection = async (group) => {
    if (
      !window.confirm(
        `Delete the entire Section "${group}" and all categories within it for ${structureCompany.name}?`
      )
    ) {
      return;
    }

    try {
      await deleteCategorySection({
        variables: {
          companyId: structureCompany.id,
          group,
        },
      });
      refetchCompanyCategories();
    } catch (err) {
      alert('Error deleting section: ' + err.message);
    }
  };

  const handleAddSubcategorySubmit = async (categoryId) => {
    if (!newSubcatName.trim()) return;
    try {
      await addSubcategory({
        variables: {
          categoryId,
          subcategoryName: newSubcatName.trim(),
        },
      });
      setNewSubcatName('');
      setActiveSubcatInputCatId(null);
      refetchCompanyCategories();
    } catch (err) {
      alert('Error adding subcategory: ' + err.message);
    }
  };

  const handleDeleteSubcat = async (categoryId, subcategoryName) => {
    try {
      await deleteSubcategory({
        variables: {
          categoryId,
          subcategoryName,
        },
      });
      refetchCompanyCategories();
    } catch (err) {
      alert('Error deleting subcategory: ' + err.message);
    }
  };

  const getCompanyInitials = (cName) => {
    if (!cName) return 'CO';
    return cName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '1.5rem 1.75rem',
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-surface) 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Legal Entities & Chart of Accounts</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
              {companies.length} Registered Divisions
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Manage subsidiaries, provision Core Branch accounting frameworks, and define hierarchical category trees
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleOpenCreate} style={{ padding: '0.45rem 1rem' }}>
          <Plus size={15} /> Add New Entity
        </button>
      </div>

      {/* Main Grid: Companies List */}
      <div className="grid-3">
        {companies.map((company) => (
          <div
            key={company.id}
            className="card halo-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.15rem',
              borderTop: company.isCoreBranch ? '3px solid var(--primary)' : '1px solid var(--border-color)',
            }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius)',
                    background: company.isCoreBranch ? 'var(--primary-gradient)' : 'var(--bg-surface)',
                    color: company.isCoreBranch ? '#fff' : 'var(--text-main)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    fontFamily: 'Plus Jakarta Sans',
                    boxShadow: company.isCoreBranch ? 'var(--shadow-glow)' : 'none',
                  }}
                >
                  {getCompanyInitials(company.name)}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{company.name}</h3>
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.2rem' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>
                      Active Entity
                    </span>
                    {company.isCoreBranch && (
                      <span
                        className="badge badge-primary"
                        style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <ShieldCheck size={11} /> Core Branch
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenEdit(company)}
                  title="Edit Company Details"
                  style={{ padding: '0.35rem 0.5rem' }}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDeleteCompany(company.id)}
                  title="Delete Company"
                  style={{ padding: '0.35rem 0.5rem', color: 'var(--danger)' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Description */}
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', minHeight: '38px', lineHeight: 1.45 }}>
              {company.description || 'No business division description specified.'}
            </p>

            {/* Action to Manage Category Hierarchy */}
            <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenStructure(company)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  padding: '0.5rem',
                }}
              >
                <FolderTree size={15} style={{ color: 'var(--primary)' }} />
                <span>Explore Chart of Accounts</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Category Structure Hierarchy Drawer / Modal */}
      {structureCompany && (
        <div className="modal-backdrop" onClick={() => setStructureCompany(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '920px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.85rem' }}
          >
            {/* Hierarchy Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{structureCompany.name}</h2>
                  {structureCompany.isCoreBranch && (
                    <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ShieldCheck size={12} /> Core Branch Architecture
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span>Entity</span>
                  <ChevronRight size={12} />
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>CORE BRIGHT Section</span>
                  <ChevronRight size={12} />
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Category</span>
                  <ChevronRight size={12} />
                  <span>Sub-category</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleApplyCoreBranchTemplate}
                  disabled={resettingCore}
                  title="Provision standard 51 CORE BRIGHT accounts"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Sparkles size={13} style={{ color: 'var(--primary)' }} />
                  <span>{resettingCore ? 'Applying...' : 'Apply Core Template'}</span>
                </button>

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddSectionModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <FolderPlus size={13} />
                  <span>+ Add Section</span>
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setStructureCompany(null)}
                  style={{ padding: '0.4rem' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Hierarchy Tree Content */}
            <div style={{ overflowY: 'auto', flex: 1, paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {catLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading category structure...
                </div>
              ) : groupedSections.length === 0 ? (
                <div className="card" style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <FolderTree size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-main)' }}>
                    No Category Hierarchy Provisioned
                  </h3>
                  <p style={{ fontSize: '0.85rem', maxWidth: '440px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                    This company has not initialized its chart of accounts yet. Apply the standard 10-section CORE BRIGHT template or add custom sections from scratch.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleApplyCoreBranchTemplate}>
                      <Sparkles size={14} /> Apply CORE BRIGHT Template
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSectionModal(true)}>
                      <FolderPlus size={14} /> Add Custom Section
                    </button>
                  </div>
                </div>
              ) : (
                groupedSections.map((sec) => (
                  <div
                    key={sec.key}
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)',
                      padding: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.85rem',
                    }}
                  >
                    {/* Section Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <span className={`section-pill section-pill-${sec.key}`} style={{ fontSize: '0.85rem', padding: '0.2rem 0.6rem' }}>
                          {sec.key}
                        </span>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{sec.label}</h4>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {sec.categories.length} Accounts in this section
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenAddCategory(sec.key, sec.label)}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        >
                          <Plus size={12} /> Add Category
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteSection(sec.key)}
                          title="Delete entire section"
                          style={{ padding: '0.25rem 0.45rem', color: 'var(--danger)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Categories under Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingLeft: '0.75rem' }}>
                      {sec.categories.map((cat) => (
                        <div
                          key={cat.id}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem 0.95rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <CornerDownRight size={13} style={{ color: 'var(--primary)' }} />
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{cat.name}</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setActiveSubcatInputCatId(activeSubcatInputCatId === cat.id ? null : cat.id);
                                  setNewSubcatName('');
                                }}
                                style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                              >
                                + Sub-category
                              </button>

                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleDeleteCat(cat.id)}
                                title="Delete category"
                                style={{ padding: '0.2rem 0.4rem', color: 'var(--danger)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Sub-categories Chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', paddingLeft: '1.25rem' }}>
                            {cat.subcategories.length === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                No subcategories (general spend)
                              </span>
                            ) : (
                              cat.subcategories.map((sub, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-color)',
                                    padding: '0.2rem 0.55rem',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.75rem',
                                    color: 'var(--text-main)',
                                  }}
                                >
                                  {sub.name}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSubcat(cat.id, sub.name)}
                                    title="Delete subcategory"
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: 'var(--text-muted)',
                                      cursor: 'pointer',
                                      padding: 0,
                                      display: 'flex',
                                    }}
                                  >
                                    <X size={11} />
                                  </button>
                                </span>
                              ))
                            )}
                          </div>

                          {/* Inline Sub-category Input */}
                          {activeSubcatInputCatId === cat.id && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', paddingLeft: '1.25rem', marginTop: '0.3rem' }}>
                              <input
                                type="text"
                                className="input"
                                style={{ padding: '0.25rem 0.55rem', fontSize: '0.8rem', maxWidth: '260px' }}
                                placeholder="Sub-category name..."
                                value={newSubcatName}
                                onChange={(e) => setNewSubcatName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddSubcategorySubmit(cat.id);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleAddSubcategorySubmit(cat.id)}
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setActiveSubcatInputCatId(null)}
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddSectionModal && (
        <div className="modal-backdrop" onClick={() => setShowAddSectionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add New Section / Letter</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSectionModal(false)} style={{ padding: '0.3rem' }}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddSectionSubmit}>
              <div className="form-group">
                <label className="form-label">Section Letter (1 Character)</label>
                <input
                  type="text"
                  className="input mono"
                  maxLength="2"
                  placeholder="X"
                  value={newSectionLetter}
                  onChange={(e) => setNewSectionLetter(e.target.value.toUpperCase())}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Section Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Special Ventures"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddSectionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Next: Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCatModal && (
        <div className="modal-backdrop" onClick={() => setShowAddCatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Add Category</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Section: <strong style={{ color: 'var(--text-main)' }}>{targetSectionLabel}</strong>
                </span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddCatModal(false)} style={{ padding: '0.3rem' }}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Corporate Insurance"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Initial Sub-category (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. General Liability"
                  value={newCatSubcat}
                  onChange={(e) => setNewCatSubcat(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddCatModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingCat}>
                  {creatingCat ? 'Adding...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Company Add / Edit Modal */}
      {showCompanyModal && (
        <div className="modal-backdrop" onClick={() => setShowCompanyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {editingCompany ? 'Edit Legal Entity' : 'Register New Company'}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCompanyModal(false)} style={{ padding: '0.35rem' }}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSubmitCompany} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Company / Legal Entity Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Acme Tech Solutions Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Business Description</label>
                <textarea
                  className="textarea"
                  rows="3"
                  placeholder="Primary operating division, legal subsidiary, or project entity..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {!editingCompany && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                  }}
                >
                  <input
                    type="checkbox"
                    id="isCoreBranchCheck"
                    checked={isCoreBranch}
                    onChange={(e) => setIsCoreBranch(e.target.checked)}
                    style={{ marginTop: '0.2rem', accentColor: 'var(--primary)' }}
                  />
                  <label htmlFor="isCoreBranchCheck" style={{ cursor: 'pointer' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      Designate as Core Branch
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      Automatically provisions the standard 10-section CORE BRIGHT chart of accounts (51 categories across Compliance, Operations, Risk, etc.) into this company's private namespace.
                    </div>
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompanyModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingComp || updatingComp}>
                  {creatingComp || updatingComp ? 'Saving...' : editingCompany ? 'Save Changes' : 'Register Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompaniesPage;
