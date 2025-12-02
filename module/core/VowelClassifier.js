/**
 * VowelClassifier - 母音判別クラス
 * 計測値を正規化された特徴として受け取り、母音ラベルを推定する。
 */
export class VowelClassifier {
    constructor(options = {}) {
        this.baseline = options.baseline || null;
        this.onVowelDetected = options.onVowelDetected || null;
        this.historyLength = options.historyLength || 7;
        this.vowelHistory = [];
        this.calibrationProfiles = options.calibrationProfiles || {};
        this.smoothingAlpha = typeof options.smoothingAlpha === 'number' ? options.smoothingAlpha : 0.6;
        this.probabilityEma = null;
        this.labelMap = options.labelMap || {
            a: 'あ',
            i: 'い',
            u: 'う',
            e: 'え',
            o: 'お',
            closed: '閉口',
            null: '-'
        };

        this.thresholds = {
            closed: {
                openness: 0.018,
                opennessRatio: 1.4
            },
            vowels: {
                a: {
                    openness: { optimal: 0.11, sigma: 0.02, penaltyThreshold: 0.09 },
                    aspectRatio: { min: 1.1, max: 1.9, falloffRange: 1.6 },
                    area: { max: 0.025 }
                },
                i: {
                    aspectRatio: { optimal: 6.5, sigma: 1.5, min: 4.0 },
                    openness: { max: 0.04, penaltyThreshold: 0.05 },
                    width: { min: 0.08, range: 0.05 },
                    mouthCornerAngle: { max: 0.25 },
                    lipThicknessRatio: { optimal: 0.12, sigma: 0.06 }
                },
                u: {
                    width: { max: 0.05, penaltyThreshold: 0.06 },
                    circularity: { min: 0.45, penaltyThreshold: 0.35 },
                    openness: { max: 0.05, sigma: 0.02 },
                    aspectRatio: { min: 1.0, max: 2.4 },
                    lipProtrusion: { max: 0.012 }
                },
                e: {
                    aspectRatio: { optimal: 3.0, sigma: 1.0, penaltyThreshold: 2.0 },
                    openness: { min: 0.03, optimal: 0.045, sigma: 0.015, max: 0.06 },
                    width: { min: 0.08, range: 0.05 },
                    mouthCornerAngle: { max: 0.28 },
                    lipThicknessGap: { optimal: 0.008, sigma: 0.008 }
                },
                o: {
                    circularity: { min: 0.45, penaltyThreshold: 0.38 },
                    width: { optimal: 0.07, sigma: 0.02 },
                    lipProtrusion: { max: 0.015 },
                    thicknessRatio: { optimal: 4.0, sigma: 1.5 },
                    openness: { optimal: 0.055, sigma: 0.02 }
                }
            }
        };

        if (options.thresholds) {
            this.setThresholds(options.thresholds);
        }
    }

    /**
     * 計測値から母音を判別
     * @param {Object} metrics - 計測値（正規化済み距離を想定）
     * @param {Object} temporalFeatures - 時系列特徴量
     * @returns {Object} 判別結果
     */
    classify(metrics, temporalFeatures = null) {
        if (!this._hasRequiredMetrics(metrics)) {
            return this._createEmptyResult();
        }

        if (this._isMouthClosed(metrics)) {
            return this._createResult('closed', 1.0, { closed: 1.0, a: 0, i: 0, u: 0, e: 0, o: 0 }, metrics);
        }

        const scores = this._calculateScores(metrics);
        const { vowel: topVowel, maxScore } = this._selectTopVowel(scores);
        const minScoreThreshold = this._getMinScoreThreshold(metrics);
        if (maxScore < minScoreThreshold) {
            return this._createEmptyResult();
        }

        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
        const probabilities = this._calculateProbabilities(scores, totalScore);
        const smoothedProbabilities = this._smoothProbabilities(probabilities);
        const smoothed = this._smoothVowel(topVowel, smoothedProbabilities[topVowel] || 0, temporalFeatures);

        const gated = this._applyConfidenceGate(smoothed);
        return this._createResult(gated.vowel, gated.confidence, smoothedProbabilities, metrics, scores);
    }

    _hasRequiredMetrics(metrics) {
        return metrics && typeof metrics.openness === 'number' && typeof metrics.width === 'number' && typeof metrics.aspectRatio === 'number';
    }

    _calculateScores(metrics) {
        return {
            a: this._scoreForA(metrics),
            i: this._scoreForI(metrics),
            u: this._scoreForU(metrics),
            e: this._scoreForE(metrics),
            o: this._scoreForO(metrics)
        };
    }

