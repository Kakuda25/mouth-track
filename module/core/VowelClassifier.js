/**
 * VowelClassifier - 母音判別クラス
 * 口の形状から日本語の5つの母音（あ、い、う、え、お）を判別します
 */

/**
 * 母音判別クラス
 */
export class VowelClassifier {
    constructor(options = {}) {
        // デフォルトの閾値設定
        this.thresholds = {
            // 各母音の特徴量範囲
            vowels: {
                'あ': {
                    openness: { min: 0.6, max: 1.0 },
                    width: { min: 0.5, max: 0.8 },
                    aspectRatio: { min: 0.5, max: 0.8 }
                },
                'い': {
                    openness: { min: 0.0, max: 0.3 },
                    width: { min: 0.7, max: 1.0 },
                    aspectRatio: { min: 1.5, max: 3.0 }
                },
                'う': {
                    openness: { min: 0.0, max: 0.2 },
                    width: { min: 0.3, max: 0.5 },
                    aspectRatio: { min: 1.0, max: 2.0 }
                },
                'え': {
                    openness: { min: 0.3, max: 0.5 },
                    width: { min: 0.6, max: 0.9 },
                    aspectRatio: { min: 1.2, max: 2.0 }
                },
                'お': {
                    openness: { min: 0.4, max: 0.6 },
                    width: { min: 0.5, max: 0.7 },
                    aspectRatio: { min: 0.9, max: 1.3 }
                }
            }
        };

        // ユーザー基準値（キャリブレーション用）
        // 初期値は0に設定（動的に更新される）
        this.userBaseline = {
            maxOpenness: 0,
            maxWidth: 0
        };

        // キャリブレーション設定
        this.calibrationFrames = 0;
        this.calibrationMaxFrames = options.calibrationFrames || 90; // デフォルト3秒（30fps × 3秒）
        this.isCalibrating = options.autoCalibrate !== false; // デフォルトで自動キャリブレーション有効
        this.calibrationMargin = options.calibrationMargin || 1.2; // 20%のマージン

        // コールバック関数
        this.onVowelDetected = options.onVowelDetected || null;
        this.onCalibrationComplete = options.onCalibrationComplete || null;

        // カスタム閾値の適用
        if (options.thresholds) {
            this.thresholds = { ...this.thresholds, ...options.thresholds };
        }

        // ユーザー基準値の適用（手動設定の場合）
        if (options.userBaseline) {
            this.userBaseline = { ...this.userBaseline, ...options.userBaseline };
            this.isCalibrating = false; // 手動設定の場合はキャリブレーションをスキップ
        }
    }

    /**
     * 計測値から母音を判別
     * @param {Object} metrics - 計測値 {openness, width, area, aspectRatio}
     * @returns {Object} 判別結果 {vowel, confidence, probabilities}
     */
    classify(metrics) {
        if (!metrics || !metrics.openness || !metrics.width || !metrics.aspectRatio) {
            return {
                vowel: null,
                confidence: 0,
                probabilities: this._getEmptyProbabilities(),
                metrics: null
            };
        }

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
            
            // キャリブレーション完了
            if (this.calibrationFrames >= this.calibrationMaxFrames) {
                // 安全マージンを追加
                this.userBaseline.maxOpenness *= this.calibrationMargin;
                this.userBaseline.maxWidth *= this.calibrationMargin;
                
                // 最小値を設定（ゼロ除算を防ぐ）
                if (this.userBaseline.maxOpenness < 0.001) {
                    this.userBaseline.maxOpenness = 0.001;
                }
                if (this.userBaseline.maxWidth < 0.001) {
                    this.userBaseline.maxWidth = 0.001;
                }
                
                this.isCalibrating = false;
                
                // コールバックを呼び出し
                if (this.onCalibrationComplete) {
                    this.onCalibrationComplete(this.userBaseline);
                }
                
                console.log('[VowelClassifier] キャリブレーション完了:', this.userBaseline);
            }
            
            // キャリブレーション中は判別しない
            return {
                vowel: null,
                confidence: 0,
                probabilities: this._getEmptyProbabilities(),
                metrics: {
                    openness: metrics.openness,
                    width: metrics.width,
                    aspectRatio: metrics.aspectRatio,
                    area: metrics.area
                },
                isCalibrating: true,
                calibrationProgress: this.calibrationFrames / this.calibrationMaxFrames
            };
        }

        // 正規化（動的に設定された基準値を使用）
        // 基準値が0の場合は、正規化せずにそのまま使用（フォールバック）
        const normOpenness = this.userBaseline.maxOpenness > 0.001 
            ? Math.min(metrics.openness / this.userBaseline.maxOpenness, 2.0) // 最大2.0に制限
            : metrics.openness;
        const normWidth = this.userBaseline.maxWidth > 0.001 
            ? Math.min(metrics.width / this.userBaseline.maxWidth, 2.0) // 最大2.0に制限
            : metrics.width;
        const aspectRatio = metrics.aspectRatio;

