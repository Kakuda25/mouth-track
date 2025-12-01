/**
 * VowelClassifier - 母音判別クラス
 * 口の形状から日本語の5つの母音（あ、い、う、え、お）を判別します
 * 拡張ランドマークと時間的特徴量を活用した高精度判定を実装
 */
export class VowelClassifier {
    constructor(options = {}) {
        this.thresholds = {
            closed: {
                openness: 0.01,
                lipThickness: 0.005
            }
        };

        this.onVowelDetected = options.onVowelDetected || null;

        if (options.thresholds) {
            this.thresholds = { ...this.thresholds, ...options.thresholds };
        }
    }

    /**
     * 計測値から母音を判別
     * @param {Object} metrics - 計測値
     * @param {Object} temporalFeatures - 時間的特徴量
     * @returns {Object} 判別結果 {vowel, confidence, probabilities, scores, metrics}
     */
    classify(metrics, temporalFeatures = null) {
        if (!metrics || !metrics.openness || !metrics.width || !metrics.aspectRatio) {
            return {
                vowel: null,
                confidence: 0,
                probabilities: this._getEmptyProbabilities(),
                scores: {},
                metrics: null
            };
        }

        const openness = metrics.openness;
        const width = metrics.width;
        const aspectRatio = metrics.aspectRatio;
        const lipThickness = (metrics.upperLipThickness || 0) + (metrics.lowerLipThickness || 0);

        const closedOpennessThreshold = this.thresholds.closed?.openness ?? 0.01;
        const lipThicknessThreshold = this.thresholds.closed?.lipThickness ?? 0.005;
        if (openness <= closedOpennessThreshold && lipThickness <= lipThicknessThreshold) {
            const probs = this._getEmptyProbabilities();
            probs['closed'] = 1;
            return {
                vowel: 'closed',
                confidence: 1,
                probabilities: probs,
                scores: { closed: 1 },
                metrics: this._extractMetrics(metrics)
            };
        }

        const scores = this._calculateScoresExtended(metrics, temporalFeatures);
        const maxScore = Math.max(...Object.values(scores));
        const vowel = Object.keys(scores).find(key => scores[key] === maxScore);
        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const confidence = totalScore > 0 ? maxScore / totalScore : 0;
        const probabilities = this._calculateProbabilities(scores, totalScore);

        const result = {
            vowel: confidence > 0.25 ? vowel : null,
            confidence: confidence,
            probabilities: probabilities,
            scores: scores,
            metrics: this._extractMetrics(metrics)
        };

        if (this.onVowelDetected) {
            this.onVowelDetected(result);
        }

        return result;
    }

    /**
     * 拡張特徴量を活用したスコア計算
     * @private
     * @param {Object} metrics - 計測値
     * @param {Object} temporalFeatures - 時間的特徴量
     * @returns {Object} 各母音のスコア
     */
    _calculateScoresExtended(metrics, temporalFeatures) {
        return {
            'あ': this._scoreForA(metrics, temporalFeatures),
            'い': this._scoreForI(metrics, temporalFeatures),
            'う': this._scoreForU(metrics, temporalFeatures),
            'え': this._scoreForE(metrics, temporalFeatures),
            'お': this._scoreForO(metrics, temporalFeatures)
        };
    }

    /**
     * 「あ」のスコアを計算
     * @private
     */
    _scoreForA(metrics, temporalFeatures) {
        const { openness, aspectRatio, circularity, area, lipCurvature } = metrics;

        const opennessScore = this._normalizeScore(openness, 0.06, 0.15, true);
        const aspectScore = this._normalizeScore(aspectRatio, 0.5, 0.8, false);
        const circularityScore = circularity || 0;
        const areaScore = this._normalizeScore(area || 0, 0.005, 0.02, true);
        const curvatureScore = lipCurvature ? 1.0 - Math.min((lipCurvature.upper || 0) / 0.01, 1.0) : 0.5;

        const baseScore = (opennessScore * 0.5) + (aspectScore * 0.3) + (circularityScore * 0.2);
        const extendedScore = (areaScore * 0.4) + (curvatureScore * 0.3) + (circularityScore * 0.3);

        let temporalScore = 0.5;
        if (temporalFeatures?.openness) {
            const velocity = Math.abs(temporalFeatures.openness.velocity || 0);
            const trend = temporalFeatures.openness.trend === 'increasing' ? 1.0 : 0.5;
            temporalScore = (Math.min(velocity / 0.1, 1.0) * 0.6) + (trend * 0.4);
        }

        return (baseScore * 0.6) + (extendedScore * 0.25) + (temporalScore * 0.15);
    }

