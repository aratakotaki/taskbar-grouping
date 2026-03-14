import { useState, useEffect } from "react";
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

type SaveStatusKind = "success" | "error";

interface SaveStatus {
  kind: SaveStatusKind;
  message: string;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [uwpApps, setUwpApps] = useState<UwpApp[]>([]);
  const [uwpError, setUwpError] = useState<string | null>(null);
  const [uwpLoading, setUwpLoading] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<UwpApp[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load persisted selected apps on startup
  useEffect(() => {
    async function loadApps() {
      try {
        const apps: UwpApp[] = await invoke("load_selected_apps");
        setSelectedApps(apps);
      } catch (err) {
        setLoadError(`選択済みアプリの読み込みに失敗しました: ${String(err)}`);
      }
    }
    loadApps();
  }, []);

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

  async function launchUwpApp(packageFamilyName: string) {
    setLaunchError(null);
    try {
      await invoke("launch_uwp_app", { appId: `${packageFamilyName}!App` });
    } catch (err) {
      setLaunchError(String(err));
    }
  }

  async function persistApps(apps: UwpApp[]) {
    setSaveStatus(null);
    try {
      await invoke("save_selected_apps", { apps });
      setSaveStatus({ kind: "success", message: "保存しました ✓" });
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus({ kind: "error", message: `保存に失敗しました: ${String(err)}` });
    }
  }

  async function selectApp(app: UwpApp) {
    if (selectedApps.some((a) => a.packageFamilyName === app.packageFamilyName)) {
      return;
    }
    const newSelected = [...selectedApps, app];
    setSelectedApps(newSelected);
    await persistApps(newSelected);
  }

  async function removeApp(packageFamilyName: string) {
    const newSelected = selectedApps.filter(
      (a) => a.packageFamilyName !== packageFamilyName
    );
    setSelectedApps(newSelected);
    await persistApps(newSelected);
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
        <h2>選択済み UWP アプリ</h2>
        {loadError && <p style={{ color: "red" }}>{loadError}</p>}
        {saveStatus && (
          <p style={{ color: saveStatus.kind === "success" ? "green" : "red" }}>
            {saveStatus.message}
          </p>
        )}
        {selectedApps.length === 0 ? (
          <p style={{ color: "#888" }}>選択済みのアプリはありません。</p>
        ) : (
          <ul style={{ textAlign: "left", marginTop: "1rem" }}>
            {selectedApps.map((app) => (
              <li key={app.packageFamilyName}>
                <strong>{app.name}</strong>
                <br />
                <small>{app.packageFamilyName}</small>
                <br />
                <button onClick={() => launchUwpApp(app.packageFamilyName)}>
                  Launch
                </button>
                <button
                  onClick={() => removeApp(app.packageFamilyName)}
                  style={{ marginLeft: "0.5rem" }}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="info-box">
        <h2>UWP アプリ管理</h2>
        <button onClick={fetchUwpApps} disabled={uwpLoading}>
          {uwpLoading ? "Loading..." : "Fetch UWP Apps"}
        </button>
        {uwpError && <p style={{ color: "red" }}>{uwpError}</p>}
        {launchError && <p style={{ color: "red" }}>{launchError}</p>}
        {uwpApps.length > 0 && (
          <ul style={{ textAlign: "left", marginTop: "1rem" }}>
            {uwpApps.map((app) => {
              const isSelected = selectedApps.some(
                (a) => a.packageFamilyName === app.packageFamilyName
              );
              return (
                <li key={app.packageFamilyName}>
                  <strong>{app.name}</strong>
                  <br />
                  <small>{app.packageFamilyName}</small>
                  <br />
                  <button onClick={() => launchUwpApp(app.packageFamilyName)}>
                    Launch
                  </button>
                  <button
                    onClick={() => selectApp(app)}
                    disabled={isSelected}
                    style={{ marginLeft: "0.5rem" }}
                  >
                    {isSelected ? "選択済み" : "選択"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}

export default App;
