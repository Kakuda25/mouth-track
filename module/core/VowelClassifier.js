/**
 * VowelClassifier - 母音判別クラス
 * 画像分析に基づいた高精度な母音判定ロジック
 * 
 * 各母音の視覚的特徴:
 * - 閉: openness ≈ 0, width ≈ 中程度
 * - あ: openness 最大（0.08-0.15）, aspectRatio 小（0.8-2.0）
 * - い: aspectRatio 最大（5.0-10.0）, openness 最小（0.01-0.03）
 * - う: width 最小（0.03-0.05）, circularity 高, openness 小（0.02-0.04）
 * - え: aspectRatio 大（2.5-4.0）, openness 中（0.03-0.06）
 * - お: circularity 高, aspectRatio 小（0.8-1.5）, openness 中（0.04-0.07）
 */
export class VowelClassifier {
    constructor(options = {}) {
        this.baseline = options.baseline || null;
        this.onVowelDetected = options.onVowelDetected || null;
        
        this.thresholds = {
            closed: {
                openness: 0.015,
                opennessRatio: 1.5
            },
            vowels: {
                'あ': { 
                    openness: { min: 0.08, optimal: 0.12, sigma: 0.04, penaltyThreshold: 0.06 }, 
                    aspectRatio: { min: 0.5, max: 2.0, falloffStart: 2.0, falloffRange: 3.0 },
                    area: { max: 0.015 }
                },
                'い': { 
                    openness: { max: 0.03, penaltyThreshold: 0.05 }, 
                    aspectRatio: { min: 3.0, optimal: 7.0, sigma: 3.0 },
                    width: { min: 0.08, range: 0.05 },
                    mouthCornerAngle: { max: 0.3 }
                },
                'う': { 
                    width: { max: 0.05, optimal: 0.04, sigma: 0.03, penaltyThreshold: 0.07 }, 
                    circularity: { min: 0.3, penaltyThreshold: 0.3 },
                    openness: { max: 0.04, sigma: 0.03 },
                    aspectRatio: { min: 1.0, max: 2.5 },
                    lipProtrusion: { max: 0.01 }
                },
                'え': { 
                    aspectRatio: { min: 2.0, optimal: 3.5, sigma: 1.5, penaltyThreshold: 2.0 },
                    openness: { min: 0.025, optimal: 0.045, sigma: 0.02, max: 0.07 },
                    width: { min: 0.08, range: 0.04 },
                    mouthCornerAngle: { max: 0.25 }
                },
                'お': { 
                    circularity: { min: 0.3, penaltyThreshold: 0.3 },
                    aspectRatio: { min: 0.8, max: 1.8, optimal: 1.3, penaltyThreshold: 2.5, falloffRange: 2.0 },
                    openness: { optimal: 0.055, sigma: 0.02 },
                    width: { optimal: 0.065, sigma: 0.025 },
                    lipProtrusion: { max: 0.008 }
                }
            }
        };

        if (options.thresholds) {
            this.thresholds = { ...this.thresholds, ...options.thresholds };
        }
    }

    /**
     * 計測値から母音を判別
     * @param {Object} metrics - 計測値
     * @param {Object} temporalFeatures - 時間的特徴量（将来の拡張用、現在は未使用）
     * @returns {Object} 判別結果
     */
    classify(metrics, temporalFeatures = null) {
        if (!metrics || !metrics.openness || !metrics.width || !metrics.aspectRatio) {
            return this._createEmptyResult();
        }

        if (this._isMouthClosed(metrics)) {
            return this._createResult('closed', 1.0, { closed: 1.0 }, metrics);
        }

        const scores = this._calculateScores(metrics);
        const maxScore = Math.max(...Object.values(scores));
        
        if (maxScore < 0.3) {
            return this._createEmptyResult();
        }

        const vowel = Object.keys(scores).find(key => scores[key] === maxScore);
        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const confidence = totalScore > 0 ? maxScore / totalScore : 0;
        const probabilities = this._calculateProbabilities(scores, totalScore);

        return this._createResult(vowel, confidence, probabilities, metrics, scores);
    }

