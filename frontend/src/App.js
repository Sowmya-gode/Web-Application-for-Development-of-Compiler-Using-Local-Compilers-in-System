import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";

function App() {
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState("# Write your code here");
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [fileName, setFileName] = useState("");

  const languageToExtension = {
    python: ".py",
    c: ".c",
    cpp: ".cpp",
    java: ".java",
  };

  const stripExtension = (name) =>
    name ? name.replace(/\.[^./\\]+$/, "") : "";

  const withLanguageExtension = (baseName, lang) => {
    const ext = languageToExtension[lang] || "";
    const noExt = stripExtension(baseName || "Untitled");
    return noExt + ext;
  };

  // Run Code
  const runCode = async () => {
    try {
      const res = await axios.post("http://localhost:5000/run", {
        code,
        language,
        input,
      });
      setOutput(res.data.output || res.data.error);
    } catch (err) {
      setOutput("Error: " + err.message);
    }
  };

  // ============ File API helpers ==============
  const fetchFiles = async () => {
    const res = await axios.get("http://localhost:5000/files");
    setFiles(res.data);
  };

  const createFile = async () => {
    const base = (fileName || "Untitled").trim();
    const name = withLanguageExtension(base, language);
    const res = await axios.post("http://localhost:5000/files", {
      name,
      language,
      content: code,
    });
    setActiveFileId(res.data._id);
    setFileName(stripExtension(res.data.name));
    await fetchFiles();
  };

  const openFile = async (id) => {
    const res = await axios.get(`http://localhost:5000/files/${id}`);
    setActiveFileId(res.data._id);
    setFileName(stripExtension(res.data.name));
    setLanguage(res.data.language);
    setCode(res.data.content);
  };

  const saveFile = async () => {
    if (!activeFileId) return createFile();
    const name = withLanguageExtension(fileName, language);
    const res = await axios.put(
      `http://localhost:5000/files/${activeFileId}`,
      {
        name,
        language,
        content: code,
      }
    );
    setFileName(stripExtension(res.data.name));
    await fetchFiles();
  };

  const renameFile = async () => {
    if (!activeFileId) return;
    const name = withLanguageExtension(fileName, language);
    await axios.put(`http://localhost:5000/files/${activeFileId}`, { name });
    await fetchFiles();
  };

  const deleteFile = async (id) => {
    await axios.delete(`http://localhost:5000/files/${id}`);
    if (id === activeFileId) {
      setActiveFileId(null);
      setFileName("");
      setCode("# Write your code here");
    }
    await fetchFiles();
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: "64px 1fr",
        height: "100%",
      }}
    >
      {/* Toolbar */}
      <div
        className="toolbar"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: 12,
        }}
      >
        <div className="heading" style={{ fontSize: 18 }}>
          ⚡ CodeCraft
        </div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="python">Python</option>
          <option value="c">C</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
        </select>
        <input
          className="input"
          placeholder="File name (without extension)"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          style={{ width: 260 }}
        />
        <button className="btn" onClick={createFile}>New</button>
        <button className="btn" onClick={saveFile}>Save</button>
        <button className="btn" onClick={renameFile} disabled={!activeFileId}>
          Rename
        </button>
        <button className="btn" onClick={runCode} style={{ marginLeft: "auto" }}>
          Run ▶
        </button>
      </div>

      {/* Main panels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "280px 1fr 380px",
          gap: 14,
          padding: 14,
        }}
      >
        {/* Files panel */}
        <div className="panel" style={{ padding: 12, overflow: "auto" }}>
          <div className="heading" style={{ marginBottom: 10 }}>
            Files
          </div>
          <div>
            {files.map((f) => (
              <div
                key={f._id}
                className="panel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div onClick={() => openFile(f._id)}>
                  <div style={{ fontWeight: 600 }}>
                    {stripExtension(f.name)}
                  </div>
                  <div style={{ fontSize: 12, color: "#9aa4bf" }}>
                    {f.language}
                  </div>
                </div>
                <button className="btn" onClick={() => deleteFile(f._id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Code Editor */}
        <div className="panel" style={{ overflow: "hidden" }}>
          <Editor
            height="100%"
            language={language}
            value={code}
            onChange={(value) => setCode(value ?? "")}
            theme="vs-dark"
            options={{
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontLigatures: true,
              fontSize: 14,
              minimap: { enabled: false },
              smoothScrolling: true,
              cursorSmoothCaretAnimation: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>

        {/* Input / Output Panel */}
        <div
          className="panel"
          style={{
            display: "grid",
            gridTemplateRows: "1fr 1fr",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="heading" style={{ marginBottom: 8 }}>
              Console input
            </div>
            <textarea
              className="input"
              placeholder="Type stdin here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ flex: 1, resize: "none" }}
            />
          </div>
          <div
            style={{
              borderTop: "1px solid #1b2133",
              padding: 12,
              background: "#0f1220",
            }}
          >
            <div className="heading" style={{ marginBottom: 8 }}>Output</div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{output}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
