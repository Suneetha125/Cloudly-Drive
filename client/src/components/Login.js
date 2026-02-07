import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post("https://cloudly-dj52.onrender.com/api/auth/login", { email, password });
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("userName", res.data.userName);
            navigate("/drive");
        } catch (err) {
            alert("Login failed! Check your email and password.");
        }
    };

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <h2 style={{color: '#1a73e8'}}>Login to Cloud</h2>
                <form onSubmit={handleLogin} style={styles.form}>
                    <input type="email" placeholder="Email" required style={styles.input} onChange={e => setEmail(e.target.value)} />
                    <input type="password" placeholder="Password" required style={styles.input} onChange={e => setPassword(e.target.value)} />
                    <button type="submit" style={styles.btn}>Login</button>
                    <Link to="/signup" style={styles.link}>No account? Sign up</Link>
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
    btn: { padding: '12px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    link: { textAlign: 'center', marginTop: 10, color: '#1a73e8', textDecoration: 'none', fontSize: '14px' }
};

export default Login;