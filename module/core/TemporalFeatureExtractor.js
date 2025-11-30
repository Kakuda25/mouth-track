/**
 * TemporalFeatureExtractor - 時間的特徴量抽出クラス
 * 時系列データから速度、加速度、統計的特徴量を計算します
 */

export class TemporalFeatureExtractor {
  constructor(options = {}) {
    // バッファサイズ（デフォルト30フレーム、約1秒）
    this.bufferSize = options.bufferSize || 30;

    // 特徴量の履歴を保持するバッファ
    this.history = [];

    // 前回のフレームの特徴量（速度計算用）
    this.previousMetrics = null;

    // 前回の速度（加速度計算用）
    this.previousVelocity = null;
  }

  /**
   * 新しいフレームの特徴量を追加
   * @param {Object} metrics - 計測値
   */
  addFrame(metrics) {
    if (!metrics) return;

    // 現在のタイムスタンプを追加
    const frameData = {
      timestamp: Date.now(),
      metrics: { ...metrics }
    };

    // バッファに追加
    this.history.push(frameData);

    // バッファサイズを超えた場合は古いデータを削除
    if (this.history.length > this.bufferSize) {
      this.history.shift();
    }
  }

  /**
   * 指定した特徴量の速度を計算
   * @param {string} featureName - 特徴量の名前
   * @returns {number} 速度（単位時間あたりの変化量）
   */
  getVelocity(featureName) {
    if (this.history.length < 2) {
      return 0;
    }

    const current = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];

    const currentValue = this._getFeatureValue(current.metrics, featureName);
    const previousValue = this._getFeatureValue(previous.metrics, featureName);

    if (currentValue === null || previousValue === null) {
      return 0;
    }

    // 時間差（ミリ秒）
    const timeDelta = current.timestamp - previous.timestamp;
    if (timeDelta === 0) return 0;

