import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UwpApp {
  name: string;
  packageFamilyName: string;
}

function parseUwpApps(raw: string): UwpApp[] {
  const apps: UwpApp[] = [];
  const blocks = raw.split(/\r?\n\r?\n/).filter((b) => b.trim() !== "");
  for (const block of blocks) {
    const nameLine = block.match(/^Name\s*:\s*(.+)$/m);
    const familyLine = block.match(/^PackageFamilyName\s*:\s*(.+)$/m);
    if (nameLine && familyLine) {
      apps.push({
        name: nameLine[1].trim(),
        packageFamilyName: familyLine[1].trim(),
      });
    }
  }
  return apps;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [uwpApps, setUwpApps] = useState<UwpApp[]>([]);
  const [uwpError, setUwpError] = useState<string | null>(null);
  const [uwpLoading, setUwpLoading] = useState(false);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  async function fetchUwpApps() {
    setUwpLoading(true);
    setUwpError(null);
    try {
      const result: string = await invoke("list_uwp_apps");
      setUwpApps(parseUwpApps(result));
    } catch (err) {
      setUwpError(String(err));
    } finally {
      setUwpLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Taskbar Grouping</h1>

      <p className="subtitle">
        Tauri × React × TypeScript による<br />
        タスクバーグループ管理アプリケーション
      </p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="名前を入力..."
          value={name}
        />
        <button type="submit">バックエンドを呼び出し</button>
      </form>

      {greetMsg && (
        <p className="message">{greetMsg}</p>
      )}

      <div className="info-box">
        <h2>UWP アプリ管理</h2>
        <button onClick={fetchUwpApps} disabled={uwpLoading}>
          {uwpLoading ? "Loading..." : "Fetch UWP Apps"}
        </button>
        {uwpError && <p style={{ color: "red" }}>{uwpError}</p>}
        {uwpApps.length > 0 && (
          <ul style={{ textAlign: "left", marginTop: "1rem" }}>
            {uwpApps.map((app) => (
              <li key={app.packageFamilyName}>
                <strong>{app.name}</strong>
                <br />
                <small>{app.packageFamilyName}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

export default App;