        // 各母音のスコアを計算
        const scores = this._calculateScores(normOpenness, normWidth, aspectRatio);

        // 最高スコアの母音を取得
        const maxScore = Math.max(...Object.values(scores));
        const vowel = Object.keys(scores).find(key => scores[key] === maxScore);

        // 信頼度を計算（最高スコアを正規化）
        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const confidence = totalScore > 0 ? maxScore / totalScore : 0;

        // 確率分布を計算
        const probabilities = this._calculateProbabilities(scores, totalScore);

        const result = {
            vowel: confidence > 0.3 ? vowel : null, // 信頼度が低い場合はnull
            confidence: confidence,
            probabilities: probabilities,
            scores: scores,
            metrics: {
                openness: normOpenness,
                width: normWidth,
                aspectRatio: aspectRatio,
                area: metrics.area
            }
        };

        // コールバック関数を呼び出し
        if (this.onVowelDetected) {
            this.onVowelDetected(result);
        }

        return result;
    }

    /**
     * 各母音のスコアを計算
     * @private
     */
    _calculateScores(normOpenness, normWidth, aspectRatio) {
        const scores = {};

        for (const [vowel, threshold] of Object.entries(this.thresholds.vowels)) {
            let score = 0;

            // 開き具合のマッチング
            if (normOpenness >= threshold.openness.min && normOpenness <= threshold.openness.max) {
                score += 0.4;
            } else {
                const distance = Math.min(
                    Math.abs(normOpenness - threshold.openness.min),
                    Math.abs(normOpenness - threshold.openness.max)
                );
                score += Math.max(0, 0.4 - distance * 2);
            }

            // 幅のマッチング
            if (normWidth >= threshold.width.min && normWidth <= threshold.width.max) {
                score += 0.3;
            } else {
                const distance = Math.min(
                    Math.abs(normWidth - threshold.width.min),
                    Math.abs(normWidth - threshold.width.max)
                );
                score += Math.max(0, 0.3 - distance * 2);
            }

            // アスペクト比のマッチング
            if (aspectRatio >= threshold.aspectRatio.min && aspectRatio <= threshold.aspectRatio.max) {
                score += 0.3;
            } else {
                const distance = Math.min(
                    Math.abs(aspectRatio - threshold.aspectRatio.min),
                    Math.abs(aspectRatio - threshold.aspectRatio.max)
                );
                score += Math.max(0, 0.3 - distance * 0.5);
            }

            scores[vowel] = Math.max(0, Math.min(1, score));
        }

        return scores;
    }

    /**
     * 確率分布を計算
     * @private
     */
    _calculateProbabilities(scores, totalScore) {
        const probabilities = {};
        
        if (totalScore === 0) {
            return this._getEmptyProbabilities();
        }

        for (const [vowel, score] of Object.entries(scores)) {
            probabilities[vowel] = score / totalScore;
        }

        return probabilities;
    }

    /**
     * 空の確率分布を取得
     * @private
     */
    _getEmptyProbabilities() {
        return {
            'あ': 0,
            'い': 0,
            'う': 0,
            'え': 0,
            'お': 0
        };
    }

    /**
     * ユーザー基準値を設定（キャリブレーション）
     * @param {Object} baseline - 基準値 {maxOpenness, maxWidth}
     */
    setUserBaseline(baseline) {
        this.userBaseline = { ...this.userBaseline, ...baseline };
    }

    /**
     * 閾値を設定
     * @param {Object} thresholds - 閾値設定
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    /**
     * キャリブレーションを実行
     * ユーザーが各母音を発音したデータから基準値を計算
     * @param {Array} calibrationData - キャリブレーションデータ [{vowel: 'あ', metrics: {...}}, ...]
     */
    calibrate(calibrationData) {
        if (!calibrationData || calibrationData.length === 0) {
            return;
        }

        // 各母音の最大値を計算
        let maxOpenness = 0;
        let maxWidth = 0;

        for (const data of calibrationData) {
            if (data.metrics) {
                maxOpenness = Math.max(maxOpenness, data.metrics.openness || 0);
                maxWidth = Math.max(maxWidth, data.metrics.width || 0);
            }
        }

        // 基準値を設定
        if (maxOpenness > 0) {
            this.userBaseline.maxOpenness = maxOpenness;
        }
        if (maxWidth > 0) {
            this.userBaseline.maxWidth = maxWidth;
        }
    }
}

