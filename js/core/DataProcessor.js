/**
 * DataProcessor - データ処理クラス
 * ランドマークデータから計測値を計算します
 */

export class DataProcessor {
    /**
     * 2点間の距離を計算
     * @param {Object} point1 - 点1 {x, y, z}
     * @param {Object} point2 - 点2 {x, y, z}
     * @returns {number} 距離
     */
    static distance(point1, point2) {
        if (!point1 || !point2) return 0;
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        const dz = (point2.z || 0) - (point1.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * 口の開き具合を計算（0.0 〜 1.0）- 中央の外側の点を使用
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 開き具合
     */
    static calculateOpenness(mouthLandmarks) {
        if (!mouthLandmarks || !mouthLandmarks.topOuter || !mouthLandmarks.bottomOuter) {
            return 0;
        }
        // 中央の外側の点を使用
        return this.distance(mouthLandmarks.topOuter, mouthLandmarks.bottomOuter);
    }

    /**
     * 口の幅を計算（0.0 〜 1.0）- 端の点を使用
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 幅
     */
    static calculateWidth(mouthLandmarks) {
        if (!mouthLandmarks || !mouthLandmarks.leftEnd || !mouthLandmarks.rightEnd) {
            return 0;
        }
        // 端の点を使用
        return this.distance(mouthLandmarks.leftEnd, mouthLandmarks.rightEnd);
    }

    /**
     * 口の面積を推定（簡易計算）
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 面積
     */
    static calculateArea(mouthLandmarks) {
        const width = this.calculateWidth(mouthLandmarks);
        const openness = this.calculateOpenness(mouthLandmarks);
        // 楕円の面積の近似: π * a * b
        return Math.PI * (width / 2) * (openness / 2);
    }

    /**
     * アスペクト比を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} アスペクト比
     */
    static calculateAspectRatio(mouthLandmarks) {
        const width = this.calculateWidth(mouthLandmarks);
        const openness = this.calculateOpenness(mouthLandmarks);
        return width / (openness + 0.0001); // ゼロ除算回避
    }

    /**
     * 変化率を計算
     * @param {number} current - 現在の値
     * @param {number} previous - 前の値
     * @returns {number} 変化率
     */
    static calculateChangeRate(current, previous) {
        if (previous === 0) return 0;
        return (current - previous) / previous;
    }

    /**
     * ランドマークデータから全計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {Object} 計測値
     */
    static calculateAllMetrics(mouthLandmarks) {
        return {
            openness: this.calculateOpenness(mouthLandmarks),
            width: this.calculateWidth(mouthLandmarks),
            area: this.calculateArea(mouthLandmarks),
            aspectRatio: this.calculateAspectRatio(mouthLandmarks)
        };
    }
}

