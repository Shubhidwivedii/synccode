import { useState } from "react";
import Editor from "./Editor";

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

function App() {
  const [roomId, setRoomId] = useState(() => {
    const path = window.location.pathname;
    const match = path.match(/\/room\/([a-z0-9]+)/);
    return match ? match[1] : null;
  });
  const [inputId, setInputId] = useState("");

  const createRoom = () => {
    const id = generateRoomId();
    window.history.pushState({}, "", `/room/${id}`);
    setRoomId(id);
  };

  const joinRoom = () => {
    if (inputId.trim()) {
      window.history.pushState({}, "", `/room/${inputId.trim()}`);
      setRoomId(inputId.trim());
    }
  };

  if (roomId) return <Editor roomId={roomId} />;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>SyncCode</h1>
        <p style={styles.sub}>Real-time collaborative code editor</p>
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
  divider: {
    color: "#8b949e",
    fontSize: "12px",
    textAlign: "center",
  },
};

export default App;