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
  Database,
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
import { ConfirmModal } from '../components/common/ConfirmModal';

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

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger',
    loading: false,
  });

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

  const promptDeleteCompany = (c) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Company Entity',
      message: `Are you sure you want to permanently delete "${c.name}"? Historical disbursements, incomes, and budgets linked to this entity will be impacted.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteCompany({ variables: { id: c.id } });
          if (structureCompany?.id === c.id) setStructureCompany(null);
          refetchCompanies();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          alert('Error deleting company: ' + err.message);
          setConfirmDialog((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  // Hierarchy Manager Handlers
  const handleOpenStructure = (company) => {
    setStructureCompany(company);
    setActiveSubcatInputCatId(null);
  };

  const promptApplyCoreBranchTemplate = () => {
    if (!structureCompany) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Apply Standard CORE BRIGHT Template',
      message: `Apply the complete 10-section CORE BRIGHT chart of accounts (51 categories) to "${structureCompany.name}"? This will populate standard corporate account categories.`,
      variant: 'primary',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await resetToCore({ variables: { companyId: structureCompany.id } });
          refetchCompanyCategories();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          alert('Error applying template: ' + err.message);
          setConfirmDialog((prev) => ({ ...prev, loading: false }));
        }
      },
    });
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

  const promptDeleteCat = (categoryId, categoryName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Category',
      message: `Delete "${categoryName}" and its subcategories from ${structureCompany?.name}?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteCategory({ variables: { id: categoryId } });
          refetchCompanyCategories();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          alert('Error deleting category: ' + err.message);
          setConfirmDialog((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const promptDeleteSection = (groupKey, groupLabel) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Entire Section',
      message: `Delete all categories in section "${groupLabel}" for ${structureCompany?.name}?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteCategorySection({
            variables: {
              companyId: structureCompany.id,
              group: groupKey,
            },
          });
          refetchCompanyCategories();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          alert('Error deleting section: ' + err.message);
          setConfirmDialog((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const handleAddSubcatSubmit = async (catId) => {
    if (!newSubcatName.trim()) return;

    try {
      await addSubcategory({
        variables: {
          categoryId: catId,
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

  const promptDeleteSubcat = (categoryId, subcatName) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Subcategory',
      message: `Remove subcategory "${subcatName}"?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, loading: true }));
        try {
          await deleteSubcategory({
            variables: {
              categoryId,
              subcategoryName: subcatName,
            },
          });
          refetchCompanyCategories();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err) {
          alert('Error removing subcategory: ' + err.message);
          setConfirmDialog((prev) => ({ ...prev, loading: false }));
        }
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header Card */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          padding: '1.35rem 1.65rem',
          background: 'var(--bg-card)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem' }}>Corporate Entities & Chart of Accounts</h1>
            <span className="badge badge-primary">
              {companies.length} Registered Entities
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Manage subsidiary entities, define individual charts of accounts, and structure CORE BRIGHT operational sections
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
          <Plus size={15} /> + Register Company
        </button>
      </div>

      {/* Grid of Companies */}
      <div className="grid-3">
        {companies.map((c) => {
          const isSelected = structureCompany?.id === c.id;

          return (
            <div
              key={c.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                boxShadow: isSelected ? 'var(--shadow-md)' : 'var(--shadow-xs)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius)',
                      background: c.isCoreBranch ? 'var(--primary)' : 'var(--bg-surface)',
                      color: c.isCoreBranch ? '#fff' : 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1rem',
                      boxShadow: 'none',
                    }}
                  >
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{c.name}</h3>
                    {c.isCoreBranch ? (
                      <span className="badge badge-success" style={{ fontSize: '0.68rem', marginTop: '0.2rem' }}>
                        Core Operating Branch
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: '0.68rem', marginTop: '0.2rem' }}>
                        Subsidiary / Branch
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => handleOpenEdit(c)}
                    title="Edit Entity"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn btn-secondary btn-icon"
                    onClick={() => promptDeleteCompany(c)}
                    title="Delete Entity"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Description */}
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', minHeight: '36px', lineHeight: 1.45 }}>
                {c.description || 'No corporate profile description provided.'}
              </p>

              {/* Structure Button */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
                <button
                  type="button"
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  style={{ width: '100%' }}
                  onClick={() => handleOpenStructure(c)}
                >
                  <FolderTree size={14} />
                  {isSelected ? 'Chart of Accounts Active' : 'Manage Chart of Accounts'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Structure Manager Section */}
      {structureCompany && (
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            border: '1.5px solid var(--primary)',
            background: 'var(--bg-card)',
          }}
        >
          {/* Structure Manager Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderTree size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.25rem' }}>
                  Chart of Accounts: <span style={{ color: 'var(--primary)' }}>{structureCompany.name}</span>
                </h2>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Customized category hierarchy and CORE BRIGHT structure for this specific legal entity
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={promptApplyCoreBranchTemplate}
                disabled={resettingCore}
              >
                <Database size={14} style={{ color: 'var(--primary)' }} />
                {resettingCore ? 'Applying...' : 'Apply CORE BRIGHT Pre-Seed (51 Accounts)'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowAddSectionModal(true)}
              >
                <Plus size={14} /> + Add Section Letter
              </button>
            </div>
          </div>

          {/* Grouped Sections List */}
          {groupedSections.length === 0 ? (
            <div className="empty-state" style={{ padding: '3.5rem 1rem' }}>
              <div className="empty-icon"><FolderTree size={24} /></div>
              <div className="empty-title">No categories in chart of accounts</div>
              <div className="empty-desc">
                Click "Apply CORE BRIGHT Pre-Seed" to populate 51 corporate account categories or create custom sections manually.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groupedSections.map((sec) => (
                <div
                  key={sec.key}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)',
                    padding: '1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  {/* Section Title Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className={`section-pill section-pill-${sec.key}`} style={{ fontSize: '0.85rem', padding: '0.25rem 0.65rem' }}>
                        Section {sec.key}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{sec.label}</span>
                      <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                        {sec.categories.length} Categories
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenAddCategory(sec.key, sec.label)}
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                      >
                        <Plus size={12} /> Add Category
                      </button>
                      <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => promptDeleteSection(sec.key, sec.label)}
                        title="Delete Entire Section"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Categories Grid inside Section */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '0.75rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    {sec.categories.map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.75rem 0.85rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.55rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{cat.name}</span>
                          <button
                            className="btn btn-ghost btn-icon"
                            onClick={() => promptDeleteCat(cat.id, cat.name)}
                            title="Delete Category"
                            style={{ padding: '0.2rem', color: 'var(--danger)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Subcategories Chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {cat.subcategories.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {sub.name}
                              <button
                                type="button"
                                onClick={() => promptDeleteSubcat(cat.id, sub.name)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer', padding: 0 }}
                                title="Remove subcategory"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))}

                          {activeSubcatInputCatId === cat.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%', marginTop: '0.25rem' }}>
                              <input
                                type="text"
                                className="input"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                placeholder="Subcategory name..."
                                value={newSubcatName}
                                onChange={(e) => setNewSubcatName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddSubcatSubmit(cat.id);
                                  if (e.key === 'Escape') setActiveSubcatInputCatId(null);
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                                onClick={() => handleAddSubcatSubmit(cat.id)}
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.25rem 0.4rem' }}
                                onClick={() => setActiveSubcatInputCatId(null)}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubcatInputCatId(cat.id);
                                setNewSubcatName('');
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px dashed var(--border-color)',
                                padding: '0.15rem 0.45rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.7rem',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                              }}
                            >
                              + Subcategory
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Confirm"
        cancelText="Cancel"
        variant={confirmDialog.variant}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Add / Edit Company Modal */}
      {showCompanyModal && (
        <div className="modal-backdrop" onClick={() => setShowCompanyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
                    {editingCompany ? 'Edit Legal Entity' : 'Register Corporate Entity'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Add branch, subsidiary, or holding company
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCompanyModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitCompany}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Company Legal Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Acme Technologies India Pvt Ltd"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Entity Purpose / Profile</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Software Development & Cloud Operations"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.25rem' }}>
                  <input
                    type="checkbox"
                    id="isCoreBranch"
                    checked={isCoreBranch}
                    onChange={(e) => setIsCoreBranch(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="isCoreBranch" style={{ fontSize: '0.825rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                    Set as Core Operating Entity
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCompanyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creatingComp || updatingComp}>
                  {creatingComp || updatingComp ? 'Saving...' : editingCompany ? 'Update Entity' : 'Register Entity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Section Letter Modal */}
      {showAddSectionModal && (
        <div className="modal-backdrop" onClick={() => setShowAddSectionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Add Section Letter</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  e.g. "X — Special Projects"
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddSectionModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddSectionSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Section Letter (Single Alphabet)</label>
                  <input
                    type="text"
                    className="input mono"
                    maxLength="1"
                    placeholder="X"
                    value={newSectionLetter}
                    onChange={(e) => setNewSectionLetter(e.target.value.toUpperCase())}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Section Title</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. Special Ventures"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddSectionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Proceed to Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCatModal && (
        <div className="modal-backdrop" onClick={() => setShowAddCatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Add Account Category</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Section: <strong style={{ color: 'var(--text-main)' }}>{targetSectionLabel}</strong>
                </span>
              </div>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowAddCatModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCategorySubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. SaaS Subscriptions"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial Subcategory (Optional)</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="e.g. GitHub & Figma Seats"
                    value={newCatSubcat}
                    onChange={(e) => setNewCatSubcat(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddCatModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={creatingCat}>
                  {creatingCat ? 'Adding...' : 'Add Category'}
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