    _scoreForA(metrics) {
        const { openness = 0, aspectRatio = 0, area = 0, width = 0, jawMovement = 0 } = metrics;
        const config = this.thresholds.vowels.a;
        const jawRatio = width > 0 ? jawMovement / width : 0;

        const openScore = this._gaussianScore(openness, this._getOptimal('a', 'openness', config.openness.optimal), this._getSigma('a', 'openness', config.openness.sigma));
        const aspectScore = this._clampedRatio(aspectRatio, config.aspectRatio.min, config.aspectRatio.max, config.aspectRatio.falloffRange);
        const areaScore = Math.min(area / (config.area.max || 0.02), 1.0);

        const combined = (openScore * 0.65) + (aspectScore * 0.25) + (areaScore * 0.1);
        
        if (openness < config.openness.penaltyThreshold) {
            const penaltyFactor = Math.max(0.18, openness / config.openness.penaltyThreshold);
            return combined * penaltyFactor * 0.32;
        }
        
        if (openness < 0.09) {
            return combined * 0.65;
        }

        if (aspectRatio < 1.1) {
            return combined * 0.38;
        }

        if (jawRatio > 0 && jawRatio < 0.6) {
            return combined * 0.55;
        }
        
        return combined;
    }

    _scoreForI(metrics) {
        const { openness = 0, width = 0, aspectRatio = 0, mouthCornerAngle, upperLipThickness = 0, lowerLipThickness = 0 } = metrics;
        const config = this.thresholds.vowels.i;

        const aspectScore = this._gaussianScore(aspectRatio, this._getOptimal('i', 'aspectRatio', config.aspectRatio.optimal), this._getSigma('i', 'aspectRatio', config.aspectRatio.sigma));
        const opennessScore = openness < config.openness.max ? 1.0 : Math.max(0, 1.0 - (openness - config.openness.max) / config.openness.max);
        const widthScore = width > config.width.min ? Math.min((width - config.width.min) / config.width.range, 1.0) : 0;
        const angle = Math.abs(mouthCornerAngle?.average || 0);
        const cornerScore = 1 - Math.min(angle / config.mouthCornerAngle.max, 1);
        const lipRatio = width > 0 ? (upperLipThickness + lowerLipThickness) / width : 0;
        const lipScore = this._gaussianScore(lipRatio, this._getOptimal('i', 'lipThicknessRatio', config.lipThicknessRatio.optimal), this._getSigma('i', 'lipThicknessRatio', config.lipThicknessRatio.sigma));

        const combined = (aspectScore * 0.35) + (opennessScore * 0.15) + (widthScore * 0.3) + (cornerScore * 0.1) + (lipScore * 0.1);
        if (aspectRatio < config.aspectRatio.min) return combined * 0.22;
        if (openness > config.openness.penaltyThreshold) return combined * 0.38;
        if (openness < 0.04) {
            return combined * 0.55;
        }
        return combined;
    }

    _scoreForU(metrics) {
        const { openness = 0, width = 0, aspectRatio = 0, circularity = 0, lipProtrusion = 0 } = metrics;
        const config = this.thresholds.vowels.u;

        const widthScore = width < config.width.max ? 1.0 : Math.max(0, 1.0 - (width - config.width.max) / config.width.max);
        const circularityScore = circularity;
        const opennessScore = openness < config.openness.max ? 1.0 : Math.max(0, 1.0 - (openness - config.openness.max) / config.openness.sigma);
        const aspectScore = (aspectRatio >= config.aspectRatio.min && aspectRatio <= config.aspectRatio.max) ? 1.0 : 0.6;
        const protrusionScore = lipProtrusion ? Math.min(lipProtrusion / config.lipProtrusion.max, 1.0) : 0.2;

        const combined = (widthScore * 0.25) + (circularityScore * 0.25) + (opennessScore * 0.2) + (protrusionScore * 0.2) + (aspectScore * 0.1);
        if (width > config.width.penaltyThreshold) return combined * 0.18;
        if (circularity < config.circularity.penaltyThreshold) return combined * 0.38;
        if (openness < 0.04) {
            return combined * 0.48;
        }
        return combined;
    }

