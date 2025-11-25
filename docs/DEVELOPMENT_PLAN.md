# 口の動きトラッキングWEBアプリ - 開発計画書

## 技術選定の根拠

### MediaPipe FaceMeshの4つの強み

#### 1. ARKitと同等以上の精度
- **468点の3D顔ランドマーク検出**
  - 口周辺だけで約40点のランドマーク
  - サブピクセル精度での位置特定
  - 深度情報も取得可能（オプション）
- **Googleの最新ML技術**
  - ARKitと同じレベルのディープラーニングモデル
  - 継続的なモデル改善とアップデート
- **信頼度スコア付き**
  - 各ランドマークの検出信頼度を提供
  - 低信頼度の場合の処理分岐が可能

#### 2. クロスプラットフォーム対応
- **対応環境**
  - Windows 10/11
  - macOS（Intel/Apple Silicon両対応）
  - Linux（Ubuntu等）
  - Android/iOS（モバイル対応も可能）
- **ブラウザ対応**
  - Chrome/Edge（Chromium系）
  - Firefox
  - Safari（macOS/iOS）
- **デバイス対応**
  - ノートPC内蔵カメラ
  - 外部USBカメラ
  - モバイルデバイスカメラ

#### 3. 軽量で高速
- **最適化されたモデル**
  - モデルサイズ: 約5MB（圧縮後）
  - 初回ロード: 2-3秒
  - メモリ使用量: 100-200MB程度
- **パフォーマンス**
  - ノートPC（i5相当）で30-60fps達成
  - GPU加速対応（WebGL）
  - CPUフォールバック機能あり
- **リアルタイム処理**
  - 1フレームの処理時間: 15-30ms
  - レイテンシ: 50ms以下

#### 4. 開発の容易性
- **簡単な導入**
  - CDN経由で即座に利用可能
  - npmパッケージも提供
  - TypeScript型定義完備
- **豊富なドキュメント**
  - 公式ドキュメント充実
  - コミュニティサポート活発
  - サンプルコード多数

## アーキテクチャ設計

### システム構成

```
┌─────────────────────────────────────────────┐
│           ユーザーインターフェース            │
│  (HTML5 + CSS3 + Vanilla JavaScript)      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│          アプリケーション層                   │
│  ┌──────────────┐  ┌──────────────────┐   │
│  │ UI Controller│  │ Settings Manager │   │
│  └──────────────┘  └──────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│           コアロジック層                      │
│  ┌───────────────────────────────────┐     │
│  │   MouthTracker (メインクラス)      │     │
│  │  - カメラ管理                      │     │
│  │  - トラッキング制御                 │     │
│  │  - データ処理                      │     │
│  └───────────────────────────────────┘     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│        MediaPipe FaceMesh層                │
│  ┌──────────────┐  ┌──────────────────┐   │
│  │ FaceMesh API │  │ TensorFlow.js    │   │
│  └──────────────┘  └──────────────────┘   │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────┴───────────────────────────┐
│           ハードウェア層                      │
│     カメラ (MediaStream API)               │
└─────────────────────────────────────────────┘
```

### ディレクトリ構成

```
mouth-track/
├── index.html              # メインHTMLファイル
├── README.md               # プロジェクト説明
├── REQUIREMENTS.md         # 要件定義書
├── DEVELOPMENT_PLAN.md     # 本ドキュメント
├── package.json            # 依存関係管理
├── package-lock.json       # 依存関係ロック
├── .gitignore             # Git除外設定
│
├── css/
│   ├── main.css           # メインスタイル
│   ├── components.css     # コンポーネント用スタイル
│   └── responsive.css     # レスポンシブ対応
│
├── js/
│   ├── app.js             # アプリケーションエントリーポイント
│   ├── index.js           # モジュールエクスポート
│   ├── core/
│   │   ├── index.js             # coreモジュールエクスポート
│   │   ├── MouthTracker.js      # トラッキングコアクラス
│   │   ├── CameraManager.js     # カメラ管理
│   │   ├── FaceMeshHandler.js   # MediaPipe連携
│   │   └── DataProcessor.js     # データ処理・計算
│   ├── ui/
│   │   └── Visualizer.js        # Canvas描画
│   ├── utils/
│   │   ├── index.js             # utilsモジュールエクスポート
│   │   ├── MouthLandmarks.js    # ランドマーク定義
│   │   ├── Smoother.js          # 座標平滑化
│   │   └── ErrorHandler.js      # エラー処理
│   └── config/
│       └── constants.js         # 定数定義（8点のランドマークインデックス）
│
└── node_modules/           # 依存パッケージ
    └── @mediapipe/         # MediaPipe関連パッケージ
```

