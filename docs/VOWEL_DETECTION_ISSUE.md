# 母音判別の問題分析

## 問題: どれだけ口を開けても「い」にしかならない

## 根本原因の分析

### 問題1: 正規化が機能していない

**現在の実装**:
```javascript
// VowelClassifier.js
this.userBaseline = {
    maxOpenness: 1.0,  // ← 固定値
    maxWidth: 1.0      // ← 固定値
};

// 正規化
const normOpenness = metrics.openness / this.userBaseline.maxOpenness;
```

**問題点**:
- MediaPipe FaceMeshの座標は0.0-1.0の相対座標
- 距離を計算すると、実際の値は0.01-0.1程度（顔全体に対する相対値）
- `1.0`で割っても値は変わらない（0.01 / 1.0 = 0.01）
- つまり、正規化が機能していない

**例**:
- 実際の計測値: `openness = 0.05`（口を大きく開いた時）
- 正規化後: `0.05 / 1.0 = 0.05`
- 「あ」の閾値: `0.6-1.0` → **範囲外！**
- 「い」の閾値: `0.0-0.3` → **範囲内！** ← これが原因

### 問題2: 閾値が実際の計測値の範囲と合っていない

**「あ」の閾値**:
```javascript
'あ': {
    openness: { min: 0.6, max: 1.0 },  // ← 実際の値は0.01-0.1程度
    ...
}
```

**「い」の閾値**:
```javascript
'い': {
    openness: { min: 0.0, max: 0.3 },  // ← 0.01-0.1は全てこの範囲内
    width: { min: 0.7, max: 1.0 },     // ← 幅も大きいと判定
    aspectRatio: { min: 1.5, max: 3.0 } // ← アスペクト比も大きいと判定
}
```

**結果**: 口を開けても、計測値が0.01-0.1の範囲なので、「い」の閾値に最も近い

### 問題3: 動的な基準値の設定がない

現在は固定値（1.0）を使用しているが、実際には：
- ユーザーが口を最大に開いた時の値を記録する必要がある
- その値を基準として正規化する必要がある

## 解決策

### 解決策1: 動的な基準値の設定（推奨）

トラッキング開始時に、最初の数フレームで最大値を記録し、それを基準値として使用：

```javascript
class VowelClassifier {
    constructor(options = {}) {
        this.userBaseline = {
            maxOpenness: 0,  // ← 0に初期化
            maxWidth: 0      // ← 0に初期化
        };
        this.calibrationFrames = 0;
        this.calibrationMaxFrames = 60; // 2秒間（30fps × 2秒）
        this.isCalibrating = true;
    }

    classify(metrics) {
        // キャリブレーション中は最大値を記録
        if (this.isCalibrating) {
            this.userBaseline.maxOpenness = Math.max(
                this.userBaseline.maxOpenness, 
                metrics.openness
            );
            this.userBaseline.maxWidth = Math.max(
                this.userBaseline.maxWidth, 
                metrics.width
            );
            
            this.calibrationFrames++;
            if (this.calibrationFrames >= this.calibrationMaxFrames) {
                this.isCalibrating = false;
                // 安全マージンを追加（10%）
                this.userBaseline.maxOpenness *= 1.1;
                this.userBaseline.maxWidth *= 1.1;
            }
            
            // キャリブレーション中は判別しない
            return { vowel: null, confidence: 0, ... };
        }

        // 正規化（動的に設定された基準値を使用）
        const normOpenness = this.userBaseline.maxOpenness > 0 
            ? metrics.openness / this.userBaseline.maxOpenness 
            : metrics.openness;
        // ...
    }
}
```

### 解決策2: 閾値を実際の計測値の範囲に合わせる

実際の計測値の範囲（0.01-0.1程度）に合わせて閾値を調整：

```javascript
'あ': {
    openness: { min: 0.06, max: 0.15 },  // 実際の範囲に合わせる
    width: { min: 0.05, max: 0.12 },
    aspectRatio: { min: 0.5, max: 0.8 }
},
'い': {
    openness: { min: 0.0, max: 0.03 },   // より狭く
    width: { min: 0.08, max: 0.15 },
    aspectRatio: { min: 2.0, max: 5.0 }
},
```

ただし、この方法は個人差に対応できない。

### 解決策3: 相対的な判定（推奨）

正規化せずに、相対的な判定を行う：

```javascript
// 各母音の特徴を相対的に判定
// 例: 「あ」は開き具合が大きい、アスペクト比が小さい
const scores = {
    'あ': calculateScoreForA(metrics.openness, metrics.aspectRatio),
    'い': calculateScoreForI(metrics.width, metrics.aspectRatio),
    // ...
};

function calculateScoreForA(openness, aspectRatio) {
    // 開き具合が大きいほど高スコア
    const opennessScore = Math.min(openness * 10, 1.0); // 0.1を1.0に正規化
    // アスペクト比が小さいほど高スコア（縦長）
    const aspectScore = aspectRatio < 1.0 ? 1.0 : Math.max(0, 1.0 - (aspectRatio - 1.0));
    return (opennessScore * 0.6) + (aspectScore * 0.4);
}
```

## 推奨される修正

**解決策1（動的な基準値の設定）を実装**し、さらに**解決策3（相対的な判定）も組み合わせる**ことを推奨します。

これにより：
1. 個人差に対応できる（動的キャリブレーション）
2. より正確な判別が可能（相対的な特徴量の使用）
3. 実装がシンプル（既存の閾値ロジックを活用）

