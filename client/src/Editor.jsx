import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import MonacoEditor from "@monaco-editor/react";

const SERVER_URL = "https://synccode-server-ihdh.onrender.com";
const LANGUAGES = ["javascript","python","java","cpp","typescript","html","css","rust"];

export default function Editor({ roomId }) {
  const [code, setCode] = useState("// Loading...");
  const [language, setLanguage] = useState("javascript");
  const [users, setUsers] = useState(0);
  const socketRef = useRef(null);
  const versionRef = useRef(0);
  const isRemoteChange = useRef(false);
  const prevCodeRef = useRef("");
  const editorRef = useRef(null);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    const socket = io(SERVER_URL);
    socketRef.current = socket;
    socket.emit("join-room", roomId);

    socket.on("load-document", ({ code, language, version }) => {
      setCode(code);
      setLanguage(language);
      versionRef.current = version;
      prevCodeRef.current = code;
    });

    socket.on("operation", ({ operation, version }) => {
      console.log("operation received:", operation);
      versionRef.current = version;
      const editor = editorRef.current;
      if (!editor) { console.log("no editor ref"); return; }
      isRemoteChange.current = true;
      const currentCode = editor.getValue();
      let newCode;
      if (operation.type === "insert") {
        newCode = currentCode.slice(0, operation.position) + operation.text + currentCode.slice(operation.position);
      } else if (operation.type === "delete") {
        newCode = currentCode.slice(0, operation.position) + currentCode.slice(operation.position + operation.deletedLength);
      }
      if (newCode !== undefined) {
        const pos = editor.getPosition();
        editor.setValue(newCode);
        editor.setPosition(pos);
        prevCodeRef.current = newCode;
        setCode(newCode);
      }
    });

    socket.on("ack", ({ version }) => { versionRef.current = version; });
    socket.on("language-update", (lang) => setLanguage(lang));
    socket.on("user-count", (count) => setUsers(count));

    return () => socket.disconnect();
  }, [roomId]);

  const handleCodeChange = (newCode) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    const prevCode = prevCodeRef.current;
    prevCodeRef.current = newCode;
    let start = 0;
    while (start < prevCode.length && start < newCode.length && prevCode[start] === newCode[start]) start++;
    if (newCode.length > prevCode.length) {
      const insertedText = newCode.slice(start, start + (newCode.length - prevCode.length));
      console.log("emitting insert:", { position: start, text: insertedText });
      socketRef.current?.emit("operation", { roomId, operation: { type: "insert", position: start, text: insertedText, baseVersion: versionRef.current } });
    } else if (newCode.length < prevCode.length) {
      const deletedLength = prevCode.length - newCode.length;
      console.log("emitting delete:", { position: start, deletedLength });
      socketRef.current?.emit("operation", { roomId, operation: { type: "delete", position: start, deletedLength, baseVersion: versionRef.current } });
    }
    setCode(newCode);
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    socketRef.current?.emit("language-change", { roomId, language: lang });
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied!");
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <span style={styles.logo}>SyncCode</span>
        <span style={styles.roomId}>Room: {roomId}</span>
        <div style={styles.userBadge}><span style={styles.dot} />{users} online</div>
        <select style={styles.select} value={language} onChange={handleLanguageChange}>
          {LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
        </select>
        <button style={styles.copyBtn} onClick={copyRoomLink}>Share Link</button>
      </div>
      <MonacoEditor
        height="calc(100vh - 52px)"
        language={language}
        value={code}
        theme="vs-dark"
        onChange={handleCodeChange}
        onMount={handleEditorMount}
        options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
      />
    </div>
  );
}

const styles = {
  wrapper: { height: "100vh", background: "#0d1117", display: "flex", flexDirection: "column" },
  toolbar: { height: "52px", background: "#161b22", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", padding: "0 16px", gap: "16px" },
  logo: { color: "#58a6ff", fontWeight: 700, fontSize: "16px", fontFamily: "monospace" },
  roomId: { color: "#8b949e", fontSize: "13px", fontFamily: "monospace", flex: 1 },
  userBadge: { display: "flex", alignItems: "center", gap: "6px", background: "#21262d", border: "1px solid #30363d", borderRadius: "20px", padding: "4px 12px", fontSize: "12px", color: "#8b949e" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", background: "#3fb950", display: "inline-block" },
  select: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 10px", fontSize: "13px", cursor: "pointer" },
  copyBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
};