**注意:** 
- `UIController.js`、`SettingsPanel.js`、`DataExporter.js`は削除済み
- `assets/`、`docs/`、`tests/`ディレクトリは未作成


## 開発フェーズ詳細

### Phase 1: 環境構築とプロトタイプ（1-2週間）

#### Week 1: 基本セットアップ
**目標**: MediaPipe FaceMeshの動作確認

**タスク**:
1. **プロジェクト初期化**
   ```bash
   - リポジトリ作成
   - ディレクトリ構造作成
   - .gitignore設定
   ```

2. **基本HTMLページ作成**
   - シンプルなレイアウト
   - カメラプレビュー領域
   - Canvas要素配置

3. **MediaPipe FaceMesh統合**
   ```javascript
   // CDN経由での導入
   - @mediapipe/face_mesh
   - @mediapipe/camera_utils
   - @mediapipe/drawing_utils
   ```

4. **カメラアクセス実装**
   - MediaStream API使用
   - カメラ権限取得
   - エラーハンドリング

5. **基本的な顔検出**
   - FaceMesh初期化
   - リアルタイム検出
   - デバッグログ出力

**成果物**:
- 動作するプロトタイプ（顔検出のみ）
- 468点のランドマーク表示

#### Week 2: 口トラッキング機能
**目標**: 8点の口ランドマーク抽出

**タスク**:
1. **口ランドマークの特定**
   ```javascript
   // MediaPipe FaceMeshの口関連インデックス（8点：外側のみ）
   const MOUTH_LANDMARKS = {
     leftEnd: 61,        // 左端
     rightEnd: 291,      // 右端
     topOuter: 13,       // 上唇中央（外側）
     bottomOuter: 14,    // 下唇中央（外側）
     topLeft: 37,        // 上唇外側左
     topRight: 267,      // 上唇外側右
     bottomLeft: 84,     // 下唇外側左
     bottomRight: 314    // 下唇外側右
   };
   ```

2. **MouthTracker クラス実装**
   - ランドマーク抽出
   - 座標の正規化
   - データ構造定義

3. **可視化機能**
   - Canvas描画実装
   - 8点のマーカー表示（色分け）
   - 10本の線分で菱形の輪郭を描画

4. **座標データの出力**
   - コンソールログ
   - 画面上への表示

**成果物**:
- 8点トラッキング動作確認
- リアルタイム座標取得

### Phase 2: コア機能実装（2-3週間）

#### Week 3: データ処理と計測
**目標**: 口の動きの定量化

**タスク**:
1. **DataProcessorクラス実装**
   ```javascript
   class DataProcessor {
     // 口の開き具合を計算
     calculateOpenness(topY, bottomY)
     
     // 口の幅を計算
     calculateWidth(leftX, rightX)
     
     // 口の面積を推定
     calculateArea(landmarks)
     
     // 変化率を計算
     calculateChangeRate(current, previous)
   }
   ```

2. **座標の平滑化**
   - カルマンフィルタまたは移動平均
   - ノイズ除去
   - 信頼度による重み付け

