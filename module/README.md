# Mouth Track Module - 仕様書

**バージョン**: 1.0  
**最終更新**: 2024年

---

## 概要

`mouth-track`モジュールは、MediaPipe FaceMeshを使用してリアルタイムで口の動きをトラッキングし、日本語の5つの母音（あ、い、う、え、お）を判別するJavaScriptライブラリです。

---

## モジュール構造

```
module/
├── core/           # コア機能
├── ui/             # UI関連（描画）
├── utils/          # ユーティリティ
├── config/         # 設定・定数
└── index.js        # メインエントリーポイント
```

---

## コアモジュール (`core/`)

### MouthTracker
**役割**: メインのトラッキングクラス。MediaPipe FaceMeshを使用して口の動きをトラッキングします。

**主要メソッド**:
- `constructor(videoElement, onDataUpdate, options)` - 初期化
- `async initialize()` - トラッキングの初期化
- `start()` - トラッキング開始
- `stop()` - トラッキング停止
- `async startCalibration()` - キャリブレーション開始（口を閉じた状態を基準として取得）
- `getBaseline()` - 基準値を取得
- `setBaseline(baseline)` - 基準値を設定

**オプション**:
- `smoothingFactor`: 平滑化係数（デフォルト: 0.5）
- `use34Points`: 34点の輪郭ランドマークを使用するか（デフォルト: true）
- `temporalBufferSize`: 時間的特徴量のバッファサイズ（デフォルト: 30）
- `calibrationDuration`: キャリブレーション期間（ミリ秒、デフォルト: 3000）
- `calibrationSampleInterval`: キャリブレーションのサンプリング間隔（ミリ秒、デフォルト: 100）

**データフロー**:
1. MediaPipe FaceMeshからランドマークを取得
2. ランドマークを平滑化（Smoother）
   - 基本ランドマーク（8点）: 平滑化される
   - 拡張ランドマーク（~200点）: 平滑化される
   - 全顔ランドマーク（468点）: 平滑化される
   - 輪郭ランドマーク（34点）: 平滑化されない（計測値計算用の生データ）
3. 計測値を計算（DataProcessor）
   - 34点モード: `calculateMetricsFromContour34()` を使用
   - 非34点モード: `calculateAllMetrics()` を使用
4. 時間的特徴量を抽出（TemporalFeatureExtractor）
5. `onDataUpdate`コールバックでデータを通知

**出力データ**:
```javascript
{
    landmarks: Object,                    // 基本ランドマーク（8点、平滑化済み）
    allMouthLandmarksExtended: Array,     // 拡張口ランドマーク（~200点、平滑化済み）
    allFaceLandmarks: Array,              // 全顔ランドマーク（468点、平滑化済み）
    metrics: Object,                      // 計測値（平滑化されたランドマークから計算）
    temporalFeatures: Object,             // 時間的特徴量
    contourLandmarks34: Array|null,       // 34点の輪郭ランドマーク（平滑化なし、計測値計算用）
    confidence: number,                   // 信頼度
    fps: number,                          // FPS
    timestamp: number,                    // タイムスタンプ
    faceDetected: boolean                 // 顔が検出されたか
}
```

### VowelClassifier
**役割**: 計測値から日本語の5つの母音を判別します。画像分析に基づいた高精度な判定ロジックを実装。

**主要メソッド**:
- `constructor(options)` - 初期化
- `classify(metrics, temporalFeatures)` - 母音を判別
- `setBaseline(baseline)` - 基準値を設定（個人差補正用）
- `setThresholds(thresholds)` - 閾値を設定

**判定ロジック**:
- **「あ」**: `openness`が最大（0.08-0.15）、`aspectRatio`が小（0.8-2.0）
- **「い」**: `aspectRatio`が最大（5.0-10.0）、`openness`が最小（0.01-0.03）
- **「う」**: `width`が最小（0.03-0.05）、`circularity`が高い
- **「え」**: `aspectRatio`が大（2.5-4.5）、`openness`が中（0.03-0.06）
- **「お」**: `circularity`が高い、`aspectRatio`が小（0.8-1.8）、`openness`が中（0.04-0.07）

**返り値**:
```javascript
{
    vowel: string,              // 判別された母音（'あ'|'い'|'う'|'え'|'お'|'closed'|null）
    confidence: number,         // 信頼度（0-1）
    probabilities: Object,       // 各母音の確率
    scores: Object,             // 各母音のスコア
    metrics: Object             // 主要な計測値
}
```

**特徴**:
- ガウス分布ベースのスコアリング
- 基準値ベースの相対判定（個人差対応）
- 閉口検知機能

### DataProcessor
**役割**: ランドマークデータから計測値を計算します。

