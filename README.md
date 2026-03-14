# Taskbar Grouping

Tauri × React × TypeScript を使用した Windows 11 対応タスクバーグループ管理アプリケーション。  
UWP アプリやウェブ URL の追加・管理を目的としています。

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite
- **バックエンド**: Tauri 2.x (Rust)

## ディレクトリ構成

```
taskbar-grouping/
├── src/                    # Reactフロントエンド
│   ├── main.tsx            # エントリポイント
│   ├── App.tsx             # メインコンポーネント（Tauriバックエンド通信）
│   └── App.css             # スタイル
├── src-tauri/              # Tauriバックエンド（Rust）
│   ├── src/
│   │   ├── main.rs         # アプリエントリポイント
│   │   └── lib.rs          # コマンド定義（greetなど）
│   ├── capabilities/
│   │   └── default.json    # Tauriパーミッション設定
│   └── tauri.conf.json     # Tauri設定
├── index.html
├── vite.config.ts
└── package.json
```

## セットアップ

### 必要なツール

- [Node.js](https://nodejs.org/) (v18以上)
- [Rust](https://www.rust-lang.org/tools/install) (rustup / cargo)
- [Tauri前提条件](https://v2.tauri.app/start/prerequisites/)（Windows: Microsoft C++ Build Tools + WebView2）

### インストール

```bash
npm install
```

## 実行方法

### 開発モード（推奨）

```bash
npm run tauri dev
```

Vite 開発サーバーが起動し、Tauri ウィンドウが表示されます。  
ファイルを編集すると自動的にホットリロードされます。

### ビルド（リリース）

```bash
npm run tauri build
```

`src-tauri/target/release/bundle/` にインストーラーが生成されます。

## 動作確認

1. アプリを起動すると Tauri ウィンドウが表示されます。
2. テキストフィールドに名前を入力します。
3. **「バックエンドを呼び出し」** ボタンをクリックします。
4. Rust バックエンドから返されたメッセージが画面に表示されます。

## 今後の拡張予定

- **UWP アプリ管理**: インストール済み UWP アプリの一覧取得・グループ管理
- **URL ショートカット管理**: ウェブ URL の追加・編集・削除
- **タスクバーグループのカスタマイズ**: グループ名・アイコン設定
- **データ永続化**: JSON または SQLite によるデータ保存・読み込み