3. **データ構造の設計**
   ```javascript
   {
     timestamp: 1234567890,
     landmarks: {
       leftOuter: {x: 0.3, y: 0.5, z: -0.01},
       // ... 他の7点
     },
     metrics: {
       openness: 0.15,
       width: 0.25,
       area: 0.0375,
       opennessRate: 0.05
     },
     confidence: 0.95
   }
   ```

4. **リアルタイムグラフ表示（オプション）**
   - Chart.jsまたはCanvas直接描画
   - 時系列データ表示

**成果物**:
- 計測値のリアルタイム表示
- データの品質向上

#### Week 4-5: UI/UX実装
**目標**: 使いやすいインターフェース

**タスク**:
1. **メイン画面のデザイン**
   - モダンなUIデザイン
   - レスポンシブ対応
   - ダークモード対応（オプション）

2. **コントロールパネル**
   - トラッキング開始/停止ボタン
   - カメラ選択ドロップダウン
   - ミラーモード切り替え

3. **設定パネル**
   - 表示設定（色、サイズ）
   - トラッキング感度調整
   - パフォーマンス設定

4. **データ表示パネル**
   - 座標値の表示
   - 計測値の表示
   - FPS表示

5. **エラー表示**
   - カメラアクセスエラー
   - 顔未検出の警告
   - パフォーマンス警告

**成果物**:
- 完成度の高いUI
- ユーザーフレンドリーな操作性

### Phase 3: データエクスポートと最適化（1-2週間）

#### Week 6: エクスポート機能
**目標**: データの保存と出力

**タスク**:
1. **DataExporterクラス実装**
   ```javascript
   class DataExporter {
     // CSV形式でエクスポート
     exportToCSV(data, filename)
     
     // JSON形式でエクスポート
     exportToJSON(data, filename)
     
     // リアルタイム記録
     startRecording()
     stopRecording()
   }
   ```

2. **記録機能**
   - セッション単位でのデータ蓄積
   - メモリ管理（一定量で自動保存）
   - タイムスタンプ管理

3. **ダウンロード機能**
   - Blob APIを使用
   - ファイル名の自動生成
   - ブラウザのダウンロード機能連携

**成果物**:
- CSV/JSONエクスポート機能
- データ記録機能

#### Week 7: パフォーマンス最適化
**目標**: 30fps以上の安定動作

**タスク**:
1. **パフォーマンス計測**
   - FPS測定の実装
   - 処理時間のプロファイリング
   - ボトルネックの特定

2. **最適化実装**
   ```javascript
   // 解像度の動的調整
   - 低スペックPCでは自動的に解像度を下げる
   
   // 描画の最適化
   - requestAnimationFrame の適切な使用
   - 不要な再描画の削減
   
   // メモリ管理
   - オブジェクトプールパターン
   - 不要なデータの破棄
   ```

3. **GPU加速の活用**
   - WebGL最適化
   - TensorFlow.js バックエンド選択

4. **エラーハンドリング強化**
   - カメラ切断時の対応
   - モデルロード失敗時の処理
   - メモリ不足時の対応

**成果物**:
- 安定した30fps動作
- エラーに強いシステム

### Phase 4: テストと改善（1週間）

#### Week 8: テストと調整
**目標**: 品質保証と最終調整

**タスク**:
1. **クロスブラウザテスト**
   - Chrome/Edge
   - Firefox
   - Safari（macOS）

2. **クロスプラットフォームテスト**
   - Windows 10/11
   - macOS（Intel/Apple Silicon）
   - Linux（Ubuntu）

3. **パフォーマンステスト**
   - 様々なスペックのPCで検証
   - 長時間動作テスト
   - メモリリークチェック

4. **ユーザビリティテスト**
   - 実際のユーザーによる操作確認
   - UIの改善
   - バグ修正

5. **ドキュメント作成**
   - README.md
   - API.md
   - USER_GUIDE.md

**成果物**:
- バグのない安定版
- 完全なドキュメント

## 技術実装の詳細

### MediaPipe FaceMesh 統合コード例

