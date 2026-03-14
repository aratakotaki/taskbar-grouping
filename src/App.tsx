import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UwpApp {
  name: string;
  packageFamilyName: string;
}

interface Group {
  id: string;
  name: string;
  apps: UwpApp[];
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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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

  // Group state
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [draggedApp, setDraggedApp] = useState<UwpApp | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [groupSaveStatus, setGroupSaveStatus] = useState<SaveStatus | null>(null);
  const [groupLoadError, setGroupLoadError] = useState<string | null>(null);
  const [groupSelectResetKey, setGroupSelectResetKey] = useState(0);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Load persisted selected apps and groups on startup
  useEffect(() => {
    async function loadData() {
      try {
        const apps: UwpApp[] = await invoke("load_selected_apps");
        setSelectedApps(apps);
      } catch (err) {
        setLoadError(`選択済みアプリの読み込みに失敗しました: ${String(err)}`);
      }
      try {
        const loadedGroups: Group[] = await invoke("load_groups");
        setGroups(loadedGroups);
      } catch (err) {
        setGroupLoadError(`グループの読み込みに失敗しました: ${String(err)}`);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (editingGroupId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingGroupId]);

  async function greet() {
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

  async function persistGroups(updatedGroups: Group[]) {
    setGroupSaveStatus(null);
    try {
      await invoke("save_groups", { groups: updatedGroups });
      setGroupSaveStatus({ kind: "success", message: "保存しました ✓" });
      setTimeout(() => setGroupSaveStatus(null), 2000);
    } catch (err) {
      setGroupSaveStatus({ kind: "error", message: `保存に失敗しました: ${String(err)}` });
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

  // --- Group management ---

  async function createGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    const newGroup: Group = { id: generateId(), name: trimmed, apps: [] };
    const updated = [...groups, newGroup];
    setGroups(updated);
    setNewGroupName("");
    await persistGroups(updated);
  }

  function startRenameGroup(group: Group) {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  }

  async function confirmRenameGroup(groupId: string) {
    const trimmed = editingGroupName.trim();
    if (!trimmed) {
      setEditingGroupId(null);
      return;
    }
    const updated = groups.map((g) =>
      g.id === groupId ? { ...g, name: trimmed } : g
    );
    setGroups(updated);
    setEditingGroupId(null);
    await persistGroups(updated);
  }

  async function deleteGroup(groupId: string) {
    const updated = groups.filter((g) => g.id !== groupId);
    setGroups(updated);
    await persistGroups(updated);
  }

  async function addAppToGroup(groupId: string, app: UwpApp) {
    const updated = groups.map((g) => {
      if (g.id !== groupId) return g;
      if (g.apps.some((a) => a.packageFamilyName === app.packageFamilyName)) return g;
      return { ...g, apps: [...g.apps, app] };
    });
    setGroups(updated);
    await persistGroups(updated);
  }

  async function removeAppFromGroup(groupId: string, packageFamilyName: string) {
    const updated = groups.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, apps: g.apps.filter((a) => a.packageFamilyName !== packageFamilyName) };
    });
    setGroups(updated);
    await persistGroups(updated);
  }

  // --- Drag and drop ---

  function onDragStartApp(app: UwpApp) {
    setDraggedApp(app);
  }

  function onDragEndApp() {
    setDraggedApp(null);
    setDragOverGroupId(null);
  }

  function onDragOverGroup(e: React.DragEvent, groupId: string) {
    e.preventDefault();
    setDragOverGroupId(groupId);
  }

  function onDragLeaveGroup() {
    setDragOverGroupId(null);
  }

  async function onDropGroup(groupId: string) {
    setDragOverGroupId(null);
    if (!draggedApp) return;
    await addAppToGroup(groupId, draggedApp);
    setDraggedApp(null);
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

      {/* Groups Section */}
      <div className="info-box">
        <h2>グループ管理</h2>
        {groupLoadError && <p style={{ color: "red" }}>{groupLoadError}</p>}
        {groupSaveStatus && (
          <p style={{ color: groupSaveStatus.kind === "success" ? "green" : "red" }}>
            {groupSaveStatus.message}
          </p>
        )}

        <div className="row" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
          <input
            placeholder="グループ名を入力..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createGroup(); }}
            style={{ width: "200px" }}
          />
          <button onClick={createGroup} disabled={!newGroupName.trim()}>
            グループ作成
          </button>
        </div>

        {groups.length === 0 ? (
          <p style={{ color: "#888" }}>グループはありません。</p>
        ) : (
          <div className="groups-container">
            {groups.map((group) => (
              <div
                key={group.id}
                className={`group-card${dragOverGroupId === group.id ? " drop-over" : ""}`}
                onDragOver={(e) => onDragOverGroup(e, group.id)}
                onDragLeave={onDragLeaveGroup}
                onDrop={() => onDropGroup(group.id)}
              >
                <div className="group-header">
                  {editingGroupId === group.id ? (
                    <input
                      ref={editInputRef}
                      className="group-name-input"
                      value={editingGroupName}
                      onChange={(e) => setEditingGroupName(e.currentTarget.value)}
                      onBlur={() => confirmRenameGroup(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRenameGroup(group.id);
                        if (e.key === "Escape") setEditingGroupId(null);
                      }}
                    />
                  ) : (
                    <span className="group-name">{group.name}</span>
                  )}
                  <div className="group-actions">
                    <button
                      className="btn-small btn-secondary"
                      onClick={() => startRenameGroup(group)}
                      title="名前を変更"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => deleteGroup(group.id)}
                      title="グループを削除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {group.apps.length === 0 ? (
                  <p className="group-empty">
                    {dragOverGroupId === group.id
                      ? "ここにドロップ ↓"
                      : "アプリをここにドラッグ＆ドロップ"}
                  </p>
                ) : (
                  <ul className="group-app-list">
                    {group.apps.map((app) => (
                      <li key={app.packageFamilyName} className="group-app-item">
                        <div>
                          <strong>{app.name}</strong>
                          <br />
                          <small>{app.packageFamilyName}</small>
                        </div>
                        <div className="group-app-actions">
                          <button
                            className="btn-small"
                            onClick={() => launchUwpApp(app.packageFamilyName)}
                          >
                            起動
                          </button>
                          <button
                            className="btn-small btn-danger"
                            onClick={() => removeAppFromGroup(group.id, app.packageFamilyName)}
                          >
                            削除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="info-box">
        <h2>選択済み UWP アプリ</h2>
        {loadError && <p style={{ color: "red" }}>{loadError}</p>}
        {saveStatus && (
          <p style={{ color: saveStatus.kind === "success" ? "green" : "red" }}>
            {saveStatus.message}
          </p>
        )}
        {groups.length > 0 && (
          <p style={{ color: "#888", fontSize: "0.9rem", margin: "0 0 0.75rem" }}>
            💡 アプリをドラッグしてグループに追加できます
          </p>
        )}
        {selectedApps.length === 0 ? (
          <p style={{ color: "#888" }}>選択済みのアプリはありません。</p>
        ) : (
          <ul style={{ textAlign: "left", marginTop: "1rem" }}>
            {selectedApps.map((app) => (
              <li
                key={app.packageFamilyName}
                draggable
                onDragStart={() => onDragStartApp(app)}
                onDragEnd={onDragEndApp}
                className="draggable-app"
              >
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
                {groups.length > 0 && (
                    <select
                      key={`sel-${app.packageFamilyName}-${groupSelectResetKey}`}
                      className="group-select"
                      defaultValue=""
                      onChange={async (e) => {
                        const groupId = e.currentTarget.value;
                        if (groupId) {
                          await addAppToGroup(groupId, app);
                          setGroupSelectResetKey((k) => k + 1);
                        }
                      }}
                    >
                      <option value="" disabled>グループに追加...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
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
                  {groups.length > 0 && (
                    <select
                      key={`uwp-${app.packageFamilyName}-${groupSelectResetKey}`}
                      className="group-select"
                      defaultValue=""
                      onChange={async (e) => {
                        const groupId = e.currentTarget.value;
                        if (groupId) {
                          await addAppToGroup(groupId, app);
                          setGroupSelectResetKey((k) => k + 1);
                        }
                      }}
                    >
                      <option value="" disabled>グループに追加...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  )}
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
