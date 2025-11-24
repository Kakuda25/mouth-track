# 口の動きトラッキングモジュール

リアルタイムで口の動きを追跡するJavaScriptモジュールです。MediaPipe FaceMeshを使用して、口周辺のランドマークを高精度にトラッキングします。

## モジュールとして使用

```javascript
import { MouthTracker, CameraManager, Visualizer } from './js/index.js';

// カメラとビデオ要素の準備
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');

// カメラマネージャーの初期化
const cameraManager = new CameraManager(videoElement);
await cameraManager.startCamera();

// トラッカーの初期化
const tracker = new MouthTracker(videoElement, (data) => {
    console.log('口のデータ:', data);
});

await tracker.initialize();
tracker.start();

// ビジュアライザーの初期化
const visualizer = new Visualizer(canvasElement, videoElement);
tracker.onDataUpdate = (data) => {
    visualizer.drawLandmarks(data.landmarks, data.allLandmarks);
};
```

## 機能

- **リアルタイム口トラッキング**: 8点の口ランドマークを30fps以上でトラッキング
  - 左端・右端（2点）
  - 上唇中央・下唇中央（2点）
  - 上唇左右・下唇左右（4点）
- **可視化**: トラッキングポイントの視覚的表示と菱形の輪郭線
- **データ計測**: 口の開き具合、幅、面積などの計測値の算出
- **カメラ選択**: 複数カメラがある場合の選択機能
- **設定カスタマイズ**: 平滑化係数、表示設定などの調整

## 技術スタック

- **HTML5**: MediaStream APIでカメラアクセス
- **CSS3**: モダンなレスポンシブデザイン
- **JavaScript (ES6+)**: モジュール化されたコード構造
- **MediaPipe FaceMesh**: Googleの高精度顔ランドマーク検出

## セットアップ

### 前提条件

- Node.js (v14以上)
- npm (v6以上)
- モダンブラウザ（Chrome/Edge、Firefox、Safari）
- カメラ（内蔵またはUSB接続）

### インストール

```bash
# 依存パッケージのインストール
npm install
```

### 開発サーバーの起動

```bash
# 開発サーバーを起動（ポート8080）
npm start

# または、キャッシュ無効化で起動
npm run dev
```

ブラウザで `http://localhost:8080` にアクセスしてください。
- Node.js（開発サーバー使用時、オプション）

### インストール

1. リポジトリをクローンまたはダウンロード

```bash
git clone <repository-url>
cd mouth-track
```

2. 依存関係をインストール

```bash
npm install
```

3. 開発サーバーを起動（オプション）

```bash
npm start
```

または、任意のHTTPサーバーでプロジェクトを開いてください。

### 使用方法

1. ブラウザで `index.html` を開く（または開発サーバーにアクセス）
2. 「トラッキング開始」ボタンをクリック
3. カメラへのアクセス許可を確認
4. 顔をカメラに向けて、口の動きをトラッキング

## プロジェクト構造

```
mouth-track/
├── index.html              # メインHTMLファイル
├── css/                    # スタイルシート
│   ├── main.css
│   ├── components.css
│   └── responsive.css
├── js/                     # JavaScriptモジュール│   ├── app.js             # エントリーポイント
│   ├── core/              # コアロジック
│   ├── ui/                # UI制御
│   ├── utils/             # ユーティリティ
│   └── config/            # 設定・定数

```

## 開発計画

詳細な開発計画は [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) を参照してください。

## ブラウザ対応

- ✅ Chrome/Edge (Chromium) - 推奨
- ✅ Firefox
- ✅ Safari (macOS/iOS)

## ライセンス

MIT License

## 参考資料

- [MediaPipe FaceMesh Documentation](https://google.github.io/mediapipe/solutions/face_mesh)
- [MediaStream API](https://developer.mozilla.org/ja/docs/Web/API/MediaStream)