```javascript
// FaceMeshHandler.js
class FaceMeshHandler {
  constructor() {
    this.faceMesh = null;
    this.camera = null;
    this.results = null;
  }

  async initialize(videoElement) {
    // FaceMesh初期化
    this.faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    // 設定
    this.faceMesh.setOptions({
      maxNumFaces: 1,              // 1つの顔のみ検出
      refineLandmarks: true,       // 高精度モード（口・目の精度向上）
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // 結果受信のコールバック
    this.faceMesh.onResults((results) => {
      this.results = results;
      this.onResultsCallback(results);
    });

    // カメラ初期化
    this.camera = new Camera(videoElement, {
      onFrame: async () => {
        await this.faceMesh.send({image: videoElement});
      },
      width: 1280,
      height: 720
    });

    await this.camera.start();
  }

  onResultsCallback(results) {
    // オーバーライド用
  }

  getMouthLandmarks() {
    if (!this.results || !this.results.multiFaceLandmarks) {
      return null;
    }

    const landmarks = this.results.multiFaceLandmarks[0];
    
    // 8点の口ランドマークを抽出（外側のみ）
    return {
      leftEnd: landmarks[61],
      rightEnd: landmarks[291],
      topOuter: landmarks[13],
      bottomOuter: landmarks[14],
      topLeft: landmarks[37],
      topRight: landmarks[267],
      bottomLeft: landmarks[84],
      bottomRight: landmarks[314]
    };
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
    }
  }
}
```

### 座標平滑化の実装

```javascript
// Smoother.js
class Smoother {
  constructor(smoothingFactor = 0.5) {
    this.smoothingFactor = smoothingFactor;
    this.previousValues = {};
  }

  // 指数移動平均による平滑化
  smooth(key, newValue) {
    if (!this.previousValues[key]) {
      this.previousValues[key] = newValue;
      return newValue;
    }

    const smoothed = {
      x: this.previousValues[key].x * this.smoothingFactor + 
         newValue.x * (1 - this.smoothingFactor),
      y: this.previousValues[key].y * this.smoothingFactor + 
         newValue.y * (1 - this.smoothingFactor),
      z: this.previousValues[key].z * this.smoothingFactor + 
         newValue.z * (1 - this.smoothingFactor)
    };

    this.previousValues[key] = smoothed;
    return smoothed;
  }

  reset() {
    this.previousValues = {};
  }
}
```

### データ計測の実装

```javascript
// DataProcessor.js
class DataProcessor {
  // 2点間の距離を計算
  static distance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    const dz = point2.z - point1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // 口の開き具合を計算（0.0 〜 1.0）
  static calculateOpenness(mouthLandmarks) {
    const topOuter = mouthLandmarks.topOuter;
    const bottomOuter = mouthLandmarks.bottomOuter;
    return this.distance(topOuter, bottomOuter);
  }

  // 口の幅を計算（0.0 〜 1.0）
  static calculateWidth(mouthLandmarks) {
    const leftOuter = mouthLandmarks.leftOuter;
    const rightOuter = mouthLandmarks.rightOuter;
    return this.distance(leftOuter, rightOuter);
  }

  // 口の面積を推定（簡易計算）
  static calculateArea(mouthLandmarks) {
    const width = this.calculateWidth(mouthLandmarks);
    const openness = this.calculateOpenness(mouthLandmarks);
    // 楕円の面積の近似: π * a * b
    return Math.PI * (width / 2) * (openness / 2);
  }

  // アスペクト比を計算
  static calculateAspectRatio(mouthLandmarks) {
    const width = this.calculateWidth(mouthLandmarks);
    const openness = this.calculateOpenness(mouthLandmarks);
    return width / (openness + 0.0001); // ゼロ除算回避
  }

  // 8点の平均信頼度を計算
  static calculateConfidence(results) {
    if (!results.multiFaceLandmarks) return 0;
    // MediaPipeは全体の信頼度を提供
    return results.multiFaceLandmarks.length > 0 ? 1.0 : 0.0;
  }
}
```

