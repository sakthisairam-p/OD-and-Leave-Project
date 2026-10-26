import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link, Routes, Route } from 'react-router-dom';
import {
    LogOut, Clock, CheckCircle2, AlertCircle,
    UserCircle, X, LayoutDashboard, Navigation, CalendarDays
} from 'lucide-react';

/* ================================================================
   API Helper
   ================================================================ */
const API_BASE = 'http://127.0.0.1:8000';

const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: { 'Authorization': `Bearer ${token}`, ...(options.headers || {}) }
    });
    if (res.status === 401) { localStorage.clear(); window.location.href = '/login'; }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
};

/* ================================================================
   Root Layout: Sidebar + Header + Content
   ================================================================ */
export default function StudentDashboard() {
    const navigate = useNavigate();
    const location = useLocation();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);

    // Notification badge counts
    const [leaveBadge, setLeaveBadge] = useState(0);
    const [odBadge, setOdBadge] = useState(0);

    const getStudentUserKey = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return u.login_id || 'student';
        } catch {
            return 'student';
        }
    };

    const getStatusSig = (r) => {
        const id = String(r.id || r._id || r.requestId || '');
        const st = String(r.status || '');
        const adv = String(r.advisorStatus || '');
        const hod = String(r.hodStatus || '');
        return `${id}__${st}__${adv}__${hod}`;
    };

    const fetchBadges = useCallback(async () => {
        try {
            const [leaveRes, odRes] = await Promise.all([
                apiFetch('/api/v1/leave/my'),
                apiFetch('/api/v1/od/my')
            ]);
            const leaveRequests = leaveRes.requests || [];
            const odRequests = odRes.requests || [];

            const userKey = getStudentUserKey();
            const seenLeaveKey = `ki_student_seen_leaves_${userKey}`;
            const seenOdKey = `ki_student_seen_ods_${userKey}`;

            const seenLeaveSigs = new Set(JSON.parse(localStorage.getItem(seenLeaveKey) || '[]'));
            const seenOdSigs = new Set(JSON.parse(localStorage.getItem(seenOdKey) || '[]'));

            const isLeaveUnread = (r) => {
                if (r.student_seen === true) return false;
                if (seenLeaveSigs.has(getStatusSig(r))) return false;
                return r.advisorStatus !== 'PENDING' || r.status === 'Approved' || r.status === 'Rejected';
            };
            const isOdUnread = (r) => {
                if (r.student_seen === true) return false;
                if (seenOdSigs.has(getStatusSig(r))) return false;
                return r.advisorStatus !== 'PENDING' || r.status === 'Approved' || r.status === 'Rejected';
            };

            const unreadLeaves = leaveRequests.filter(isLeaveUnread);
            const unreadODs = odRequests.filter(isOdUnread);

            if (location.pathname === '/student/leave') {
                leaveRequests.forEach(r => seenLeaveSigs.add(getStatusSig(r)));
                localStorage.setItem(seenLeaveKey, JSON.stringify([...seenLeaveSigs]));
                setLeaveBadge(0);
                apiFetch('/api/v1/leave/mark-seen', { method: 'POST' }).catch(() => {});
            } else {
                setLeaveBadge(unreadLeaves.length);
            }

            if (location.pathname === '/student/od') {
                odRequests.forEach(r => seenOdSigs.add(getStatusSig(r)));
                localStorage.setItem(seenOdKey, JSON.stringify([...seenOdSigs]));
                setOdBadge(0);
                apiFetch('/api/v1/od/mark-seen', { method: 'POST' }).catch(() => {});
            } else {
                setOdBadge(unreadODs.length);
            }
        } catch (e) { /* silent */ }
    }, [location.pathname]);

    // Mark leave as "seen" when visiting leave page
    const clearLeaveBadge = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/leave/my');
            const userKey = getStudentUserKey();
            const seenLeaveKey = `ki_student_seen_leaves_${userKey}`;
            const seenLeaveSigs = new Set(JSON.parse(localStorage.getItem(seenLeaveKey) || '[]'));
            (res.requests || []).forEach(r => seenLeaveSigs.add(getStatusSig(r)));
            localStorage.setItem(seenLeaveKey, JSON.stringify([...seenLeaveSigs]));
            setLeaveBadge(0);
            apiFetch('/api/v1/leave/mark-seen', { method: 'POST' }).catch(() => {});
            apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
        } catch (e) { /* silent */ }
    }, []);

    const clearOdBadge = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/od/my');
            const userKey = getStudentUserKey();
            const seenOdKey = `ki_student_seen_ods_${userKey}`;
            const seenOdSigs = new Set(JSON.parse(localStorage.getItem(seenOdKey) || '[]'));
            (res.requests || []).forEach(r => seenOdSigs.add(getStatusSig(r)));
            localStorage.setItem(seenOdKey, JSON.stringify([...seenOdSigs]));
            setOdBadge(0);
            apiFetch('/api/v1/od/mark-seen', { method: 'POST' }).catch(() => {});
            apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
        } catch (e) { /* silent */ }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const pd = await apiFetch('/api/v1/auth/me');
                setProfile(pd);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
        fetchBadges();
    }, [fetchBadges]);

    // Clear respective badge when switching to that page
    useEffect(() => {
        if (location.pathname === '/student/leave') clearLeaveBadge();
        if (location.pathname === '/student/od') clearOdBadge();
    }, [location.pathname, clearLeaveBadge, clearOdBadge]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        localStorage.removeItem('contextDept');
        navigate('/login');
    };

    const profileFields = () => {
        if (!profile) return [];
        return [
            { key: 'NAME', value: profile.full_name || profile.name || '-' },
            { key: 'ROLL_NO', value: profile.roll_number || profile.roll_no || '-' },
            { key: 'REG_NO', value: profile.register_no || profile.register_number || '-' },
            { key: 'DEPARTMENT', value: profile.department || '-' },
            { key: 'YEAR', value: profile.year || '-' },
            { key: 'EMAIL', value: profile.email || '-' },
            { key: 'PHONE NO.', value: profile.phone || profile.phone_number || '-' }
        ];
    };

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666' }}>Loading...</div>;

    const isActive = (path) => location.pathname === path;

    return (
        <div className="app-wrapper">
            {/* ---- SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>Student Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/student" className={`nav-item ${isActive('/student') ? 'active' : ''}`}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>

                    <Link to="/student/leave" className={`nav-item ${isActive('/student/leave') ? 'active' : ''}`}>
                        <CalendarDays size={18} />
                        <span style={{ flex: 1 }}>Leave Request</span>
                        {leaveBadge > 0 && <Badge count={leaveBadge} />}
                    </Link>

                    <Link to="/student/od" className={`nav-item ${isActive('/student/od') ? 'active' : ''}`}>
                        <Navigation size={18} />
                        <span style={{ flex: 1 }}>OD Request</span>
                        {odBadge > 0 && <Badge count={odBadge} />}
                    </Link>

                    <div style={{ flex: 1 }} />
                    <button className="nav-item" onClick={handleLogout} style={{ color: '#ff6b6b' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </nav>
            </aside>

            {/* ---- MAIN ---- */}
            <div className="main-content">
                {/* Top Header */}
                <header className="top-header">
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Student Portal</span>

                    {/* Profile (Top-Right) */}
                    <div style={{ position: 'relative' }}>
                        <div onClick={() => setProfileOpen(p => !p)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                            <UserCircle size={28} />
                            <span>{profile?.full_name || profile?.name || 'Student'}</span>
                        </div>

                        {profileOpen && <>
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setProfileOpen(false)} />
                            <div style={{
                                position: 'absolute', top: '48px', right: 0, width: '330px',
                                background: '#fff', border: '1px solid #ddd', borderRadius: '10px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000
                            }}>
                                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h4 style={{ margin: 0, color: '#002147' }}>Student Profile</h4>
                                    <X size={16} style={{ cursor: 'pointer', color: '#999' }} onClick={() => setProfileOpen(false)} />
                                </div>
                                <div style={{ padding: '1rem 1.25rem', maxHeight: '420px', overflowY: 'auto' }}>
                                    {profileFields().map((f, i) => (
                                        <div key={i} style={{ marginBottom: '0.8rem' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{f.key}</div>
                                            <div style={{ fontSize: '0.9rem', color: '#222', marginTop: '2px' }}>{f.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>}
                    </div>
                </header>

                {/* Page Content */}
                <div className="page-content">
                    <Routes>
                        <Route path="/" element={<DashboardTab profile={profile} />} />
                        <Route path="/leave" element={<LeaveTab />} />
                        <Route path="/od" element={<ODTab />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   Badge Component
   ================================================================ */
function Badge({ count }) {
    return (
        <span style={{
            minWidth: '20px', height: '20px', borderRadius: '10px',
            backgroundColor: '#dc3545', color: '#fff', fontSize: '0.7rem',
            fontWeight: 'bold', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 5px'
        }}>{count}</span>
    );
}

/* ================================================================
   DASHBOARD TAB
   ================================================================ */
function DashboardTab({ profile }) {
    const [leaveStats, setLeaveStats] = useState({ total: 0, permitted: 0, nonPermitted: 0 });
    const [loading, setLoading] = useState(true);

    const [historyList, setHistoryList] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const [leaveRes, odRes] = await Promise.all([
                    apiFetch('/api/v1/leave/my'),
                    apiFetch('/api/v1/od/my')
                ]);

                // Calculate Total Leave stats strictly from Leave requests only (excluding OD)
                const leaveRequests = leaveRes.requests || [];

                let total = 0;
                let permitted = 0;
                let nonPermitted = 0;

                leaveRequests.forEach(req => {
                    const days = req.numberOfDays || 0;
                    total += days;
                    if (req.status === 'Approved' || req.overallStatus === 'Approved') {
                        permitted += days;
                    } else {
                        nonPermitted += days;
                    }
                });

                setLeaveStats({ total, permitted, nonPermitted });

                // Request history displays both Leave and OD
                const history = [
                    ...(leaveRes.requests || []).map(r => ({ ...r, reqType: 'Leave' })),
                    ...(odRes.requests || []).map(r => ({ ...r, reqType: 'OD' }))
                ];

                // Sort by most recently submitted
                history.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                setHistoryList(history);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, []);

    // Working Hours: 9:00 AM to 4:40 PM. Weekends excluded.
    const [totalWorkingDays, setTotalWorkingDays] = useState(90);

    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetch('/api/v1/admin/settings');
                const setting = (res.settings || []).find(s => s.key === 'totalWorkingDays');
                if (setting && setting.value) setTotalWorkingDays(parseInt(setting.value));
            } catch (e) { }
        })();
    }, []);

    const getStatusStyle = (status) => {
        const s = String(status).toLowerCase();
        if (s === 'approved') return { bg: '#d4edda', color: '#155724', label: 'Permitted' };
        if (s === 'rejected') return { bg: '#f8d7da', color: '#721c24', label: 'Rejected' };
        return { bg: '#fff3cd', color: '#856404', label: 'Pending' };
    };

    const leavePct = totalWorkingDays > 0 ? Math.round((leaveStats.total / totalWorkingDays) * 100) : 0;

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            {/* Student Info Bar */}
            <div className="card" style={{ margin: '0 0 1.25rem', padding: '1rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                <UserCircle size={36} color="#002147" />
                <div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#002147' }}>{profile?.full_name || profile?.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{profile?.register_number || profile?.register_no}</div>
                </div>
                <InfoPill label="Department" value={profile?.department} />
                <InfoPill label="Year" value={profile?.year} />
                <InfoPill label="Section" value={profile?.section || profile?.department_code} />
            </div>

            {loading ? <div className="text-muted text-center">Loading dashboard data...</div> : <>
                {/* Attendance Stats Layout */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    marginBottom: '2rem'
                }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <PastelStatCard label="Total Working Days" value={totalWorkingDays} theme="blue" />
                    </div>
                    <div>
                        <PastelStatCard label="Total Leave Days" value={leaveStats.total} theme="red" />
                    </div>
                    <div>
                        <PastelStatCard label="Leave Percentage" value={`${leavePct}%`} theme="purple" />
                    </div>
                    <div>
                        <PastelStatCard label="Permitted" value={leaveStats.permitted} theme="green" />
                    </div>
                    <div>
                        <PastelStatCard label="Non - Permitted" value={leaveStats.nonPermitted} theme="orange" />
                    </div>
                </div>

                {/* History Section */}
                <div className="card" style={{ margin: '0', padding: '1.25rem' }}>
                    <h3 style={{ color: '#002147', margin: '0 0 1rem', fontSize: '1rem', borderBottom: '2px solid #002147', paddingBottom: '0.5rem' }}>
                        Request History
                    </h3>

                    {historyList.length === 0 ? (
                        <div className="text-center text-muted" style={{ padding: '2rem 0' }}>No leave or OD requests submitted yet.</div>
                    ) : (
                        <div>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '150px 100px 1fr 100px',
                                padding: '0.6rem 0.75rem', backgroundColor: '#f0f2f5', borderRadius: '6px 6px 0 0',
                                fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                <div>Dates</div>
                                <div>Type</div>
                                <div>Reason / Event</div>
                                <div style={{ textAlign: 'center' }}>Status</div>
                            </div>

                            {historyList.map(req => {
                                const statusInfo = getStatusStyle(req.status);
                                return (
                                    <div key={req.id || req.requestId} style={{
                                        display: 'grid', gridTemplateColumns: '150px 100px 1fr 100px',
                                        padding: '0.75rem', borderBottom: '1px solid #eee', alignItems: 'center'
                                    }}>
                                        <div style={{ fontSize: '0.8rem', color: '#555' }}>
                                            {req.fromDate} {req.toDate !== req.fromDate ? `to ${req.toDate}` : ''}
                                        </div>
                                        <div>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                                                backgroundColor: req.reqType === 'OD' ? '#e3f2fd' : '#fce4ec',
                                                color: req.reqType === 'OD' ? '#0d47a1' : '#c2185b'
                                            }}>
                                                {req.reqType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#333' }}>
                                            {req.eventName || req.reason || '—'}
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            <span style={{
                                                padding: '2px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
                                                backgroundColor: statusInfo.bg, color: statusInfo.color
                                            }}>
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </>}
        </div>
    );
}

function InfoPill({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ borderLeft: '2px solid #e0e0e0', paddingLeft: '1rem' }}>
            <div style={{ fontSize: '0.65rem', color: '#999', fontWeight: 700, textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '0.9rem', color: '#333', fontWeight: 500 }}>{value}</div>
        </div>
    );
}

function StatCard({ label, value, color, accent }) {
    return (
        <div className="card text-center" style={{
            margin: 0, padding: '1rem 0.5rem',
            borderBottom: accent ? `4px solid ${color}` : 'none',
            border: accent ? undefined : '1px solid #e8e8e8'
        }}>
            <div style={{ fontSize: '0.65rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem' }}>{label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
        </div>
    );
}

function PastelStatCard({ label, value, theme }) {
    const themes = {
        blue: { bg: '#eef6ff', border: '#3b82f6', text: '#0ea5e9' },
        red: { bg: '#fff1f2', border: '#f43f5e', text: '#be123c' },
        purple: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
        green: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
        orange: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' }
    };

    const currentTheme = themes[theme] || themes.blue;

    return (
        <div style={{
            backgroundColor: currentTheme.bg,
            border: `2px solid ${currentTheme.border}`,
            borderRadius: '8px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            height: '100%',
            minHeight: '100px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
            <div style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#334155', // Slate gray for title
                marginBottom: '0.5rem'
            }}>
                {label}
            </div>
            <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: currentTheme.text
            }}>
                {value}
            </div>
        </div>
    );
}

/* ================================================================
   LEAVE TAB
   ================================================================ */
function LeaveTab() {
    const [view, setView] = useState('list'); // list | form | success
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ reason: '', startDate: '', endDate: '' });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [submittedData, setSubmittedData] = useState(null);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/leave/my');
            setRequests(res.requests || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const calcDays = () => {
        if (!formData.startDate || !formData.endDate) return 0;
        const s = new Date(formData.startDate), e = new Date(formData.endDate);
        return e < s ? 0 : Math.floor((e - s) / 86400000) + 1;
    };

    const submitLeave = async (e) => {
        e.preventDefault();
        setSubmitting(true); setError(null);
        try {
            const form = new FormData();
            form.append('leaveType', 'Other Leave');
            form.append('fromDate', formData.startDate);
            form.append('toDate', formData.endDate);
            form.append('reason', formData.reason);
            form.append('parentName', 'N/A');
            form.append('parentContact', '9999999999');
            const res = await fetch(`${API_BASE}/api/v1/leave/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: form
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Failed');
            setSubmittedData({ ...formData, id: d.requestId, days: calcDays() });
            setView('success');
        } catch (err) { setError(err.message); }
        setSubmitting(false);
    };

    if (view === 'form') return (
        <div className="card" style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#002147', margin: 0 }}>Leave Application</h3>
                <button onClick={() => setView('list')} className="btn" style={{ fontSize: '0.85rem', color: '#666' }}>← Back</button>
            </div>
            <form onSubmit={submitLeave}>
                {error && <div style={{ color: '#dc3545', textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
                <div className="form-group">
                    <label className="form-label">Reason for Leave</label>
                    <textarea className="input-field" rows="3" required minLength={10} placeholder="Minimum 10 characters"
                        value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                </div>
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input type="date" required className="input-field" value={formData.startDate}
                            onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">End Date</label>
                        <input type="date" required className="input-field" min={formData.startDate} value={formData.endDate}
                            onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Number of Days</label>
                    <input className="input-field" readOnly value={calcDays()} style={{ backgroundColor: '#f4f7f6', fontWeight: 'bold' }} />
                </div>
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '0.6rem 2rem', fontWeight: 600 }}>
                        {submitting ? 'Submitting...' : 'SUBMIT REQUEST'}
                    </button>
                </div>
            </form>
        </div>
    );

    if (view === 'success') return (
        <SubmissionSuccess type="LEAVE" data={submittedData} reset={() => { setView('list'); setFormData({ reason: '', startDate: '', endDate: '' }); fetchRequests(); }} />
    );

    // LIST VIEW
    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ color: '#002147', margin: 0 }}>Leave Requests</h3>
                <button onClick={() => setView('form')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ New Leave Request</button>
            </div>
            {loading ? <p className="text-muted">Loading...</p> : requests.length === 0
                ? <div className="card text-center text-muted">No leave requests found.</div>
                : requests.map(r => <RequestCard key={r.id} req={r} type="leave" />)
            }
        </div>
    );
}

/* ================================================================
   OD TAB
   ================================================================ */
function ODTab() {
    const [view, setView] = useState('list');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({ reason: '', eventName: '', location: '', college: '', startDate: '', endDate: '', startHr: '09', startMin: '00', startAmPm: 'AM', endHr: '04', endMin: '00', endAmPm: 'PM', purpose: '', otherPurpose: '', document: null });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [submittedData, setSubmittedData] = useState(null);

    const fetchRequests = useCallback(async () => {
        try {
            const res = await apiFetch('/api/v1/od/my');
            setRequests(res.requests || []);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const calcDays = () => {
        if (!formData.startDate || !formData.endDate) return 0;
        const s = new Date(formData.startDate), e = new Date(formData.endDate);
        return e < s ? 0 : Math.floor((e - s) / 86400000) + 1;
    };

    const submitOD = async (e) => {
        e.preventDefault();
        setSubmitting(true); setError(null);
        try {
            const finalPurpose = formData.purpose === 'Other' ? formData.otherPurpose : formData.purpose;
            const form = new FormData();
            form.append('odType', 'Event');
            form.append('eventName', formData.eventName);
            form.append('organization', formData.college);
            form.append('location', formData.location);
            form.append('fromDate', formData.startDate);
            form.append('toDate', formData.endDate);
            form.append('purpose', finalPurpose);
            form.append('remarks', formData.reason);
            form.append('startTime', `${formData.startHr}:${formData.startMin} ${formData.startAmPm}`);
            form.append('endTime', `${formData.endHr}:${formData.endMin} ${formData.endAmPm}`);
            form.append('facultyCoordinator', 'N/A');
            form.append('coordinatorContact', '9999999999');
            form.append('parentPermission', 'true');
            if (formData.document) {
                form.append('document', formData.document);
            } else {
                const blob = new Blob(['placeholder'], { type: 'text/plain' });
                form.append('document', blob, 'document.png');
            }

            const res = await fetch(`${API_BASE}/api/v1/od/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                body: form
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.detail || 'Failed');
            setSubmittedData({ ...formData, id: d.requestId, days: calcDays(), purpose: finalPurpose });
            setView('success');
        } catch (err) { setError(err.message); }
        setSubmitting(false);
    };

    if (view === 'form') return (
        <div className="card" style={{ maxWidth: '560px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ color: '#002147', margin: 0 }}>OD Permission</h3>
                <button onClick={() => setView('list')} className="btn" style={{ fontSize: '0.85rem', color: '#666' }}>← Back</button>
            </div>
            <form onSubmit={submitOD}>
                {error && <div style={{ color: '#dc3545', textAlign: 'center', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
                <div className="form-group">
                    <label className="form-label">Reason for OD</label>
                    <textarea className="input-field" rows="2" required value={formData.reason}
                        onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Event Name</label>
                    <input type="text" required className="input-field" value={formData.eventName}
                        onChange={e => setFormData({ ...formData, eventName: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">Upload Required Image / Document</label>
                    <input type="file" required className="input-field" accept="image/*,.pdf" style={{ padding: '0.4rem' }}
                        onChange={e => setFormData({ ...formData, document: e.target.files[0] })} />
                </div>
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Location</label>
                        <input type="text" required className="input-field" value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">College / Institution</label>
                        <input type="text" required className="input-field" value={formData.college}
                            onChange={e => setFormData({ ...formData, college: e.target.value })} />
                    </div>
                </div>
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Start Date</label>
                        <input type="date" required className="input-field" value={formData.startDate}
                            onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">End Date</label>
                        <input type="date" required className="input-field" min={formData.startDate} value={formData.endDate}
                            onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                    </div>
                </div>
                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <datalist id="hour-options">
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(h => <option key={h} value={h} />)}
                    </datalist>
                    <datalist id="min-options">
                        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => <option key={m} value={m} />)}
                    </datalist>
                    <div className="form-group">
                        <label className="form-label">Start Time</label>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input type="text" list="hour-options" className="input-field" value={formData.startHr} onChange={e => setFormData({ ...formData, startHr: e.target.value })} style={{ padding: '0.4rem', flex: 1, textAlign: 'center' }} />
                            <span style={{ fontWeight: 700, color: '#666' }}>:</span>
                            <input type="text" list="min-options" className="input-field" value={formData.startMin} onChange={e => setFormData({ ...formData, startMin: e.target.value })} style={{ padding: '0.4rem', flex: 1, textAlign: 'center' }} />
                            <select className="input-field" value={formData.startAmPm} onChange={e => setFormData({ ...formData, startAmPm: e.target.value })} style={{ padding: '0.4rem', flex: 1.2 }}>
                                <option>AM</option><option>PM</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">End Time</label>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <input type="text" list="hour-options" className="input-field" value={formData.endHr} onChange={e => setFormData({ ...formData, endHr: e.target.value })} style={{ padding: '0.4rem', flex: 1, textAlign: 'center' }} />
                            <span style={{ fontWeight: 700, color: '#666' }}>:</span>
                            <input type="text" list="min-options" className="input-field" value={formData.endMin} onChange={e => setFormData({ ...formData, endMin: e.target.value })} style={{ padding: '0.4rem', flex: 1, textAlign: 'center' }} />
                            <select className="input-field" value={formData.endAmPm} onChange={e => setFormData({ ...formData, endAmPm: e.target.value })} style={{ padding: '0.4rem', flex: 1.2 }}>
                                <option>AM</option><option>PM</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Number of Days</label>
                    <input className="input-field" readOnly value={calcDays()} style={{ backgroundColor: '#f4f7f6', fontWeight: 'bold' }} />
                </div>
                <div className="form-group">
                    <label className="form-label">Purpose of Participation</label>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                        {['Volunteer', 'Participant', 'Other'].map(p => (
                            <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                <input type="radio" name="purpose" required checked={formData.purpose === p}
                                    onChange={() => setFormData({ ...formData, purpose: p })} /> {p}
                            </label>
                        ))}
                    </div>
                </div>
                {formData.purpose === 'Other' && (
                    <div className="form-group">
                        <label className="form-label">Other Reason</label>
                        <input type="text" required className="input-field" value={formData.otherPurpose}
                            onChange={e => setFormData({ ...formData, otherPurpose: e.target.value })} />
                    </div>
                )}
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '0.6rem 2rem', fontWeight: 600 }}>
                        {submitting ? 'Submitting...' : 'SUBMIT REQUEST'}
                    </button>
                </div>
            </form>
        </div>
    );

    if (view === 'success') return (
        <SubmissionSuccess type="OD" data={submittedData} reset={() => { setView('list'); setFormData({ reason: '', eventName: '', location: '', college: '', startDate: '', endDate: '', startHr: '09', startMin: '00', startAmPm: 'AM', endHr: '04', endMin: '00', endAmPm: 'PM', purpose: '', otherPurpose: '', document: null }); fetchRequests(); }} />
    );

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ color: '#002147', margin: 0 }}>OD Requests</h3>
                <button onClick={() => setView('form')} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ New OD Request</button>
            </div>
            {loading ? <p className="text-muted">Loading...</p> : requests.length === 0
                ? <div className="card text-center text-muted">No OD requests found.</div>
                : requests.map(r => <RequestCard key={r.id} req={r} type="od" />)
            }
        </div>
    );
}

/* ================================================================
   Request Card — shows each request with DYNAMIC status workflow
   ================================================================ */
function RequestCard({ req, type }) {
    const isOD = type === 'od';
    const advisorStatus = (req.advisorStatus || 'PENDING').toUpperCase();
    const hodStatus = (req.hodStatus || 'ACTION_REQUIRED').toUpperCase();
    const overallStatus = (req.status || 'Pending');

    // Derive workflow node states
    const submitted = { label: 'SUBMITTED', state: 'done' }; // always green

    let advisorNode;
    if (advisorStatus === 'APPROVED') advisorNode = { label: 'CLASS ADVISOR', state: 'done' };
    else if (advisorStatus === 'REJECTED') advisorNode = { label: 'CLASS ADVISOR', state: 'rejected' };
    else advisorNode = { label: 'CLASS ADVISOR', state: 'pending' };

    let hodNode = { label: 'HOD', state: 'waiting' };
    if (isOD) {
        if (advisorStatus === 'APPROVED') {
            if (hodStatus === 'APPROVED') hodNode = { label: 'HOD', state: 'done' };
            else if (hodStatus === 'REJECTED') hodNode = { label: 'HOD', state: 'rejected' };
            else hodNode = { label: 'HOD', state: 'pending' };
        }
    }

    let grantedNode = { label: 'PERMISSION GRANTED', state: 'waiting' };
    if (overallStatus === 'Approved') grantedNode = { label: 'PERMISSION GRANTED', state: 'done' };
    else if (overallStatus === 'Rejected' || advisorStatus === 'REJECTED' || hodStatus === 'REJECTED')
        grantedNode = { label: 'REJECTED', state: 'rejected' };

    const nodes = [submitted, advisorNode];
    if (isOD) nodes.push(hodNode);
    nodes.push(grantedNode);

    return (
        <div className="card" style={{ margin: '0 0 0.75rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#002147' }}>
                        {isOD ? (req.eventName || 'OD Request') : (req.leaveType || 'Leave')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        {req.fromDate} → {req.toDate} &bull; {req.numberOfDays || '-'} day(s)
                    </div>
                </div>
                <StatusLabel status={overallStatus} />
            </div>

            {/* Workflow */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0', padding: '0.5rem 0' }}>
                {nodes.map((n, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <WorkflowArrow state={n.state} />}
                        <WorkflowNode label={n.label} state={n.state} />
                    </React.Fragment>
                ))}
            </div>

            {/* Rejection reason */}
            {(overallStatus === 'Rejected' || advisorStatus === 'REJECTED' || hodStatus === 'REJECTED') && req.reviewerRemarks && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#fff5f5', border: '1px solid #ebb', borderRadius: '4px', fontSize: '0.8rem', color: '#a00' }}>
                    <strong>Rejection Reason:</strong> {req.reviewerRemarks}
                </div>
            )}
        </div>
    );
}

function StatusLabel({ status }) {
    const s = String(status).toLowerCase();
    let bg, color;
    if (s === 'approved') { bg = '#d4edda'; color = '#155724'; }
    else if (s === 'rejected') { bg = '#f8d7da'; color = '#721c24'; }
    else { bg = '#fff3cd'; color = '#856404'; }
    return (
        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: bg, color, textTransform: 'uppercase' }}>
            {status}
        </span>
    );
}

/* ================================================================
   Workflow Visualizer — Dynamic from MongoDB status
   ================================================================ */
function WorkflowNode({ label, state }) {
    const colors = {
        done: '#28a745',
        pending: '#ffc107',
        waiting: '#c0c0c0',
        rejected: '#dc3545'
    };
    const bg = colors[state] || colors.waiting;
    const icons = {
        done: <CheckCircle2 size={16} />,
        pending: <Clock size={16} />,
        waiting: <Clock size={16} />,
        rejected: <X size={16} />
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', marginBottom: '4px'
            }}>
                {icons[state]}
            </div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textAlign: 'center', color: state === 'waiting' ? '#aaa' : '#444', lineHeight: 1.2 }}>
                {label}
            </div>
        </div>
    );
}

