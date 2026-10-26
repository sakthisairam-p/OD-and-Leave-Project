import React, { useState, useEffect } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (res.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
};

const DEPARTMENTS = [
    { value: 'CSE(AI&ML)', label: 'CSE(AI&ML)' },
    { value: 'CSE', label: 'CSE' },
    { value: 'IT', label: 'IT' },
    { value: 'AIDS', label: 'AIDS' },
    { value: 'ECE', label: 'ECE' },
    { value: 'EEE', label: 'EEE' },
    { value: 'MECH', label: 'MECH' },
    { value: 'CIVIL', label: 'CIVIL' }
];

const YEARS = [
    { value: 'All', label: 'All Years' },
    { value: 'I', label: '1st Year (I)' },
    { value: 'II', label: '2nd Year (II)' },
    { value: 'III', label: '3rd Year (III)' },
    { value: 'IV', label: '4th Year (IV)' }
];

const normalizeYear = (yr) => {
    if (!yr) return '';
    const s = String(yr).trim().toUpperCase();
    if (s.includes('IV') || s.includes('4') || s.includes('FOURTH')) return 'IV';
    if (s.includes('III') || s.includes('3') || s.includes('THIRD')) return 'III';
    if (s.includes('II') || s.includes('2') || s.includes('SECOND')) return 'II';
    if (s.includes('I') || s.includes('1') || s.includes('FIRST')) return 'I';
    return s;
};