## パフォーマンス目標と最適化戦略

### 目標指標

| 指標 | 目標値 | 許容範囲 |
|------|--------|----------|
| FPS | 30fps以上 | 25-60fps |
| レイテンシ | 50ms以下 | 100ms以下 |
| 初期ロード時間 | 3秒以内 | 5秒以内 |
| メモリ使用量 | 200MB以下 | 300MB以下 |
| CPU使用率 | 50%以下 | 70%以下 |

### 最適化チェックリスト

#### フロントエンド最適化
- [ ] 画像・アセットの圧縮
- [ ] CSS/JSの最小化（Minify）
- [ ] 不要なライブラリの削除
- [ ] Lazy Loading の実装
- [ ] Service Worker によるキャッシング（オプション）

#### MediaPipe最適化
- [ ] `refineLandmarks: true` で口の精度向上
- [ ] `maxNumFaces: 1` で処理負荷軽減
- [ ] 適切な解像度設定（720p推奨、必要に応じて480p）
- [ ] GPU加速の有効化

#### Canvas描画最適化
- [ ] `requestAnimationFrame` の適切な使用
- [ ] オフスクリーンCanvas の活用
- [ ] 差分描画の実装
- [ ] 描画レイヤーの分離

#### メモリ管理
- [ ] オブジェクトの再利用
- [ ] 定期的なガベージコレクション促進
- [ ] 大量データの分割処理
- [ ] イベントリスナーの適切な削除

## リスク管理

### 技術的リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| パフォーマンス不足 | 高 | 解像度の動的調整、軽量モード実装 |
| ブラウザ非互換 | 中 | Polyfill使用、フォールバック実装 |
| カメラアクセス拒否 | 中 | 明確なエラーメッセージ、代替入力 |
| モデルロード失敗 | 低 | リトライ機構、オフライン対応 |

### スケジュールリスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 見積もり超過 | 中 | バッファ期間の確保、優先順位付け |
| 技術的課題 | 中 | 早期プロトタイピング、PoC実施 |
| 仕様変更 | 低 | アジャイル開発、柔軟な設計 |

## 成功の評価基準

### 機能面
- ✅ 8点の口ランドマークを安定してトラッキング
- ✅ 30fps以上で動作
- ✅ 複数ブラウザで動作確認
- ✅ 菱形の輪郭線が正しく表示

### 品質面
- ✅ レイテンシ50ms以下を達成
- ✅ 10分以上の連続動作でエラーなし
- ✅ メモリリークが発生しない
- ✅ エラーハンドリングが適切

### ユーザビリティ面
- ✅ 初回起動から1分以内に使い始められる
- ✅ 直感的な操作が可能
- ✅ エラーメッセージが分かりやすい
- ✅ ドキュメントが充実

## 次のステップ

### 即座に着手
1. プロジェクトディレクトリの作成
2. 基本的なHTML/CSS/JSファイルの作成
3. MediaPipe FaceMeshのCDN統合
4. カメラアクセスの実装

### 推奨タスク順序
```
Day 1-2:  環境構築、基本HTMLページ
Day 3-4:  MediaPipe統合、顔検出
Day 5-7:  口ランドマーク抽出、可視化
Day 8-10: データ処理、計測機能
Day 11-14: UI/UX実装
Day 15-17: エクスポート機能
Day 18-20: 最適化
Day 21-23: テスト
Day 24-25: ドキュメント作成
```

## まとめ

MediaPipe FaceMeshを使用することで、以下を実現します：

1. **ARKitと同等以上の精度**: 468点の高精度ランドマーク検出
2. **クロスプラットフォーム対応**: Windows/macOS/Linux全てで動作
3. **軽量で高速**: ノートPCで30fps以上の安定動作
4. **開発効率**: CDNで即座に利用可能、豊富なドキュメント

この計画に従って開発を進めることで、**約4-6週間**で高品質な口トラッキングWEBアプリを完成させることができます。


