import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
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
        <h2>今後の機能予定</h2>
        <ul>
          <li>UWPアプリの追加・管理</li>
          <li>ウェブURLのショートカット管理</li>
          <li>タスクバーグループのカスタマイズ</li>
          <li>データの永続化（JSON / SQLite）</li>
        </ul>
      </div>
    </main>
  );
}

export default App;
