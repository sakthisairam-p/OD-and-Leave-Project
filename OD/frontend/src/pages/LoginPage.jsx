import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        login_id: '',
        password: '',
        role: 'STUDENT'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const trimmedLoginId = formData.login_id.trim();
            const isSA = trimmedLoginId.toUpperCase() === 'SA' || trimmedLoginId.toLowerCase() === 'sa@kitech.edu.in';

            const payload = {
                login_id: trimmedLoginId,
                password: formData.password,
                target_role: isSA ? 'sa' : formData.role.toLowerCase()
            };

            const response = await fetch('http://127.0.0.1:8000/api/v1/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Login failed');
            }

            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role.toUpperCase());
            localStorage.setItem('user', JSON.stringify({
                full_name: data.full_name,
                login_id: data.login_id,
                department: data.department || ''
            }));
            if (data.department) {
                localStorage.setItem('contextDept', data.department);
            }

            const role = data.role.toUpperCase();

            if (role === 'STUDENT') navigate('/student');
            else if (role === 'DEO') navigate('/deo');
            else if (role === 'HOD') navigate('/hod');
            else if (role === 'ADVISOR') navigate('/advisor');
            else if (role === 'STAFF' || role === 'FACULTY' || role === 'SUBJECT_STAFF') navigate('/staff');
            else if (role === 'SA') navigate('/sa');
            else navigate('/login');

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="card auth-card">
                <div className="auth-header" style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                    <img
                        src="/logo.png"
                        alt="Kangeyam Institutions Logo"
                        style={{
                            width: '84px',
                            height: '84px',
                            objectFit: 'contain',
                            margin: '0 auto 0.75rem auto',
                            display: 'block',
                            filter: 'drop-shadow(0 4px 10px rgba(0, 33, 71, 0.15))'
                        }}
                    />
                    <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#002147', margin: '0 0 0.25rem 0' }}>
                        KI Smart Attendance+
                    </h1>
                    <p className="text-muted" style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>
                        Kangeyam Group of Institutions
                    </p>
                </div>

                {error && <div className="card text-danger" style={{ padding: '0.75rem', marginBottom: '1rem', border: '1px solid var(--danger)', backgroundColor: '#fff5f5' }}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label className="form-label">User ID</label>
                        <input
                            type="text"
                            className="input-field"
                            required
                            placeholder="e.g. 23AIML001 / staff@college.edu.in"
                            value={formData.login_id}
                            onChange={(e) => setFormData({ ...formData, login_id: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            required
                            placeholder="********"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Select User Role</label>
                        <select
                            className="input-field"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                            <option value="STUDENT">Student</option>
                            <option value="FACULTY">Faculty</option>
                            <option value="ADVISOR">Class Advisor</option>
                            <option value="HOD">HOD</option>
                            <option value="DEO">DEO</option>
                        </select>
                    </div>

                    <div className="form-group" style={{ textAlign: 'right' }}>
                        <a
                            href="#forgot-password"
                            onClick={(e) => {
                                e.preventDefault();
                                alert("Contact your administrator");
                            }}
                            style={{ fontSize: '0.875rem', color: 'var(--primary)', textDecoration: 'none', cursor: 'pointer', fontWeight: 500 }}
                        >
                            Forgot Your Password?
                        </a>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem' }} disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
