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
        // 実際の計測値の範囲（0.01-0.1程度）に合わせて調整
        this.thresholds = {
            // 各母音の特徴量範囲（生の計測値）
            vowels: {
                'あ': {
                    // 大きく開く、縦長
                    openness: { min: 0.06, max: 0.15 },
                    width: { min: 0.05, max: 0.12 },
                    aspectRatio: { min: 0.5, max: 0.8 }
                },
                'い': {
                    // 横に広げる、開きは小さい
                    openness: { min: 0.0, max: 0.03 },
                    width: { min: 0.08, max: 0.15 },
                    aspectRatio: { min: 2.0, max: 5.0 }
                },
                'う': {
                    // すぼめる、小さい
                    openness: { min: 0.0, max: 0.02 },
                    width: { min: 0.03, max: 0.06 },
                    aspectRatio: { min: 1.5, max: 3.0 }
                },
                'え': {
                    // 少し開いて横に広げる
                    openness: { min: 0.03, max: 0.05 },
                    width: { min: 0.07, max: 0.12 },
                    aspectRatio: { min: 1.5, max: 2.5 }
                },
                'お': {
                    // 丸く開ける、中程度
                    openness: { min: 0.05, max: 0.08 },
                    width: { min: 0.05, max: 0.10 },
                    aspectRatio: { min: 0.9, max: 1.5 }
                }
            }
        };

        // コールバック関数
        this.onVowelDetected = options.onVowelDetected || null;

        // カスタム閾値の適用
        if (options.thresholds) {
            this.thresholds = { ...this.thresholds, ...options.thresholds };
        }
    }

    /**
     * 計測値から母音を判別
     * @param {Object} metrics - 計測値 {openness, width, area, aspectRatio, ...}
     * @param {Object} temporalFeatures - 時間的特徴量（オプション、現在は未使用。将来の改善で使用予定）
     * @returns {Object} 判別結果 {vowel, confidence, probabilities}
     */
    classify(metrics, temporalFeatures = null) {
        if (!metrics || !metrics.openness || !metrics.width || !metrics.aspectRatio) {
            return {
                vowel: null,
                confidence: 0,
                probabilities: this._getEmptyProbabilities(),
                metrics: null
            };
        }

        // 相対的な判定（正規化なし）
        // 生の計測値をそのまま使用
        const openness = metrics.openness;
        const width = metrics.width;
        const aspectRatio = metrics.aspectRatio;

        // 各母音のスコアを計算（相対的な判定）
        const scores = this._calculateScoresRelative(openness, width, aspectRatio, metrics, temporalFeatures);

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
                openness: openness,
                width: width,
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
     * 各母音のスコアを計算（相対的な判定）
     * 正規化なしで、相対的な特徴量で判定
     * @private
     * @param {number} openness - 開き具合
     * @param {number} width - 幅
     * @param {number} aspectRatio - アスペクト比
     * @param {Object} metrics - 計測値（現在は未使用。将来の改善で使用予定）
     * @param {Object} temporalFeatures - 時間的特徴量（現在は未使用。将来の改善で使用予定）
     */
    _calculateScoresRelative(openness, width, aspectRatio, metrics = null, temporalFeatures = null) {
        const scores = {};

        // 「あ」: 開き具合が大きい、アスペクト比が小さい（縦長）
        scores['あ'] = this._scoreForA(openness, aspectRatio);

        // 「い」: 幅が大きい、開き具合が小さい、アスペクト比が大きい（横長）
        scores['い'] = this._scoreForI(openness, width, aspectRatio);

        // 「う」: 開き具合が小さい、幅が小さい、アスペクト比が中程度（すぼめる）
        scores['う'] = this._scoreForU(openness, width, aspectRatio);

        // 「え」: 開き具合が中程度、幅が大きい、アスペクト比が大きい（横に広げる）
        scores['え'] = this._scoreForE(openness, width, aspectRatio);

        // 「お」: 開き具合が中程度、幅が中程度、アスペクト比が小さい（丸い）
        scores['お'] = this._scoreForO(openness, width, aspectRatio);

        return scores;
    }

    /**
     * 「あ」のスコアを計算
     * 特徴: 開き具合が大きい、アスペクト比が小さい（縦長）
     * @private
     */
    _scoreForA(openness, aspectRatio) {
        // 開き具合が大きいほど高スコア（0.06以上で高スコア）
        const opennessScore = Math.min(openness / 0.06, 1.0);
        // アスペクト比が小さいほど高スコア（0.8以下で高スコア）
        const aspectScore = aspectRatio < 0.8 ? 1.0 : Math.max(0, 1.0 - (aspectRatio - 0.8) * 2);
        return (opennessScore * 0.6) + (aspectScore * 0.4);
    }

    /**
     * 「い」のスコアを計算
     * 特徴: 幅が大きい、開き具合が小さい、アスペクト比が大きい（横長）
     * @private
     */
    _scoreForI(openness, width, aspectRatio) {
        // 開き具合が小さいほど高スコア（0.03以下で高スコア）
        const opennessScore = openness < 0.03 ? 1.0 : Math.max(0, 1.0 - (openness - 0.03) * 20);
        // 幅が大きいほど高スコア（0.08以上で高スコア）
        const widthScore = Math.min(width / 0.08, 1.0);
        // アスペクト比が大きいほど高スコア（2.0以上で高スコア）
        const aspectScore = aspectRatio > 2.0 ? Math.min((aspectRatio - 2.0) / 2.0, 1.0) : Math.max(0, aspectRatio / 2.0);
        return (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
    }

    /**
     * 「う」のスコアを計算
     * 特徴: 開き具合が小さい、幅が小さい、アスペクト比が中程度（すぼめる）
     * @private
     */
    _scoreForU(openness, width, aspectRatio) {
        // 開き具合が小さいほど高スコア（0.02以下で高スコア）
        const opennessScore = openness < 0.02 ? 1.0 : Math.max(0, 1.0 - (openness - 0.02) * 30);
        // 幅が小さいほど高スコア（0.06以下で高スコア）
        const widthScore = width < 0.06 ? 1.0 : Math.max(0, 1.0 - (width - 0.06) * 15);
        // アスペクト比が中程度（1.5-3.0）で高スコア
        const aspectScore = aspectRatio >= 1.5 && aspectRatio <= 3.0
            ? 1.0
            : Math.max(0, 1.0 - Math.min(Math.abs(aspectRatio - 2.25) / 1.5, 1.0));
        return (opennessScore * 0.4) + (widthScore * 0.4) + (aspectScore * 0.2);
    }

    /**
     * 「え」のスコアを計算
     * 特徴: 開き具合が中程度、幅が大きい、アスペクト比が大きい（横に広げる）
     * @private
     */
    _scoreForE(openness, width, aspectRatio) {
        // 開き具合が中程度（0.03-0.05）で高スコア
        const opennessScore = openness >= 0.03 && openness <= 0.05
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(openness - 0.04) * 25);
        // 幅が大きいほど高スコア（0.07以上で高スコア）
        const widthScore = Math.min(width / 0.07, 1.0);
        // アスペクト比が大きいほど高スコア（1.5以上で高スコア）
        const aspectScore = aspectRatio > 1.5 ? Math.min((aspectRatio - 1.5) / 1.0, 1.0) : Math.max(0, aspectRatio / 1.5);
        return (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
    }

    /**
     * 「お」のスコアを計算
     * 特徴: 開き具合が中程度、幅が中程度、アスペクト比が小さい（丸い）
     * @private
     */
    _scoreForO(openness, width, aspectRatio) {
        // 開き具合が中程度（0.05-0.08）で高スコア
        const opennessScore = openness >= 0.05 && openness <= 0.08
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(openness - 0.065) * 20);
        // 幅が中程度（0.05-0.10）で高スコア
        const widthScore = width >= 0.05 && width <= 0.10
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(width - 0.075) * 15);
        // アスペクト比が小さいほど高スコア（1.5以下で高スコア）
        const aspectScore = aspectRatio < 1.5 ? 1.0 : Math.max(0, 1.0 - (aspectRatio - 1.5) * 1.0);
        return (opennessScore * 0.4) + (widthScore * 0.3) + (aspectScore * 0.3);
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
     * 閾値を設定
     * @param {Object} thresholds - 閾値設定
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }
}

