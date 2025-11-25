# 口の動きトラッキングモジュール

リアルタイムで口の動きを追跡し、**母音の口の形になっているかをチェックする機能**を提供する、再利用可能なJavaScriptモジュールです。MediaPipe FaceMeshを使用して、口周辺のランドマークを高精度にトラッキングします。

## 特徴

- **モジュール化**: 様々なフレームワークで使用可能
- **母音判別**: 日本語の5つの母音（あ、い、う、え、お）を判別
- **リアルタイム処理**: 30fps以上での安定したトラッキング
- **再利用可能**: 他のアプリケーションから簡単に組み込める

## モジュールとして使用

```javascript
import { MouthTracker, VowelClassifier } from './module/index.js';

// カメラとビデオ要素の準備
const videoElement = document.getElementById('video');

// トラッカーの初期化
const tracker = new MouthTracker(videoElement, (data) => {
    console.log('口のデータ:', data);
});

await tracker.initialize();
tracker.start();

// 母音判別の設定
const classifier = new VowelClassifier({
    onVowelDetected: (result) => {
        console.log('検出された母音:', result.vowel);
        console.log('信頼度:', result.confidence);
    }
});

// データ更新時に母音を判別
tracker.onDataUpdate = (data) => {
    if (data.metrics) {
        const vowelResult = classifier.classify(data.metrics);
    }
};
```

## 機能

### コア機能
- **リアルタイム口トラッキング**: 16点の口輪郭ランドマークを30fps以上でトラッキング
  - 上唇外側（7点）
  - 上唇内側（5点）
  - 下唇内側（5点）
  - 口角（2点）
- **高精度データ計測**: `MOUTH_CONTOUR_INDICES`を使用した詳細な口の形状計測
  - 口の開き具合、幅、面積、アスペクト比などの計測値の算出
- **母音判別**: 日本語の5つの母音（あ、い、う、え、お）を相対判定方式で判別
- **カメラ選択**: 複数カメラがある場合の選択機能
- **可視化**: トラッキングポイントの視覚的表示（オプション）

### デモアプリケーション
- 完全な動作例を含むデモアプリケーション（`demo/`フォルダ）
- UI付きの見本アプリケーション

## 技術スタック

- **JavaScript (ES6+)**: モジュール化されたコード構造
- **MediaPipe FaceMesh**: Googleの高精度顔ランドマーク検出
- **HTML5**: MediaStream APIでカメラアクセス
- **Canvas API**: 可視化（オプション）

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

ブラウザで `http://localhost:8080/demo/` にアクセスしてデモアプリケーションを確認できます。

## プロジェクト構造

```
mouth-track/
├── module/                    # 再利用可能なモジュール
│   ├── core/                 # コア機能
│   │   ├── CameraManager.js  # カメラ管理
│   │   ├── FaceMeshHandler.js # MediaPipe統合
│   │   ├── MouthTracker.js   # トラッキング管理
│   │   ├── DataProcessor.js  # データ処理
│   │   └── VowelClassifier.js # 母音判別
│   ├── utils/                # ユーティリティ
│   │   ├── MouthLandmarks.js # ランドマーク定義
│   │   ├── Smoother.js       # 平滑化
│   │   └── ErrorHandler.js  # エラーハンドリング
│   ├── ui/                   # UI関連（オプション）
│   │   └── Visualizer.js    # 可視化
│   ├── config/               # 設定
│   │   └── constants.js      # 定数定義
│   └── index.js              # モジュールエントリーポイント
│
├── demo/                      # 見本用のカメラ機能
│   ├── index.html            # デモHTML
│   ├── app.js                # デモアプリケーション
│   ├── css/                  # デモ用CSS
│   └── README.md             # デモの使い方
│
├── package.json              # npm設定
├── README.md                 # 本ファイル
└── REQUIREMENTS.md           # 要件定義書
```

## 使用方法

### モジュールとして使用

```javascript
// ES6 Modules
import { MouthTracker, VowelClassifier } from './module/index.js';

// または、npmパッケージとしてインストールした場合
// import { MouthTracker, VowelClassifier } from 'mouth-track';
```

詳細な使用方法は、`demo/app.js`を参照してください。

### デモアプリケーション

1. `npm start`で開発サーバーを起動
2. ブラウザで `http://localhost:8080/demo/` にアクセス
3. 「トラッキング開始」ボタンをクリック
4. カメラへのアクセス許可を確認
5. 顔をカメラに向けて、口の動きをトラッキング

## 母音判別機能

`VowelClassifier`クラスを使用して、口の形状から母音を判別できます。**相対判定方式**を採用しており、ユーザーごとの個体差に対応しています。

```javascript
const classifier = new VowelClassifier({
    onVowelDetected: (result) => {
        console.log('判別結果:', result.vowel); // 'あ', 'い', 'う', 'え', 'お', または null
        console.log('信頼度:', result.confidence); // 0.0 〜 1.0
        console.log('確率分布:', result.probabilities); // 各母音の確率
        console.log('スコア:', result.scores); // 各母音のスコア
    }
});

// 計測値から母音を判別（生の計測値をそのまま使用）
const result = classifier.classify(metrics);
```

### 判別方式

- **相対判定**: 生の計測値を正規化せずに、相対的な特徴量で判定
- **高精度計測**: `MOUTH_CONTOUR_INDICES`（16点）を使用した詳細な口の輪郭分析
- **閾値ベース分類**: 各母音の特徴量範囲に基づいたスコアリング

詳細は [REQUIREMENTS.md](./REQUIREMENTS.md) を参照してください。

## ブラウザ対応

- ✅ Chrome/Edge (Chromium) - 推奨
- ✅ Firefox
- ✅ Safari (macOS/iOS)

**注意**: カメラアクセスにはHTTPS環境またはlocalhostが必要です。


## ライセンス

MIT License

## 参考資料

- [MediaPipe FaceMesh Documentation](https://google.github.io/mediapipe/solutions/face_mesh)
- [MediaStream API](https://developer.mozilla.org/ja/docs/Web/API/MediaStream)