export default function SubjectPortalTab({ profile }) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter Form State
    const [department, setDepartment] = useState('');
    const [year, setYear] = useState('All');
    const [selectedDate, setSelectedDate] = useState(todayStr);

    // Active sub-filter: 'ALL' | 'LEAVE' | 'OD'
    const [filterType, setFilterType] = useState('ALL');

    // Results State
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [allResults, setAllResults] = useState([]);
    const [errorMsg, setErrorMsg] = useState('');

    // Pre-fill department from profile if available, then auto-load
    useEffect(() => {
        if (profile) {
            let resolvedDept = department;

            if (profile.department) {
                const matchDept = DEPARTMENTS.find(d =>
                    d.value.toLowerCase() === profile.department.toLowerCase() ||
                    profile.department.toLowerCase().includes(d.value.toLowerCase()) ||
                    (d.value === 'CSE(AI&ML)' && profile.department.toUpperCase().includes('AIML'))
                );
                resolvedDept = matchDept ? matchDept.value : profile.department;
                setDepartment(resolvedDept);
            } else if (!department) {
                resolvedDept = 'CSE(AI&ML)';
                setDepartment(resolvedDept);
            }

            // Auto-load with resolved department immediately
            if (resolvedDept) {
                fetchData(todayStr, resolvedDept, year);
            }
        }
    }, [profile]);

    // Load Attendance / Absentees
    const fetchData = async (dateQuery, overrideDept, overrideYear) => {
        const useDept = overrideDept || department;
        const useYear = overrideYear !== undefined ? overrideYear : year;

        if (!useDept) {
            setErrorMsg('Please select Department.');
            return;
        }

        setErrorMsg('');
        setLoadingData(true);
        setHasLoaded(true);

        try {
            const dateParam = dateQuery ? `&date=${encodeURIComponent(dateQuery)}` : '';
            const yearParam = (useYear && useYear !== 'All') ? `&year=${encodeURIComponent(useYear)}` : '';
            const leaveUrl = `/api/v1/leave-requests/approved?department=${encodeURIComponent(useDept)}${dateParam}${yearParam}`;
            const odUrl = `/api/v1/od-requests/approved?department=${encodeURIComponent(useDept)}${dateParam}${yearParam}`;

            const [leaveRes, odRes] = await Promise.all([
                apiFetch(leaveUrl).catch(async () => ({ records: [] })),
                apiFetch(odUrl).catch(async () => ({ records: [] }))
            ]);

            const leaves = (leaveRes.records || leaveRes.requests || []).map(r => ({
                ...r,
                _type: 'Leave',
                keyId: `LEV-${r.id || r.requestId || Math.random()}`
            }));

            const ods = (odRes.records || odRes.requests || []).map(r => ({
                ...r,
                _type: 'OD',
                keyId: `OD-${r.id || r.requestId || Math.random()}`
            }));

            let combined = [...leaves, ...ods];

            // Strictly filter by chosen department
            if (useDept && useDept.toUpperCase() !== 'ALL') {
                const targetDept = useDept.toUpperCase().replace(/\s+/g, '');
                const aimlAliases = ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'];
                const isTargetAiml = aimlAliases.includes(targetDept);
                combined = combined.filter(r => {
                    const rDept = String(r.department || '').toUpperCase().replace(/\s+/g, '');
                    if (isTargetAiml) return aimlAliases.includes(rDept);
                    return rDept === targetDept;
                });
            }

            // Filter by year if specified
            if (useYear && useYear !== 'All') {
                const targetY = normalizeYear(useYear);
                combined = combined.filter(r => normalizeYear(r.year) === targetY);
            }

            // If a specific date is queried, filter records active on that date
            if (dateQuery) {
                combined = combined.filter(r => {
                    const f = String(r.fromDate || '').split('T')[0];
                    const t = String(r.toDate || r.fromDate || '').split('T')[0];
                    if (!f) return true;
                    return dateQuery >= f && (!t || dateQuery <= t);
                });
            }

            // Sort by fromDate descending, then student name
            combined.sort((a, b) => {
                const dateA = a.fromDate || '';
                const dateB = b.fromDate || '';
                if (dateB !== dateA) return dateB.localeCompare(dateA);
                return (a.studentName || '').localeCompare(b.studentName || '');
            });

            setAllResults(combined);
        } catch (err) {
            console.error('Error loading attendance data:', err);
            setErrorMsg(err.message || 'Failed to load attendance records.');
        } finally {
            setLoadingData(false);
        }
    };

    const handleLoadAttendance = (e) => {
        if (e) e.preventDefault();
        fetchData(selectedDate, department, year);
    };

    // Filter by type: ALL, Leave, OD
    const displayedResults = allResults.filter(r => {
        if (filterType === 'LEAVE') return r._type === 'Leave';
        if (filterType === 'OD') return r._type === 'OD';
        return true;
    });

    const leaveCount = allResults.filter(r => r._type === 'Leave').length;
    const odCount = allResults.filter(r => r._type === 'OD').length;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h3 style={{ color: '#002147', marginBottom: '1.25rem' }}>Faculty Portal</h3>

            {/* Top Center Filter Card */}
            <div className="card" style={{ margin: '0 0 1.5rem', padding: '1.25rem' }}>
                <form onSubmit={handleLoadAttendance} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {/* Department */}
                    <div style={{ minWidth: '160px', flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#002147', marginBottom: '0.35rem' }}>
                            Department
                        </label>
                        <select
                            className="input-field"
                            style={{ margin: 0, width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                            value={department}
                            onChange={e => setDepartment(e.target.value)}
                            required
                        >
                            <option value="">Select Department</option>
                            {DEPARTMENTS.map(d => (
                                <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year */}
                    <div style={{ minWidth: '140px', flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#002147', marginBottom: '0.35rem' }}>
                            Year
                        </label>
                        <select
                            className="input-field"
                            style={{ margin: 0, width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                            value={year}
                            onChange={e => setYear(e.target.value)}
                        >
                            {YEARS.map(y => (
                                <option key={y.value} value={y.value}>{y.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date */}
                    <div style={{ minWidth: '160px', flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#002147', marginBottom: '0.35rem' }}>
                            Date
                        </label>
                        <input
                            type="date"
                            className="input-field"
                            style={{ margin: 0, width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                        />
                    </div>

                    {/* Action Button */}
                    <div style={{ display: 'flex' }}>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loadingData}
                            style={{ minWidth: '100px', height: '40px', padding: '0 1.5rem', fontWeight: 700 }}
                            title="Load students on leave/OD for selected date"
                        >
                            {loadingData ? 'Loading...' : 'Load'}
                        </button>
                    </div>
                </form>

                {errorMsg && (
                    <div style={{ marginTop: '0.8rem', color: '#dc3545', fontSize: '0.85rem', textAlign: 'center' }}>
                        {errorMsg}
                    </div>
                )}
            </div>

            {/* Results Area */}
            {!hasLoaded ? (
                <div className="card text-center text-muted" style={{ padding: '2rem' }}>
                    Select Department, Year, and Date above, then click <strong>Load</strong> to view students on Leave or OD.
                </div>
            ) : loadingData ? (
                <p className="text-muted text-center" style={{ padding: '2rem' }}>Loading attendance details...</p>
            ) : allResults.length === 0 ? (
                <div className="card text-center text-muted">
                    Hooray! No students on leave or OD in {department} {year !== 'All' ? `(${year} Year)` : ''} on {selectedDate}.
                </div>
            ) : (
                <div>
                    {/* Summary Bar & Filter Tabs */}
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem'
                    }}>
                        <span style={{ fontSize: '0.9rem', color: '#555', fontWeight: 600 }}>
                            Students on Leave / OD in <strong>{department}</strong> {year !== 'All' ? <span>({year} Year)</span> : ''} on <strong>{selectedDate}</strong> ({allResults.length})
                        </span>

                        {/* Sub-filter tabs */}
                        <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.8rem' }}>
                            <button
                                type="button"
                                onClick={() => setFilterType('ALL')}
                                style={{
                                    padding: '4px 10px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                                    fontWeight: filterType === 'ALL' ? 700 : 500,
                                    backgroundColor: filterType === 'ALL' ? '#002147' : '#e2e8f0',
                                    color: filterType === 'ALL' ? '#fff' : '#334155'
                                }}
                            >
                                All ({allResults.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('LEAVE')}
                                style={{
                                    padding: '4px 10px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                                    fontWeight: filterType === 'LEAVE' ? 700 : 500,
                                    backgroundColor: filterType === 'LEAVE' ? '#e65100' : '#fff3e0',
                                    color: filterType === 'LEAVE' ? '#fff' : '#b23c00'
                                }}
                            >
                                Leaves ({leaveCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterType('OD')}
                                style={{
                                    padding: '4px 10px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                                    fontWeight: filterType === 'OD' ? 700 : 500,
                                    backgroundColor: filterType === 'OD' ? '#0d47a1' : '#e3f2fd',
                                    color: filterType === 'OD' ? '#fff' : '#0d47a1'
                                }}
                            >
                                OD ({odCount})
                            </button>
                        </div>
                    </div>

                    {displayedResults.map(req => (
                        <div key={req.keyId} className="card" style={{ margin: '0 0 1rem', padding: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#002147' }}>{req.studentName}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                        {req.registerNumber} {req.rollNumber ? `(${req.rollNumber})` : ''} • {req.department} • {req.year} {req.section ? `• Sec: ${req.section}` : ''}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{
                                        padding: '3px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                        backgroundColor: req._type === 'OD' ? '#e3f2fd' : '#fff8e1',
                                        color: req._type === 'OD' ? '#0d47a1' : '#e65100'
                                    }}>
                                        {req._type === 'OD' ? (req.eventName || 'On-Duty') : (req.leaveType || 'Leave')}
                                    </span>
                                    <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '4px' }}>
                                        {req.fromDate} to {req.toDate} ({req.numberOfDays || 1} day{req.numberOfDays > 1 ? 's' : ''})
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2" style={{ gap: '0.75rem', fontSize: '0.85rem' }}>
                                {req._type === 'OD' ? (
                                    <>
                                        <div><strong>Event / Program:</strong> {req.eventName || '—'}</div>
                                        <div><strong>College / Org:</strong> {req.organization || '—'}</div>
                                        <div><strong>Timing:</strong> {req.startTime || '—'} to {req.endTime || '—'}</div>
                                        <div><strong>Location:</strong> {req.location || '—'}</div>
                                        <div style={{ gridColumn: '1/-1' }}><strong>Purpose:</strong> {req.purpose || req.remarks || '—'}</div>
                                        <div><strong>Faculty Coordinator:</strong> {req.facultyCoordinator || '—'} {req.coordinatorContact ? `(${req.coordinatorContact})` : ''}</div>
                                        <div><strong>Status:</strong> <span style={{ color: '#28a745', fontWeight: 700 }}>Approved</span></div>
                                    </>
                                ) : (
                                    <>
                                        <div><strong>Leave Type:</strong> {req.leaveType || 'Leave'}</div>
                                        <div><strong>Reason:</strong> {req.reason || '—'}</div>
                                        <div><strong>Parent Name:</strong> {req.parentName || '—'}</div>
                                        <div><strong>Parent Contact:</strong> {req.parentContact || req.emergencyContact || '—'}</div>
                                        {req.remarks && <div style={{ gridColumn: '1/-1' }}><strong>Remarks:</strong> {req.remarks}</div>}
                                        <div><strong>Approved By:</strong> {req.approvedBy || 'Class Advisor'}</div>
                                        <div><strong>Status:</strong> <span style={{ color: '#28a745', fontWeight: 700 }}>Approved</span></div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
