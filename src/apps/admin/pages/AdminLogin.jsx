import { useState } from "react";
import { adminLogin } from "../../../services/api";

function AdminLogin({ onLogin }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token.trim()) {
      setError("Please enter the admin token");
      return;
    }

    setLoading(true);
    try {
      await adminLogin(token.trim());
      onLogin(token.trim());
    } catch (err) {
      setError(err.message || "Invalid admin token");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card card">
        <h1>Admin Login</h1>
        <p className="login-desc">Jeizi Productions Tournament Admin</p>
        <form onSubmit={handleSubmit}>
          {error && <p className="error">{error}</p>}
          <div className="form-group">
            <label>Admin Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter admin token"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;