    _scoreForE(metrics) {
        const { openness = 0, width = 0, aspectRatio = 0, mouthCornerAngle, upperLipThickness = 0, lowerLipThickness = 0 } = metrics;
        const config = this.thresholds.vowels.e;

        const aspectScore = this._gaussianScore(aspectRatio, this._getOptimal('e', 'aspectRatio', config.aspectRatio.optimal), this._getSigma('e', 'aspectRatio', config.aspectRatio.sigma));
        const opennessScore = this._gaussianScore(openness, this._getOptimal('e', 'openness', config.openness.optimal), this._getSigma('e', 'openness', config.openness.sigma));
        const widthScore = width > config.width.min ? Math.min((width - config.width.min) / config.width.range, 1.0) : 0.4;
        const angle = Math.abs(mouthCornerAngle?.average || 0);
        const cornerScore = 1 - Math.min(angle / config.mouthCornerAngle.max, 1);
        const gap = Math.abs(upperLipThickness - lowerLipThickness);
        const lipGapScore = this._gaussianScore(gap, this._getOptimal('e', 'lipThicknessGap', config.lipThicknessGap.optimal), this._getSigma('e', 'lipThicknessGap', config.lipThicknessGap.sigma));

        const combined = (aspectScore * 0.28) + (opennessScore * 0.2) + (widthScore * 0.3) + (cornerScore * 0.1) + (lipGapScore * 0.12);
        if (aspectRatio < config.aspectRatio.penaltyThreshold) return combined * 0.35;
        if (openness < config.openness.min) return combined * 0.08;
        if (openness > config.openness.max) return combined * 0.35;
        if (openness < 0.04) {
            return combined * 0.35;
        }
        return combined;
    }

    _scoreForO(metrics) {
        const { openness = 0, width = 0, circularity = 0, lipProtrusion = 0, upperLipThickness = 0, lowerLipThickness = 0 } = metrics;
        const config = this.thresholds.vowels.o;

        const circularityScore = circularity;
        const thicknessSum = upperLipThickness + lowerLipThickness;
        const thicknessRatio = thicknessSum > 0 ? width / thicknessSum : 0;
        const thicknessScore = this._gaussianScore(thicknessRatio, this._getOptimal('o', 'thicknessRatio', config.thicknessRatio.optimal), this._getSigma('o', 'thicknessRatio', config.thicknessRatio.sigma));
        const opennessScore = this._gaussianScore(openness, this._getOptimal('o', 'openness', config.openness.optimal), this._getSigma('o', 'openness', config.openness.sigma));
        const widthScore = this._gaussianScore(width, this._getOptimal('o', 'width', config.width.optimal), this._getSigma('o', 'width', config.width.sigma));
        const protrusionScore = lipProtrusion ? Math.min(lipProtrusion / config.lipProtrusion.max, 1.0) : 0.2;

        const combined = (circularityScore * 0.3) + (thicknessScore * 0.2) + (protrusionScore * 0.2) + (opennessScore * 0.15) + (widthScore * 0.15);
        if (circularity < config.circularity.penaltyThreshold) return combined * 0.28;
        if (openness < 0.05) {
            return combined * 0.48;
        }
        return combined;
    }

    _gaussianScore(value, optimal, sigma) {
        const diff = value - optimal;
        const variance = sigma * sigma || 1e-6;
        return Math.exp(-(diff * diff) / (2 * variance));
    }

    _clampedRatio(value, min, max, falloffRange = 1.0) {
        if (value >= min && value <= max) return 1.0;
        const distance = value < min ? min - value : value - max;
        return Math.max(0, 1.0 - distance / falloffRange);
    }

    _isMouthClosed(metrics) {
        const { openness, upperLipThickness = 0, lowerLipThickness = 0, width = 0 } = metrics;

        if (openness <= 0.018) {
            return true;
        }

        const thicknessSum = upperLipThickness + lowerLipThickness;
        const thicknessRatio = width > 0 ? thicknessSum / width : 0;
        if (openness <= 0.028 && thicknessRatio > 0.25) {
            return true;
        }

        if (this.baseline) {
            const baselineOpenness = this.baseline.openness || 0.01;
            const opennessRatio = this.thresholds.closed?.opennessRatio ?? 1.4;
            return openness <= baselineOpenness * opennessRatio;
        }

        const closedOpennessThreshold = this.thresholds.closed?.openness ?? 0.018;
        if (openness <= closedOpennessThreshold) {
            return true;
        }

        return false;
    }

    _getMinScoreThreshold(metrics) {
        return metrics.openness < 0.04 ? 0.45 : 0.28;
    }

