/**
 * VowelClassifier - 母音判別クラス
 * 口の形状から日本語の5つの母音（あ、い、う、え、お）を判別します
 */
export class VowelClassifier {
    constructor(options = {}) {
        this.thresholds = {
            // closed: parameters to detect mouth-closed state
            closed: {
                openness: 0.01,
                lipThickness: 0.005
            },
            vowels: {
                'あ': {
                    openness: { min: 0.06, max: 0.15 },
                    width: { min: 0.05, max: 0.12 },
                    aspectRatio: { min: 0.5, max: 0.8 }
                },
                'い': {
                    openness: { min: 0.0, max: 0.03 },
                    width: { min: 0.08, max: 0.15 },
                    aspectRatio: { min: 2.0, max: 5.0 }
                },
                'う': {
                    openness: { min: 0.0, max: 0.02 },
                    width: { min: 0.03, max: 0.06 },
                    aspectRatio: { min: 1.5, max: 3.0 }
                },
                'え': {
                    openness: { min: 0.03, max: 0.05 },
                    width: { min: 0.07, max: 0.12 },
                    aspectRatio: { min: 1.5, max: 2.5 }
                },
                'お': {
                    openness: { min: 0.05, max: 0.08 },
                    width: { min: 0.05, max: 0.10 },
                    aspectRatio: { min: 0.9, max: 1.5 }
                }
            }
        };

        this.onVowelDetected = options.onVowelDetected || null;

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

        const openness = metrics.openness;
        const width = metrics.width;
        const aspectRatio = metrics.aspectRatio;

        // closed-mouth detection (prioritize)
        const closedOpennessThreshold = this.thresholds.closed?.openness ?? 0.01;
        const lipThickness = (metrics.upperLipThickness || 0) + (metrics.lowerLipThickness || 0);
        const lipThicknessThreshold = this.thresholds.closed?.lipThickness ?? 0.005;
        if (openness <= closedOpennessThreshold && lipThickness <= lipThicknessThreshold) {
            const probs = this._getEmptyProbabilities();
            probs['closed'] = 1;
            const closedResult = {
                vowel: 'closed',
                confidence: 1,
                probabilities: probs,
                scores: { closed: 1 },
                metrics: {
                    openness: openness,
                    width: width,
                    aspectRatio: aspectRatio,
                    area: metrics.area
                }
            };
            if (this.onVowelDetected) this.onVowelDetected(closedResult);
            return closedResult;
        }

        const scores = this._calculateScoresRelative(openness, width, aspectRatio, metrics, temporalFeatures);
        const maxScore = Math.max(...Object.values(scores));
        const vowel = Object.keys(scores).find(key => scores[key] === maxScore);
        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const confidence = totalScore > 0 ? maxScore / totalScore : 0;
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

        if (this.onVowelDetected) {
            this.onVowelDetected(result);
        }

        return result;
    }

    /**
     * 各母音のスコアを計算
     * @private
     * @param {number} openness - 開き具合
     * @param {number} width - 幅
     * @param {number} aspectRatio - アスペクト比
     * @param {Object} metrics - 計測値（将来の改善で使用予定）
     * @param {Object} temporalFeatures - 時間的特徴量（将来の改善で使用予定）
     */
    _calculateScoresRelative(openness, width, aspectRatio, metrics = null, temporalFeatures = null) {
        const scores = {};

        scores['あ'] = this._scoreForA(openness, aspectRatio);
        scores['い'] = this._scoreForI(openness, width, aspectRatio);
        scores['う'] = this._scoreForU(openness, width, aspectRatio);
        scores['え'] = this._scoreForE(openness, width, aspectRatio);
        scores['お'] = this._scoreForO(openness, width, aspectRatio);

        return scores;
    }

    /**
     * 「あ」のスコアを計算
     * @private
     */
    _scoreForA(openness, aspectRatio) {
        const opennessScore = Math.min(openness / 0.06, 1.0);
        const aspectScore = aspectRatio < 0.8 ? 1.0 : Math.max(0, 1.0 - (aspectRatio - 0.8) * 2);
        return (opennessScore * 0.6) + (aspectScore * 0.4);
    }

    /**
     * 「い」のスコアを計算
     * @private
     */
    _scoreForI(openness, width, aspectRatio) {
        const opennessScore = openness < 0.03 ? 1.0 : Math.max(0, 1.0 - (openness - 0.03) * 20);
        const widthScore = Math.min(width / 0.08, 1.0);
        const aspectScore = aspectRatio > 2.0 ? Math.min((aspectRatio - 2.0) / 2.0, 1.0) : Math.max(0, aspectRatio / 2.0);
        return (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
    }

    /**
     * 「う」のスコアを計算
     * @private
     */
    _scoreForU(openness, width, aspectRatio) {
        const opennessScore = openness < 0.02 ? 1.0 : Math.max(0, 1.0 - (openness - 0.02) * 30);
        const widthScore = width < 0.06 ? 1.0 : Math.max(0, 1.0 - (width - 0.06) * 15);
        const aspectScore = aspectRatio >= 1.5 && aspectRatio <= 3.0
            ? 1.0
            : Math.max(0, 1.0 - Math.min(Math.abs(aspectRatio - 2.25) / 1.5, 1.0));
        return (opennessScore * 0.4) + (widthScore * 0.4) + (aspectScore * 0.2);
    }

    /**
     * 「え」のスコアを計算
     * @private
     */
    _scoreForE(openness, width, aspectRatio) {
        const opennessScore = openness >= 0.03 && openness <= 0.05
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(openness - 0.04) * 25);
        const widthScore = Math.min(width / 0.07, 1.0);
        const aspectScore = aspectRatio > 1.5 ? Math.min((aspectRatio - 1.5) / 1.0, 1.0) : Math.max(0, aspectRatio / 1.5);
        return (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
    }

    /**
     * 「お」のスコアを計算
     * @private
     */
    _scoreForO(openness, width, aspectRatio) {
        const opennessScore = openness >= 0.05 && openness <= 0.08
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(openness - 0.065) * 20);
        const widthScore = width >= 0.05 && width <= 0.10
            ? 1.0
            : Math.max(0, 1.0 - Math.abs(width - 0.075) * 15);
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
            'お': 0,
            'closed': 0
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

