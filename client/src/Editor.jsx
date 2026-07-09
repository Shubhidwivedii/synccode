import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import MonacoEditor from "@monaco-editor/react";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "https://synccode-server-ihdh.onrender.com";
const LANGUAGES = ["javascript", "python", "java", "cpp", "typescript", "html", "css", "rust"];

export default function Editor({ roomId, token, user, onLeave, onRoomTouched }) {
  const [code, setCode] = useState("// Loading...");
  const [language, setLanguage] = useState("javascript");
  const [users, setUsers] = useState(0);
  const [error, setError] = useState("");
  const [tree, setTree] = useState({ folders: [], files: [] });
  const [activeFileId, setActiveFileId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [createMode, setCreateMode] = useState(null);
  const [draftName, setDraftName] = useState("");
  const [saveState, setSaveState] = useState("Saved");
  const socketRef = useRef(null);
  const versionRef = useRef(0);
  const isRemoteChange = useRef(false);
  const prevCodeRef = useRef("");
  const editorRef = useRef(null);

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${token}`,
  }), [token]);

  const activeFile = tree.files.find((file) => file._id === activeFileId);
  const selectedFolder = tree.folders.find((folder) => folder._id === selectedFolderId);

  const fetchTree = useCallback(async () => {
    const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/tree`, { headers: authHeaders });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Unable to load files");
      return;
    }

    setTree({ folders: data.folders || [], files: data.files || [] });
    setActiveFileId((current) => current || data.activeFileId);
  }, [authHeaders, roomId]);

  useEffect(() => {
    fetchTree().catch(() => setError("Unable to load files"));
  }, [fetchTree]);

  useEffect(() => {
    const socket = io(SERVER_URL, { auth: { token } });
    socketRef.current = socket;
    socket.emit("join-room", roomId);

    socket.on("load-document", ({ fileId, code, language, version }) => {
      setError("");
      if (fileId) setActiveFileId(fileId);
      setCode(code);
      setLanguage(language);
      versionRef.current = version;
      prevCodeRef.current = code;
      setSaveState("Saved");
      onRoomTouched?.();
    });

    socket.on("room-tree", (nextTree) => {
      setTree({ folders: nextTree.folders || [], files: nextTree.files || [] });
      setActiveFileId((current) => current || nextTree.activeFileId);
    });

    socket.on("operation", ({ operation, version }) => {
      versionRef.current = version;
      const editor = editorRef.current;
      if (!editor) return;
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

    socket.on("ack", ({ version }) => {
      versionRef.current = version;
      setSaveState("Saved");
    });
    socket.on("language-update", (lang) => setLanguage(lang));
    socket.on("user-count", (count) => setUsers(count));
    socket.on("room-error", (message) => setError(message));
    socket.on("connect_error", (err) => setError(err.message || "Unable to connect"));

    return () => socket.disconnect();
  }, [roomId, token, onRoomTouched]);

  useEffect(() => {
    if (!activeFileId || !socketRef.current) return;
    setCode("// Loading...");
    prevCodeRef.current = "";
    versionRef.current = 0;
    socketRef.current.emit("join-file", { roomId, fileId: activeFileId });
  }, [activeFileId, roomId]);

  const createFolder = async () => {
    const name = draftName.trim();
    if (!name) return;

    const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/folders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Unable to create folder");
      return;
    }

    setSelectedFolderId(data.folder._id);
    setDraftName("");
    setCreateMode(null);
    await fetchTree();
  };

  const createFile = async () => {
    const name = draftName.trim();
    if (!name) return;

    const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ name, folder: selectedFolderId, language }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Unable to create file");
      return;
    }

    await fetchTree();
    setDraftName("");
    setCreateMode(null);
    setActiveFileId(data.file._id);
  };

  const startCreate = (mode) => {
    setError("");
    setCreateMode(mode);
    setDraftName(mode === "file" ? "index.js" : "");
  };

  const submitCreate = () => {
    if (createMode === "folder") createFolder();
    if (createMode === "file") createFile();
  };

  const saveFile = async () => {
    if (!activeFileId) return;

    setSaveState("Saving...");
    const res = await fetch(`${SERVER_URL}/api/rooms/${roomId}/files/${activeFileId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ code, language }),
    });
    const data = await res.json();

    if (!res.ok) {
      setSaveState("Save failed");
      setError(data.error || "Unable to save file");
      return;
    }

    setSaveState("Saved");
    setError("");
    await fetchTree();
  };

  const handleCodeChange = (newCode = "") => {
    if (isRemoteChange.current) { isRemoteChange.current = false; return; }
    const prevCode = prevCodeRef.current;
    prevCodeRef.current = newCode;
    let start = 0;
    while (start < prevCode.length && start < newCode.length && prevCode[start] === newCode[start]) start++;
    if (newCode.length > prevCode.length) {
      const insertedText = newCode.slice(start, start + (newCode.length - prevCode.length));
      socketRef.current?.emit("operation", {
        roomId,
        fileId: activeFileId,
        operation: { type: "insert", position: start, text: insertedText, baseVersion: versionRef.current },
      });
    } else if (newCode.length < prevCode.length) {
      const deletedLength = prevCode.length - newCode.length;
      socketRef.current?.emit("operation", {
        roomId,
        fileId: activeFileId,
        operation: { type: "delete", position: start, deletedLength, baseVersion: versionRef.current },
      });
    }
    setCode(newCode);
    setSaveState("Saving...");
  };

  const handleLanguageChange = (e) => {
    const lang = e.target.value;
    setLanguage(lang);
    socketRef.current?.emit("language-change", { roomId, fileId: activeFileId, language: lang });
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Room link copied!");
  };

  const rootFiles = tree.files.filter((file) => !file.folder);

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <span style={styles.logo}>SyncCode</span>
        <span style={styles.roomId}>Room: {roomId}</span>
        {error && <span style={styles.error}>{error}</span>}
        <span style={styles.user}>{user?.email || user?.username}</span>
        <div style={styles.userBadge}><span style={styles.dot} />{users} online</div>
        <select style={styles.select} value={language} onChange={handleLanguageChange}>
          {LANGUAGES.map((lang) => <option key={lang} value={lang}>{lang}</option>)}
        </select>
        <button style={styles.saveBtn} onClick={saveFile}>Save</button>
        <span style={styles.saveState}>{saveState}</span>
        <button style={styles.copyBtn} onClick={copyRoomLink}>Share Link</button>
        <button style={styles.leaveBtn} onClick={onLeave}>Rooms</button>
      </div>
      <div style={styles.main}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <span>Files</span>
            <span style={styles.sidebarCount}>{tree.files.length}</span>
          </div>
          <div style={styles.actionRow}>
            <button style={styles.actionBtn} onClick={() => startCreate("folder")}>New folder</button>
            <button style={styles.actionBtnPrimary} onClick={() => startCreate("file")}>New file</button>
          </div>
          {createMode && (
            <div style={styles.createPanel}>
              <div style={styles.createLabel}>
                {createMode === "folder" ? "Create folder" : `Create file ${selectedFolder ? `in ${selectedFolder.name}` : "in root"}`}
              </div>
              <input
                autoFocus
                style={styles.sideInput}
                placeholder={createMode === "folder" ? "folder-name" : "file.js"}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitCreate()}
              />
              <div style={styles.createActions}>
                <button style={styles.smallBtnPrimary} onClick={submitCreate}>Create</button>
                <button
                  style={styles.smallBtn}
                  onClick={() => {
                    setCreateMode(null);
                    setDraftName("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <button
            style={{ ...styles.folderBtn, ...(selectedFolderId === null ? styles.selectedFolder : {}) }}
            onClick={() => setSelectedFolderId(null)}
          >
            / root
          </button>
          {rootFiles.map((file) => (
            <button
              key={file._id}
              style={{ ...styles.fileBtn, ...(file._id === activeFileId ? styles.activeFile : {}) }}
              onClick={() => setActiveFileId(file._id)}
            >
              {file.name}
            </button>
          ))}
          {tree.folders.map((folder) => {
            const files = tree.files.filter((file) => file.folder === folder._id);
            return (
              <div key={folder._id}>
                <button
                  style={{ ...styles.folderBtn, ...(selectedFolderId === folder._id ? styles.selectedFolder : {}) }}
                  onClick={() => setSelectedFolderId(folder._id)}
                >
                  {folder.name}
                </button>
                {files.map((file) => (
                  <button
                    key={file._id}
                    style={{ ...styles.fileBtn, ...styles.nestedFile, ...(file._id === activeFileId ? styles.activeFile : {}) }}
                    onClick={() => setActiveFileId(file._id)}
                  >
                    {file.name}
                  </button>
                ))}
              </div>
            );
          })}
        </aside>
        <section style={styles.editorPane}>
          <div style={styles.fileBar}>
            <span>{activeFile?.name || "No file selected"}</span>
            {selectedFolder && <span style={styles.folderHint}>New files go into {selectedFolder.name}</span>}
          </div>
          <MonacoEditor
            height="calc(100vh - 84px)"
            language={language}
            value={code}
            theme="vs-dark"
            onChange={handleCodeChange}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{ fontSize: 14, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true }}
          />
        </section>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { height: "100vh", background: "#0d1117", display: "flex", flexDirection: "column" },
  toolbar: { height: "52px", background: "#161b22", borderBottom: "1px solid #30363d", display: "flex", alignItems: "center", padding: "0 16px", gap: "16px" },
  logo: { color: "#58a6ff", fontWeight: 700, fontSize: "16px", fontFamily: "monospace" },
  roomId: { color: "#8b949e", fontSize: "13px", fontFamily: "monospace", flex: 1 },
  user: { color: "#8b949e", fontSize: "12px" },
  error: { color: "#ffb4b4", fontSize: "12px" },
  userBadge: { display: "flex", alignItems: "center", gap: "6px", background: "#21262d", border: "1px solid #30363d", borderRadius: "20px", padding: "4px 12px", fontSize: "12px", color: "#8b949e" },
  dot: { width: "8px", height: "8px", borderRadius: "50%", background: "#3fb950", display: "inline-block" },
  select: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 10px", fontSize: "13px", cursor: "pointer" },
  saveBtn: { background: "#1f6feb", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  saveState: { color: "#8b949e", fontSize: "12px", minWidth: "56px" },
  copyBtn: { background: "#238636", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  leaveBtn: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  main: { flex: 1, display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", minHeight: 0 },
  sidebar: { background: "#0d1117", borderRight: "1px solid #30363d", padding: "12px", overflow: "auto" },
  sidebarHeader: { color: "#e6edf3", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "13px", fontWeight: 700, marginBottom: "10px" },
  sidebarCount: { color: "#8b949e", background: "#21262d", borderRadius: "999px", padding: "2px 8px", fontSize: "11px" },
  actionRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" },
  actionBtn: { background: "#161b22", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", padding: "8px", fontSize: "12px", cursor: "pointer" },
  actionBtnPrimary: { background: "#1f6feb", color: "#ffffff", border: "1px solid #388bfd", borderRadius: "6px", padding: "8px", fontSize: "12px", cursor: "pointer", fontWeight: 700 },
  createPanel: { background: "#161b22", border: "1px solid #30363d", borderRadius: "8px", padding: "10px", display: "grid", gap: "8px", marginBottom: "12px" },
  createLabel: { color: "#8b949e", fontSize: "12px" },
  sideInput: { background: "#161b22", border: "1px solid #30363d", borderRadius: "6px", color: "#e6edf3", padding: "8px", fontSize: "12px", outline: "none" },
  createActions: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" },
  smallBtn: { background: "#21262d", color: "#e6edf3", border: "1px solid #30363d", borderRadius: "6px", padding: "7px 8px", fontSize: "12px", cursor: "pointer" },
  smallBtnPrimary: { background: "#238636", color: "#ffffff", border: "1px solid #2ea043", borderRadius: "6px", padding: "7px 8px", fontSize: "12px", cursor: "pointer", fontWeight: 700 },
  folderBtn: { width: "100%", background: "transparent", color: "#8b949e", border: "none", borderRadius: "6px", padding: "7px 8px", textAlign: "left", cursor: "pointer", fontWeight: 700 },
  selectedFolder: { background: "#1f6feb26", color: "#58a6ff" },
  fileBtn: { width: "100%", background: "transparent", color: "#c9d1d9", border: "none", borderRadius: "6px", padding: "7px 8px", textAlign: "left", cursor: "pointer" },
  nestedFile: { paddingLeft: "22px" },
  activeFile: { background: "#23863633", color: "#ffffff" },
  editorPane: { minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" },
  fileBar: { height: "32px", background: "#161b22", borderBottom: "1px solid #30363d", color: "#e6edf3", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", fontSize: "13px" },
  folderHint: { color: "#8b949e", fontSize: "12px" },
};
