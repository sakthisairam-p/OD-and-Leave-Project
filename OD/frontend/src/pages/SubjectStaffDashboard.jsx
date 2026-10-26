import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, UserCircle, RefreshCw, BookOpen } from 'lucide-react';
import SubjectPortalTab from '../components/SubjectPortalTab';

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

export default function SubjectStaffDashboard() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const pd = await apiFetch('/api/v1/auth/me');
                setProfile(pd);
            } catch (e) {
                console.error('Error fetching faculty profile:', e);
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
                <div style={{ fontSize: '1rem', fontWeight: 600 }}>Loading Faculty Portal...</div>
            </div>
        );
    }

    return (
        <div className="app-wrapper">
            {/* ---- DEDICATED FACULTY SIDEBAR ---- */}
            <aside className="sidebar">
                <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1.25rem 1rem' }}>
                    <img src="/logo.png" alt="Kangeyam Institutions" style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '50%', backgroundColor: '#fff', padding: '2px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} />
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '0.3px', textAlign: 'center' }}>Faculty Portal</span>
                </div>
                <nav className="sidebar-nav">
                    <Link to="/staff" className="nav-item active">
                        <BookOpen size={18} />
                        <span>Attendance Verification</span>
                    </Link>

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
                    <div>
                        <span style={{ fontWeight: 600, color: '#002147', fontSize: '1.1rem' }}>
                            Faculty Portal
                        </span>
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
                            Daily Attendance & Leave Verification Gateway
                        </span>
                    </div>

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
                                <span>{profile?.full_name || profile?.name || 'Faculty'}</span>
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
                                            Faculty Profile
                                        </h4>
                                        <div style={{ fontSize: '0.85rem', color: '#444' }}>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Name:</strong> {profile?.full_name || profile?.name}</p>
                                            <p style={{ margin: '0 0 0.4rem' }}><strong>Role:</strong> Faculty</p>
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

                {/* Page Content with Dedicated Faculty Attendance Inquiry Component */}
                <div className="page-content" style={{ padding: '1.5rem 2rem' }}>
                    <SubjectPortalTab profile={profile} isAdvisor={false} />
                </div>
            </div>
        </div>
    );
}
