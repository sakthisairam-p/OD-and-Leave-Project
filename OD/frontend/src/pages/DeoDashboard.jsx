import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Calendar, X, CheckCircle2, Clock, LayoutDashboard, UserPlus, UserCircle, Save, FileText, Download, BarChart2, Users, Trash2, Edit2, Settings, Filter, Printer, Eye } from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const normalizeYear = (yr) => {
    if (!yr) return '';
    const s = String(yr).trim().toUpperCase();
    if (s.includes('IV') || s === '4' || s.includes('FOURTH')) return 'IV';
    if (s.includes('III') || s === '3' || s.includes('THIRD')) return 'III';
    if (s.includes('II') || s === '2' || s.includes('SECOND')) return 'II';
    if (s.includes('I') || s === '1' || s.includes('FIRST')) return 'I';
    return s;
};

const apiFetch = async (url, options = {}) => {
    let finalUrl = url;
    let ctxDept = localStorage.getItem('contextDept');
    if (!ctxDept) {
        try {
            const userObj = JSON.parse(localStorage.getItem('user') || '{}');
            if (userObj.department) ctxDept = userObj.department;
        } catch (e) {}
    }
    const ctxYear = localStorage.getItem('contextYear');
    if (ctxDept && !finalUrl.includes('department=') && !url.includes('/api/v1/auth') && !url.includes('/api/v1/admin/settings')) {
        const sym = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${sym}department=${encodeURIComponent(ctxDept)}`;
    }
    if (ctxYear && !finalUrl.includes('year=') && !url.includes('/api/v1/auth') && !url.includes('/api/v1/admin/settings')) {
        const sym = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${sym}year=${encodeURIComponent(ctxYear)}`;
    }

    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    const response = await fetch(`${API_BASE}${finalUrl}`, { ...options, headers });

    // Attempt to parse JSON even if error, to show backend details
    let data;
    try {
        data = await response.json();
    } catch (e) {
        data = { detail: response.statusText };
    }

    if (!response.ok) {
        if (response.status === 401) {
            localStorage.clear();
            window.location.href = '/login';
        }
        throw new Error(data.detail || `API Error: ${response.status}`);
    }
    return data;
};

const getStatusStyle = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'approved') return { bg: '#d4edda', color: '#155724', label: 'Approved' };
    if (s === 'rejected') return { bg: '#f8d7da', color: '#721c24', label: 'Rejected' };
    if (s === 'proofsubmitted') return { bg: '#cce5ff', color: '#004085', label: 'Proof Submitted' };
    return { bg: '#fff3cd', color: '#856404', label: 'Pending' };
};

const getStatusIcon = (status) => {
    const s = String(status).toLowerCase();
    if (s === 'approved') return <CheckCircle2 size={18} style={{ color: '#28a745' }} />;
    if (s === 'rejected') return <X size={18} style={{ color: '#dc3545' }} />;
    return <Clock size={18} style={{ color: '#ffc107' }} />;
};

const getRecordDays = (r) => {
    if (r.numberOfDays !== undefined && r.numberOfDays !== null && !isNaN(Number(r.numberOfDays)) && Number(r.numberOfDays) > 0) {
        return Number(r.numberOfDays);
    }
    if (r.days !== undefined && r.days !== null && !isNaN(Number(r.days)) && Number(r.days) > 0) {
        return Number(r.days);
    }
    if (r.fromDate && r.toDate) {
        const d1 = new Date(r.fromDate);
        const d2 = new Date(r.toDate);
        const diffMs = d2.getTime() - d1.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
        if (!isNaN(diffDays) && diffDays > 0) return diffDays;
    }
    return 1;
};