**主要メソッド（静的）**:
- `calculateOpenness(mouthLandmarks)` - 口の開き具合
- `calculateWidth(mouthLandmarks)` - 口の幅
- `calculateArea(mouthLandmarks)` - 口の面積
- `calculateAspectRatio(mouthLandmarks)` - アスペクト比（width/openness）
- `calculateAllMetrics(mouthLandmarks, contourLandmarks)` - 全計測値を計算
- `calculateMetricsFromContour34(mouthLandmarks, contourLandmarks, allMouthLandmarksExtended)` - 34点版の計測値

**拡張特徴量**:
- `upperLipThickness` / `lowerLipThickness` - 唇の厚さ
- `mouthCornerAngle` - 口角の角度
- `lipCurvature` - 唇の曲率
- `circularity` - 円形度
- `cornerMovement` - 口角の動き（34点版）
- `cheekMovement` - 頬の動き（34点版）
- `jawMovement` - 顎の動き（34点版）
- `ellipticity` - 楕円度
- `symmetry` - 左右対称性
- `lipProtrusion` - 唇の突出度（Z軸方向）
- `upperLipHeight` / `lowerLipHeight` - 唇の高さ
- `openingShape` - 口の開き方の形状（'circular'|'elliptical'|'linear'）

### FaceMeshHandler
**役割**: MediaPipe FaceMeshとの連携を担当します。

**主要メソッド**:
- `async initialize(videoElement)` - FaceMeshの初期化
- `setOnResults(callback)` - 結果コールバックを設定
- `async send(videoElement)` - ビデオフレームを処理
- `getMouthLandmarks(results)` - 基本ランドマーク（8点）を取得
- `getMouthContourLandmarks(results, use34Points)` - 輪郭ランドマーク（16点または34点）を取得
- `getAllMouthLandmarksExtended(results)` - 拡張口ランドマーク（~200点）を取得
- `getAllFaceLandmarks(results)` - 全顔ランドマーク（468点）を取得
- `getConfidence(results)` - 信頼度を取得

### CalibrationManager
**役割**: 初期状態で口を閉じた状態を基準として、個人差を補正する機能を提供します。

**主要メソッド**:
- `async startCalibration(getMetrics)` - キャリブレーションを開始
- `stopCalibration()` - キャリブレーションを停止
- `getBaseline()` - 基準値を取得
- `setBaseline(baseline)` - 基準値を設定
- `getIsCalibrating()` - キャリブレーション中かどうか

**基準値の内容**:
```javascript
{
    openness: number,        // 最小値
    width: number,           // 最小値
    aspectRatio: number,     // 平均値
    area: number,            // 最小値
    lipThickness: number,    // 最小値
    opennessMax: number,     // 最大値
    widthMax: number,        // 最大値
    timestamp: number        // キャリブレーション実行時刻
}
```

### TemporalFeatureExtractor
**役割**: 時系列データから速度、加速度、統計的特徴量を計算します。

**主要メソッド**:
- `addFrame(metrics)` - 新しいフレームの特徴量を追加
- `getVelocity(featureName)` - 速度を計算
- `getAcceleration(featureName)` - 加速度を計算
- `getMovingAverage(featureName, windowSize)` - 移動平均を計算
- `getStandardDeviation(featureName, windowSize)` - 標準偏差を計算
- `getTrend(featureName)` - 変化傾向を取得（'increasing'|'decreasing'|'stable'）
- `getAllTemporalFeatures()` - すべての時間的特徴量を取得

**計算対象特徴量**:
- 基本: `openness`, `width`, `aspectRatio`, `area`
- 拡張: `mouthCornerAngle.average`, `lipCurvature.average`, `circularity`, `upperLipThickness`, `lowerLipThickness`

### CameraManager
**役割**: カメラの取得、選択、制御を行います。

**主要メソッド**:
- `async getAvailableCameras(maxRetries, retryDelay)` - 利用可能なカメラのリストを取得
- `async startCamera(deviceId, constraints)` - カメラを開始
- `stopCamera()` - カメラを停止
- `getVideoDimensions()` - ビデオのサイズを取得

---

## UIモジュール (`ui/`)

### Visualizer
**役割**: Canvas上にランドマークとトラッキング情報を描画します。

**主要メソッド**:
- `constructor(canvasElement, videoElement)` - 初期化
- `resize()` - Canvasサイズをビデオに合わせる
- `drawLandmarks(data)` - ランドマークを描画
- `clear()` - Canvasをクリア

**描画モード**:
- 全顔ランドマーク（468点）の描画
- 34点の輪郭ランドマークの描画
- 基本ランドマーク（8点）の描画

**設定**:
- `mirrorMode`: ミラーモード（デフォルト: true）

---

## ユーティリティモジュール (`utils/`)

### Smoother
**役割**: 指数移動平均による座標平滑化を実装します。

**主要メソッド**:
- `smooth(key, newValue)` - 座標を平滑化
- `reset()` - 平滑化データをリセット
- `setSmoothingFactor(factor)` - 平滑化係数を変更

### ErrorHandler
**役割**: アプリケーション全体のエラーハンドリングを行います。