    /**
     * 各母音のスコアを計算（画像の特徴に基づく）
     * @private
     */
    _calculateScores(metrics) {
        return {
            'あ': this._scoreForA(metrics),
            'い': this._scoreForI(metrics),
            'う': this._scoreForU(metrics),
            'え': this._scoreForE(metrics),
            'お': this._scoreForO(metrics)
        };
    }

    /**
     * 「あ」のスコア: openness が最大、aspectRatio が小～中
     * @private
     */
    _scoreForA(metrics) {
        const { openness, aspectRatio, area } = metrics;
        const config = this.thresholds.vowels['あ'];

        const opennessScore = this._gaussianScore(openness, config.openness.optimal, config.openness.sigma);
        const aspectScore = aspectRatio < config.aspectRatio.max ? 1.0 : Math.max(0, 1.0 - (aspectRatio - config.aspectRatio.falloffStart) / config.aspectRatio.falloffRange);
        const areaScore = area ? Math.min(area / config.area.max, 1.0) : 0.5;

        const finalScore = (opennessScore * 0.7) + (aspectScore * 0.2) + (areaScore * 0.1);

        if (openness < config.openness.penaltyThreshold) return finalScore * 0.3;
        return finalScore;
    }

    /**
     * 「い」のスコア: aspectRatio が最大、openness が最小
     * @private
     */
    _scoreForI(metrics) {
        const { openness, width, aspectRatio, mouthCornerAngle } = metrics;
        const config = this.thresholds.vowels['い'];

        const aspectScore = this._gaussianScore(aspectRatio, config.aspectRatio.optimal, config.aspectRatio.sigma);
        const opennessScore = openness < config.openness.max ? 1.0 : Math.max(0, 1.0 - (openness - config.openness.max) / config.openness.max);
        const widthScore = width > config.width.min ? Math.min((width - config.width.min) / config.width.range, 1.0) : 0;
        const cornerScore = mouthCornerAngle ? Math.min(Math.abs(mouthCornerAngle.average || 0) / config.mouthCornerAngle.max, 1.0) : 0.5;

        const finalScore = (aspectScore * 0.5) + (opennessScore * 0.3) + (widthScore * 0.15) + (cornerScore * 0.05);

        if (aspectRatio < config.aspectRatio.min) return finalScore * 0.3;
        if (openness > config.openness.penaltyThreshold) return finalScore * 0.5;
        return finalScore;
    }

    /**
     * 「う」のスコア: width が最小、circularity が高い
     * @private
     */
    _scoreForU(metrics) {
        const { openness, width, aspectRatio, circularity, lipProtrusion } = metrics;
        const config = this.thresholds.vowels['う'];

        const widthScore = width < config.width.max ? 1.0 : Math.max(0, 1.0 - (width - config.width.max) / config.width.sigma);
        const circularityScore = circularity || 0;
        const opennessScore = openness < config.openness.max ? 1.0 : Math.max(0, 1.0 - (openness - config.openness.max) / config.openness.sigma);
        const aspectScore = (aspectRatio >= config.aspectRatio.min && aspectRatio <= config.aspectRatio.max) ? 1.0 : 0.5;
        const protrusionScore = lipProtrusion ? Math.min(lipProtrusion / config.lipProtrusion.max, 1.0) : 0.5;

        const finalScore = (widthScore * 0.4) + (circularityScore * 0.25) + (opennessScore * 0.2) + 
                          (aspectScore * 0.1) + (protrusionScore * 0.05);

        if (width > config.width.penaltyThreshold) return finalScore * 0.2;
        if (circularity < config.circularity.penaltyThreshold) return finalScore * 0.5;
        return finalScore;
    }

    /**
     * 「え」のスコア: aspectRatio が大、openness が中
     * @private
     */
    _scoreForE(metrics) {
        const { openness, width, aspectRatio, mouthCornerAngle } = metrics;
        const config = this.thresholds.vowels['え'];

        const aspectScore = this._gaussianScore(aspectRatio, config.aspectRatio.optimal, config.aspectRatio.sigma);
        const opennessScore = this._gaussianScore(openness, config.openness.optimal, config.openness.sigma);
        const widthScore = width > config.width.min ? Math.min((width - config.width.min) / config.width.range, 1.0) : 0.5;
        const cornerScore = mouthCornerAngle ? Math.min(Math.abs(mouthCornerAngle.average || 0) / config.mouthCornerAngle.max, 1.0) : 0.5;

        const finalScore = (aspectScore * 0.45) + (opennessScore * 0.35) + (widthScore * 0.15) + (cornerScore * 0.05);

        if (aspectRatio < config.aspectRatio.penaltyThreshold) return finalScore * 0.4;
        if (openness < config.openness.min || openness > config.openness.max) return finalScore * 0.5;
        return finalScore;
    }