    /**
     * 「い」のスコアを計算
     * @private
     */
    _scoreForI(metrics, temporalFeatures) {
        const { openness, width, aspectRatio, mouthCornerAngle, cornerMovement, cheekMovement, lipCurvature } = metrics;

        const opennessScore = this._normalizeScore(openness, 0.0, 0.03, false);
        const widthScore = this._normalizeScore(width, 0.08, 0.15, true);
        const aspectScore = this._normalizeScore(aspectRatio, 2.0, 5.0, true);
        const cornerAngleScore = mouthCornerAngle ? Math.max(0, (mouthCornerAngle.average || 0) / 0.5) : 0;
        const cornerMovementScore = cornerMovement ? Math.min((cornerMovement.average || 0) / 0.02, 1.0) : 0;
        const cheekMovementScore = cheekMovement ? Math.min((cheekMovement.average || 0) / 0.03, 1.0) : 0;
        const curvatureScore = lipCurvature ? 1.0 - Math.min((lipCurvature.upper || 0) / 0.005, 1.0) : 0.5;

        const baseScore = (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
        const extendedScore = (cornerAngleScore * 0.3) + (cornerMovementScore * 0.25) + 
                              (cheekMovementScore * 0.25) + (curvatureScore * 0.2);

        return (baseScore * 0.65) + (extendedScore * 0.35);
    }

    /**
     * 「う」のスコアを計算
     * @private
     */
    _scoreForU(metrics, temporalFeatures) {
        const { openness, width, aspectRatio, upperLipThickness, lowerLipThickness, 
                circularity, lipCurvature, jawMovement, lipProtrusion } = metrics;

        const opennessScore = this._normalizeScore(openness, 0.0, 0.02, false);
        const widthScore = this._normalizeScore(width, 0.03, 0.06, false);
        const aspectScore = this._normalizeScore(aspectRatio, 1.5, 3.0, false);
        const lipThicknessScore = this._normalizeScore(
            (upperLipThickness || 0) + (lowerLipThickness || 0), 0.005, 0.015, true
        );
        const circularityScore = circularity || 0;
        const curvatureScore = lipCurvature ? Math.min((lipCurvature.average || 0) / 0.01, 1.0) : 0;
        const jawMovementScore = jawMovement ? Math.min((jawMovement || 0) / 0.05, 1.0) : 0;
        const protrusionScore = lipProtrusion ? Math.min((lipProtrusion || 0) / 0.01, 1.0) : 0;

        const baseScore = (opennessScore * 0.4) + (widthScore * 0.4) + (aspectScore * 0.2);
        const extendedScore = (lipThicknessScore * 0.25) + (circularityScore * 0.2) + 
                              (curvatureScore * 0.2) + (jawMovementScore * 0.15) + (protrusionScore * 0.2);

        return (baseScore * 0.6) + (extendedScore * 0.4);
    }

    /**
     * 「え」のスコアを計算
     * @private
     */
    _scoreForE(metrics, temporalFeatures) {
        const { openness, width, aspectRatio, mouthCornerAngle, lipCurvature } = metrics;

        const opennessScore = this._normalizeScore(openness, 0.03, 0.05, false);
        const widthScore = this._normalizeScore(width, 0.07, 0.12, true);
        const aspectScore = this._normalizeScore(aspectRatio, 1.5, 2.5, true);
        const cornerAngleScore = mouthCornerAngle ? Math.max(0, (mouthCornerAngle.average || 0) / 0.3) : 0;
        const curvatureScore = lipCurvature ? Math.min((lipCurvature.upper || 0) / 0.008, 1.0) : 0.5;

        const baseScore = (opennessScore * 0.3) + (widthScore * 0.4) + (aspectScore * 0.3);
        const extendedScore = (cornerAngleScore * 0.5) + (curvatureScore * 0.5);

        let temporalScore = 0.5;
        if (temporalFeatures?.['aspectRatio']) {
            const trend = temporalFeatures['aspectRatio'].trend === 'increasing' ? 1.0 : 0.5;
            temporalScore = trend;
        }

        return (baseScore * 0.7) + (extendedScore * 0.2) + (temporalScore * 0.1);
    }

    /**
     * 「お」のスコアを計算
     * @private
     */
    _scoreForO(metrics, temporalFeatures) {
        const { openness, width, aspectRatio, circularity, lipCurvature, 
                upperLipThickness, lowerLipThickness, jawMovement, lipProtrusion } = metrics;

        const opennessScore = this._normalizeScore(openness, 0.05, 0.08, false);
        const widthScore = this._normalizeScore(width, 0.05, 0.10, false);
        const aspectScore = this._normalizeScore(aspectRatio, 0.9, 1.5, false);
        const circularityScore = circularity || 0;
        const curvatureScore = lipCurvature ? Math.min((lipCurvature.average || 0) / 0.01, 1.0) : 0;
        const lipThicknessScore = this._normalizeScore(
            (upperLipThickness || 0) + (lowerLipThickness || 0), 0.005, 0.015, true
        );
        const jawMovementScore = jawMovement ? Math.min((jawMovement || 0) / 0.05, 1.0) : 0;
        const protrusionScore = lipProtrusion ? Math.min((lipProtrusion || 0) / 0.01, 1.0) : 0;

        const baseScore = (opennessScore * 0.4) + (widthScore * 0.3) + (aspectScore * 0.3);
        const extendedScore = (circularityScore * 0.25) + (curvatureScore * 0.25) + 
                              (lipThicknessScore * 0.2) + (jawMovementScore * 0.15) + (protrusionScore * 0.15);

        return (baseScore * 0.6) + (extendedScore * 0.4);
    }

    /**
     * 特徴量を正規化してスコアを計算
     * @private
     * @param {number} value - 特徴量の値
     * @param {number} min - 最小値
     * @param {number} max - 最大値
     * @param {boolean} higherIsBetter - 値が大きいほど良いか
     * @returns {number} 正規化されたスコア（0-1）
     */
    _normalizeScore(value, min, max, higherIsBetter) {
        if (max === min) return 0.5;
        
        if (higherIsBetter) {
            if (value >= max) return 1.0;
            if (value <= min) return 0.0;
            return (value - min) / (max - min);
        } else {
            if (value <= min) return 1.0;
            if (value >= max) return 0.0;
            return 1.0 - ((value - min) / (max - min));
        }
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
     * 計測値から主要な値を抽出
     * @private
     */
    _extractMetrics(metrics) {
        return {
            openness: metrics.openness,
            width: metrics.width,
            aspectRatio: metrics.aspectRatio,
            area: metrics.area,
            circularity: metrics.circularity,
            lipCurvature: metrics.lipCurvature,
            mouthCornerAngle: metrics.mouthCornerAngle
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