**主要メソッド（静的）**:
- `handleError(error, context)` - エラーを処理
- `handleCameraError(error)` - カメラエラーを処理
- `handleMediaPipeError(error)` - MediaPipeエラーを処理

### MouthLandmarks
**役割**: 口ランドマークの定義とユーティリティ関数を提供します。

**主要関数**:
- `getMouthLandmarkIndices()` - ランドマークインデックス配列を取得
- `getLandmarkIndex(name)` - ランドマーク名からインデックスを取得
- `structureMouthLandmarks(landmarks)` - ランドマークデータを構造化

---

## 設定モジュール (`config/`)

### constants.js
**役割**: アプリケーション定数を定義します。

**主要定数**:
- `MOUTH_LANDMARKS`: 基本ランドマーク（8点）のインデックス
- `MOUTH_ALL_LANDMARKS`: 拡張口ランドマーク（~200点）のインデックス
- `MOUTH_CONTOUR_INDICES`: 標準的な口の輪郭（16点）
- `MOUTH_CONTOUR_INDICES_34`: 拡張された口周辺のランドマーク（34点）
- `FACE_MESH_CONFIG`: MediaPipe FaceMesh設定
- `CAMERA_CONFIG`: カメラ設定
- `DEFAULT_SETTINGS`: デフォルト設定値

---

## 使用例

### 基本的な使用方法

```javascript
import { MouthTracker, VowelClassifier } from './module/index.js';

const videoElement = document.getElementById('video');
const vowelClassifier = new VowelClassifier();

const mouthTracker = new MouthTracker(videoElement, (data) => {
    if (data.metrics && data.faceDetected) {
        const result = vowelClassifier.classify(data.metrics, data.temporalFeatures);
        console.log('判別結果:', result.vowel, result.confidence);
    }
});

await mouthTracker.initialize();
mouthTracker.start();
```

### キャリブレーションを使用する場合

```javascript
// キャリブレーションを開始（口を閉じた状態を維持）
const baseline = await mouthTracker.startCalibration();

// 基準値をVowelClassifierに設定
vowelClassifier.setBaseline(baseline);

// トラッキングを開始
mouthTracker.start();
```

### カスタムオプションを使用する場合

```javascript
const mouthTracker = new MouthTracker(videoElement, onDataUpdate, {
    smoothingFactor: 0.7,
    use34Points: true,
    temporalBufferSize: 60,
    calibrationDuration: 5000
});
```

---

## データ形式

### metrics（計測値）

```javascript
{
    // 基本計測値
    openness: number,              // 口の開き具合
    width: number,                 // 口の幅
    area: number,                  // 口の面積
    aspectRatio: number,           // アスペクト比（width/openness）
    
    // 拡張特徴量（contourLandmarksがある場合）
    upperLipThickness: number,
    lowerLipThickness: number,
    mouthCornerAngle: { left: number, right: number, average: number },
    lipCurvature: { upper: number, lower: number, average: number },
    circularity: number,
    
    // 34点版の拡張特徴量
    cornerMovement: { left: number, right: number, average: number },
    cheekMovement: { left: number, right: number, average: number },
    jawMovement: number,
    ellipticity: number,
    symmetry: number,
    upperLipHeight: number,
    lowerLipHeight: number,
    openingShape: string,          // 'circular'|'elliptical'|'linear'
    lipProtrusion: number,
    
    // 変化率
    opennessRate: number,
    widthRate: number
}
```

### temporalFeatures（時間的特徴量）

```javascript
{
    openness: {
        velocity: number,
        acceleration: number,
        movingAverage: number,
        standardDeviation: number,
        trend: string              // 'increasing'|'decreasing'|'stable'
    },
    width: { ... },
    aspectRatio: { ... },
    area: { ... },
    'mouthCornerAngle.average': {
        velocity: number,
        acceleration: number,
        trend: string
    },
    'lipCurvature.average': { ... },
    circularity: { ... },
    upperLipThickness: { ... },
    lowerLipThickness: { ... }
}
```

---

## 依存関係

- **MediaPipe FaceMesh**: 顔ランドマーク検出（CDNまたはnpmパッケージから読み込み）
- **ブラウザAPI**: 
  - `navigator.mediaDevices` - カメラアクセス
  - `HTMLVideoElement` - ビデオストリーム
  - `HTMLCanvasElement` - 描画（Visualizer使用時）

---

## 注意事項

1. **HTTPSまたはlocalhost**: カメラアクセスにはHTTPSまたはlocalhost環境が必要です
2. **MediaPipe FaceMesh**: `window.FaceMesh`が利用可能である必要があります
3. **パフォーマンス**: 34点モードは計算コストが高いため、必要に応じて16点モードを使用してください
4. **キャリブレーション**: 個人差を補正するため、初回使用時にキャリブレーションを実行することを推奨します

---

**ドキュメント作成者**: AI Assistant  
**バージョン**: 1.0

