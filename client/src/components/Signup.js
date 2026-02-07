import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            await axios.post("http://localhost:5000/api/auth/register", form);
            alert("Signup success! Please login.");
            navigate("/");
        } catch (err) { 
            alert("Signup failed! User might already exist."); 
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={{color: '#1a73e8'}}>Create Account</h2>
                <form onSubmit={handleSignup} style={styles.form}>
                    <input type="text" placeholder="Full Name" required style={styles.input} onChange={e => setForm({...form, name: e.target.value})} />
                    <input type="email" placeholder="Email" required style={styles.input} onChange={e => setForm({...form, email: e.target.value})} />
                    <input type="password" placeholder="Password" required style={styles.input} onChange={e => setForm({...form, password: e.target.value})} />
                    <button type="submit" style={styles.btn}>Sign Up</button>
                    <p onClick={() => navigate("/")} style={{cursor:'pointer', textAlign:'center', color:'#1a73e8', fontSize:'14px'}}>Back to Login</p>
                </form>
            </div>
        </div>
    );
};

const styles = {
    page: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f9fa' },
    card: { background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px' },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    input: { padding: '12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' },
    btn: { padding: '12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }
};

export default Signup;