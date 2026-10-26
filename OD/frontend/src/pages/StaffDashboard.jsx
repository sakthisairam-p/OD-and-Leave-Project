import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    LogOut, UserCircle, ShieldCheck, RefreshCw, LayoutDashboard, Mail, Phone, Building, Award
} from 'lucide-react';

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

export default function StaffDashboard() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [isAdvisorAccount, setIsAdvisorAccount] = useState(false);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const pd = await apiFetch('/api/v1/auth/me');
                setProfile(pd);

                const userRole = String(pd.role || '').toLowerCase();
                const storedRole = String(localStorage.getItem('role') || '').toLowerCase();
                if (userRole === 'advisor' || storedRole === 'advisor') {
                    setIsAdvisorAccount(true);
                }
            } catch (e) {
                console.error('Error fetching staff profile:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
        localStorage.removeItem('contextDept');
        navigate('/login');
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                height: '100vh', backgroundColor: '#f8fafc', color: '#64748b'
            }}>
                <RefreshCw size={36} className="animate-spin" style={{ marginBottom: '1rem', color: '#002147' }} />
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>Loading Faculty & Staff Portal...</div>
            </div>
        );
    }

    return (
        <div className="app-wrapper">
            {/* ---- REGULAR FACULTY & STAFF SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>Faculty & Staff Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/staff" className="nav-item active">
                        <LayoutDashboard size={18} />
                        <span>Staff Overview</span>
                    </Link>

                    {/* Quick Link to Advisor Portal if staff has Advisor role */}
                    {isAdvisorAccount && (
                        <Link
                            to="/advisor"
                            className="nav-item"
                            style={{
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                marginTop: '0.5rem',
                                paddingTop: '0.75rem',
                                color: '#38bdf8'
                            }}
                            title="Open Class Advisor Portal"
                        >
                            <ShieldCheck size={18} />
                            <span>Class Advisor Portal</span>
                        </Link>
                    )}

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
                    <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>Staff Dashboard</span>

                    {/* Profile Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setProfileOpen(!profileOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--primary)',
                                    fontWeight: 600
                                }}
                            >
                                <UserCircle size={28} />
                                <span>{profile?.full_name || profile?.name || 'Faculty Member'}</span>
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
                                        width: '300px',
                                        background: '#fff',
                                        border: '1px solid #ddd',
                                        borderRadius: '10px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                        zIndex: 1000,
                                        padding: '1rem'
                                    }}>
                                        <h4 style={{ margin: '0 0 1rem', color: '#002147', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                                            Staff Profile
                                        </h4>
                                        <div style={{ fontSize: '0.85rem', color: '#444' }}>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Name:</strong> {profile?.full_name || profile?.name}</p>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Role:</strong> {isAdvisorAccount ? 'Class Advisor / Faculty' : 'Faculty / Staff'}</p>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Department:</strong> {profile?.department || 'N/A'}</p>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Email:</strong> {profile?.email || 'N/A'}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="btn btn-primary"
                                            style={{
                                                width: '100%',
                                                marginTop: '1rem',
                                                backgroundColor: '#ff6b6b',
                                                borderColor: '#ff6b6b',
                                                color: '#fff',
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="page-content" style={{ padding: '2rem' }}>
                    <div style={{
                        backgroundColor: '#fff',
                        borderRadius: '12px',
                        padding: '2rem',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                backgroundColor: '#e0f2fe',
                                color: '#0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.75rem',
                                fontWeight: 700
                            }}>
                                {(profile?.full_name || profile?.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 style={{ margin: 0, color: '#002147', fontSize: '1.5rem' }}>
                                    {profile?.full_name || profile?.name || 'Staff Member'}
                                </h2>
                                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                                    {isAdvisorAccount ? 'Class Advisor & Faculty' : 'Faculty / Staff Member'} - Department of {profile?.department || 'General'}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                            gap: '1.5rem',
                            marginTop: '1.5rem'
                        }}>
                            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <Mail size={16} /> Official Email
                                </div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{profile?.email || 'N/A'}</div>
                            </div>

                            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <Building size={16} /> Department
                                </div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{profile?.department || 'N/A'}</div>
                            </div>

                            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <Phone size={16} /> Contact Number
                                </div>
                                <div style={{ fontWeight: 600, color: '#0f172a' }}>{profile?.phone || profile?.mobileNumber || 'Not Provided'}</div>
                            </div>

                            <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                    <Award size={16} /> Account Status
                                </div>
                                <div style={{ fontWeight: 600, color: '#16a34a' }}>ACTIVE</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
