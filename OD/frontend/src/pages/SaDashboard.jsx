import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LogOut, UserPlus, Users, Trash2, Edit2, CheckCircle2, X,
    UserCircle, Shield, KeyRound, Lock, Mail, Phone, Building,
    ChevronDown, Check, AlertCircle, Eye, EyeOff, User
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000';

const apiFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };
    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (!res.ok) {
        let msg = 'API Error';
        try { const err = await res.json(); msg = err.detail || err.message || msg; } catch (e) { }
        throw new Error(msg);
    }
    return res.json();
};

export default function SaDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('register');
    const [loading, setLoading] = useState(false);

    // Profile & Password Reset
    const [profile, setProfile] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || {};
        } catch {
            return {};
        }
    });
    const [profileOpen, setProfileOpen] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    // Password reset form state
    const [resetPwData, setResetPwData] = useState({
        new_password: '',
        confirm_password: '',
        email: ''
    });
    const [showPw, setShowPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);
    const [resetError, setResetError] = useState('');
    const [resetSuccess, setResetSuccess] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    // Register
    const [regForm, setRegForm] = useState({ full_name: '', email: '', mobile_number: '', department: 'ADMIN', password: '' });
    const [regError, setRegError] = useState('');
    const [regLoading, setRegLoading] = useState(false);

    // Manage
    const [deoList, setDeoList] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({});

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const pd = await apiFetch('/api/v1/auth/me');
                if (pd) {
                    setProfile(prev => ({ ...prev, ...pd }));
                    setResetPwData(prev => ({
                        ...prev,
                        email: pd.email || 'sa@kitech.edu.in'
                    }));
                }
            } catch (err) {
                console.error("Error fetching SA profile:", err);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        if (activeTab === 'manage') {
            fetchDEOs();
        }
    }, [activeTab]);

    const fetchDEOs = async () => {
        try {
            setLoading(true);
            const res = await apiFetch(`/api/v1/users/staff?role=deo&limit=50`);
            setDeoList(res.staff || []);
        } catch (e) {
            console.error(e);
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
        setRegLoading(true);
        try {
            const body = {
                role: 'DEO',
                full_name: regForm.full_name,
                email: regForm.email,
                password: regForm.password,
                phone: regForm.mobile_number,
                department: regForm.department,
                date_of_birth: '01/01/1990'
            };
            await apiFetch('/api/v1/users/institutional', { method: 'POST', body: JSON.stringify(body) });
            alert("DEO Registered Successfully!");
            setRegForm({ full_name: '', email: '', mobile_number: '', department: 'ADMIN', password: '' });
            setActiveTab('manage');
        } catch (error) {
            setRegError(error.message);
        } finally {
            setRegLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to permanently delete this DEO?")) return;
        try {
            await apiFetch(`/api/v1/users/staff/${userId}`, { method: 'DELETE' });
            alert('DEO deleted successfully.');
            fetchDEOs();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleEditUser = (u) => {
        setEditingUser(u.id || u._id);
        setEditForm({
            name: u.name || u.fullName || u.full_name || '',
            email: u.email || u.collegeEmail || '',
            department: u.department || '',
            phone: u.phone || u.mobileNumber || u.mobile_number || '',
            password: ''
        });
    };

    const submitUserEdit = async (userId) => {
        try {
            await apiFetch(`/api/v1/users/staff/${userId}`, {
                method: 'PUT',
                body: JSON.stringify(editForm)
            });
            alert('DEO updated successfully.');
            setEditingUser(null);
            fetchDEOs();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleResetSaPassword = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSuccess('');

        if (!resetPwData.new_password || resetPwData.new_password.length < 4) {
            setResetError('Password must be at least 4 characters long.');
            return;
        }

        if (resetPwData.new_password !== resetPwData.confirm_password) {
            setResetError('Passwords do not match.');
            return;
        }

        setResetLoading(true);
        try {
            const body = {
                login_id: 'SA',
                email: resetPwData.email || profile?.email || 'sa@kitech.edu.in',
                new_password: resetPwData.new_password
            };
            const res = await apiFetch('/api/v1/auth/sa/reset-password', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            setResetSuccess(res.message || 'Super Admin password updated successfully!');
            setResetPwData(prev => ({ ...prev, new_password: '', confirm_password: '' }));
            setTimeout(() => {
                setShowForgotModal(false);
                setResetSuccess('');
            }, 2200);
        } catch (err) {
            setResetError(err.message || 'Failed to reset password');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="app-wrapper">
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center', color: '#ff8787' }}>SUPER ADMIN</span>
                </div>
                <nav className="sidebar-nav">
                    <button onClick={() => setActiveTab('register')} className={`nav-item ${activeTab === 'register' ? 'active' : ''}`}>
                        <UserPlus size={18} /> Register DEO
                    </button>
                    <button onClick={() => setActiveTab('manage')} className={`nav-item ${activeTab === 'manage' ? 'active' : ''}`}>
                        <Users size={18} /> Manage DEOs
                    </button>
                    <div style={{ flex: 1 }} />
                    <button className="nav-item" onClick={handleLogout} style={{ color: '#ff6b6b' }}>
                        <LogOut size={18} /> Logout
                    </button>
                </nav>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <div>
                        <h1 className="header-title" style={{ fontSize: '1.25rem', margin: 0, color: '#002147' }}>Super Admin Portal</h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Central Control Panel</p>
                    </div>

                    {/* Right Corner: Profile Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <div
                            onClick={() => setProfileOpen(!profileOpen)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                cursor: 'pointer',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: '#ffffff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease',
                                userSelect: 'none'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                        >
                            <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                boxShadow: '0 2px 4px rgba(220,38,38,0.25)'
                            }}>
                                SA
                            </div>
                            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                                <div style={{
                                    fontWeight: 600,
                                    fontSize: '0.875rem',
                                    color: '#0f172a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}>
                                    {profile?.full_name || profile?.name || 'System Administrator'}
                                </div>
                                <div style={{ fontSize: '0.725rem', color: '#dc2626', fontWeight: 600, letterSpacing: '0.02em' }}>
                                    SUPER ADMIN
                                </div>
                            </div>
                            <ChevronDown size={16} style={{ color: '#64748b', transition: 'transform 0.2s', transform: profileOpen ? 'rotate(180deg)' : 'none' }} />
                        </div>

                        {profileOpen && (
                            <>
                                <div
                                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                                    onClick={() => setProfileOpen(false)}
                                />
                                <div style={{
                                    position: 'absolute',
                                    top: '48px',
                                    right: 0,
                                    width: '320px',
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15)',
                                    zIndex: 1000,
                                    overflow: 'hidden'
                                }}>
                                    {/* Profile Header */}
                                    <div style={{
                                        padding: '1.25rem',
                                        background: 'linear-gradient(135deg, #002147 0%, #003366 100%)',
                                        color: '#ffffff'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                                                color: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 700,
                                                fontSize: '1.1rem',
                                                border: '2px solid rgba(255,255,255,0.2)',
                                                boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                                            }}>
                                                SA
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.975rem', color: '#ffffff' }}>
                                                    {profile?.full_name || profile?.name || 'System Administrator (SA)'}
                                                </div>
                                                <div style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.25)',
                                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '999px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    color: '#fca5a5',
                                                    marginTop: '0.25rem'
                                                }}>
                                                    <Shield size={12} /> Super Admin
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Profile Details List */}
                                    <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem', color: '#334155' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ color: '#64748b', width: '18px', display: 'flex', justifyContent: 'center' }}>
                                                <Shield size={15} />
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Login ID</span>
                                                <strong style={{ color: '#0f172a' }}>{profile?.login_id || 'SA'}</strong>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ color: '#64748b', width: '18px', display: 'flex', justifyContent: 'center' }}>
                                                <Mail size={15} />
                                            </div>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Email Address</span>
                                                <span style={{ color: '#0f172a', fontWeight: 500 }}>{profile?.email || 'sa@kitech.edu.in'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ color: '#64748b', width: '18px', display: 'flex', justifyContent: 'center' }}>
                                                <Phone size={15} />
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Mobile Number</span>
                                                <span style={{ color: '#0f172a', fontWeight: 500 }}>{profile?.phone || profile?.mobileNumber || '9876543210'}</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                            <div style={{ color: '#64748b', width: '18px', display: 'flex', justifyContent: 'center' }}>
                                                <Building size={15} />
                                            </div>
                                            <div>
                                                <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Department / Scope</span>
                                                <span style={{ color: '#0f172a', fontWeight: 500 }}>
                                                    {profile?.department === 'ALL' ? 'Central Administration (All Depts)' : (profile?.department || 'Central Admin')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{
                                        padding: '0.75rem 1rem',
                                        backgroundColor: '#f8fafc',
                                        borderTop: '1px solid #e2e8f0',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.5rem'
                                    }}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForgotModal(true);
                                                setProfileOpen(false);
                                            }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                width: '100%',
                                                padding: '0.6rem 0.85rem',
                                                borderRadius: '6px',
                                                backgroundColor: '#ffffff',
                                                border: '1px solid #cbd5e1',
                                                color: '#002147',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#002147'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                        >
                                            <KeyRound size={16} style={{ color: '#dc2626' }} />
                                            Forgot / Reset Password (SA)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                width: '100%',
                                                padding: '0.6rem 0.85rem',
                                                borderRadius: '6px',
                                                backgroundColor: '#fee2e2',
                                                border: '1px solid #fca5a5',
                                                color: '#b91c1c',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                        >
                                            <LogOut size={16} />
                                            Logout
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </header>

                <div className="page-content">
                    {activeTab === 'manage' && (
                        <div className="card">
                            <h3 style={{ color: '#002147', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Users size={20} /> Registered Data Entry Operators
                            </h3>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading DEOs...</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Name</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Contact Info</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Department</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Change Password</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {deoList.length === 0 ? (
                                                <tr>
                                                    <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: '#666' }}>No DEOs registered yet.</td>
                                                </tr>
                                            ) : deoList.map((u, i) => {
                                                let isEditing = editingUser === (u.id || u._id);
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid #dee2e6' }}>
                                                        {isEditing ? (
                                                            <>
                                                                <td style={{ padding: '0.75rem' }}><input type="text" placeholder="Name" className="input-field" style={{ margin: 0, padding: '5px' }} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                                                                <td style={{ padding: '0.75rem' }}>
                                                                    <div style={{ display: 'flex', gap: '4px', flexDirection: 'column' }}>
                                                                        <input type="text" placeholder="Email" className="input-field" style={{ margin: 0, padding: '5px' }} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} />
                                                                        <input type="text" placeholder="Phone" className="input-field" style={{ margin: 0, padding: '5px' }} value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} />
                                                                    </div>
                                                                </td>
                                                                <td style={{ padding: '0.75rem' }}>
                                                                    <input type="text" placeholder="Dept" className="input-field" style={{ margin: 0, padding: '5px' }} value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} />
                                                                </td>
                                                                <td style={{ padding: '0.75rem' }}><input type="password" placeholder="New Password" className="input-field" style={{ margin: 0, padding: '5px' }} value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></td>
                                                                <td style={{ padding: '0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                                    <button onClick={() => submitUserEdit(u.id || u._id)} style={{ padding: '6px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}><CheckCircle2 size={16} /></button>
                                                                    <button onClick={() => setEditingUser(null)} style={{ padding: '6px 12px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}><X size={16} /></button>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{u.name || u.fullName || u.full_name}</td>
                                                                <td style={{ padding: '0.75rem' }}>
                                                                    {u.email || u.collegeEmail}<br />
                                                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>{u.phone || u.mobileNumber || '—'}</span>
                                                                </td>
                                                                <td style={{ padding: '0.75rem' }}>{u.department}</td>
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
                        <div className="card">
                            <h3 style={{ color: '#002147', marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <UserPlus size={20} /> Register Data Entry Operator
                            </h3>

                            {regError && <div style={{ padding: '0.75rem', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '6px', marginBottom: '1rem' }}>{regError}</div>}

                            <form onSubmit={handleRegisterSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Name</label>
                                    <input type="text" name="full_name" className="input-field" value={regForm.full_name} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Email (Login ID)</label>
                                    <input type="email" name="email" className="input-field" value={regForm.email} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Phone Number</label>
                                    <input type="text" name="mobile_number" className="input-field" value={regForm.mobile_number} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Department</label>
                                    <select name="department" className="input-field" value={regForm.department} onChange={updateRegField} required style={{ marginTop: '0.2rem' }}>
                                        <option value="">Select Department</option>
                                        <option value="CSE">CSE</option>
                                        <option value="CSE(AI&ML)">CSE(AI&ML)</option>
                                        <option value="CSE(CS)">CSE(CS)</option>
                                        <option value="AI&DS">AI&DS</option>
                                        <option value="IT">IT</option>
                                        <option value="ECE">ECE</option>
                                        <option value="EEE">EEE</option>
                                        <option value="MECH">MECH</option>
                                        <option value="CIVIL">CIVIL</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Password</label>
                                    <input type="password" name="password" className="input-field" value={regForm.password} onChange={updateRegField} required style={{ marginTop: '0.2rem' }} />
                                </div>
                                <div style={{ gridColumn: '1 / -1', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button type="submit" disabled={regLoading} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 2rem' }}>
                                        {regLoading ? 'Registering...' : <><UserPlus size={18} /> Register DEO</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal for Super Admin Forgot / Reset Password */}
            {showForgotModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    padding: '1rem'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '440px',
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            backgroundColor: '#002147',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '8px',
                                    backgroundColor: '#dc2626',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <KeyRound size={18} color="#fff" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>Reset SA Password</h3>
                                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Super Administrator Credential Update</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForgotModal(false);
                                    setResetError('');
                                    setResetSuccess('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '4px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleResetSaPassword} style={{ padding: '1.5rem' }}>
                            {resetError && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    backgroundColor: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    borderRadius: '6px',
                                    color: '#b91c1c',
                                    fontSize: '0.85rem',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <AlertCircle size={16} />
                                    <span>{resetError}</span>
                                </div>
                            )}

                            {resetSuccess && (
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '6px',
                                    color: '#15803d',
                                    fontSize: '0.85rem',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}>
                                    <CheckCircle2 size={16} />
                                    <span>{resetSuccess}</span>
                                </div>
                            )}

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                                    Super Admin Account
                                </label>
                                <input
                                    type="text"
                                    readOnly
                                    value={`SA (${profile?.email || 'sa@kitech.edu.in'})`}
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 0.75rem',
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        fontSize: '0.875rem',
                                        color: '#475569',
                                        cursor: 'not-allowed',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                                    New Password <span style={{ color: '#dc2626' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        required
                                        placeholder="Enter new password (min 4 chars)"
                                        value={resetPwData.new_password}
                                        onChange={e => setResetPwData({ ...resetPwData, new_password: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem 2.5rem 0.6rem 0.75rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem',
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#64748b'
                                        }}
                                    >
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                                    Confirm New Password <span style={{ color: '#dc2626' }}>*</span>
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPw ? 'text' : 'password'}
                                        required
                                        placeholder="Re-enter new password"
                                        value={resetPwData.confirm_password}
                                        onChange={e => setResetPwData({ ...resetPwData, confirm_password: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem 2.5rem 0.6rem 0.75rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '0.875rem',
                                            color: '#0f172a',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: '#64748b'
                                        }}
                                    >
                                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForgotModal(false);
                                        setResetError('');
                                        setResetSuccess('');
                                    }}
                                    style={{
                                        padding: '0.6rem 1.25rem',
                                        borderRadius: '6px',
                                        backgroundColor: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        color: '#475569',
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    style={{
                                        padding: '0.6rem 1.5rem',
                                        borderRadius: '6px',
                                        backgroundColor: '#dc2626',
                                        border: 'none',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        fontSize: '0.875rem',
                                        cursor: resetLoading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 2px 6px rgba(220,38,38,0.3)'
                                    }}
                                >
                                    {resetLoading ? 'Updating...' : <><Check size={16} /> Save New Password</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
