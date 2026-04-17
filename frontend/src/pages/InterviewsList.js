import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { toast } from 'sonner';
import { Plus, Search, ChevronRight, XCircle, RefreshCw } from 'lucide-react';

const STATUS_OPTIONS = ['', 'scheduled', 'calling', 'in_progress', 'completed', 'failed', 'cancelled'];

function StatusBadge({ status }) {
  return <span className={`badge badge-${status?.replace('_', '-')}`}>{status?.replace('_', ' ')}</span>;
}

export default function InterviewsList() {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ skip: page * limit, limit });
      if (status) params.append('status', status);
      const res = await api.get(`/api/interviews?${params}`);
      setSessions(res.data.sessions || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to load interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, [status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = sessions.filter(s =>
    !search ||
    s.candidate?.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.job?.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCancel = async (sessionId) => {
    try {
      await api.post(`/api/interviews/${sessionId}/cancel`);
      toast.success('Interview cancelled');
      fetchSessions();
    } catch (err) {
      toast.error('Failed to cancel');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" data-testid="interviews-list-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>Interviews</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {total} total interviews
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchSessions} className="btn-secondary" data-testid="refresh-btn">
            <RefreshCw size={16} />
          </button>
          <Link to="/dashboard/interviews/new" className="btn-primary" data-testid="schedule-new-btn">
            <Plus size={16} />
            Schedule New
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            placeholder="Search candidate or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="phonic-input pl-9"
            style={{ width: 240 }}
            data-testid="search-input"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(0); }}
          className="phonic-input"
          style={{ width: 160 }}
          data-testid="status-filter"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="phonic-card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="flex gap-2">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p style={{ color: 'var(--color-text-secondary)' }}>No interviews found.</p>
          </div>
        ) : (
          <table className="phonic-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Score</th>
                <th>Scheduled</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(session => (
                <tr key={session.session_id} data-testid={`session-row-${session.session_id}`}>
                  <td>
                    <div className="font-semibold">{session.candidate?.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      {session.candidate?.phone}
                    </div>
                  </td>
                  <td>
                    <div>{session.job?.title}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {session.job?.company}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'var(--color-surface-highlight)', color: 'var(--color-text-secondary)' }}>
                      {session.mode}
                    </span>
                  </td>
                  <td><StatusBadge status={session.status} /></td>
                  <td>
                    {session.evaluation?.overall_score
                      ? <span className="font-mono font-bold">{session.evaluation.overall_score}/5</span>
                      : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    }
                  </td>
                  <td className="font-mono text-xs">
                    {session.scheduled_at ? new Date(session.scheduled_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/dashboard/interviews/${session.session_id}`}
                        className="btn-ghost text-xs py-1 px-2"
                        data-testid={`view-btn-${session.session_id}`}
                      >
                        View <ChevronRight size={12} />
                      </Link>
                      {['scheduled', 'calling'].includes(session.status) && (
                        <button
                          onClick={() => handleCancel(session.session_id)}
                          className="btn-ghost text-xs py-1 px-2"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => p - 1)} disabled={page === 0} className="btn-secondary">
              Previous
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * limit >= total} className="btn-secondary">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