export default function DeoDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [historyType, setHistoryType] = useState('leave'); // 'leave' or 'od' inside dashboard
    const [registerType, setRegisterType] = useState('student'); // 'student', 'advisor', 'hod', 'faculty'
    const [profile, setProfile] = useState({});

    const [leaves, setLeaves] = useState([]);
    const [ods, setOds] = useState([]);
    const [loading, setLoading] = useState(true);

    const todayDateStr = new Date().toISOString().split('T')[0];
    const [filterDate, setFilterDate] = useState(todayDateStr);
    const [filterYear, setFilterYear] = useState('All');

    // Reports State
    const [reportType, setReportType] = useState('student');
    const [reportSearchRoll, setReportSearchRoll] = useState('');
    const [submitSearchRoll, setSubmitSearchRoll] = useState('');
    const [fetchedStudentInfo, setFetchedStudentInfo] = useState(null);
    const [reportDate, setReportDate] = useState(todayDateStr);
    const [reportYear, setReportYear] = useState('All');
    const [studentHistoryFilter, setStudentHistoryFilter] = useState('ALL'); // 'ALL' | 'LEAVE' | 'OD'
    const [reportCustomDept, setReportCustomDept] = useState('');
    const [totalWorkingDays, setTotalWorkingDays] = useState(90); // Default illustrative working days
    const [showDocumentModal, setShowDocumentModal] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);
    const [modalType, setModalType] = useState('');
    const [profileOpen, setProfileOpen] = useState(false);

    // Registration Form State
    const [regForm, setRegForm] = useState({
        staff_id: '',
        full_name: '', roll_number: '', register_number: '', email: '',
        mobile_number: '', year: localStorage.getItem('contextYear') || '',
        department: localStorage.getItem('contextDept') || '', password: '',
        faculty_role: 'NONE',
        subjects: ''
    });
    const [regMessage, setRegMessage] = useState('');
    const [regError, setRegError] = useState('');
    const [regLoading, setRegLoading] = useState(false);

    // Manage Users State
    const [manageType, setManageType] = useState('student');
    const [manageUsersList, setManageUsersList] = useState([]);
    const [manageSearch, setManageSearch] = useState('');
    const [manageEditingUser, setManageEditingUser] = useState(null);
    const [manageEditForm, setManageEditForm] = useState({});

    // Settings
    const [totalWorkingDaysSetting, setTotalWorkingDaysSetting] = useState('90');

    const fetchSettings = async () => {
        try {
            const res = await apiFetch('/api/v1/admin/settings');
            const setting = (res.settings || []).find(s => s.key === 'totalWorkingDays');
            if (setting && setting.value) {
                setTotalWorkingDaysSetting(setting.value);
                setTotalWorkingDays(Number(setting.value) || 90);
            }
        } catch (e) { console.error(e); }
    };

    const handleSettingSubmit = async (e) => {
        if (e) e.preventDefault();
        try {
            setLoading(true);
            await apiFetch('/api/v1/admin/settings/totalWorkingDays', {
                method: 'PUT',
                body: JSON.stringify({ value: String(totalWorkingDaysSetting) })
            });
            setTotalWorkingDays(Number(totalWorkingDaysSetting) || 90);
            alert(`Working days updated to ${totalWorkingDaysSetting}! Updated across all portals and reports.`);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateWorkingDaysInReport = async () => {
        try {
            setLoading(true);
            await apiFetch('/api/v1/admin/settings/totalWorkingDays', {
                method: 'PUT',
                body: JSON.stringify({ value: String(totalWorkingDays) })
            });
            setTotalWorkingDaysSetting(String(totalWorkingDays));
            alert(`Total Working Days updated to ${totalWorkingDays}! Applied across student dashboard and reports.`);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const me = await apiFetch('/api/v1/auth/me');
                setProfile(me);
                if (me.department) {
                    setRegForm(prev => ({
                        ...prev,
                        department: me.department
                    }));
                }
            } catch (e) {
                console.error("Error fetching DEO profile:", e);
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const u = JSON.parse(userStr);
                    setProfile(u);
                    if (u.department) setRegForm(prev => ({ ...prev, department: u.department }));
                }
            }
            fetchSettings();
        })();
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard' || activeTab === 'reports') {
            loadData();
        }
        if (activeTab === 'reports' || activeTab === 'settings') {
            fetchSettings();
        }
    }, [activeTab, profile?.department]);

    useEffect(() => {
        setStudentHistoryFilter('ALL');
    }, [submitSearchRoll]);

    useEffect(() => {
        const fetchStudent = async () => {
            if (submitSearchRoll.trim().length > 0) {
                try {
                    const deptParam = profile?.department ? `&department=${encodeURIComponent(profile.department)}` : '';
                    const res = await apiFetch(`/api/v1/users/students?search=${submitSearchRoll.trim()}${deptParam}`);
                    if (res.students && res.students.length > 0) {
                        setFetchedStudentInfo(res.students[0]);
                    } else {
                        setFetchedStudentInfo(null);
                    }
                } catch (e) {
                    setFetchedStudentInfo(null);
                }
            } else {
                setFetchedStudentInfo(null);
            }
        };
        fetchStudent();
    }, [submitSearchRoll, profile?.department]);

    const loadData = async () => {
        try {
            setLoading(true);
            const deptToUse = profile?.department || localStorage.getItem('contextDept') || '';
            const deptParam = deptToUse ? `&department=${encodeURIComponent(deptToUse)}` : '';
            const [leaveRes, odRes] = await Promise.all([
                apiFetch(`/api/v1/leave/pending?status=all${deptParam}`),
                apiFetch(`/api/v1/od/pending?status=all${deptParam}`)
            ]);

            setLeaves(leaveRes.requests || []);
            setOds(odRes.requests || []);
        } catch (error) {
            console.error("Error fetching DEO data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        localStorage.removeItem('contextDept');
        navigate('/login');
    };

    const updateRegField = (e) => {
        setRegForm({ ...regForm, [e.target.name]: e.target.value });
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setRegError('');
        setRegMessage('');
        setRegLoading(true);

        const assignedDept = (profile?.department || regForm.department || '').trim();

        try {
            if (registerType === 'student') {
                await apiFetch('/api/v1/users/students', {
                    method: 'POST',
                    body: JSON.stringify({
                        full_name: regForm.full_name,
                        register_number: regForm.register_number,
                        roll_number: regForm.roll_number,
                        email: regForm.email,
                        mobile_number: regForm.mobile_number,
                        department: assignedDept,
                        year: regForm.year,
                        section: 'A', // Default or need field
                        date_of_birth: '2000-01-01', // Placeholder if not provided
                        account_status: 'ACTIVE',
                        password: regForm.password
                    })
                });
                alert('Student registered successfully in department: ' + assignedDept);
            } else {
                // Institutional user (Class Advisor, HOD, Faculty)
                let roleToSend = 'FACULTY';
                if (registerType === 'advisor') roleToSend = 'ADVISOR';
                else if (registerType === 'hod') roleToSend = 'HOD';
                else if (registerType === 'faculty') roleToSend = 'FACULTY';

                const subjectsList = regForm.subjects ? regForm.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];
                await apiFetch('/api/v1/users/institutional', {
                    method: 'POST',
                    body: JSON.stringify({
                        staff_id: regForm.staff_id,
                        full_name: regForm.full_name,
                        email: regForm.email,
                        password: regForm.password,
                        phone: regForm.mobile_number,
                        department: assignedDept,
                        year: (registerType === 'hod' || registerType === 'faculty') ? undefined : (regForm.year || undefined),
                        role: roleToSend,
                        subjects: subjectsList
                    })
                });
                const roleLabel = registerType === 'advisor' ? 'Class Advisor' : registerType === 'hod' ? 'HOD' : 'Subject Staff / Faculty';
                alert(`${roleLabel} registered successfully in department: ${assignedDept}!`);
            }
            // Clear form while keeping the DEO's department fixed
            setRegForm({
                staff_id: '',
                full_name: '', roll_number: '', register_number: '', email: '', mobile_number: '',
                subjects: '',
                year: localStorage.getItem('contextYear') || '',
                department: assignedDept,
                password: ''
            });
        } catch (error) {
            setRegError(error.message);
        } finally {
            setRegLoading(false);
        }
    };

    const fetchManageUsers = async (type = manageType, search = manageSearch) => {
        try {
            setLoading(true);
            const endpoint = type === 'student' ? 'students' : 'staff';
            const deptParam = profile?.department ? `&department=${encodeURIComponent(profile.department)}` : '';
            const res = await apiFetch(`/api/v1/users/${endpoint}?search=${search}&limit=200${deptParam}`);
            let rawList = type === 'student' ? (res.students || []) : (res.staff || []);

            const currentDeoDept = (profile?.department || '').toUpperCase().replace(/\s+/g, '');
            const isAimlDeo = ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(currentDeoDept);

            // Filter out records from other departments so other department DEOs never see them
            if (currentDeoDept) {
                rawList = rawList.filter(u => {
                    const uDept = (u.department || '').toUpperCase().replace(/\s+/g, '');
                    if (isAimlDeo) {
                        return ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(uDept);
                    }
                    return uDept === currentDeoDept;
                });
            }

            if (type !== 'student') {
                const currentDeoEmail = (profile?.email || '').toLowerCase().trim();
                const currentDeoStaffId = (profile?.staff_id || profile?.staffId || profile?.login_id || '').toLowerCase().trim();
                rawList = rawList.filter(u => {
                    const r = (u.role || '').toLowerCase();
                    if (r === 'deo' || r === 'sa') return false;
                    const uEmail = (u.email || u.collegeEmail || '').toLowerCase().trim();
                    const uStaffId = (u.staff_id || u.staffId || u.login_id || '').toLowerCase().trim();
                    if (currentDeoEmail && uEmail && uEmail === currentDeoEmail) return false;
                    if (currentDeoStaffId && uStaffId && uStaffId === currentDeoStaffId) return false;
                    return true;
                });
            }
            setManageUsersList(rawList);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
        try {
            const endpoint = manageType === 'student' ? `students/${userId}` : `staff/${userId}`;
            await apiFetch(`/api/v1/users/${endpoint}`, { method: 'DELETE' });
            alert('User deleted successfully.');
            fetchManageUsers(manageType, manageSearch);
        } catch (e) {
            alert(e.message);
        }
    };

    const handleEditUser = (u) => {
        setManageEditingUser(u.id || u._id);
        const nameVal = u.name || u.fullName || u.full_name || '';
        const deptVal = u.department || '';
        const emailVal = u.email || u.collegeEmail || '';
        setManageEditForm({
            staff_id: u.staff_id || u.staffId || '',
            name: nameVal,
            email: emailVal,
            department: deptVal,
            register_number: u.register_no || u.registerNumber || '',
            roll_number: u.roll_number || u.rollNumber || '',
            phone: u.phone || u.mobileNumber || u.mobile_number || '',
            year: u.year || u.assigned_year || '',
            password: ''
        });
    };

    const submitUserEdit = async (userId) => {
        try {
            const endpoint = manageType === 'student' ? `students/${userId}` : `staff/${userId}`;
            await apiFetch(`/api/v1/users/${endpoint}`, {
                method: 'PUT',
                body: JSON.stringify(manageEditForm)
            });
            alert('User updated successfully.');
            setManageEditingUser(null);
            fetchManageUsers(manageType, manageSearch);
        } catch (e) {
            alert(e.message);
        }
    };

    // Filter Logic
    const currentDeoDept = (profile?.department || localStorage.getItem('contextDept') || '').toUpperCase().replace(/\s+/g, '');
    const isAimlDeo = ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(currentDeoDept);

    const matchesDeoDepartment = (itemDeptRaw) => {
        if (!currentDeoDept) return true;
        const itemDept = (itemDeptRaw || '').toUpperCase().replace(/\s+/g, '');
        if (isAimlDeo) {
            return ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(itemDept);
        }
        return itemDept === currentDeoDept;
    };

    const filteredLeaves = useMemo(() => {
        return leaves.filter(item => {
            if (!matchesDeoDepartment(item.department)) return false;
            if (filterYear !== 'All') {
                const itemY = normalizeYear(item.year);
                const targetY = normalizeYear(filterYear);
                if (itemY !== targetY) return false;
            }
            if (filterDate) {
                const toD = item.toDate || item.fromDate;
                if (!(filterDate >= item.fromDate && filterDate <= toD)) return false;
            }
            return true;
        });
    }, [leaves, currentDeoDept, isAimlDeo, filterYear, filterDate]);

    const filteredOds = useMemo(() => {
        return ods.filter(item => {
            if (!matchesDeoDepartment(item.department)) return false;
            if (filterYear !== 'All') {
                const itemY = normalizeYear(item.year);
                const targetY = normalizeYear(filterYear);
                if (itemY !== targetY) return false;
            }
            if (filterDate) {
                const toD = item.toDate || item.fromDate;
                if (!(filterDate >= item.fromDate && filterDate <= toD)) return false;
            }
            return true;
        });
    }, [ods, currentDeoDept, isAimlDeo, filterYear, filterDate]);

    // Report Computations
    const searchedStudentRecords = useMemo(() => {
        if (!submitSearchRoll) return [];
        const rollLower = submitSearchRoll.toLowerCase().trim();
        return [...leaves, ...ods].filter(r =>
            matchesDeoDepartment(r.department) &&
            ((r.rollNumber && r.rollNumber.toLowerCase().includes(rollLower)) ||
            (r.registerNumber && r.registerNumber.toLowerCase().includes(rollLower)))
        ).sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
    }, [leaves, ods, submitSearchRoll, currentDeoDept, isAimlDeo]);

    const searchedStudentStats = useMemo(() => {
        const leaveItems = searchedStudentRecords.filter(r => r.leaveType);
        const odItems = searchedStudentRecords.filter(r => !r.leaveType);

        const totalLeaveDays = leaveItems.reduce((acc, r) => acc + getRecordDays(r), 0);
        const totalOdDays = odItems.reduce((acc, r) => acc + getRecordDays(r), 0);
        const totalLeaveTimes = leaveItems.length;
        const totalOdTimes = odItems.length;

        const effectiveWorkingDays = Number(totalWorkingDays) > 0 ? Number(totalWorkingDays) : 90;
        const leavePercentage = ((totalLeaveDays / effectiveWorkingDays) * 100).toFixed(1);

        return {
            totalLeaveDays,
            totalOdDays,
            totalLeaveTimes,
            totalOdTimes,
            leavePercentage
        };
    }, [searchedStudentRecords, totalWorkingDays]);

    const displayedStudentHistory = useMemo(() => {
        if (studentHistoryFilter === 'LEAVE') return searchedStudentRecords.filter(r => r.leaveType);
        if (studentHistoryFilter === 'OD') return searchedStudentRecords.filter(r => !r.leaveType);
        return searchedStudentRecords;
    }, [searchedStudentRecords, studentHistoryFilter]);

    const resolvedStudent = useMemo(() => {
        const firstRec = searchedStudentRecords[0] || {};
        if (fetchedStudentInfo) {
            return {
                name: fetchedStudentInfo.name || fetchedStudentInfo.fullName || firstRec.studentName || 'Student',
                rollNumber: fetchedStudentInfo.roll_number || fetchedStudentInfo.rollNumber || firstRec.rollNumber || submitSearchRoll,
                registerNumber: fetchedStudentInfo.register_no || fetchedStudentInfo.registerNumber || firstRec.registerNumber || '—',
                department: fetchedStudentInfo.department || firstRec.department || profile?.department || '—',
                year: fetchedStudentInfo.year || firstRec.year || '—',
                section: fetchedStudentInfo.section || firstRec.section || '—',
                email: fetchedStudentInfo.email || fetchedStudentInfo.collegeEmail || firstRec.collegeEmail || '—',
                phone: fetchedStudentInfo.phone || fetchedStudentInfo.mobileNumber || firstRec.parentContact || '—'
            };
        }
        if (firstRec && (firstRec.studentName || firstRec.rollNumber)) {
            return {
                name: firstRec.studentName || 'Student',
                rollNumber: firstRec.rollNumber || submitSearchRoll,
                registerNumber: firstRec.registerNumber || '—',
                department: firstRec.department || profile?.department || '—',
                year: firstRec.year || '—',
                section: firstRec.section || '—',
                email: firstRec.collegeEmail || '—',
                phone: firstRec.parentContact || '—'
            };
        }
        return null;
    }, [fetchedStudentInfo, searchedStudentRecords, submitSearchRoll, profile?.department]);

    const renderBlackAndWhiteDocument = () => {
        if (!resolvedStudent) return null;
        const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

        return (
            <div
                className="document-sheet bw-document"
                id="formal-student-document"
                style={{
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    padding: '2rem',
                    fontFamily: 'serif, Times, "Times New Roman"',
                    boxShadow: 'none',
                    margin: '0 auto',
                    maxWidth: '820px',
                    boxSizing: 'border-box'
                }}
            >
                {/* College Header (Black & White) */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 'bold', color: '#000000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        KANGEYAM INSTITUTE OF TECHNOLOGY
                    </h2>
                    <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#000000', fontStyle: 'italic' }}>
                        Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase' }}>
                        DEPARTMENT OF {resolvedStudent.department}
                    </p>
                    <div style={{ margin: '8px 0 0', display: 'inline-block', border: '1px solid #000000', padding: '3px 14px', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        STUDENT LEAVE & ON-DUTY (OD) RECORD
                    </div>
                </div>

                {/* 1. First: Student Name, Roll No, Dept (Strictly B&W) */}
                <div style={{ border: '1px solid #000000', padding: '0.75rem 1rem', marginBottom: '1.25rem', backgroundColor: '#ffffff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', color: '#000000' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', width: '20%', fontWeight: 'bold' }}>Student Name:</td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '35%', fontWeight: 'bold', fontSize: '1.05rem', textTransform: 'uppercase' }}>{resolvedStudent.name}</td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '20%', fontWeight: 'bold' }}>Roll Number:</td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '25%', fontWeight: 'bold' }}>{resolvedStudent.rollNumber}</td>
                            </tr>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Department:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>{resolvedStudent.department}</td>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Register No:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>{resolvedStudent.registerNumber}</td>
                            </tr>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Year & Section:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>
                                    {resolvedStudent.year ? `Year ${resolvedStudent.year}` : '—'} {resolvedStudent.section ? `- Section ${resolvedStudent.section}` : ''}
                                </td>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Report Date:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>{printDate}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Attendance Summary Bar (B&W) */}
                <div style={{ border: '1px solid #000000', padding: '0.5rem 1rem', marginBottom: '1.25rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000' }}>
                    <span>Total Leave Days: {searchedStudentStats.totalLeaveDays}</span>
                    <span>|</span>
                    <span>Total On-Duty (OD) Days: {searchedStudentStats.totalOdDays}</span>
                    <span>|</span>
                    <span>Leave %: {searchedStudentStats.leavePercentage}%</span>
                </div>

                {/* 2. Below that: All Leave Details applied by the student (B&W table) */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Leave & On-Duty Details Applied:
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#000000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eeeeee', borderBottom: '2px solid #000000' }}>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '35px' }}>S.No</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '120px' }}>Date(s)</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '60px' }}>Duration</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '110px' }}>Category & Type</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left' }}>Reason / Purpose</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '85px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchedStudentRecords.length > 0 ? (
                                searchedStudentRecords.map((r, i) => {
                                    const days = getRecordDays(r);
                                    const isLeave = !!r.leaveType;
                                    const datesDisplay = r.fromDate === r.toDate || !r.toDate ? r.fromDate : `${r.fromDate} to ${r.toDate}`;
                                    const reasonDisplay = r.reason || r.eventName || '—';

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 'bold' }}>{datesDisplay}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>
                                                {days} {days === 1 ? 'day' : 'days'}
                                            </td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>
                                                <strong>{isLeave ? 'Leave' : 'OD'}</strong> - {r.leaveType || r.odType || 'Regular'}
                                            </td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{reasonDisplay}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {r.status || 'Approved'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ border: '1px solid #000000', padding: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                                        No leave or on-duty records found for this student.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderBlackAndWhiteDateDocument = () => {
        const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const printTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const totalLeaves = reportDateRecords.filter(r => r.leaveType).length;
        const totalOds = reportDateRecords.filter(r => !r.leaveType).length;

        return (
            <div
                className="document-sheet bw-document"
                id="formal-date-document"
                style={{
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '2px solid #000000',
                    padding: '2rem',
                    fontFamily: 'serif, Times, "Times New Roman"',
                    boxShadow: 'none',
                    margin: '0 auto',
                    maxWidth: '840px',
                    boxSizing: 'border-box'
                }}
            >
                {/* College Header (Black & White) */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 'bold', color: '#000000', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        KANGEYAM INSTITUTE OF TECHNOLOGY
                    </h2>
                    <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#000000', fontStyle: 'italic' }}>
                        Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000', textTransform: 'uppercase' }}>
                        DEPARTMENT OF {profile?.department || 'ALL DEPARTMENTS'}
                    </p>
                    <div style={{ margin: '8px 0 0', display: 'inline-block', border: '1px solid #000000', padding: '3px 14px', fontSize: '0.9rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        DAILY STUDENT LEAVE & ON-DUTY (OD) ATTENDANCE REPORT
                    </div>
                </div>

                {/* Filter & Metadata Info Box (B&W) */}
                <div style={{ border: '1px solid #000000', padding: '0.75rem 1rem', marginBottom: '1.25rem', backgroundColor: '#ffffff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem', color: '#000000' }}>
                        <tbody>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', width: '20%', fontWeight: 'bold' }}>Record Date:</td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '35%', fontWeight: 'bold', fontSize: '1rem' }}>
                                    {reportDate ? reportDate : 'All Available Dates'}
                                </td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '20%', fontWeight: 'bold' }}>Academic Year:</td>
                                <td style={{ border: 'none', padding: '4px 6px', width: '25%', fontWeight: 'bold' }}>
                                    {reportYear !== 'All' ? `Year ${reportYear}` : 'All Years (I - IV)'}
                                </td>
                            </tr>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Department:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>{profile?.department || 'All Departments'}</td>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Generated On:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }}>{printDate} at {printTime}</td>
                            </tr>
                            <tr>
                                <td style={{ border: 'none', padding: '4px 6px', fontWeight: 'bold' }}>Generated By:</td>
                                <td style={{ border: 'none', padding: '4px 6px' }} colSpan="3">
                                    {profile?.full_name || profile?.name || 'Data Entry Operator'} (DEO)
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Summary Row (B&W) */}
                <div style={{ border: '1px solid #000000', padding: '0.5rem 1rem', marginBottom: '1.25rem', backgroundColor: '#fafafa', display: 'flex', justifyContent: 'space-around', fontSize: '0.9rem', fontWeight: 'bold', color: '#000000' }}>
                    <span>Total Students Absent / On-Duty: {reportDateRecords.length}</span>
                    <span>|</span>
                    <span>Leaves: {totalLeaves}</span>
                    <span>|</span>
                    <span>On-Duty (OD): {totalOds}</span>
                </div>

                {/* Student Records Table (B&W Table) */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Student Leave & On-Duty Absence List:
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#000000' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#eeeeee', borderBottom: '2px solid #000000' }}>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '35px' }}>S.No</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '90px' }}>Roll No</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '150px' }}>Student Name</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '50px' }}>Year</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left', width: '110px' }}>Category & Type</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '60px' }}>Days</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'left' }}>Reason / Details</th>
                                <th style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', width: '75px' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportDateRecords.length > 0 ? (
                                reportDateRecords.map((r, i) => {
                                    const days = getRecordDays(r);
                                    const isLeave = !!r.leaveType;
                                    const reasonDisplay = r.reason || r.eventName || '—';

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px solid #000000' }}>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>{i + 1}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 'bold' }}>{r.rollNumber || '—'}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', fontWeight: 'bold' }}>{r.studentName}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>{r.year || '—'}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>
                                                <strong>{isLeave ? 'Leave' : 'OD'}</strong> - {r.leaveType || r.odType || 'Regular'}
                                            </td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center' }}>
                                                {days} {days === 1 ? 'd' : 'd'}
                                            </td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px' }}>{reasonDisplay}</td>
                                            <td style={{ border: '1px solid #000000', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                {r.status || 'Approved'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="8" style={{ border: '1px solid #000000', padding: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                                        No leave or on-duty absence records found for the selected date and year filter.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const reportDateRecords = useMemo(() => {
        return [...leaves, ...ods].filter(r => {
            if (!matchesDeoDepartment(r.department)) return false;
            if (reportYear !== 'All') {
                const rY = normalizeYear(r.year);
                const targetY = normalizeYear(reportYear);
                if (rY !== targetY) return false;
            }
            if (!reportDate) return true;
            const toD = r.toDate || r.fromDate;
            return reportDate >= r.fromDate && reportDate <= toD;
        }).sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate));
    }, [leaves, ods, reportDate, reportYear, currentDeoDept, isAimlDeo]);

    const customRecords = useMemo(() => {
        if (!reportCustomDept) return [];
        const deptLower = reportCustomDept.toLowerCase().trim();
        return [...leaves, ...ods].filter(r => r.department && r.department.toLowerCase().includes(deptLower));
    }, [leaves, ods, reportCustomDept]);

    const openModal = (item, type) => {
        setSelectedItem(item);
        setModalType(type);
    };

    const renderModal = () => {
        if (!selectedItem) return null;
        const statusInfo = getStatusStyle(selectedItem.status);

        return (
            <>
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setSelectedItem(null)} />
                <div className="card" style={{
                    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '90%', maxWidth: '600px', zIndex: 1000, margin: 0, padding: 0, overflow: 'hidden'
                }}>
                    <div style={{ padding: '1rem 1.5rem', backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#002147' }}>{modalType === 'leave' ? 'Leave Details' : 'OD Details'}</h3>
                        <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <X size={20} color="#666" />
                        </button>
                    </div>

                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#333' }}>{selectedItem.studentName}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{selectedItem.registerNumber} • {selectedItem.department}</div>
                            </div>
                            <span style={{
                                padding: '5px 12px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 700,
                                backgroundColor: statusInfo.bg, color: statusInfo.color, display: 'flex', alignItems: 'center', gap: '5px', height: 'fit-content'
                            }}>
                                {getStatusIcon(selectedItem.status)} {statusInfo.label}
                            </span>
                        </div>

                        <div className="grid grid-cols-2" style={{ gap: '1rem', fontSize: '0.9rem' }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Date Range</div>
                                <div style={{ fontWeight: 500, color: '#333' }}>{selectedItem.fromDate} {selectedItem.toDate !== selectedItem.fromDate && `to ${selectedItem.toDate}`}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Type</div>
                                <div style={{ fontWeight: 500, color: '#333' }}>{selectedItem.leaveType || selectedItem.odType}</div>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Reason / Purpose</div>
                                <div style={{ backgroundColor: '#f8f9fa', padding: '0.75rem', borderRadius: '4px', border: '1px solid #eee', marginTop: '0.25rem' }}>
                                    {selectedItem.reason || selectedItem.purpose || selectedItem.eventName || 'N/A'}
                                </div>
                            </div>

                            {modalType === 'od' && selectedItem.organization && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Organization</div>
                                    <div style={{ backgroundColor: '#f8f9fa', padding: '0.75rem', borderRadius: '4px', border: '1px solid #eee', marginTop: '0.25rem' }}>
                                        {selectedItem.organization} {selectedItem.location && `(${selectedItem.location})`}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#888', textTransform: 'uppercase' }}>Submitted On</div>
                                <div style={{ fontWeight: 500, color: '#333' }}>
                                    {selectedItem.submittedAt ? new Date(selectedItem.submittedAt).toLocaleString() : 'N/A'}
                                </div>
                            </div>

                            {selectedItem.supportingDocument && (
                                <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                                    <a href={`${API_BASE}${selectedItem.supportingDocument}`} target="_blank" rel="noreferrer" style={{ color: '#0056b3', textDecoration: 'underline' }}>
                                        View Supporting Document
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className="app-wrapper">
            {/* ---- SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>DEO Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={18} /> Dashboard
                    </button>
                    <div>
                        <button
                            onClick={() => setActiveTab('register')}
                            className={`nav-item ${activeTab === 'register' ? 'active' : ''}`}
                            style={{ width: '100%' }}
                        >
                            <UserPlus size={18} /> Register
                        </button>
                        {activeTab === 'register' && (
                            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2.5rem', marginTop: '0.2rem', gap: '0.5rem' }}>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: registerType === 'student' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: registerType === 'student' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setRegisterType('student')}>• Student</div>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: registerType === 'advisor' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: registerType === 'advisor' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setRegisterType('advisor')}>• Class Advisor</div>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: registerType === 'hod' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: registerType === 'hod' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setRegisterType('hod')}>• HOD</div>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: registerType === 'faculty' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: registerType === 'faculty' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setRegisterType('faculty')}>• Subject Staff</div>
                            </div>
                        )}
                    </div>
                    <div>
                        <button
                            onClick={() => { setActiveTab('manage'); fetchManageUsers('student', manageSearch); setManageType('student'); }}
                            className={`nav-item ${activeTab === 'manage' ? 'active' : ''}`}
                            style={{ width: '100%' }}
                        >
                            <Users size={18} /> Manage Users
                        </button>
                        {activeTab === 'manage' && (
                            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2.5rem', marginTop: '0.2rem', gap: '0.5rem' }}>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: manageType === 'student' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: manageType === 'student' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => { setManageType('student'); fetchManageUsers('student', manageSearch); }}>• Students</div>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: manageType === 'staff' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: manageType === 'staff' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => { setManageType('staff'); fetchManageUsers('staff', manageSearch); }}>• Staff / HOD / CA</div>
                            </div>
                        )}
                    </div>
                    <div>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                            style={{ width: '100%' }}
                        >
                            <FileText size={18} /> Reports
                        </button>
                        {activeTab === 'reports' && (
                            <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: '2.5rem', marginTop: '0.2rem', gap: '0.5rem' }}>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: reportType === 'student' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: reportType === 'student' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setReportType('student')}>• By Student</div>
                                <div style={{ cursor: 'pointer', fontSize: '0.9rem', color: reportType === 'date' ? '#ffc107' : 'rgba(255,255,255,0.7)', fontWeight: reportType === 'date' ? '700' : '500', transition: 'color 0.2s' }} onClick={() => setReportType('date')}>• By Date</div>
                            </div>
                        )}
                    </div>

                    <div>
                        <button
                            onClick={() => { setActiveTab('settings'); fetchSettings(); }}
                            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                            style={{ width: '100%' }}
                        >
                            <Settings size={18} /> Settings
                        </button>
                    </div>

                    <div style={{ flex: 1 }} />
                    <button className="nav-item" onClick={handleLogout} style={{ color: '#ff6b6b' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </nav>
            </aside>

            {/* ---- MAIN CONTENT ---- */}
            <div className="main-content">
                {/* Top Header */}
                <header className="top-header">
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>DEO Gateway</span>
                    <div style={{ position: 'relative' }}>
                        <div onClick={() => setProfileOpen(!profileOpen)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}>
                            <UserCircle size={28} />
                            <span>{profile?.full_name || profile?.name || 'DEO User'}</span>
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
                                    <p><strong>Name:</strong> {profile?.full_name || profile?.name || 'DEO User'}</p>
                                    <p><strong>Role:</strong> DEO</p>
                                </div>
                            </div>
                        </>}
                    </div>
                </header>

                <div className="page-content">
                    {activeTab === 'settings' && (
                        <div className="card">
                            <h3 style={{ color: '#002147', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Settings size={20} /> System Settings
                            </h3>

                            <form onSubmit={handleSettingSubmit}>
                                <div className="form-group" style={{ maxWidth: '400px' }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Total Working Days <span style={{ color: 'red' }}>*</span></label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={totalWorkingDaysSetting}
                                        onChange={e => setTotalWorkingDaysSetting(e.target.value)}
                                        required
                                        min="1"
                                    />
                                    <small className="text-muted" style={{ display: 'block', marginTop: '4px' }}>
                                        This value will be displayed on the student dashboard for attendance calculation. Any changes will immediately reflect for all students.
                                    </small>
                                </div>

                                <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '0.6rem 2rem' }}>
                                    {loading ? 'Saving...' : 'Save Settings'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab !== 'settings' && activeTab !== 'reports' && (
                        <div className="card hide-on-print" style={{ margin: '0 0 1.25rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <UserCircle size={40} color="#002147" />
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#002147' }}>Welcome, {profile?.full_name || profile?.name || 'DEO'}</div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>{activeTab === 'dashboard' ? 'Data Entry Operator Dashboard' : 'User Registration Portal'}</div>
                            </div>
                        </div>
                    )}

                            {activeTab === 'dashboard' && (
                                <>
                                    {/* Filter Section */}
                                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                            <div style={{ fontWeight: 600, color: '#002147', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Filter size={18} />
                                                Filter Records
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                {/* Year Filter */}
                                                <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                                                    <select
                                                        className="input-field"
                                                        value={filterYear}
                                                        onChange={(e) => setFilterYear(e.target.value)}
                                                        style={{ marginTop: 0 }}
                                                    >
                                                        <option value="All">All Years</option>
                                                        <option value="I">1st Year (I)</option>
                                                        <option value="II">2nd Year (II)</option>
                                                        <option value="III">3rd Year (III)</option>
                                                        <option value="IV">4th Year (IV)</option>
                                                    </select>
                                                </div>

                                                {/* Date Filter */}
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <input
                                                        type="date"
                                                        className="input-field"
                                                        value={filterDate}
                                                        onChange={(e) => setFilterDate(e.target.value)}
                                                        style={{ marginTop: 0 }}
                                                    />
                                                </div>

                                                {/* Clear button */}
                                                {(filterYear !== 'All' || filterDate !== todayDateStr) && (
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => { setFilterDate(todayDateStr); setFilterYear('All'); }}
                                                        title="Reset Filters to Today"
                                                        style={{ backgroundColor: '#6c757d', padding: '0.6rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                                                    >
                                                        <X size={16} /> Reset
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>Loading DEO Data...</div>
                                    ) : (
                                        <>
                                            {/* Dashboard view showing KPIs */}
                                            <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                                                <div className="card text-center" style={{ margin: 0, padding: '1.5rem 1rem', borderTop: '4px solid #ffc107', cursor: 'pointer', opacity: historyType === 'leave' ? 1 : 0.6 }} onClick={() => setHistoryType('leave')}>
                                                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Number of Leave's</div>
                                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#dc3545' }}>{filteredLeaves.length}</div>
                                                    <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#0056b3', textDecoration: historyType === 'leave' ? 'underline' : 'none' }}>Click to view list</div>
                                                </div>
                                                <div className="card text-center" style={{ margin: 0, padding: '1.5rem 1rem', borderTop: '4px solid #17a2b8', cursor: 'pointer', opacity: historyType === 'od' ? 1 : 0.6 }} onClick={() => setHistoryType('od')}>
                                                    <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Number of OD's</div>
                                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#17a2b8' }}>{filteredOds.length}</div>
                                                    <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#0056b3', textDecoration: historyType === 'od' ? 'underline' : 'none' }}>Click to view list</div>
                                                </div>
                                            </div>

                                            {/* Combined History List rendered inline within Dashboard */}
                                            <div className="card" style={{ margin: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #002147', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                                    <h3 style={{ color: '#002147', margin: 0, fontSize: '1rem' }}>
                                                        <Calendar size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle', color: '#002147' }} />
                                                        {historyType === 'leave' ? 'Leave History' : 'OD History'}
                                                    </h3>
                                                    <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>Showing {(historyType === 'leave' ? filteredLeaves : filteredOds).length} records</span>
                                                </div>

                                                {(historyType === 'leave' ? filteredLeaves : filteredOds).length === 0 ? (
                                                    <div style={{ textAlign: 'center', padding: '2rem 0', color: '#888' }}>
                                                        No records found {filterYear !== 'All' ? `for ${filterYear} Year` : ''}{filterDate ? ` on ${filterDate}` : ''}.
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div style={{
                                                            display: 'grid', gridTemplateColumns: '80px 1fr 90px 1fr 100px',
                                                            padding: '0.6rem 0.75rem', backgroundColor: '#f0f2f5', borderRadius: '6px 6px 0 0',
                                                            fontSize: '0.7rem', fontWeight: 700, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px'
                                                        }}>
                                                            <div>Roll No</div>
                                                            <div>Student Name</div>
                                                            <div>Year</div>
                                                            <div>Dates</div>
                                                            <div style={{ textAlign: 'center' }}>Status</div>
                                                        </div>

                                                        {(historyType === 'leave' ? filteredLeaves : filteredOds).map(item => {
                                                            const statusInfo = getStatusStyle(item.status);
                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    onClick={() => openModal(item, historyType)}
                                                                    style={{
                                                                        display: 'grid', gridTemplateColumns: '80px 1fr 90px 1fr 100px',
                                                                        padding: '0.75rem', borderBottom: '1px solid #eee',
                                                                        cursor: 'pointer', alignItems: 'center', backgroundColor: '#fff',
                                                                        transition: 'background 0.2s'
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fff'}
                                                                >
                                                                    <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#333' }}>{item.rollNumber || item.registerNumber?.substring(item.registerNumber.length - 3) || '—'}</div>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#002147' }}>{item.studentName}</div>
                                                                    <div>
                                                                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#e9ecef', color: '#002147' }}>
                                                                            {item.year || '—'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ fontSize: '0.8rem', color: '#555' }}>
                                                                        {item.fromDate} {item.toDate !== item.fromDate && `to ${item.toDate}`}
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
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}

                            {activeTab === 'reports' && (
                                <div id="print-area">
                                    <div style={{ marginBottom: '1.5rem' }} className="hide-on-print">
                                        <h2 style={{ margin: 0, color: '#002147', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'capitalize' }}>
                                            <BarChart2 size={24} /> Report: By {reportType}
                                        </h2>
                                    </div>

                                    {reportType === 'student' && (
                                        <>
                                            <div className="card hide-on-print" style={{ marginBottom: '1rem' }}>
                                                <h3 style={{ margin: '0 0 1rem', color: '#002147', fontSize: '1rem' }}>Search by Roll No</h3>
                                                <div style={{ display: 'flex', gap: '1rem' }}>
                                                    <input type="text" className="input-field" placeholder="Enter Full Roll Number..." value={reportSearchRoll} onChange={(e) => setReportSearchRoll(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setSubmitSearchRoll(reportSearchRoll)} style={{ margin: 0, flex: 1 }} />
                                                    <button className="btn btn-primary" onClick={() => setSubmitSearchRoll(reportSearchRoll)}>Search</button>
                                                </div>
                                            </div>

                                            {(submitSearchRoll && resolvedStudent) ? (
                                                <>
                                                    {/* On-screen Dashboard View */}
                                                    <div className="hide-on-print">
                                                        <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem', backgroundColor: '#e9ecef', borderLeft: '4px solid #002147', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#002147' }}>Student: <span style={{ color: '#333' }}>{resolvedStudent.name}</span></div>
                                                                <div style={{ fontSize: '0.9rem', color: '#555', marginTop: '0.25rem' }}>
                                                                    Roll No: <strong>{resolvedStudent.rollNumber}</strong> | Dept: <strong>{resolvedStudent.department || '—'}</strong>
                                                                    {resolvedStudent.year && <span> | Year: <strong>{resolvedStudent.year}</strong></span>}
                                                                    {resolvedStudent.section && <span> | Sec: <strong>{resolvedStudent.section}</strong></span>}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => setShowDocumentModal(true)}
                                                                className="btn"
                                                                style={{
                                                                    fontSize: '0.85rem',
                                                                    fontWeight: 'bold',
                                                                    backgroundColor: '#ffffff',
                                                                    color: '#000000',
                                                                    border: '1.5px solid #000000',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem',
                                                                    padding: '0.45rem 0.9rem'
                                                                }}
                                                            >
                                                                <FileText size={16} /> View Report
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                                                            <div
                                                                className="card text-center"
                                                                style={{
                                                                    margin: 0,
                                                                    cursor: 'pointer',
                                                                    borderTop: '4px solid #dc3545',
                                                                    boxShadow: studentHistoryFilter === 'LEAVE' ? '0 0 0 2px #dc3545' : undefined,
                                                                    backgroundColor: studentHistoryFilter === 'LEAVE' ? '#fff5f5' : '#fff',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onClick={() => setStudentHistoryFilter(prev => prev === 'LEAVE' ? 'ALL' : 'LEAVE')}
                                                            >
                                                                <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>TOTAL LEAVE DAYS</div>
                                                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#dc3545' }}>{searchedStudentStats.totalLeaveDays}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                                                    {searchedStudentStats.totalLeaveDays} {searchedStudentStats.totalLeaveDays === 1 ? 'day' : 'days'} ({searchedStudentStats.totalLeaveTimes} {searchedStudentStats.totalLeaveTimes === 1 ? 'time' : 'times'})
                                                                </div>
                                                            </div>
                                                            <div
                                                                className="card text-center"
                                                                style={{
                                                                    margin: 0,
                                                                    cursor: 'pointer',
                                                                    borderTop: '4px solid #17a2b8',
                                                                    boxShadow: studentHistoryFilter === 'OD' ? '0 0 0 2px #17a2b8' : undefined,
                                                                    backgroundColor: studentHistoryFilter === 'OD' ? '#f0faff' : '#fff',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onClick={() => setStudentHistoryFilter(prev => prev === 'OD' ? 'ALL' : 'OD')}
                                                            >
                                                                <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>ON-DUTY (OD) DAYS</div>
                                                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#17a2b8' }}>{searchedStudentStats.totalOdDays}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                                                    {searchedStudentStats.totalOdDays} {searchedStudentStats.totalOdDays === 1 ? 'day' : 'days'} ({searchedStudentStats.totalOdTimes} {searchedStudentStats.totalOdTimes === 1 ? 'time' : 'times'})
                                                                </div>
                                                            </div>
                                                            <div className="card text-center" style={{ margin: 0, borderTop: '4px solid #ffc107' }}>
                                                                <div style={{ fontSize: '0.85rem', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>LEAVE %</div>
                                                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#ffc107' }}>{searchedStudentStats.leavePercentage}%</div>
                                                            </div>
                                                        </div>

                                                        <div className="card" style={{ margin: 0 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                                <h3 style={{ margin: 0, color: '#002147', fontSize: '1rem' }}>
                                                                    History of Leaves & ODs ({displayedStudentHistory.length})
                                                                </h3>
                                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                    <button
                                                                        onClick={() => setStudentHistoryFilter('ALL')}
                                                                        className="btn"
                                                                        style={{
                                                                            padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
                                                                            backgroundColor: studentHistoryFilter === 'ALL' ? '#002147' : '#e9ecef',
                                                                            color: studentHistoryFilter === 'ALL' ? '#fff' : '#333'
                                                                        }}
                                                                    >
                                                                        All ({searchedStudentRecords.length})
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setStudentHistoryFilter('LEAVE')}
                                                                        className="btn"
                                                                        style={{
                                                                            padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
                                                                            backgroundColor: studentHistoryFilter === 'LEAVE' ? '#dc3545' : '#e9ecef',
                                                                            color: studentHistoryFilter === 'LEAVE' ? '#fff' : '#333'
                                                                        }}
                                                                    >
                                                                        Leaves Only ({searchedStudentStats.totalLeaveTimes})
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setStudentHistoryFilter('OD')}
                                                                        className="btn"
                                                                        style={{
                                                                            padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px',
                                                                            backgroundColor: studentHistoryFilter === 'OD' ? '#17a2b8' : '#e9ecef',
                                                                            color: studentHistoryFilter === 'OD' ? '#fff' : '#333'
                                                                        }}
                                                                    >
                                                                        ODs Only ({searchedStudentStats.totalOdTimes})
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {displayedStudentHistory.length > 0 ? (
                                                                displayedStudentHistory.map((r, i) => {
                                                                    const days = getRecordDays(r);
                                                                    return (
                                                                        <div key={i} style={{ padding: '0.75rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <div>
                                                                                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                    <span>{r.fromDate} {r.toDate !== r.fromDate && `to ${r.toDate}`}</span>
                                                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#002147', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px' }}>
                                                                                        {days} {days === 1 ? 'day' : 'days'}
                                                                                    </span>
                                                                                </div>
                                                                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '2px' }}>
                                                                                    Type: <span style={{ fontWeight: 700, color: '#002147' }}>{r.leaveType || r.odType || 'OD'}</span>
                                                                                    {r.reason && <span> • Reason: {r.reason}</span>}
                                                                                </div>
                                                                            </div>
                                                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', ...getStatusStyle(r.status) }}>
                                                                                {r.status}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontStyle: 'italic', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                                                                    No records found for selected filter.
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Printable Black & White Document View */}
                                                    <div className="print-only">
                                                        {renderBlackAndWhiteDocument()}
                                                    </div>
                                                </>
                                            ) : submitSearchRoll ? (
                                                <div className="card text-center hide-on-print" style={{ padding: '2rem', color: '#888' }}>
                                                    Student not found in database.
                                                </div>
                                            ) : null}
                                        </>
                                    )}

                                    {reportType === 'date' && (
                                        <>
                                            <div className="card hide-on-print" style={{ marginBottom: '1.5rem' }}>
                                                <h3 style={{ margin: '0 0 1rem', color: '#002147', fontSize: '1rem' }}>Filter by Date & Year</h3>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                                    <div style={{ flex: 1, minWidth: '180px' }}>
                                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Select Date</label>
                                                        <input
                                                            type="date"
                                                            className="input-field"
                                                            value={reportDate}
                                                            onChange={(e) => setReportDate(e.target.value)}
                                                            style={{ margin: 0 }}
                                                        />
                                                    </div>
                                                    <div style={{ width: '160px' }}>
                                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Select Year</label>
                                                        <select
                                                            className="input-field"
                                                            value={reportYear}
                                                            onChange={(e) => setReportYear(e.target.value)}
                                                            style={{ margin: 0 }}
                                                        >
                                                            <option value="All">All Years</option>
                                                            <option value="I">1st Year</option>
                                                            <option value="II">2nd Year</option>
                                                            <option value="III">3rd Year</option>
                                                            <option value="IV">4th Year</option>
                                                        </select>
                                                    </div>
                                                    {(reportDate || reportYear !== 'All') && (
                                                        <button
                                                            onClick={() => { setReportDate(''); setReportYear('All'); }}
                                                            className="btn"
                                                            style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 600, padding: '0.55rem 1rem' }}
                                                        >
                                                            Reset Filters
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* On-screen view */}
                                            <div className="card hide-on-print" style={{ margin: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <h3 style={{ margin: 0, color: '#002147', fontSize: '1rem' }}>
                                                        Records {reportDate ? `on ${reportDate}` : '(All Dates)'} {reportYear !== 'All' ? `• Year ${reportYear}` : ''} ({reportDateRecords.length})
                                                    </h3>
                                                    <button
                                                        onClick={() => setShowDocumentModal(true)}
                                                        className="btn"
                                                        style={{
                                                            fontSize: '0.85rem',
                                                            fontWeight: 'bold',
                                                            backgroundColor: '#ffffff',
                                                            color: '#000000',
                                                            border: '1.5px solid #000000',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            padding: '0.4rem 0.85rem'
                                                        }}
                                                    >
                                                        <FileText size={16} /> View Report
                                                    </button>
                                                </div>
                                                {reportDateRecords.length > 0 ? (
                                                    reportDateRecords.map((r, i) => {
                                                        const days = getRecordDays(r);
                                                        return (
                                                            <div key={i} style={{ padding: '0.75rem', borderBottom: '1px solid #eee' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                                                    <span style={{ fontWeight: 600 }}>
                                                                        {r.studentName} ({r.rollNumber || '—'})
                                                                        {r.year && (
                                                                            <span style={{ fontSize: '0.75rem', color: '#002147', fontWeight: 700, backgroundColor: '#e2e8f0', padding: '1px 7px', borderRadius: '4px', marginLeft: '8px' }}>
                                                                                Year {r.year}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: r.leaveType ? '#dc3545' : '#17a2b8' }}>
                                                                        {r.leaveType ? 'LEAVE' : 'OD'} ({days} {days === 1 ? 'day' : 'days'})
                                                                    </span>
                                                                </div>
                                                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                                                    Dates: {r.fromDate}{r.toDate && r.toDate !== r.fromDate ? ` to ${r.toDate}` : ''}
                                                                    {r.reason && <span> • Reason: {r.reason}</span>}
                                                                    {r.eventName && <span> • Event: {r.eventName}</span>}
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#888', fontStyle: 'italic' }}>
                                                        No records found for the selected date and year filter.
                                                    </div>
                                                )}
                                            </div>

                                            {/* Printable Black & White Date Document Target */}
                                            <div className="print-only">
                                                {renderBlackAndWhiteDateDocument()}
                                            </div>
                                        </>
                                    )}

                                </div>
                            )}

                            {activeTab === 'manage' && (
                                <div className="card">
                                    <h3 style={{ color: '#002147', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users size={20} /> Manage User Records
                                    </h3>

                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                        <input type="text" className="input-field" placeholder="Search by name, email, roll no..." value={manageSearch} onChange={(e) => setManageSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchManageUsers()} style={{ margin: 0, flex: 1 }} />
                                        <button className="btn btn-primary" onClick={() => fetchManageUsers()}>Search</button>
                                    </div>

                                    {loading ? (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>Loading users...</div>
                                    ) : (
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                                        {manageType === 'staff' && <th style={{ padding: '0.75rem', textAlign: 'left' }}>Staff ID</th>}
                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Contact</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Details</th>
                                                        {manageType === 'student' && <th style={{ padding: '0.75rem', textAlign: 'left' }}>Identifiers</th>}
                                                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Password</th>
                                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {manageUsersList
                                                        .filter(u => {
                                                            const currentDeoDept = (profile?.department || '').toUpperCase().replace(/\s+/g, '');
                                                            const isAimlDeo = ['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(currentDeoDept);
                                                            if (currentDeoDept) {
                                                                const uDept = (u.department || '').toUpperCase().replace(/\s+/g, '');
                                                                if (isAimlDeo) {
                                                                    if (!['AIML', 'CSE(AI&ML)', 'CSE(AIML)'].includes(uDept)) return false;
                                                                } else if (uDept !== currentDeoDept) {
                                                                    return false;
                                                                }
                                                            }
                                                            if (manageType === 'staff') {
                                                                const r = (u.role || '').toLowerCase();
                                                                if (r === 'deo' || r === 'sa') return false;
                                                                const currentDeoEmail = (profile?.email || '').toLowerCase().trim();
                                                                const currentDeoStaffId = (profile?.staff_id || profile?.staffId || profile?.login_id || '').toLowerCase().trim();
                                                                const uEmail = (u.email || u.collegeEmail || '').toLowerCase().trim();
                                                                const uStaffId = (u.staff_id || u.staffId || u.login_id || '').toLowerCase().trim();
                                                                if (currentDeoEmail && uEmail && uEmail === currentDeoEmail) return false;
                                                                if (currentDeoStaffId && uStaffId && uStaffId === currentDeoStaffId) return false;
                                                            }
                                                            return true;
                                                        })
                                                        .map((u, i) => {
                                                        let isEditing = manageEditingUser === (u.id || u._id);
                                                        return (
                                                            <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                                                                {isEditing ? (
                                                                    <>
                                                                        {manageType === 'staff' && (
                                                                            <td style={{ padding: '0.75rem' }}><input type="text" placeholder="Staff ID" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.staff_id} onChange={e => setManageEditForm({ ...manageEditForm, staff_id: e.target.value })} /></td>
                                                                        )}
                                                                        <td style={{ padding: '0.75rem' }}><input type="text" placeholder="Name" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.name} onChange={e => setManageEditForm({ ...manageEditForm, name: e.target.value })} /></td>
                                                                        <td style={{ padding: '0.75rem' }}>
                                                                            <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                                                                <input type="text" placeholder="Email" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.email} onChange={e => setManageEditForm({ ...manageEditForm, email: e.target.value })} />
                                                                                <input type="text" placeholder="Phone" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.phone} onChange={e => setManageEditForm({ ...manageEditForm, phone: e.target.value })} />
                                                                            </div>
                                                                        </td>
                                                                        <td style={{ padding: '0.75rem' }}>
                                                                            <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                                                                <input type="text" placeholder="Dept" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.department} onChange={e => setManageEditForm({ ...manageEditForm, department: e.target.value })} />
                                                                                <input type="text" placeholder="Year (for CA / Faculty)" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.year} onChange={e => setManageEditForm({ ...manageEditForm, year: e.target.value })} />
                                                                            </div>
                                                                        </td>
                                                                        {manageType === 'student' && (
                                                                            <td style={{ padding: '0.75rem' }}>
                                                                                <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                                                                    <input type="text" placeholder="Roll No" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.roll_number} onChange={e => setManageEditForm({ ...manageEditForm, roll_number: e.target.value })} />
                                                                                    <input type="text" placeholder="Reg No" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.register_number} onChange={e => setManageEditForm({ ...manageEditForm, register_number: e.target.value })} />
                                                                                </div>
                                                                            </td>
                                                                        )}
                                                                        <td style={{ padding: '0.75rem' }}><input type="password" placeholder="New Password" className="input-field" style={{ margin: 0, padding: '5px' }} value={manageEditForm.password} onChange={e => setManageEditForm({ ...manageEditForm, password: e.target.value })} /></td>
                                                                        <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                            <button onClick={() => submitUserEdit(u.id || u._id)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}><CheckCircle2 size={16} /></button>
                                                                            <button onClick={() => setManageEditingUser(null)} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                                                        </td>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        {manageType === 'staff' && (
                                                                            <td style={{ padding: '0.75rem', fontWeight: 700, color: '#002147' }}>
                                                                                {u.staff_id || u.staffId || '—'}
                                                                            </td>
                                                                        )}
                                                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{u.name || u.fullName || u.full_name}</td>
                                                                        <td style={{ padding: '0.75rem' }}>
                                                                            {u.email || u.collegeEmail}<br />
                                                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>{u.phone || u.mobileNumber || u.mobile_number || '—'}</span>
                                                                        </td>
                                                                        <td style={{ padding: '0.75rem' }}>
                                                                            {u.department} <br />
                                                                            <span style={{ fontSize: '0.8rem', color: '#666' }}>Year: {u.year || u.assigned_year || '—'}</span>
                                                                        </td>
                                                                        {manageType === 'student' && (
                                                                            <td style={{ padding: '0.75rem', color: '#666', fontSize: '0.8rem' }}>
                                                                                <strong>Roll:</strong> {u.roll_number || u.rollNumber || '—'} <br />
                                                                                <strong>Reg:</strong> {u.register_no || u.registerNumber || '—'}
                                                                            </td>
                                                                        )}
                                                                        <td style={{ padding: '0.75rem', color: '#888', fontStyle: 'italic', fontSize: '0.8rem' }}>Hidden</td>
                                                                        <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                            <button onClick={() => handleEditUser(u)} style={{ padding: '6px 10px', background: 'transparent', color: '#17a2b8', border: '1px solid #17a2b8', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }} title="Edit"><Edit2 size={14} /></button>
                                                                            <button onClick={() => handleDeleteUser(u.id || u._id)} style={{ padding: '6px 10px', background: 'transparent', color: '#dc3545', border: '1px solid #dc3545', borderRadius: '4px', cursor: 'pointer' }} title="Delete"><Trash2 size={14} /></button>
                                                                        </td>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'register' && (
                                <div>
                                    {/* Form Header */}

                                    <div className="card">
                                        <h3 style={{ color: '#002147', marginTop: 0, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <UserPlus size={20} /> Register {registerType === 'advisor' ? 'Class Advisor' : registerType === 'hod' ? 'Head of Department (HOD)' : registerType === 'faculty' ? 'Subject Staff' : 'Student'}
                                        </h3>

                                        {regError && <div style={{ padding: '0.75rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px', marginBottom: '1rem' }}>{regError}</div>}

                                        <form onSubmit={handleRegisterSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                                            {registerType !== 'student' && (
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                                                        Staff ID <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="staff_id"
                                                        className="input-field"
                                                        value={regForm.staff_id}
                                                        onChange={updateRegField}
                                                        required
                                                        style={{ marginTop: '0.2rem' }}
                                                        placeholder="e.g. STF001"
                                                    />
                                                </div>
                                            )}

                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Name <span style={{ color: 'red' }}>*</span></label>
                                                <input
                                                    type="text"
                                                    name="full_name"
                                                    className="input-field"
                                                    value={regForm.full_name}
                                                    onChange={updateRegField}
                                                    required
                                                    style={{ marginTop: '0.2rem' }}
                                                    placeholder={registerType === 'student' ? 'Student Full Name' : 'Staff Full Name'}
                                                />
                                            </div>

                                            {registerType === 'student' && (
                                                <>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Roll No</label>
                                                        <input type="text" name="roll_number" className="input-field" value={regForm.roll_number} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                                    </div>
                                                    <div className="form-group" style={{ margin: 0 }}>
                                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Register No</label>
                                                        <input type="text" name="register_number" className="input-field" value={regForm.register_number} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                                    </div>
                                                </>
                                            )}

                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>College Mail ID <span style={{ color: 'red' }}>*</span></label>
                                                <input type="email" name="email" className="input-field" value={regForm.email} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} placeholder="staff@college.edu.in" />
                                            </div>

                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Phone Number</label>
                                                <input type="text" name="mobile_number" className="input-field" value={regForm.mobile_number} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                            </div>

                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>
                                                    Department
                                                </label>
                                                <input
                                                    type="text"
                                                    name="department"
                                                    className="input-field"
                                                    value={profile?.department || regForm.department}
                                                    readOnly={Boolean(profile?.department)}
                                                    onChange={updateRegField}
                                                    style={{
                                                        marginTop: '0.2rem',
                                                        backgroundColor: profile?.department ? '#f1f5f9' : '#fff',
                                                        cursor: profile?.department ? 'not-allowed' : 'text',
                                                        fontWeight: profile?.department ? 600 : 400
                                                    }}
                                                    placeholder="e.g. CSE(AI&ML)"
                                                />
                                            </div>

                                            {(registerType === 'student' || registerType === 'advisor') && (
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                                                        Year <span style={{ color: 'red' }}>*</span>
                                                    </label>
                                                    <select
                                                        name="year"
                                                        className="input-field"
                                                        value={regForm.year}
                                                        onChange={updateRegField}
                                                        style={{ marginTop: '0.2rem' }}
                                                        required
                                                    >
                                                        <option value="">Select Year</option>
                                                        <option value="I">I Year</option>
                                                        <option value="II">II Year</option>
                                                        <option value="III">III Year</option>
                                                        <option value="IV">IV Year</option>
                                                    </select>
                                                </div>
                                            )}

                                            {registerType !== 'student' && (
                                                <div className="form-group" style={{ margin: 0 }}>
                                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>
                                                        Subjects Handled (Optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="subjects"
                                                        className="input-field"
                                                        value={regForm.subjects}
                                                        onChange={updateRegField}
                                                        style={{ marginTop: '0.2rem' }}
                                                        placeholder="e.g. Machine Learning, Deep Learning, Python"
                                                    />
                                                </div>
                                            )}

                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label" style={{ fontSize: '0.8rem' }}>Password <span style={{ color: 'red' }}>*</span></label>
                                                <input type="password" name="password" className="input-field" value={regForm.password} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                            </div>

                                            <div style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                                <button type="submit" disabled={regLoading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}>
                                                    {regLoading ? 'Registering...' : <><Save size={18} /> Register {registerType === 'advisor' ? 'Class Advisor' : registerType === 'hod' ? 'HOD' : registerType === 'faculty' ? 'Subject Staff' : 'Student'}</>}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}
                </div>

                {renderModal()}

                {/* Black & White Document Modal (Supports Student & Date Reports) */}
                {showDocumentModal && ((reportType === 'student' && resolvedStudent) || reportType === 'date') && (
                    <div className="document-modal-overlay">
                        <div
                            className="document-modal-actions hide-on-print"
                            style={{
                                width: '100%',
                                maxWidth: '820px',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.6rem',
                                marginBottom: '0.75rem',
                                background: 'transparent',
                                boxShadow: 'none',
                                border: 'none',
                                padding: 0
                            }}
                        >
                            <button
                                onClick={() => window.print()}
                                title="Download PDF / Print"
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#000000',
                                    border: '1.5px solid #000000',
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#000000'; e.currentTarget.style.color = '#ffffff'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#000000'; }}
                            >
                                <Download size={20} />
                            </button>
                            <button
                                onClick={() => setShowDocumentModal(false)}
                                title="Close"
                                style={{
                                    backgroundColor: '#ffffff',
                                    color: '#000000',
                                    border: '1.5px solid #000000',
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                    transition: 'all 0.15s ease'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#000000'; e.currentTarget.style.color = '#ffffff'; }}
                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.color = '#000000'; }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* The Black & White Document Sheet */}
                        {reportType === 'student' ? renderBlackAndWhiteDocument() : renderBlackAndWhiteDateDocument()}
                    </div>
                )}
            </div>
        </div>
    );
}
