# CameraManager設計分析

## 現在の設計

### 問題点

1. **UI依存**: `videoElement`を受け取り、直接DOM要素を操作している
   ```javascript
   constructor(videoElement) {
       this.videoElement = videoElement;
       // ...
       this.videoElement.srcObject = this.currentStream;
   }
   ```

2. **フレームワーク非依存性の欠如**: ReactやVue.jsなど他のフレームワークで使いにくい

3. **責務の混在**: カメラストリームの取得とUI要素の設定が混在

## 設計オプション

### オプション1: MediaStreamのみを返す設計（推奨）

**変更内容**:
- `CameraManager`は`MediaStream`のみを返す
- UI要素の設定は呼び出し側が行う

**メリット**:
- ✅ モジュールが完全にUI非依存
- ✅ 他のフレームワークで使いやすい
- ✅ カメラ管理ロジックを再利用可能
- ✅ 責務が明確（カメラ管理のみ）

**デメリット**:
- ⚠️ 呼び出し側で少しコードが増える（`videoElement.srcObject = stream`）

**実装例**:
```javascript
// module/core/CameraManager.js
export class CameraManager {
    constructor() {  // videoElementを削除
        this.currentStream = null;
        this.availableCameras = [];
    }

    async startCamera(deviceId = null) {
        // MediaStreamのみを返す
        this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        return this.currentStream;  // UI要素の設定は行わない
    }
}

// demo/app.js
const cameraManager = new CameraManager();
const stream = await cameraManager.startCamera();
videoElement.srcObject = stream;  // 呼び出し側で設定
```

### オプション2: CameraManagerをdemoに移動

**変更内容**:
- `CameraManager`を`demo/`に移動
- モジュールは`MediaStream`を受け取るだけ

**メリット**:
- ✅ モジュールが完全にUI非依存
- ✅ モジュールがシンプル

**デメリット**:
- ❌ カメラ管理ロジックが再利用できない
- ❌ 他のプロジェクトで同じロジックが必要な場合に重複コードが発生
- ❌ モジュールの価値が下がる

### オプション3: 2つのクラスに分離

**変更内容**:
- `CameraStreamManager`: ストリーム取得のみ（モジュール）
- `CameraUIManager`: UI要素の設定（demo）

**メリット**:
- ✅ 責務が完全に分離
- ✅ モジュールはUI非依存

**デメリット**:
- ⚠️ 複雑になりすぎる
- ⚠️ オーバーエンジニアリングの可能性

## 推奨: オプション1

### 理由

1. **モジュールとしての価値**: カメラ管理ロジックは有用で、他のプロジェクトでも使える
2. **効率性**: 呼び出し側で1行追加するだけ（`videoElement.srcObject = stream`）
3. **シンプルさ**: 過度に複雑にならない
4. **再利用性**: React、Vue.js、Vanilla JSなど、あらゆるフレームワークで使える

### 実装の影響

**変更が必要なファイル**:
1. `module/core/CameraManager.js`: `videoElement`依存を削除
2. `demo/app.js`: ストリームを`videoElement`に設定するコードを追加
3. `module/index.js`: エクスポートはそのまま（APIは変わらない）

**効率への影響**:
- ほぼ影響なし（1行追加するだけ）
- むしろ、モジュールの再利用性が向上し、長期的には効率的

## 結論

**オプション1を推奨**します。

- モジュールとしての価値を維持
- UI非依存で再利用性が高い
- 効率への影響は最小限
- 実装もシンプル

