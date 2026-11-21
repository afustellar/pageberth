<div align="center">

<img src="public/inkwell.svg" alt="Inkwell logo" width="72" valign="middle">&nbsp;&nbsp;<font size="6">**Inkwell**</font>

**静かに書く。ノートはこの PC の中に。**

[![status](https://img.shields.io/badge/version-0.1.0--alpha-orange)](https://github.com/skpcd/inkwell/releases)
[![platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-blue)](#ダウンロード)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[中文](./README.md) · [English](./README.en.md) · **日本語**

[ダウンロード](#ダウンロード) · [機能](#機能) · [開発](#開発)

</div>

---

Inkwell は**ローカルファースト**の Markdown ライティングアプリです。フォルダを開けば、それがそのままあなたのボルト。`.md` ファイルは常にあなたのもの — データベースなし、クラウドなし、アカウントなし。静かに書いて、ノートはこの PC の中に。

<img src="assets/screenshot.png" alt="Inkwell スクリーンショット" width="900">

## 機能

| | |
|---|---|
| ✍️ **3 種類の表示** | 編集 / 分割 / プレビューをワンクリックで切替、標準は分割 |
| 🔗 **双方向リンク** | `[[リンク]]` で自動接続、クリックで開くか作成、エイリアス対応 |
| 🕸 **グラフビュー** | ノート同士のつながりを力指向グラフで可視化 |
| 📋 **アウトライン** | 見出しジャンプ、プレビュー同期スクロール |
| 🔎 **全文検索** | 全ノート横断検索、文脈スニペット付き（`Ctrl+Shift+F`） |
| ⚡ **クイックスイッチ** | 最近使用順のノート切替（`Ctrl+P`） |
| 🖼 **画像貼付** | スクリーンショットを直接ノートに貼り付け |
| 🗑 **ゴミ箱** | 削除はゴミ箱経由、復元可能 |
| 📤 **書き出し** | 単一ファイル HTML + PDF |
| 🌗 **テーマ** | ライト/ダーク（システム追従）× 5 カラー |
| 🌍 **3 言語 UI** | 中文 / English / 日本語 |
| ⌨️ **コマンドパレット** | `Ctrl+K` ですべての操作にアクセス |
| 🔄 **自動更新** | アプリ内で更新確認、プログレスバー付き |

## ダウンロード

[Releases](https://github.com/skpcd/inkwell/releases) から最新ビルドを入手：

| プラットフォーム | ファイル | 備考 |
|------------------|----------|------|
| Windows | `Inkwell-Setup-*.exe` | ガイド付きインストーラ、保存先を選択可能 |
| Linux | `*.AppImage` / `*.deb` | AppImage はインストール不要 |
| macOS | `*-arm64-mac.zip` | Apple Silicon。未署名のため右クリック → 開く |

> ビルドは未署名：Windows SmartScreen では「詳細情報 → 実行」を選択してください

## 開発

```bash
npm install        # 依存関係のインストール
npm run dev        # Web プレビュー @ http://localhost:5178
npm run typecheck  # TypeScript 型チェック
npm run electron:dev    # ビルドしてデスクトップアプリを起動
npm run electron:build  # release/ にインストーラを生成
```

スタック：Electron · Vite · TypeScript（フレームワークなし、素の DOM）· CodeMirror 6 · marked + DOMPurify

## License

MIT