    /**
     * 「お」のスコア: circularity が高い、aspectRatio が小
     * @private
     */
    _scoreForO(metrics) {
        const { openness, width, aspectRatio, circularity, lipProtrusion } = metrics;
        const config = this.thresholds.vowels['お'];

        const circularityScore = circularity || 0;
        const aspectScore = (aspectRatio >= config.aspectRatio.min && aspectRatio <= config.aspectRatio.max) ? 1.0 : Math.max(0, 1.0 - Math.abs(aspectRatio - config.aspectRatio.optimal) / config.aspectRatio.falloffRange);
        const opennessScore = this._gaussianScore(openness, config.openness.optimal, config.openness.sigma);
        const widthScore = this._gaussianScore(width, config.width.optimal, config.width.sigma);
        const protrusionScore = lipProtrusion ? Math.min(lipProtrusion / config.lipProtrusion.max, 1.0) : 0.5;

        const finalScore = (circularityScore * 0.35) + (aspectScore * 0.3) + (opennessScore * 0.2) + 
                          (widthScore * 0.1) + (protrusionScore * 0.05);

        if (circularity < config.circularity.penaltyThreshold) return finalScore * 0.4;
        if (aspectRatio > config.aspectRatio.penaltyThreshold) return finalScore * 0.3;
        return finalScore;
    }

    /**
     * ガウス分布ベースのスコア計算
     * @private
     * @param {number} value - 実際の値
     * @param {number} optimal - 最適値（ピーク）
     * @param {number} sigma - 標準偏差
     * @returns {number} スコア（0-1）
     */
    _gaussianScore(value, optimal, sigma) {
        const diff = value - optimal;
        return Math.exp(-(diff * diff) / (2 * sigma * sigma));
    }

    /**
     * 口が閉じているか判定
     * @private
     */
    _isMouthClosed(metrics) {
        const { openness, aspectRatio } = metrics;

        if (this.baseline) {
            const baselineOpenness = this.baseline.openness || 0.01;
            const opennessRatio = this.thresholds.closed?.opennessRatio ?? 1.5;
            return openness <= baselineOpenness * opennessRatio;
        }

        const closedOpennessThreshold = this.thresholds.closed?.openness ?? 0.015;
        
        if (openness <= closedOpennessThreshold) {
            return true;
        }

        if (openness <= 0.025 && aspectRatio > 8.0) {
            return false;
        }

        return false;
    }

    /**
     * 確率分布を計算
     * @private
     */
    _calculateProbabilities(scores, totalScore) {
        if (totalScore === 0) {
            return this._getEmptyProbabilities();
        }

        const probabilities = {};
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
     * 結果オブジェクトを作成
     * @private
     */
    _createResult(vowel, confidence, probabilities, metrics, scores = {}) {
        const result = {
            vowel: vowel,
            confidence: confidence,
            probabilities: probabilities,
            scores: scores,
            metrics: metrics ? {
                openness: metrics.openness,
                width: metrics.width,
                aspectRatio: metrics.aspectRatio,
                area: metrics.area,
                circularity: metrics.circularity
            } : null
        };

        if (this.onVowelDetected) {
            this.onVowelDetected(result);
        }

        return result;
    }

    /**
     * 空の結果オブジェクトを作成
     * @private
     */
    _createEmptyResult() {
        return {
            vowel: null,
            confidence: 0,
            probabilities: this._getEmptyProbabilities(),
            scores: {},
            metrics: null
        };
    }

    /**
     * 基準値を設定
     * @param {Object} baseline - 基準値
     */
    setBaseline(baseline) {
        this.baseline = baseline;
    }

    /**
     * 閾値を設定
     * @param {Object} thresholds - 閾値設定
     */
    setThresholds(thresholds) {
        this.thresholds = { ...this.thresholds, ...thresholds };
    }
}
