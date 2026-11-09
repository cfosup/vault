import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { Lock, Repeat, UserPlus, Users } from 'lucide-react';
import { GET_ORG_MEMBERS, GET_COMPANIES, GET_MONTH_LOCKS, GET_RECURRING } from '../../graphql/queries';
import { INVITE_MEMBER, UPDATE_MEMBER_ACCESS, REMOVE_MEMBER, LOCK_MONTH, UNLOCK_MONTH, STOP_RECURRING } from '../../graphql/mutations';
import { isOwner } from '../../utils/access';
import { useAuthStore } from '../../store/authStore';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const emptyForm = {
  email: '',
  accessScope: 'modules',
  expenses: true,
  income: false,
  companyIds: [],
  canDeleteExpenses: false,
  canDeleteIncome: false,
};

const accessLabel = (member) => {
  if (!member.accessScope || member.accessScope === 'workspace') return 'Whole workspace';
  const names = (member.modules || []).map((item) => (item === 'income' ? 'Income' : 'Expenses'));
  return names.length ? names.join(' and ') : 'No areas selected';
};

export const OrgAccessPanel = () => {
  const user = useAuthStore((state) => state.user);
  const owner = isOwner(user);
  const { data, refetch } = useQuery(GET_ORG_MEMBERS, { skip: !owner });
  const { data: companyData } = useQuery(GET_COMPANIES, { skip: !owner });
  const { data: lockData, refetch: refetchLocks } = useQuery(GET_MONTH_LOCKS, { skip: !owner });
  const { data: recurringData, refetch: refetchRecurring } = useQuery(GET_RECURRING, { skip: !owner });
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState('');
  const [noticeOk, setNoticeOk] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [inviteMember, { loading: inviting }] = useMutation(INVITE_MEMBER);
  const [updateMember] = useMutation(UPDATE_MEMBER_ACCESS);
  const [removeMember] = useMutation(REMOVE_MEMBER);
  const [lockMonth, { loading: locking }] = useMutation(LOCK_MONTH);
  const [unlockMonth] = useMutation(UNLOCK_MONTH);
  const [stopRecurring] = useMutation(STOP_RECURRING);

  if (!owner) return null;
  const companies = companyData?.companies || [];
  const members = (data?.orgMembers || []).filter((member) => member.role !== 'owner');
  const invites = data?.pendingInvites || [];
  const locks = lockData?.monthLocks || [];
  const schedules = recurringData?.myRecurringSchedules || [];

  const inputFrom = (source) => ({
    email: source.email,
    accessScope: source.accessScope,
    modules: [source.expenses && 'expenses', source.income && 'income'].filter(Boolean),
    companyIds: source.companyIds,
    canDeleteExpenses: source.canDeleteExpenses,
    canDeleteIncome: source.canDeleteIncome,
  });

  const sendInvite = async (event) => {
    event.preventDefault();
    setNotice('');
    setNoticeOk(false);
    if (form.accessScope === 'modules' && !form.expenses && !form.income) {
      setNotice('Choose expenses, income, or the whole workspace.');
      return;
    }
    try {
      const res = await inviteMember({ variables: { input: inputFrom(form) } });
      setNotice(res.data?.inviteMember?.message || 'Invitation sent.');
      setNoticeOk(true);
      setForm(emptyForm);
      refetch();
    } catch (err) {
      setNotice(err.message);
      setNoticeOk(false);
    }
  };

  const companyNames = (ids) => {
    if (!ids?.length) return 'All companies';
    return ids.map((id) => companies.find((company) => company.id === id)?.name || 'Company').join(', ');
  };

  return (
    <div className="people-layout">
      <section className="card people-card">
        <div className="settings-heading">
          <div className="settings-icon"><Users size={18} /></div>
          <div>
            <h3>People</h3>
            <p>Invite someone into this organization and choose what they can open.</p>
          </div>
        </div>

        <form className="invite-form" onSubmit={sendInvite}>
          <label className="form-group">
            <span className="form-label">Email</span>
            <input className="input" type="email" required placeholder="name@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>

          <div className="form-group">
            <span className="form-label">What they can open</span>
            <div className="scope-switch" role="group">
              <button type="button" className={form.accessScope === 'workspace' ? 'is-on' : ''} onClick={() => setForm({ ...form, accessScope: 'workspace' })}>Whole workspace</button>
              <button type="button" className={form.accessScope === 'modules' ? 'is-on' : ''} onClick={() => setForm({ ...form, accessScope: 'modules' })}>Only some areas</button>
            </div>
          </div>

          {form.accessScope === 'modules' && (
            <div className="choice-row">
              <label className={`choice-chip ${form.expenses ? 'is-on' : ''}`}>
                <input type="checkbox" checked={form.expenses} onChange={(event) => setForm({ ...form, expenses: event.target.checked })} />
                Expenses
              </label>
              <label className={`choice-chip ${form.income ? 'is-on' : ''}`}>
                <input type="checkbox" checked={form.income} onChange={(event) => setForm({ ...form, income: event.target.checked })} />
                Income
              </label>
            </div>
          )}

          <div className="form-group">
            <span className="form-label">Companies</span>
            <div className="choice-row">
              {companies.map((company) => {
                const on = form.companyIds.includes(company.id);
                return (
                  <label key={company.id} className={`choice-chip ${on ? 'is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(event) => {
                        const companyIds = event.target.checked
                          ? [...form.companyIds, company.id]
                          : form.companyIds.filter((id) => id !== company.id);
                        setForm({ ...form, companyIds });
                      }}
                    />
                    {company.name}
                  </label>
                );
              })}
            </div>
            <p className="field-hint">Leave every company unticked to allow all of them.</p>
          </div>

          <div className="form-group">
            <span className="form-label">Delete rights</span>
            <div className="choice-row">
              <label className={`choice-chip ${form.canDeleteExpenses ? 'is-on' : ''}`}>
                <input type="checkbox" checked={form.canDeleteExpenses} onChange={(event) => setForm({ ...form, canDeleteExpenses: event.target.checked })} />
                Can delete expenses
              </label>
              <label className={`choice-chip ${form.canDeleteIncome ? 'is-on' : ''}`}>
                <input type="checkbox" checked={form.canDeleteIncome} onChange={(event) => setForm({ ...form, canDeleteIncome: event.target.checked })} />
                Can delete income
              </label>
            </div>
          </div>

          {notice && <p className={`people-notice ${noticeOk ? 'is-good' : ''}`}>{notice}</p>}
          <button className="btn btn-primary" type="submit" disabled={inviting}>
            <UserPlus size={15} /> {inviting ? 'Sending...' : 'Send invite'}
          </button>
        </form>

        {invites.length > 0 && (
          <div className="people-block">
            <h4>Waiting to join</h4>
            {invites.map((invite) => (
              <div key={invite.id} className="person-row">
                <div>
                  <strong>{invite.email}</strong>
                  <span>{accessLabel(invite)} · {companyNames(invite.companyIds)}</span>
                </div>
                <span className="badge badge-warning">Invite sent</span>
              </div>
            ))}
          </div>
        )}

        <div className="people-block">
          <h4>On the team</h4>
          {members.length === 0 ? (
            <p className="field-hint">You are the only person here. An invite adds someone to this same organization.</p>
          ) : members.map((member) => (
            <div key={member.id} className="person-row">
              <div>
                <strong>{member.name || member.email}</strong>
                <span>{member.email} · {accessLabel(member)} · {companyNames(member.companyIds)}</span>
              </div>
              <div className="person-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  onClick={async () => {
                    await updateMember({
                      variables: {
                        userId: member.id,
                        input: {
                          accessScope: member.accessScope || 'workspace',
                          modules: member.modules,
                          companyIds: member.companyIds,
                          canDeleteExpenses: !member.canDeleteExpenses,
                          canDeleteIncome: member.canDeleteIncome,
                        },
                      },
                    });
                    refetch();
                  }}
                >
                  {member.canDeleteExpenses ? 'Expense delete on' : 'Allow expense delete'}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" onClick={async () => { await removeMember({ variables: { userId: member.id } }); refetch(); }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card people-card">
        <div className="settings-heading">
          <div className="settings-icon"><Lock size={18} /></div>
          <div>
            <h3>Closed months</h3>
            <p>A locked month cannot be changed by anyone until you unlock it.</p>
          </div>
        </div>
        <form
          className="lock-row"
          onSubmit={async (event) => {
            event.preventDefault();
            await lockMonth({ variables: { year, month } });
            refetchLocks();
          }}
        >
          <select className="select" value={month} onChange={(event) => setMonth(Number(event.target.value))} aria-label="Month">
            {MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
          </select>
          <input className="input" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} aria-label="Year" />
          <button className="btn btn-secondary" type="submit" disabled={locking}>{locking ? 'Locking...' : 'Lock month'}</button>
        </form>
        {locks.length === 0 ? (
          <p className="field-hint">No months are locked.</p>
        ) : (
          <div className="people-block">
            {locks.map((lock) => (
              <div key={lock.id} className="person-row">
                <div>
                  <strong>{MONTHS[lock.month - 1]} {lock.year}</strong>
                  <span>Closed for new and edited expenses and income</span>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={async () => { await unlockMonth({ variables: { year: lock.year, month: lock.month } }); refetchLocks(); }}>Unlock</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {schedules.length > 0 && (
        <section className="card people-card">
          <div className="settings-heading">
            <div className="settings-icon"><Repeat size={18} /></div>
            <div>
              <h3>Repeating entries</h3>
              <p>These are added automatically on the same day each month.</p>
            </div>
          </div>
          <div className="people-block">
            {schedules.map((row) => (
              <div key={row.id} className="person-row">
                <div>
                  <strong>{row.label || (row.kind === 'income' ? 'Income' : 'Expense')}</strong>
                  <span>{row.kind === 'income' ? 'Income' : 'Expense'} · day {row.dayOfMonth} of each month</span>
                </div>
                <button className="btn btn-secondary btn-sm" type="button" onClick={async () => { await stopRecurring({ variables: { id: row.id } }); refetchRecurring(); }}>Stop</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
