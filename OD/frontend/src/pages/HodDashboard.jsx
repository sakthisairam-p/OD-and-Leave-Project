import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link, Routes, Route } from 'react-router-dom';
import {
    LogOut, CheckCircle2, Clock, AlertCircle,
    UserCircle, X, LayoutDashboard, Navigation
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
    if (s.includes('IV') || s.includes('4') || s.includes('FOURTH')) return 'IV';
    if (s.includes('III') || s.includes('3') || s.includes('THIRD')) return 'III';
    if (s.includes('II') || s.includes('2') || s.includes('SECOND')) return 'II';
    if (s.includes('I') || s.includes('1') || s.includes('FIRST')) return 'I';
    return s;
};

const isDateInRange = (filterDate, fromDate, toDate) => {
    if (!filterDate) return true;
    const cleanDate = (d) => {
        if (!d) return '';
        const s = String(d).trim();
        if (s.includes('T')) return s.split('T')[0];
        if (s.includes('/') || (s.includes('-') && s.split('-')[0].length !== 4)) {
            const parts = s.split(/[-/]/);
            if (parts.length === 3 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        return s.slice(0, 10);
    };

    const target = cleanDate(filterDate);
    const start = cleanDate(fromDate) || target;
    const end = cleanDate(toDate) || start;

    const minDate = start <= end ? start : end;
    const maxDate = start <= end ? end : start;

    return target >= minDate && target <= maxDate;
};

/* ================================================================
   Root Layout: HOD
   ================================================================ */
export default function HodDashboard() {
    const navigate = useNavigate();
    const location = useLocation();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const todayDateStr = new Date().toISOString().split('T')[0];
    const [dateFilter, setDateFilter] = useState(todayDateStr);
    const [yearFilter, setYearFilter] = useState('All');

    // Badge for pending OD requests needing HOD action
    const [odBadge, setOdBadge] = useState(0);

    const getHodUserKey = () => {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            return u.login_id || 'hod';
        } catch {
            return 'hod';
        }
    };

    const fetchBadges = useCallback(async () => {
        try {
            const yq = yearFilter !== 'All' ? `&year=${encodeURIComponent(yearFilter)}` : '';
            const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
            const odRes = await apiFetch(`/api/v1/od/pending?status=Pending${yq}${dq}`);
            // Only count ODs where advisor already approved and HOD hasn't acted
            let pendingForHod = (odRes.requests || []).filter(r =>
                r.advisorStatus === 'APPROVED' &&
                (r.hodStatus === 'ACTION_REQUIRED' || r.hodStatus === 'PENDING' || !r.hodStatus)
            );
            if (yearFilter !== 'All') {
                const targetY = normalizeYear(yearFilter);
                pendingForHod = pendingForHod.filter(r => normalizeYear(r.year) === targetY);
            }
            if (dateFilter) {
                pendingForHod = pendingForHod.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
            }

            const userKey = getHodUserKey();
            const seenHodOdKey = `ki_hod_seen_ods_${userKey}`;
            const seenOdIds = new Set(JSON.parse(localStorage.getItem(seenHodOdKey) || '[]'));

            if (location.pathname === '/hod/od') {
                pendingForHod.forEach(r => seenOdIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenHodOdKey, JSON.stringify([...seenOdIds]));
                setOdBadge(0);
            } else {
                const unreadForHod = pendingForHod.filter(r => !seenOdIds.has(String(r.id || r._id || r.requestId)));
                setOdBadge(unreadForHod.length);
            }
        } catch (e) { console.error(e); }
    }, [yearFilter, dateFilter, location.pathname]);

    // Clear respective badge immediately when navigating to that page
    useEffect(() => {
        const userKey = getHodUserKey();
        if (location.pathname === '/hod/od') {
            const seenHodOdKey = `ki_hod_seen_ods_${userKey}`;
            const seenOdIds = new Set(JSON.parse(localStorage.getItem(seenHodOdKey) || '[]'));
            apiFetch('/api/v1/od/pending?status=Pending').then(res => {
                (res.requests || []).forEach(r => seenOdIds.add(String(r.id || r._id || r.requestId)));
                localStorage.setItem(seenHodOdKey, JSON.stringify([...seenOdIds]));
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
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>HOD Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/hod" className={`nav-item ${isActive('/hod') ? 'active' : ''}`}>
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>

                    <Link to="/hod/od" className={`nav-item ${isActive('/hod/od') ? 'active' : ''}`}>
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
                <header className="top-header">
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Head of Department Gateway</span>

                    {/* Filter and Profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Year Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555' }}>Year:</span>
                            <select
                                style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', fontSize: '0.85rem' }}
                                value={yearFilter}
                                onChange={(e) => setYearFilter(e.target.value)}
                            >
                                <option value="All">All Years</option>
                                <option value="I">1st Year (I)</option>
                                <option value="II">2nd Year (II)</option>
                                <option value="III">3rd Year (III)</option>
                                <option value="IV">4th Year (IV)</option>
                            </select>
                        </div>

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
                                <span>{profile?.full_name || profile?.name || 'HOD'}</span>
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
                                        <p><strong>Role:</strong> Head of Department</p>
                                        <p><strong>Department:</strong> {profile?.department || 'N/A'}</p>
                                        <p><strong>Email:</strong> {profile?.email || 'N/A'}</p>
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
                        <Route path="/" element={<HodDashboardTab profile={profile} odCount={odBadge} yearFilter={yearFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} />} />
                        <Route path="/od" element={<OdReviewTab updateCounts={fetchBadges} yearFilter={yearFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} />} />
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
function HodDashboardTab({ profile, odCount, yearFilter, dateFilter, setDateFilter }) {
    const [historyList, setHistoryList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'LEAVE', 'OD'

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const yq = yearFilter !== 'All' ? `&year=${encodeURIComponent(yearFilter)}` : '';
                const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
                const [leaveRes, odRes] = await Promise.all([
                    apiFetch(`/api/v1/leave/pending?status=all${yq}${dq}`),
                    apiFetch(`/api/v1/od/pending?status=all${yq}${dq}`)
                ]);

                const historyLeaves = (leaveRes.requests || []).map(r => ({ ...r, _type: 'Leave' }));
                const historyODs = (odRes.requests || []).map(r => ({ ...r, _type: 'OD' }));

                let combined = [...historyLeaves, ...historyODs];
                if (yearFilter !== 'All') {
                    const targetY = normalizeYear(yearFilter);
                    combined = combined.filter(r => normalizeYear(r.year) === targetY);
                }
                if (dateFilter) {
                    combined = combined.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
                }
                combined.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
                setHistoryList(combined);
            } catch (e) { console.error(e); }
            setLoading(false);
        })();
    }, [yearFilter, dateFilter]);

    const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

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
            {/* Welcome */}
            <div className="card" style={{ margin: '0 0 1.25rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <UserCircle size={40} color="#002147" />
                <div>
                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#002147' }}>Welcome, {profile?.full_name || 'HOD'}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>Head of Department Dashboard</div>
                </div>
            </div>

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                <div
                    className="card text-center"
                    style={{ margin: 0, padding: '1.25rem 1rem', borderTop: '4px solid #ffc107', cursor: 'pointer', opacity: typeFilter === 'LEAVE' ? 1 : 0.85 }}
                    onClick={() => setTypeFilter(prev => prev === 'LEAVE' ? 'ALL' : 'LEAVE')}
                >
                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Total Leaves ({yearFilter !== 'All' ? yearFilter : 'All Years'}{dateFilter ? ` • ${dateFilter}` : ''})
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#dc3545' }}>{totalLeaves}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#0056b3' }}>
                        {typeFilter === 'LEAVE' ? '● Filtering Leaves' : 'Click to filter leaves'}
                    </div>
                </div>

                <div
                    className="card text-center"
                    style={{ margin: 0, padding: '1.25rem 1rem', borderTop: '4px solid #17a2b8', cursor: 'pointer', opacity: typeFilter === 'OD' ? 1 : 0.85 }}
                    onClick={() => setTypeFilter(prev => prev === 'OD' ? 'ALL' : 'OD')}
                >
                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Total ODs ({yearFilter !== 'All' ? yearFilter : 'All Years'}{dateFilter ? ` • ${dateFilter}` : ''})
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#17a2b8' }}>{totalOds}</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#0056b3' }}>
                        {typeFilter === 'OD' ? '● Filtering ODs' : 'Click to filter ODs'}
                    </div>
                </div>

                <div className="card text-center" style={{ margin: 0, padding: '1.25rem 1rem', borderTop: '4px solid #28a745' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                        Pending OD Review
                    </div>
                    <div style={{ fontSize: '2.2rem', fontWeight: 800, color: odCount > 0 ? '#dc3545' : '#28a745' }}>{odCount}</div>
                    <Link to="/hod/od" style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: '#0056b3', display: 'inline-block', fontWeight: 600 }}>
                        Review OD Requests →
                    </Link>
                </div>
            </div>

            {/* Request History */}
            <div className="card" style={{ margin: '0', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #002147', paddingBottom: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ color: '#002147', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={18} color="#28a745" />
                        Request History {yearFilter !== 'All' && <span style={{ fontSize: '0.85rem', color: '#0056b3', fontWeight: 600 }}>({yearFilter})</span>} {dateFilter && <span style={{ fontSize: '0.85rem', color: '#b45309', fontWeight: 600 }}>({dateFilter})</span>}
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
                            No {typeFilter !== 'ALL' ? typeFilter.toLowerCase() : ''} records found {yearFilter !== 'All' ? `for ${yearFilter}` : ''}.
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

                            {displayedList.map(req => {
                                const isExpanded = expandedId === (req.id || req.requestId);
                                const statusInfo = getStatusStyle(req.status);
                                return (
                                    <div key={req.id || req.requestId}>
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
                                                    {req._type === 'OD' && <div><strong>Time:</strong> {req.startTime} - {req.endTime}</div>}
                                                    <div><strong>Days:</strong> {req.numberOfDays || '—'}</div>
                                                    {req._type === 'OD' && <div><strong>Event:</strong> {req.eventName}</div>}
                                                    {req._type === 'OD' && <div><strong>Location:</strong> {req.location}</div>}
                                                    {req._type === 'OD' && <div><strong>College:</strong> {req.organization}</div>}
                                                    <div><strong>Reason / Purpose:</strong> {req.purpose || req.reason}</div>
                                                    <div style={{ gridColumn: '1/-1' }}><strong>Remarks:</strong> {req.remarks || '—'}</div>
                                                    <div><strong>CA Status:</strong> <span style={{ color: '#002147', fontWeight: 700 }}>{req.advisorStatus || 'PENDING'}</span></div>
                                                    <div><strong>Overall Status:</strong> <span style={{ color: statusInfo.color, fontWeight: 700 }}>{statusInfo.label}</span></div>
                                                    <div><strong>Approved By:</strong> {req.approvedBy || '—'}</div>
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
   OD REVIEW TAB — HOD reviews CA-approved OD requests
   ================================================================ */
function OdReviewTab({ updateCounts, yearFilter, dateFilter, setDateFilter }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [remarks, setRemarks] = useState({});
    const [expandedId, setExpandedId] = useState(null);

    const fetchPending = useCallback(async () => {
        setLoading(true);
        try {
            const yq = yearFilter !== 'All' ? `&year=${encodeURIComponent(yearFilter)}` : '';
            const dq = dateFilter ? `&date=${encodeURIComponent(dateFilter)}` : '';
            const res = await apiFetch(`/api/v1/od/pending?status=Pending${yq}${dq}`);
            // Only show ODs where advisor already approved and HOD hasn't acted
            let pendingForHod = (res.requests || []).filter(r =>
                r.advisorStatus === 'APPROVED' &&
                (r.hodStatus === 'ACTION_REQUIRED' || r.hodStatus === 'PENDING' || !r.hodStatus)
            );
            if (yearFilter !== 'All') {
                const targetY = normalizeYear(yearFilter);
                pendingForHod = pendingForHod.filter(r => normalizeYear(r.year) === targetY);
            }
            if (dateFilter) {
                pendingForHod = pendingForHod.filter(r => isDateInRange(dateFilter, r.fromDate, r.toDate));
            }
            setRequests(pendingForHod);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, [yearFilter, dateFilter]);

    useEffect(() => { fetchPending(); }, [fetchPending, yearFilter, dateFilter]);

    const handleAction = async (id, status) => {
        setProcessingId(id);
        try {
            const form = new URLSearchParams();
            form.append('status', status);
            if (remarks[id]) form.append('reviewerRemarks', remarks[id]);

            await apiFetch(`/api/v1/od-requests/${id}/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form.toString()
            });
            setRequests(prev => prev.filter(r => r.id !== id));
            updateCounts();
        } catch (e) {
            alert("Error: " + e.message);
        }
        setProcessingId(null);
    };

    const toggleExpand = (id) => setExpandedId(prev => prev === id ? null : id);

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h3 style={{ color: '#002147', marginBottom: '1.25rem' }}>Pending OD Requests (CA Approved → Awaiting HOD)</h3>

            {loading ? <p className="text-muted">Loading requests...</p> :
                requests.length === 0 ? <div className="card text-center text-muted">No pending OD requests awaiting HOD approval.</div> :
                    requests.map(req => (
                        <div key={req.id} className="card" style={{ margin: '0 0 1rem', padding: '1.25rem' }}>
                            {/* Header Row */}
                            <div
                                onClick={() => toggleExpand(req.id)}
                                style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.8rem', marginBottom: '0.8rem', cursor: 'pointer' }}
                            >
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#002147' }}>{req.studentName}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{req.rollNumber || req.registerNumber} • {req.department} • {req.year} • Sec: {req.section}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 700, color: '#17a2b8', fontSize: '0.9rem' }}>{req.eventName || 'OD Request'}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#888' }}>{req.fromDate} to {req.toDate} ({req.numberOfDays} days)</div>
                                    <div style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                                        <span style={{ padding: '2px 8px', borderRadius: '8px', backgroundColor: '#d4edda', color: '#155724', fontWeight: 700 }}>
                                            CA: Approved ✓
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Expandable Details */}
                            {expandedId === req.id && (
                                <div className="grid grid-cols-2" style={{ gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f8f9ff', borderRadius: '6px', borderLeft: '3px solid #17a2b8' }}>
                                    <div><strong>College:</strong> {req.organization}</div>
                                    <div><strong>Location:</strong> {req.location}</div>
                                    <div><strong>Time:</strong> {req.startTime} - {req.endTime}</div>
                                    <div><strong>Purpose:</strong> {req.purpose}</div>
                                    <div style={{ gridColumn: '1/-1' }}><strong>Remarks:</strong> {req.remarks || '—'}</div>
                                    <div><strong>CA Approved By:</strong> {req.approvedBy || '—'}</div>
                                    <div><strong>Faculty Coordinator:</strong> {req.facultyCoordinator || '—'}</div>
                                    {req.supportingDocument && (
                                        <div style={{ gridColumn: '1/-1' }}>
                                            <a href={`${API_BASE}${req.supportingDocument}`} target="_blank" rel="noreferrer" style={{ color: '#0056b3', textDecoration: 'underline' }}>View Supporting Document</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '8px', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Optional HOD remarks"
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
