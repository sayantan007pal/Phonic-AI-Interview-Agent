import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import {
  ListVideo, CheckCircle, TrendingUp,
  Plus, ChevronRight, Calendar, Star
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, color, delta }) {
  return (
    <div className="stat-card" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {delta && (
          <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
            +{delta}
          </span>
        )}
      </div>
      <p className="text-3xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans', color: 'var(--color-text-primary)' }}>
        {value ?? '—'}
      </p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/interviews/stats'),
      api.get('/api/interviews?limit=5'),
    ]).then(([statsRes, listRes]) => {
      setStats(statsRes.data);
      setRecent(listRes.data.sessions || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <div key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Welcome back, {user?.name?.split(' ')[0] || 'Recruiter'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Here's your interview activity at a glance
          </p>
        </div>
        <Link to="/dashboard/interviews/new" className="btn-primary" data-testid="new-interview-btn">
          <Plus size={16} />
          New Interview
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
        <StatCard label="Total Interviews" value={stats?.total} icon={ListVideo} color="var(--color-accent-primary)" />
        <StatCard label="Scheduled" value={stats?.scheduled} icon={Calendar} color="var(--color-warning)" />
        <StatCard label="Completed" value={stats?.completed} icon={CheckCircle} color="var(--color-success)" />
        <StatCard label="Avg Score" value={stats?.avg_score ? `${stats.avg_score}/5` : null} icon={Star} color="var(--color-accent-secondary)" />
      </div>

      {/* Recent Interviews */}
      <div className="phonic-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Recent Interviews
          </h2>
          <Link to="/dashboard/interviews" className="btn-ghost text-sm" style={{ color: 'var(--color-accent-primary)' }}>
            View all <ChevronRight size={14} />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-12">
            <ListVideo size={32} className="mx-auto mb-4" style={{ color: 'var(--color-text-secondary)' }} />
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              No interviews yet. Schedule your first one!
            </p>
            <Link to="/dashboard/interviews/new" className="btn-primary">
              <Plus size={16} />
              Schedule Interview
            </Link>
          </div>
        ) : (
          <table className="phonic-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Role</th>
                <th>Status</th>
                <th>Score</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map(session => (
                <tr key={session.session_id} data-testid={`interview-row-${session.session_id}`}>
                  <td>
                    <div className="font-medium">{session.candidate?.name || '—'}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {session.candidate?.email}
                    </div>
                  </td>
                  <td>{session.job?.title || '—'}</td>
                  <td><StatusBadge status={session.status} /></td>
                  <td>
                    {session.evaluation?.overall_score
                      ? <span className="font-mono font-semibold">{session.evaluation.overall_score}/5</span>
                      : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                    }
                  </td>
                  <td className="font-mono text-xs">
                    {new Date(session.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <Link
                      to={`/dashboard/interviews/${session.session_id}`}
                      className="btn-ghost text-xs"
                    >
                      View <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { to: '/dashboard/interviews/new', icon: Plus, title: 'Schedule Interview', desc: 'Create a new AI interview session', color: 'var(--color-accent-primary)' },
          { to: '/dashboard/jd', icon: ListVideo, title: 'Manage JD Library', desc: 'Save and reuse job descriptions', color: 'var(--color-accent-secondary)' },
          { to: '/dashboard/settings', icon: TrendingUp, title: 'Configure API Keys', desc: 'Set up Deepgram, Cartesia, and more', color: 'var(--color-warning)' },
        ].map(({ to, icon: Icon, title, desc, color }) => (
          <Link key={to} to={to} className="phonic-card block hover:-translate-y-1 transition-transform duration-200" style={{ textDecoration: 'none' }}>
            <div className="w-10 h-10 rounded-lg mb-4 flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <h3 className="font-semibold mb-1" style={{ fontFamily: 'Plus Jakarta Sans', fontSize: 15 }}>{title}</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