function WorkflowArrow({ state }) {
    const colors = { done: '#28a745', pending: '#ffc107', waiting: '#e0e0e0', rejected: '#dc3545' };
    return <div style={{ width: '40px', height: '3px', backgroundColor: colors[state] || '#e0e0e0', marginTop: '-18px' }} />;
}

/* ================================================================
   Submission Success
   ================================================================ */
function SubmissionSuccess({ type, data, reset }) {
    const isLeave = type === 'LEAVE';
    return (
        <div className="card" style={{ maxWidth: '650px', margin: '0 auto' }}>
            <div style={{ padding: '0.75rem', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', textAlign: 'center', fontWeight: 700, marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                ✓ {type} request submitted successfully!
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#002147', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Request Details</h4>
                <div className="grid grid-cols-2" style={{ gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div><strong>Dates:</strong> {data.startDate} → {data.endDate}</div>
                    <div><strong>Days:</strong> {data.days}</div>
                    {isLeave ? (
                        <div style={{ gridColumn: '1/-1' }}><strong>Reason:</strong> {data.reason}</div>
                    ) : (<>
                        <div><strong>Event:</strong> {data.eventName}</div>
                        <div><strong>College:</strong> {data.college}</div>
                        <div><strong>Purpose:</strong> {data.purpose}</div>
                        <div style={{ gridColumn: '1/-1' }}><strong>Reason:</strong> {data.reason}</div>
                    </>)}
                </div>
            </div>
            <h4 style={{ color: '#002147', textAlign: 'center', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Approval Workflow</h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <WorkflowNode label="SUBMITTED" state="done" />
                <WorkflowArrow state="done" />
                <WorkflowNode label="CLASS ADVISOR" state="pending" />
                {!isLeave && <><WorkflowArrow state="waiting" /><WorkflowNode label="HOD" state="waiting" /></>}
                <WorkflowArrow state="waiting" />
                <WorkflowNode label="PERMISSION GRANTED" state="waiting" />
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button onClick={reset} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>← Back to Requests</button>
            </div>
        </div>
    );
}
