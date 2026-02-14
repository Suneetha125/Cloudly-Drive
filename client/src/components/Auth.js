const API = "https://cloudly-dj52.onrender.com/api";

const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? "/auth/login" : "/auth/register";
    try {
        const res = await axios.post(`${API}${endpoint}`, form);
        if (isLogin) {
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("userName", res.data.userName);
            navigate("/drive");
        } else {
            alert("Account created! Please login.");
            setIsLogin(true);
        }
    } catch (err) { 
        console.error("Auth error:", err.response?.data);
        // This will show "Invalid email" or "Email exists" instead of "Unexpected error"
        alert(err.response?.data?.error || "Server Connection Failed"); 
    }
};