    // 速度 = 変化量 / 時間差（秒単位に変換）
    return (currentValue - previousValue) / (timeDelta / 1000);
  }

  /**
   * 指定した特徴量の加速度を計算
   * @param {string} featureName - 特徴量の名前
   * @returns {number} 加速度（速度の変化率）
   */
  getAcceleration(featureName) {
    if (this.history.length < 3) {
      return 0;
    }

    const current = this.history[this.history.length - 1];
    const previous = this.history[this.history.length - 2];
    const beforePrevious = this.history[this.history.length - 3];

    const currentValue = this._getFeatureValue(current.metrics, featureName);
    const previousValue = this._getFeatureValue(previous.metrics, featureName);
    const beforePreviousValue = this._getFeatureValue(beforePrevious.metrics, featureName);

    if (currentValue === null || previousValue === null || beforePreviousValue === null) {
      return 0;
    }

    // 現在の速度
    const timeDelta1 = current.timestamp - previous.timestamp;
    const velocity1 = timeDelta1 > 0 ? (currentValue - previousValue) / (timeDelta1 / 1000) : 0;

    // 前回の速度
    const timeDelta2 = previous.timestamp - beforePrevious.timestamp;
    const velocity2 = timeDelta2 > 0 ? (previousValue - beforePreviousValue) / (timeDelta2 / 1000) : 0;

    // 加速度 = 速度の変化 / 時間差
    const totalTimeDelta = (timeDelta1 + timeDelta2) / 2;
    if (totalTimeDelta === 0) return 0;

    return (velocity1 - velocity2) / (totalTimeDelta / 1000);
  }

  /**
   * 指定した特徴量の移動平均を計算
   * @param {string} featureName - 特徴量の名前
   * @param {number} windowSize - ウィンドウサイズ（デフォルト: 5フレーム）
   * @returns {number} 移動平均
   */
  getMovingAverage(featureName, windowSize = 5) {
    if (this.history.length === 0) {
      return 0;
    }

    // ウィンドウサイズを調整
    const actualWindowSize = Math.min(windowSize, this.history.length);
    const startIndex = this.history.length - actualWindowSize;

    let sum = 0;
    let count = 0;

    for (let i = startIndex; i < this.history.length; i++) {
      const value = this._getFeatureValue(this.history[i].metrics, featureName);
      if (value !== null) {
        sum += value;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * 指定した特徴量の標準偏差を計算
   * @param {string} featureName - 特徴量の名前
   * @param {number} windowSize - ウィンドウサイズ（デフォルト: 10フレーム）
   * @returns {number} 標準偏差
   */
  getStandardDeviation(featureName, windowSize = 10) {
    if (this.history.length === 0) {
      return 0;
    }

    // ウィンドウサイズを調整
    const actualWindowSize = Math.min(windowSize, this.history.length);
    const startIndex = this.history.length - actualWindowSize;

    // 平均を計算
    const average = this.getMovingAverage(featureName, actualWindowSize);

    // 分散を計算
    let sumSquaredDiff = 0;
    let count = 0;

    for (let i = startIndex; i < this.history.length; i++) {
      const value = this._getFeatureValue(this.history[i].metrics, featureName);
      if (value !== null) {
        const diff = value - average;
        sumSquaredDiff += diff * diff;
        count++;
      }
    }

    if (count === 0) return 0;

    const variance = sumSquaredDiff / count;
    return Math.sqrt(variance);
  }

  /**
   * 指定した特徴量の変化の傾向を取得
   * @param {string} featureName - 特徴量の名前
   * @returns {string} 'increasing', 'decreasing', 'stable'
   */
  getTrend(featureName) {
    if (this.history.length < 5) {
      return 'stable';
    }

    // 最近の5フレームの傾向を分析
    const recentFrames = this.history.slice(-5);
    let increases = 0;
    let decreases = 0;

    for (let i = 1; i < recentFrames.length; i++) {
      const current = this._getFeatureValue(recentFrames[i].metrics, featureName);
      const previous = this._getFeatureValue(recentFrames[i - 1].metrics, featureName);

      if (current !== null && previous !== null) {
        const diff = current - previous;
        if (diff > 0.001) { // 閾値を設定してノイズを除去
          increases++;
        } else if (diff < -0.001) {
          decreases++;
        }
      }
    }

    if (increases > decreases * 1.5) {
      return 'increasing';
    } else if (decreases > increases * 1.5) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * すべての時間的特徴量を取得
   * @returns {Object} 時間的特徴量のオブジェクト
   */
  getAllTemporalFeatures() {
    if (this.history.length === 0) {
      return null;
    }

    const features = {};
    const featureNames = ['openness', 'width', 'aspectRatio', 'area'];

    for (const featureName of featureNames) {
      features[featureName] = {
        velocity: this.getVelocity(featureName),
        acceleration: this.getAcceleration(featureName),
        movingAverage: this.getMovingAverage(featureName),
        standardDeviation: this.getStandardDeviation(featureName),
        trend: this.getTrend(featureName)
      };
    }

    return features;
  }

  /**
   * バッファをリセット
   */
  reset() {
    this.history = [];
    this.previousMetrics = null;
    this.previousVelocity = null;
  }

  /**
   * 特徴量の値を取得（ネストされたオブジェクトにも対応）
   * @private
   * @param {Object} metrics - 計測値
   * @param {string} featureName - 特徴量の名前
   * @returns {number|null} 特徴量の値
   */
  _getFeatureValue(metrics, featureName) {
    if (!metrics) return null;

    // ネストされたオブジェクトの場合（例: mouthCornerAngle.average）
    if (featureName.includes('.')) {
      const parts = featureName.split('.');
      let value = metrics;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          return null;
        }
      }
      return typeof value === 'number' ? value : null;
    }

    // 通常の特徴量
    return typeof metrics[featureName] === 'number' ? metrics[featureName] : null;
  }

  /**
   * バッファサイズを設定
   * @param {number} size - 新しいバッファサイズ
   */
  setBufferSize(size) {
    this.bufferSize = Math.max(1, Math.min(size, 120)); // 1-120フレームの範囲

    // バッファサイズを超えている場合は古いデータを削除
    while (this.history.length > this.bufferSize) {
      this.history.shift();
    }
  }

  /**
   * 現在のバッファサイズを取得
   * @returns {number} バッファサイズ
   */
  getBufferSize() {
    return this.bufferSize;
  }

  /**
   * 現在の履歴フレーム数を取得
   * @returns {number} 履歴フレーム数
   */
  getHistoryLength() {
    return this.history.length;
  }
}
