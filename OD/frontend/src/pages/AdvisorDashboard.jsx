import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    let finalUrl = url;

    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${finalUrl}`, {
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

const normalizeYear = (yr) => {
    if (!yr) return '';
    const s = String(yr).trim().toUpperCase();
    if (s.includes('IV') || s === '4' || s.includes('FOURTH')) return 'IV';
    if (s.includes('III') || s === '3' || s.includes('THIRD')) return 'III';
    if (s.includes('II') || s === '2' || s.includes('SECOND')) return 'II';
    if (s.includes('I') || s === '1' || s.includes('FIRST')) return 'I';
    return s;
};

const isDateInRange = (targetDate, fromDate, toDate) => {
    if (!targetDate) return true;
    if (!fromDate && !toDate) return true;
    const t = new Date(targetDate).setHours(0, 0, 0, 0);
    const f = fromDate ? new Date(fromDate).setHours(0, 0, 0, 0) : t;
    const end = toDate ? new Date(toDate).setHours(0, 0, 0, 0) : f;
    return t >= f && t <= end;
};

/* ================================================================
   Root Layout: Advisor
   ================================================================ */
export default function AdvisorDashboard() {
    const navigate = useNavigate();
    const location = useLocation();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const todayDateStr = new Date().toISOString().split('T')[0];
    const [dateFilter, setDateFilter] = useState(todayDateStr);

    // Badges for pending items
    const [leaveBadge, setLeaveBadge] = useState(0);
    const [odBadge, setOdBadge] = useState(0);

    const getAdvisorUserKey = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return u.login_id || 'advisor';
        } catch {
            return 'advisor';
        }
    };

    const fetchBadges = useCallback(async () => {
        try {
            const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
            const [leaveRes, odRes] = await Promise.all([
                apiFetch(`/api/v1/leave/pending?status=Pending${dq}`),
                apiFetch(`/api/v1/od/pending?status=Pending${dq}`)
            ]);
            // Only count requests where Advisor hasn't acted yet
            let pendingLeaves = (leaveRes.requests || []).filter(r => r.advisorStatus === 'PENDING' || !r.advisorStatus);
            let pendingODs = (odRes.requests || []).filter(r => r.advisorStatus === 'PENDING' || !r.advisorStatus);

            if (dateFilter) {
                pendingLeaves = pendingLeaves.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
                pendingODs = pendingODs.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
            }

            const userKey = getAdvisorUserKey();
            const seenLeaveKey = `ki_advisor_seen_leaves_${userKey}`;
            const seenOdKey = `ki_advisor_seen_ods_${userKey}`;

            const seenLeaveIds = new Set(JSON.parse(localStorage.getItem(seenLeaveKey) || '[]'));
            const seenOdIds = new Set(JSON.parse(localStorage.getItem(seenOdKey) || '[]'));

            if (location.pathname === '/advisor/leave') {
                pendingLeaves.forEach(r => seenLeaveIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenLeaveKey, JSON.stringify([...seenLeaveIds]));
                setLeaveBadge(0);
            } else {
                const unreadLeaves = pendingLeaves.filter(r => !seenLeaveIds.has(String(r.id || r._id || r.requestId)));
                setLeaveBadge(unreadLeaves.length);
            }

            if (location.pathname === '/advisor/od') {
                pendingODs.forEach(r => seenOdIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenOdKey, JSON.stringify([...seenOdIds]));
                setOdBadge(0);
            } else {
                const unreadODs = pendingODs.filter(r => !seenOdIds.has(String(r.id || r._id || r.requestId)));
                setOdBadge(unreadODs.length);
            }
        } catch (e) { console.error(e); }
    }, [dateFilter, location.pathname]);

    // Clear respective badge immediately when navigating to that page
    useEffect(() => {
        const userKey = getAdvisorUserKey();
        if (location.pathname === '/advisor/leave') {
            const seenLeaveKey = `ki_advisor_seen_leaves_${userKey}`;
            const seenLeaveIds = new Set(JSON.parse(localStorage.getItem(seenLeaveKey) || '[]'));
            apiFetch('/api/v1/leave/pending?status=Pending').then(res => {
                (res.requests || []).forEach(r => seenLeaveIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenLeaveKey, JSON.stringify([...seenLeaveIds]));
                setLeaveBadge(0);
                apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
            }).catch(() => {});
        }
        if (location.pathname === '/advisor/od') {
            const seenOdKey = `ki_advisor_seen_ods_${userKey}`;
            const seenOdIds = new Set(JSON.parse(localStorage.getItem(seenOdKey) || '[]'));
            apiFetch('/api/v1/od/pending?status=Pending').then(res => {
                (res.requests || []).forEach(r => seenOdIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenOdKey, JSON.stringify([...seenOdIds]));
                setOdBadge(0);
                apiFetch('/api/v1/notifications/read-all', { method: 'POST' }).catch(() => {});
            }).catch(() => {});
        }
    }, [location.pathname]);

    useEffect(() => {
        (async () => {
            try {
                const pd = await apiFetch('/api/v1/auth/me');
                setProfile(pd);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
        fetchBadges();
        // Set up polling for new requests every 30 seconds
        const interval = setInterval(fetchBadges, 30000);
        return () => clearInterval(interval);
    }, [fetchBadges]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        localStorage.removeItem('contextDept');
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#666' }}>Loading...</div>;

    return (
        <div className="app-wrapper">
            {/* ---- SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>Class Advisor Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/advisor" className={`nav-item ${isActive('/advisor') ? 'active' : ''}`}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>

                    <Link to="/advisor/leave" className={`nav-item ${isActive('/advisor/leave') ? 'active' : ''}`}>
                        <CalendarDays size={18} />
                        <span style={{ flex: 1 }}>Leave Permission</span>
                        {leaveBadge > 0 && <Badge count={leaveBadge} />}
                    </Link>

                    <Link to="/advisor/od" className={`nav-item ${isActive('/advisor/od') ? 'active' : ''}`}>
                        <Navigation size={18} />
                        <span style={{ flex: 1 }}>OD Permission</span>
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
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Class Advisor Gateway</span>

                    {/* Filter and Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Date Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>Date:</span>
                            <input
                                type="date"
                                style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '0.85rem' }}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                            {dateFilter && (
                                <button
                                    onClick={() => setDateFilter('')}
                                    style={{
                                        border: 'none', background: '#fee2e2', color: '#dc2626',
                                        borderRadius: '4px', padding: '0.3rem 0.6rem', fontSize: '0.75rem',
                                        cursor: 'pointer', fontWeight: 600
                                    }}
                                    title="Reset Date"
                                >
                                    Clear
                                </button>
                            )}
                        </div>

                        <div style={{ position: 'relative' }}>
                            <div onClick={() => setProfileOpen(!profileOpen)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                                <UserCircle size={28} />
                                <span>{profile?.full_name || profile?.name || 'Advisor'}</span>
                            </div>

                            {profileOpen && <>
                                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setProfileOpen(false)} />
                                <div style={{
                                    position: 'absolute', top: '48px', right: 0, width: '300px',
                                    background: '#fff', border: '1px solid #ddd', borderRadius: '10px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1000, padding: '1rem'
                                }}>
                                    <h4 style={{ margin: '0 0 1rem', color: '#002147', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Profile</h4>
                                    <div style={{ fontSize: '0.85rem', color: '#444' }}>
                                        <p><strong>Name:</strong> {profile?.full_name}</p>
                                        <p><strong>Role:</strong> Class Advisor</p>
                                        <p><strong>Department:</strong> {profile?.department || 'N/A'}</p>
                                    </div>
                                    <button onClick={handleLogout} className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', backgroundColor: '#ff6b6b', borderColor: '#ff6b6b' }}>Logout</button>
                                </div>
                            </>}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="page-content">
                    <Routes>
                        <Route path="/" element={<DashboardTab profile={profile} leaveCount={leaveBadge} odCount={odBadge} dateFilter={dateFilter} setDateFilter={setDateFilter} />} />
                        <Route path="/leave" element={<ReviewTab type="leave" updateCounts={fetchBadges} dateFilter={dateFilter} setDateFilter={setDateFilter} />} />
                        <Route path="/od" element={<ReviewTab type="od" updateCounts={fetchBadges} dateFilter={dateFilter} setDateFilter={setDateFilter} />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
}

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
function DashboardTab({ profile, leaveCount, odCount, dateFilter, setDateFilter }) {
    const [historyList, setHistoryList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'LEAVE', 'OD'

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
                const [leaveRes, odRes] = await Promise.all([
                    apiFetch(`/api/v1/leave/pending?status=all${dq}`),
                    apiFetch(`/api/v1/od/pending?status=all${dq}`)
                ]);
                const historyLeaves = (leaveRes.requests || []).map(r => ({ ...r, _type: 'Leave' }));
                const historyODs = (odRes.requests || []).map(r => ({ ...r, _type: 'OD' }));

                let combined = [...historyLeaves, ...historyODs];
                if (dateFilter) {
                    combined = combined.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
                }
                combined.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                setHistoryList(combined);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, [dateFilter]);

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const getStatusStyle = (status) => {
        const s = String(status).toLowerCase();
        if (s === 'approved') return { bg: '#d4edda', color: '#155724', label: 'Permitted' };
        if (s === 'rejected') return { bg: '#f8d7da', color: '#721c24', label: 'Rejected' };
        return { bg: '#fff3cd', color: '#856404', label: 'Pending' };
    };

    const totalLeaves = useMemo(() => historyList.filter(r => r._type === 'Leave').length, [historyList]);
    const totalOds = useMemo(() => historyList.filter(r => r._type === 'OD').length, [historyList]);

    const displayedList = useMemo(() => {
        if (typeFilter === 'LEAVE') return historyList.filter(r => r._type === 'Leave');
        if (typeFilter === 'OD') return historyList.filter(r => r._type === 'OD');
        return historyList;
    }, [historyList, typeFilter]);

    return (
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
            {/* Welcome Bar */}
            <div className="card" style={{ margin: '0 0 1.25rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <UserCircle size={40} color="#002147" />
                <div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#002147' }}>Welcome, {profile?.full_name || 'Advisor'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>Class Advisor Dashboard</div>
                </div>
            </div>

            {/* Request Counts — Total Leaves & Total ODs only */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div
                    className="card text-center"
                    style={{ margin: 0, padding: '1.25rem 1rem', borderTop: '4px solid #ffc107', cursor: 'pointer', opacity: typeFilter === 'LEAVE' ? 1 : 0.85 }}
                    onClick={() => setTypeFilter(prev => prev === 'LEAVE' ? 'ALL' : 'LEAVE')}
                >
                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Total Leaves {dateFilter ? `(${dateFilter})` : ''}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#dc3545' }}>{totalLeaves}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#0056b3' }}>
                        {typeFilter === 'LEAVE' ? '● Filtering Leaves' : 'Click to filter'}
                    </div>
                </div>

                <div
                    className="card text-center"
                    style={{ margin: 0, padding: '1.25rem 1rem', borderTop: '4px solid #17a2b8', cursor: 'pointer', opacity: typeFilter === 'OD' ? 1 : 0.85 }}
                    onClick={() => setTypeFilter(prev => prev === 'OD' ? 'ALL' : 'OD')}
                >
                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Total ODs {dateFilter ? `(${dateFilter})` : ''}
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#17a2b8' }}>{totalOds}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#0056b3' }}>
                        {typeFilter === 'OD' ? '● Filtering ODs' : 'Click to filter'}
                    </div>
                </div>
            </div>

            {/* Request History — Expandable List */}
            <div className="card" style={{ margin: '0', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #002147', paddingBottom: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ color: '#002147', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} color="#28a745" />
                        Request History {dateFilter && <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 600 }}>({dateFilter})</span>}
                    </h3>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            onClick={() => setTypeFilter('ALL')}
                            className="btn"
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.75rem', borderRadius: '4px',
                                backgroundColor: typeFilter === 'ALL' ? '#002147' : '#e9ecef',
                                color: typeFilter === 'ALL' ? '#fff' : '#333'
                            }}
                        >
                            All ({historyList.length})
                        </button>
                        <button
                            onClick={() => setTypeFilter('LEAVE')}
                            className="btn"
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.75rem', borderRadius: '4px',
                                backgroundColor: typeFilter === 'LEAVE' ? '#dc3545' : '#e9ecef',
                                color: typeFilter === 'LEAVE' ? '#fff' : '#333'
                            }}
                        >
                            Leaves ({totalLeaves})
                        </button>
                        <button
                            onClick={() => setTypeFilter('OD')}
                            className="btn"
                            style={{
                                padding: '0.3rem 0.75rem', fontSize: '0.75rem', borderRadius: '4px',
                                backgroundColor: typeFilter === 'OD' ? '#17a2b8' : '#e9ecef',
                                color: typeFilter === 'OD' ? '#fff' : '#333'
                            }}
                        >
                            ODs ({totalOds})
                        </button>
                    </div>
                </div>

                {loading ? <p className="text-muted">Loading...</p> :
                    displayedList.length === 0 ? (
                        <div className="text-center text-muted" style={{ padding: '2rem 0' }}>
                            No {typeFilter !== 'ALL' ? typeFilter.toLowerCase() : ''} records found {dateFilter ? `on ${dateFilter}` : ''}.
                        </div>
                    ) : (
                        <div>
                            {/* Table Header */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '75px 1fr 70px 110px 150px 90px',
                                padding: '0.6rem 0.75rem', backgroundColor: '#f0f2f5', borderRadius: '6px 6px 0 0',
                                fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px'
                            }}>
                                <div>Roll No</div>
                                <div>Student Name</div>
                                <div>Year</div>
                                <div>Type</div>
                                <div>Dates</div>
                                <div style={{ textAlign: 'center' }}>Status</div>
                            </div>

                            {/* Table Rows */}
                            {displayedList.map(req => {
                                const isExpanded = expandedId === (req.id || req.requestId);
                                const statusInfo = getStatusStyle(req.status);
                                return (
                                    <div key={req.id || req.requestId}>
                                        {/* Compact Row */}
                                        <div
                                            onClick={() => toggleExpand(req.id || req.requestId)}
                                            style={{
                                                display: 'grid', gridTemplateColumns: '75px 1fr 70px 110px 150px 90px',
                                                padding: '0.75rem', borderBottom: '1px solid #eee',
                                                cursor: 'pointer', alignItems: 'center',
                                                backgroundColor: isExpanded ? '#f8f9ff' : '#fff',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#fafafa'; }}
                                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#fff'; }}
                                        >
                                            <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#333' }}>{req.rollNumber || '—'}</div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#002147' }}>{req.studentName}</div>
                                            <div>
                                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#e9ecef', color: '#002147' }}>
                                                    {req.year || '—'}
                                                </span>
                                            </div>
                                            <div>
                                                <span style={{
                                                    padding: '2px 10px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 700,
                                                    backgroundColor: req._type === 'OD' ? '#e3f2fd' : '#fff8e1',
                                                    color: req._type === 'OD' ? '#0d47a1' : '#e65100'
                                                }}>
                                                    {req._type === 'OD' ? (req.eventName || 'OD') : (req.leaveType || 'Leave')}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#4b5563', fontWeight: 500 }}>
                                                {req.fromDate}{req.toDate && req.toDate !== req.fromDate ? ` → ${req.toDate}` : ''}
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

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div style={{
                                                padding: '1rem 1.25rem', backgroundColor: '#f8f9ff',
                                                borderBottom: '2px solid #dee2e6', borderLeft: '3px solid #002147'
                                            }}>
                                                <div className="grid grid-cols-2" style={{ gap: '0.75rem', fontSize: '0.85rem' }}>
                                                    <div><strong>Register No:</strong> {req.registerNumber}</div>
                                                    <div><strong>Department:</strong> {req.department} • {req.year} • Sec: {req.section}</div>
                                                    <div><strong>From:</strong> {req.fromDate}</div>
                                                    <div><strong>To:</strong> {req.toDate}</div>
                                                    <div><strong>Number of Days:</strong> {req.numberOfDays || '—'}</div>
                                                    <div><strong>Status:</strong> <span style={{ color: statusInfo.color, fontWeight: 700 }}>{statusInfo.label}</span></div>
                                                    {req._type === 'OD' ? (
                                                        <>
                                                            <div><strong>Event:</strong> {req.eventName}</div>
                                                            <div><strong>Location:</strong> {req.location}</div>
                                                            <div><strong>College:</strong> {req.organization}</div>
                                                            <div><strong>Purpose:</strong> {req.purpose}</div>
                                                            <div style={{ gridColumn: '1/-1' }}><strong>Remarks:</strong> {req.remarks || '—'}</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div style={{ gridColumn: '1/-1' }}><strong>Leave Reason:</strong> {req.reason}</div>
                                                            <div><strong>Parent Name:</strong> {req.parentName}</div>
                                                            <div><strong>Parent Contact:</strong> {req.parentContact}</div>
                                                        </>
                                                    )}
                                                    {req.reviewerRemarks && (
                                                        <div style={{ gridColumn: '1/-1' }}><strong>CA Remarks:</strong> {req.reviewerRemarks}</div>
                                                    )}
                                                    <div><strong>Approved By:</strong> {req.approvedBy || '—'}</div>
                                                    <div><strong>Reviewed At:</strong> {req.reviewedAt ? new Date(req.reviewedAt).toLocaleString() : '—'}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                }
            </div>
        </div>
    );
}

/* ================================================================
   REVIEW TAB (Handles both Leave and OD)
   ================================================================ */
function ReviewTab({ type, updateCounts, dateFilter, setDateFilter }) {
    const isOD = type === 'od';
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [remarks, setRemarks] = useState({});

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
            const endpoint = isOD ? `/api/v1/od/pending?status=Pending${dq}` : `/api/v1/leave/pending?status=Pending${dq}`;
            const res = await apiFetch(endpoint);
            // Show only ones that Advisor hasn't approved/rejected yet
            let pendingForMe = (res.requests || []).filter(r => r.advisorStatus === 'PENDING' || !r.advisorStatus);
            if (dateFilter) {
                pendingForMe = pendingForMe.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
            }
            setRequests(pendingForMe);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [isOD, dateFilter]);

    useEffect(() => { fetchPending(); }, [fetchPending]);

    const handleAction = async (id, status) => {
        setProcessingId(id);
        try {
            const form = new URLSearchParams();
            form.append('status', status); // 'Approved' or 'Rejected'
            if (remarks[id]) form.append('reviewerRemarks', remarks[id]);

            const endpoint = isOD ? `/api/v1/od-requests/${id}/review` : `/api/v1/leave-requests/${id}/review`;
            await apiFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString()
            });
            // Update local lists
            setRequests(prev => prev.filter(r => r.id !== id));
            updateCounts();
        } catch (e) {
            alert("Error: " + e.message);
        }
        setProcessingId(null);
    };

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h3 style={{ color: '#002147', marginBottom: '1.25rem' }}>Pending {isOD ? 'OD' : 'Leave'} Requests</h3>

            {loading ? <p className="text-muted">Loading requests...</p> :
                requests.length === 0 ? <div className="card text-center text-muted">Hooray! No pending requests.</div> :
                    requests.map(req => (
                        <div key={req.id} className="card" style={{ margin: '0 0 1rem', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#002147' }}>{req.studentName}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{req.registerNumber} • {req.department} • {req.year} • Sec: {req.section}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: isOD ? '#17a2b8' : '#ffc107', fontSize: '0.9rem' }}>
                                        {isOD ? (req.eventName || 'Event OD') : (req.leaveType || 'Leave')}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                        {req.fromDate} to {req.toDate} ({req.numberOfDays} days)
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2" style={{ gap: '1rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {isOD ? (
                                    <>
                                        <div><strong>College:</strong> {req.organization}</div>
                                        <div><strong>Location:</strong> {req.location}</div>
                                        <div><strong>Time:</strong> {req.startTime} - {req.endTime}</div>
                                        <div><strong>Purpose:</strong> {req.purpose}</div>
                                        <div style={{ gridColumn: '1/-1' }}><strong>Student Reason/Remarks:</strong> {req.remarks}</div>
                                        {req.supportingDocument && (
                                            <div style={{ gridColumn: '1/-1' }}>
                                                <a href={`${API_BASE}${req.supportingDocument}`} target="_blank" rel="noreferrer" style={{ color: '#0056b3', textDecoration: 'underline' }}>View Supporting Document</a>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div><strong>Reason:</strong> {req.reason}</div>
                                        <div><strong>Parent:</strong> {req.parentName} ({req.parentContact})</div>
                                        {req.supportingDocument && (
                                            <div style={{ gridColumn: '1/-1' }}>
                                                <a href={`${API_BASE}${req.supportingDocument}`} target="_blank" rel="noreferrer" style={{ color: '#0056b3', textDecoration: 'underline' }}>View Medical/Supporting Document</a>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Optional remarks (e.g. valid reason, rejected due to exams)"
                                    style={{ flex: 1, margin: 0 }}
                                    value={remarks[req.id] || ''}
                                    onChange={e => setRemarks({ ...remarks, [req.id]: e.target.value })}
                                />
                                <button
                                    className="btn btn-primary"
                                    style={{ backgroundColor: '#28a745', borderColor: '#28a745', minWidth: '100px' }}
                                    disabled={processingId === req.id}
                                    onClick={() => handleAction(req.id, 'Approved')}
                                >
                                    {processingId === req.id ? '...' : 'Approve'}
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ backgroundColor: '#dc3545', borderColor: '#dc3545', minWidth: '100px' }}
                                    disabled={processingId === req.id}
                                    onClick={() => handleAction(req.id, 'Rejected')}
                                >
                                    {processingId === req.id ? '...' : 'Reject'}
                                </button>
                            </div>
                        </div>
                    ))}
        </div>
    );
}
