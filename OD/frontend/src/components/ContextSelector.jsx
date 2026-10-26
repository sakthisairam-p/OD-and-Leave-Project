import React, { useState } from 'react';
import { Layers, ChevronRight, BookOpen, GraduationCap } from 'lucide-react';

const DEPARTMENTS = ['AIML', 'CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'BME', 'AIDS'];
const YEARS = ['I Year', 'II Year', 'III Year', 'IV Year'];

export default function ContextSelector({ children }) {
    const [dept, setDept] = useState(localStorage.getItem('contextDept') || '');
    const [year, setYear] = useState(localStorage.getItem('contextYear') || '');
    const role = localStorage.getItem('role');

    // Auto-lock the department for HOD and ADVISOR based on their profile
    React.useEffect(() => {
        if (!dept && (role === 'HOD' || role === 'ADVISOR')) {
            try {
                const userObj = JSON.parse(localStorage.getItem('user') || '{}');
                const userDept = userObj.department || userObj.department_code;
                if (userDept) {
                    setDept(userDept);
                    localStorage.setItem('contextDept', userDept);
                }
            } catch (e) { }
        }
    }, [dept, role]);

    const handleDeptSelect = (d) => {
        setDept(d);
        localStorage.setItem('contextDept', d);
    };

    const handleYearSelect = (y) => {
        setYear(y);
        localStorage.setItem('contextYear', y);
        // Force reload to let the dashboard pick up the new context if it relies on localStorage
        window.location.reload();
    };

    const handleChangeContext = () => {
        if (role !== 'HOD' && role !== 'ADVISOR') {
            setDept('');
            localStorage.removeItem('contextDept');
        }
        setYear('');
        localStorage.removeItem('contextYear');
    };

    // If both are selected, render the children directly with an overlay button to change context
    if (dept && year) {
        return (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                {children}

                {/* A floating pill to let them change context easily */}
                <div
                    title="Change Department or Year"
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '20px',
                        padding: '10px 18px',
                        backgroundColor: '#002147',
                        color: 'white',
                        borderRadius: '30px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                        zIndex: 9999
                    }}
                    onClick={handleChangeContext}
                >
                    <Layers size={16} />
                    {dept} • {year}
                </div>
            </div>
        );
    }

    // Otherwise render the Context Selector UI
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f4f7f6',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <header style={{
                backgroundColor: '#002147',
                color: 'white',
                padding: '1.25rem 2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
                <GraduationCap size={28} />
                <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Staff Portal Context</h1>
            </header>

            <main style={{ flex: 1, padding: '3rem 2rem', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>

                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h2 style={{ color: '#002147', fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {!dept ? 'Select Department' : 'Select Academic Year'}
                    </h2>
                    <p style={{ color: '#666', fontSize: '1rem' }}>
                        {!dept
                            ? 'Please choose the department you want to manage.'
                            : `You have selected ${dept}. Now choose the year.`}
                    </p>
                </div>

                {!dept ? (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1.5rem'
                    }}>
                        {DEPARTMENTS.map(d => (
                            <div
                                key={d}
                                onClick={() => handleDeptSelect(d)}
                                style={{
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    padding: '2rem 1.5rem',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                    border: '2px solid transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '1rem'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.border = '2px solid #002147';
                                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.border = '2px solid transparent';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                                }}
                            >
                                <div style={{
                                    width: '50px', height: '50px',
                                    backgroundColor: '#eef2f5',
                                    borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#002147'
                                }}>
                                    <BookOpen size={24} />
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#333' }}>
                                    {d}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div>
                        <div style={{ marginBottom: '2rem' }}>
                            {role !== 'HOD' && role !== 'ADVISOR' && (
                                <button
                                    onClick={() => setDept('')}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#0056b3',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        display: 'inline-flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    ← Back to Departments
                                </button>
                            )}
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '1.5rem'
                        }}>
                            {YEARS.map(y => (
                                <div
                                    key={y}
                                    onClick={() => handleYearSelect(y)}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: '12px',
                                        padding: '2.5rem 1.5rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                        border: '2px solid transparent',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-5px)';
                                        e.currentTarget.style.border = '2px solid #002147';
                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.border = '2px solid transparent';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#002147' }}>
                                        {y}
                                    </div>
                                    <div style={{ marginTop: '0.5rem', color: '#888', fontSize: '0.85rem' }}>
                                        Click to enter workspace
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
