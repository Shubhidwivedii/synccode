import { useCallback, useEffect, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import Editor from "./Editor";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://synccode-server-ihdh.onrender.com";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("synccode_token"));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("synccode_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState(() => {
    const path = window.location.pathname;
    const match = path.match(/\/room\/([a-z0-9]+)/);
    return match ? match[1] : null;
  });
  const [inputId, setInputId] = useState("");

  const saveSession = (nextToken, nextUser) => {
    localStorage.setItem("synccode_token", nextToken);
    localStorage.setItem("synccode_user", JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  const fetchRooms = useCallback(async () => {
    if (!token) return;

    const authHeaders = { Authorization: `Bearer ${token}` };
    const res = await fetch(`${SERVER_URL}/api/rooms`, { headers: authHeaders });
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms || []);
    }
  }, [token]);

  useEffect(() => {
    fetchRooms().catch(() => setRooms([]));
  }, [fetchRooms]);

  const submitAuth = async (e) => {
    e.preventDefault();
    setAuthError("");

    const res = await fetch(`${SERVER_URL}/api/auth/${authMode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authForm),
    });
    const data = await res.json();

    if (!res.ok) {
      setAuthError(data.error || "Authentication failed");
      return;
    }

    saveSession(data.token, data.user);
  };

  const submitGoogleAuth = async (credential) => {
    setAuthError("");

    const res = await fetch(`${SERVER_URL}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const data = await res.json();

    if (!res.ok) {
      setAuthError(data.error || "Google sign-in failed");
      return;
    }

    saveSession(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem("synccode_token");
    localStorage.removeItem("synccode_user");
    setToken(null);
    setUser(null);
    setRoomId(null);
    setRooms([]);
    window.history.pushState({}, "", "/");
  };

  const enterRoom = (id) => {
    window.history.pushState({}, "", `/room/${id}`);
    setRoomId(id);
  };

  const openRoom = async (id, { touch = true } = {}) => {
    const nextRoomId = id.trim().toLowerCase();
    if (!nextRoomId) return;

    setRoomError("");
    const authHeaders = { Authorization: `Bearer ${token}` };

    if (touch) {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ roomId: nextRoomId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setRoomError(data.error || "Unable to open room");
        return;
      }
    }

    enterRoom(nextRoomId);
    fetchRooms().catch(() => {});
  };

  const createRoom = () => {
    const id = generateRoomId();
    openRoom(id);
  };

  const joinRoom = () => {
    if (inputId.trim()) {
      openRoom(inputId.trim());
    }
  };

  const leaveRoom = () => {
    window.history.pushState({}, "", "/");
    setRoomId(null);
    fetchRooms().catch(() => {});
  };

  const handleRoomTouched = useCallback(() => {
    fetchRooms().catch(() => {});
  }, [fetchRooms]);

  if (!token || !user) {
    return (
      <div style={styles.container}>
        <form style={styles.card} onSubmit={submitAuth}>
          <h1 style={styles.title}>SyncCode</h1>
          <p style={styles.sub}>{authMode === "login" ? "Log in to continue" : "Create an account"}</p>
          {authError && <div style={styles.error}>{authError}</div>}
          <input
            style={styles.input}
            placeholder="Username"
            value={authForm.username}
            onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
          />
          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />
          <button style={styles.btn} type="submit">
            {authMode === "login" ? "Log In" : "Sign Up"}
          </button>
          {GOOGLE_CLIENT_ID && (
            <>
              <div style={styles.divider}>or</div>
              <GoogleLogin
                onSuccess={(response) => submitGoogleAuth(response.credential)}
                onError={() => setAuthError("Google sign-in failed")}
                theme="filled_black"
                width="360"
              />
            </>
          )}
          <button
            style={{ ...styles.linkBtn }}
            type="button"
            onClick={() => {
              setAuthError("");
              setAuthMode(authMode === "login" ? "register" : "login");
            }}
          >
            {authMode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </form>
      </div>
    );
  }

  if (roomId) {
    return (
      <Editor
        key={roomId}
        roomId={roomId}
        token={token}
        user={user}
        onLeave={leaveRoom}
        onRoomTouched={handleRoomTouched}
      />
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>SyncCode</h1>
        <p style={styles.sub}>Signed in as {user.email || user.username}</p>
        <button style={styles.btn} onClick={createRoom}>
          Create New Room
        </button>
        <div style={styles.divider}>or join existing</div>
        <input
          style={styles.input}
          placeholder="Enter Room ID"
          value={inputId}
          onChange={(e) => setInputId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && joinRoom()}
        />
        <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={joinRoom}>
          Join Room
        </button>
        {roomError && <div style={styles.error}>{roomError}</div>}
        <div style={styles.history}>
          <div style={styles.historyTitle}>Past rooms</div>
          {rooms.length === 0 ? (
            <div style={styles.emptyHistory}>Rooms you create or join will appear here.</div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.roomId}
                style={styles.roomBtn}
                type="button"
                onClick={() => openRoom(room.roomId, { touch: false })}
              >
                <span>{room.roomId}</span>
                <span style={styles.roomMeta}>
                  {new Date(room.lastOpenedAt || room.updatedAt || room.createdAt).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
        <button style={styles.linkBtn} onClick={logout}>Log out</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#0d1117",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: "12px",
    padding: "48px 40px",
    width: "360px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  title: {
    color: "#58a6ff",
    margin: 0,
    fontSize: "32px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
  },
  sub: {
    color: "#8b949e",
    margin: "0 0 8px",
    fontSize: "14px",
  },
  btn: {
    background: "#238636",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "12px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    boxSizing: "border-box",
  },
  btnSecondary: {
    background: "#21262d",
    border: "1px solid #30363d",
    color: "#e6edf3",
  },
  input: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: "6px",
    padding: "10px 12px",
    color: "#e6edf3",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  error: {
    background: "#3d1f24",
    border: "1px solid #8e3038",
    borderRadius: "6px",
    color: "#ffd8d8",
    fontSize: "13px",
    padding: "8px 10px",
  },
  divider: {
    color: "#8b949e",
    fontSize: "12px",
    textAlign: "center",
  },
  linkBtn: {
    background: "transparent",
    border: "none",
    color: "#58a6ff",
    cursor: "pointer",
    fontSize: "13px",
    padding: "4px",
  },
  history: {
    borderTop: "1px solid #30363d",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingTop: "12px",
  },
  historyTitle: {
    color: "#8b949e",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  emptyHistory: {
    color: "#8b949e",
    fontSize: "12px",
  },
  roomBtn: {
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: "6px",
    color: "#e6edf3",
    cursor: "pointer",
    padding: "8px 10px",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  roomMeta: {
    color: "#8b949e",
    fontSize: "11px",
  },
};

export default App;
