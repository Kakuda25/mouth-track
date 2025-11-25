/**
 * Smoother - 座標平滑化クラス
 * 指数移動平均による平滑化を実装します
 */

export class Smoother {
    constructor(smoothingFactor = 0.5) {
        this.smoothingFactor = smoothingFactor;
        this.previousValues = {};
    }

    /**
     * 指数移動平均による平滑化
     * @param {string} key - ランドマークのキー
     * @param {Object} newValue - 新しい座標値 {x, y, z}
     * @returns {Object} 平滑化された座標値
     */
    smooth(key, newValue) {
        if (!newValue || typeof newValue.x !== 'number') {
            return newValue;
        }

        if (!this.previousValues[key]) {
            this.previousValues[key] = { ...newValue };
            return newValue;
        }

        const prev = this.previousValues[key];
        const smoothed = {
            x: prev.x * this.smoothingFactor + newValue.x * (1 - this.smoothingFactor),
            y: prev.y * this.smoothingFactor + newValue.y * (1 - this.smoothingFactor),
            z: (prev.z || 0) * this.smoothingFactor + (newValue.z || 0) * (1 - this.smoothingFactor)
        };

        this.previousValues[key] = smoothed;
        return smoothed;
    }

    /**
     * 全ての平滑化データをリセット
     */
    reset() {
        this.previousValues = {};
    }

    /**
     * 平滑化係数を変更
     */
    setSmoothingFactor(factor) {
        this.smoothingFactor = Math.max(0, Math.min(1, factor));
    }
}