    _selectTopVowel(scores) {
        let maxScore = -Infinity;
        let topVowel = null;
        for (const [vowel, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                topVowel = vowel;
            }
        }
        return { vowel: topVowel, maxScore };
    }

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

    _getEmptyProbabilities() {
        return {
            a: 0,
            i: 0,
            u: 0,
            e: 0,
            o: 0,
            closed: 0
        };
    }

    _smoothProbabilities(probabilities) {
        const keys = ['a', 'i', 'u', 'e', 'o', 'closed'];
        if (!this.probabilityEma) {
            this.probabilityEma = { ...probabilities };
            return { ...probabilities };
        }

        const alpha = this.smoothingAlpha;
        const smoothed = {};
        keys.forEach(key => {
            const prev = this.probabilityEma[key] || 0;
            const curr = probabilities[key] || 0;
            smoothed[key] = prev * alpha + curr * (1 - alpha);
        });
        this.probabilityEma = smoothed;
        return smoothed;
    }

    _smoothVowel(vowel, confidence, temporalFeatures) {
        if (!vowel) {
            this.vowelHistory = [];
            return { vowel: null, confidence: 0 };
        }

        this.vowelHistory.push({ vowel, confidence });
        if (this.vowelHistory.length > this.historyLength) {
            this.vowelHistory.shift();
        }

        const counts = {};
        this.vowelHistory.forEach(item => {
            counts[item.vowel] = (counts[item.vowel] || 0) + (item.confidence || 0);
        });

        let majority = vowel;
        let majorityCount = 0;
        Object.entries(counts).forEach(([key, count]) => {
            if (count > majorityCount) {
                majority = key;
                majorityCount = count;
            }
        });

        const safeCount = majorityCount > 0 ? majorityCount : 1;
        const avgConfidence = this.vowelHistory
            .filter(item => item.vowel === majority)
            .reduce((sum, item) => sum + item.confidence, 0) / safeCount;

        const penalty = this._transitionPenalty(temporalFeatures);
        return { vowel: majority, confidence: avgConfidence * penalty };
    }

    _applyConfidenceGate(smoothed) {
        const isConfident = smoothed.confidence >= 0.5;
        return {
            vowel: isConfident ? smoothed.vowel : null,
            confidence: isConfident ? smoothed.confidence : 0
        };
    }

    _transitionPenalty(temporalFeatures) {
        if (!temporalFeatures) return 1.0;
        const opennessVelocity = Math.abs(temporalFeatures.openness?.velocity || 0);
        const widthVelocity = Math.abs(temporalFeatures.width?.velocity || 0);
        const opennessAcc = Math.abs(temporalFeatures.openness?.acceleration || 0);
        const widthAcc = Math.abs(temporalFeatures.width?.acceleration || 0);

        const velocitySum = opennessVelocity + widthVelocity;
        const accSum = opennessAcc + widthAcc;

        if (velocitySum > 0.35 || accSum > 0.7) return 0.7;
        if (velocitySum > 0.18 || accSum > 0.35) return 0.85;
        return 1.0;
    }

    _createResult(vowel, confidence, probabilities, metrics, scores = {}) {
        const result = {
            vowel,
            confidence,
            probabilities,
            scores,
            metrics: metrics ? {
                openness: metrics.openness,
                width: metrics.width,
                aspectRatio: metrics.aspectRatio,
                area: metrics.area,
                circularity: metrics.circularity,
                scale: metrics.scale
            } : null,
            displayVowel: vowel ? (this.labelMap[vowel] || vowel) : this.labelMap.null
        };

        if (this.onVowelDetected) {
            this.onVowelDetected(result);
        }

        return result;
    }

    _createEmptyResult() {
        return {
            vowel: null,
            confidence: 0,
            probabilities: this._getEmptyProbabilities(),
            scores: {},
            metrics: null
        };
    }

    setBaseline(baseline) {
        this.baseline = baseline;
    }

    setThresholds(thresholds) {
        if (thresholds.calibrationProfiles) {
            this.calibrationProfiles = { ...this.calibrationProfiles, ...thresholds.calibrationProfiles };
        }
        this.thresholds = { ...this.thresholds, ...thresholds };
    }

    _getOptimal(vowel, feature, fallback) {
        const override = this.calibrationProfiles?.[vowel]?.[feature]?.mean;
        return typeof override === 'number' ? override : fallback;
    }

    _getSigma(vowel, feature, fallback) {
        const override = this.calibrationProfiles?.[vowel]?.[feature]?.sigma;
        return typeof override === 'number' ? override : fallback;
    }
}
