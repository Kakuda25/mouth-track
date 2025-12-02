**TODO 管理**

- **ファイル**: `todo_list.json` (ワークスペースルート)
- **目的**: エージェントと人が進捗・ログを安全に追記・更新するためのJSON形式のTODO管理

**スキーマ（重要フィールド）**
- `id`: ユニークな整数（連番）
- `title`: タイトル
- `description`: 詳細（Markdown可）
- `status`: `未着手` / `進行中` / `保留` / `完了` (値: `not-started` / `in-progress` / `blocked` / `completed`)
- `created_at`, `updated_at`: ISO8601タイムスタンプ
- `owner`: 担当者（文字列）
- `priority`: `低` / `中` / `高` (値: `low` / `medium` / `high`)
- `tags`: 配列
- `logs`: `[{timestamp, author, message}]`
- `artifacts`: 関連ファイルパスの配列

```
**運用ルール**
- 小さな判断メモも `logs` に残す（後で原因調査しやすくするため）。
- 詳細（Markdown）に記述する際は、`./description`フォルダに格納し、`id-タイトル.md` という形式で命名してください。例: `1-初期スキーマ定義.md`
