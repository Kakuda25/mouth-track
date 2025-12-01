/**
 * CalibrationManager - キャリブレーション管理クラス
 * 初期状態で口を閉じた状態を基準として、個人差を補正する機能を提供
 */
export class CalibrationManager {
    constructor(options = {}) {
        this.duration = options.duration || 3000;
        this.sampleInterval = options.sampleInterval || 100;
        this.minSamples = options.minSamples || 10;
        
        this.isCalibrating = false;
        this.samples = [];
        this.baseline = null;
        this.onCalibrationComplete = options.onCalibrationComplete || null;
        this.onCalibrationProgress = options.onCalibrationProgress || null;
    }

    /**
     * キャリブレーションを開始
     * @param {Function} getMetrics - 計測値を取得する関数
     * @returns {Promise<Object>} 基準値
     */
    async startCalibration(getMetrics) {
        if (this.isCalibrating) {
            throw new Error('キャリブレーションは既に実行中です');
        }

        this.isCalibrating = true;
        this.samples = [];
        const startTime = Date.now();
        const endTime = startTime + this.duration;

        return new Promise((resolve, reject) => {
            const sampleInterval = setInterval(() => {
                try {
                    const metrics = getMetrics();
                    if (!metrics || !metrics.openness || !metrics.width) {
                        return;
                    }

                    this.samples.push({
                        timestamp: Date.now(),
                        openness: metrics.openness,
                        width: metrics.width,
                        aspectRatio: metrics.aspectRatio,
                        area: metrics.area || 0,
                        upperLipThickness: metrics.upperLipThickness || 0,
                        lowerLipThickness: metrics.lowerLipThickness || 0
                    });

                    const progress = Math.min((Date.now() - startTime) / this.duration, 1.0);
                    if (this.onCalibrationProgress) {
                        this.onCalibrationProgress(progress, this.samples.length);
                    }

                    if (Date.now() >= endTime) {
                        clearInterval(sampleInterval);
                        this._completeCalibration(resolve, reject);
                    }
                } catch (error) {
                    clearInterval(sampleInterval);
                    this.isCalibrating = false;
                    reject(error);
                }
            }, this.sampleInterval);
        });
    }

    /**
     * キャリブレーションを完了
     * @private
     */
    _completeCalibration(resolve, reject) {
        if (this.samples.length < this.minSamples) {
            this.isCalibrating = false;
            reject(new Error(`サンプル数が不足しています: ${this.samples.length} < ${this.minSamples}`));
            return;
        }

        const baseline = this._calculateBaseline();
        this.baseline = baseline;
        this.isCalibrating = false;

        if (this.onCalibrationComplete) {
            this.onCalibrationComplete(baseline);
        }

        resolve(baseline);
    }

    /**
     * 基準値を計算
     * @private
     * @returns {Object} 基準値
     */
    _calculateBaseline() {
        if (this.samples.length === 0) {
            return null;
        }

        const opennessValues = this.samples.map(s => s.openness).filter(v => v > 0);
        const widthValues = this.samples.map(s => s.width).filter(v => v > 0);
        const aspectRatioValues = this.samples.map(s => s.aspectRatio).filter(v => v > 0);
        const areaValues = this.samples.map(s => s.area).filter(v => v > 0);
        const lipThicknessValues = this.samples.map(s => 
            (s.upperLipThickness || 0) + (s.lowerLipThickness || 0)
        ).filter(v => v > 0);

        const calculateMin = (values) => values.length > 0 ? Math.min(...values) : 0;
        const calculateMax = (values) => values.length > 0 ? Math.max(...values) : 0;
        const calculateAvg = (values) => values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

        return {
            openness: calculateMin(opennessValues),
            width: calculateMin(widthValues),
            aspectRatio: calculateAvg(aspectRatioValues),
            area: calculateMin(areaValues),
            lipThickness: calculateMin(lipThicknessValues),
            opennessMax: calculateMax(opennessValues),
            widthMax: calculateMax(widthValues),
            timestamp: Date.now()
        };
    }

    /**
     * キャリブレーションを停止
     */
    stopCalibration() {
        this.isCalibrating = false;
        this.samples = [];
    }

    /**
     * 基準値を取得
     * @returns {Object|null} 基準値
     */
    getBaseline() {
        return this.baseline;
    }

    /**
     * 基準値を設定
     * @param {Object} baseline - 基準値
     */
    setBaseline(baseline) {
        this.baseline = baseline;
    }

    /**
     * キャリブレーション中かどうか
     * @returns {boolean} キャリブレーション中の場合true
     */
    getIsCalibrating() {
        return this.isCalibrating;
    }
}

