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
     * 複数の点から平均座標を計算
     * @param {Array} points - 点の配列 [{x, y, z}, ...]
     * @returns {Object|null} 平均座標 {x, y, z}
     */
    static calculateAveragePoint(points) {
        if (!points || points.length === 0) return null;

        const sum = points.reduce((acc, p) => {
            return {
                x: acc.x + (p.x || 0),
                y: acc.y + (p.y || 0),
                z: acc.z + (p.z || 0)
            };
        }, { x: 0, y: 0, z: 0 });

        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
            z: sum.z / points.length
        };
    }

    /**
     * 口の輪郭ランドマークから計測値を計算（MOUTH_CONTOUR_INDICESを使用）
     * より多くの点を使用することで、より正確な計測が可能
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @param {Object} basicLandmarks - 基本ランドマーク（左端、右端等）
     * @returns {Object} 計測値
     */
    static calculateMetricsFromContour(contourLandmarks, basicLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            // フォールバック: 基本ランドマークを使用
            return this.calculateAllMetrics(basicLandmarks);
        }

        // 上唇外側の点（12-18）
        const topOuterPoints = contourLandmarks.filter(lm => 
            [12, 13, 14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        // 下唇外側の点（14-18、重複あり）
        const bottomOuterPoints = contourLandmarks.filter(lm => 
            [14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        // 上唇内側の点（78-82）
        const topInnerPoints = contourLandmarks.filter(lm => 
            [78, 79, 80, 81, 82].includes(lm.index)
        ).map(lm => lm.point || lm);

        // 下唇内側の点（308-312）
        const bottomInnerPoints = contourLandmarks.filter(lm => 
            [308, 309, 310, 311, 312].includes(lm.index)
        ).map(lm => lm.point || lm);

        // 口角の点（61, 291）
        const cornerPoints = contourLandmarks.filter(lm => 
            [61, 291].includes(lm.index)
        ).map(lm => lm.point || lm);

        // 平均点を計算
        const topOuterAvg = this.calculateAveragePoint(topOuterPoints) || 
                           (basicLandmarks?.topOuter ? { x: basicLandmarks.topOuter.x, y: basicLandmarks.topOuter.y, z: basicLandmarks.topOuter.z || 0 } : null);
        const bottomOuterAvg = this.calculateAveragePoint(bottomOuterPoints) || 
                              (basicLandmarks?.bottomOuter ? { x: basicLandmarks.bottomOuter.x, y: basicLandmarks.bottomOuter.y, z: basicLandmarks.bottomOuter.z || 0 } : null);
        const leftCorner = cornerPoints.find(p => p.x < 0.5) || 
                          (basicLandmarks?.leftEnd ? { x: basicLandmarks.leftEnd.x, y: basicLandmarks.leftEnd.y, z: basicLandmarks.leftEnd.z || 0 } : null);
        const rightCorner = cornerPoints.find(p => p.x >= 0.5) || 
                           (basicLandmarks?.rightEnd ? { x: basicLandmarks.rightEnd.x, y: basicLandmarks.rightEnd.y, z: basicLandmarks.rightEnd.z || 0 } : null);

        // 計測値を計算
        const openness = (topOuterAvg && bottomOuterAvg) ? 
            this.distance(topOuterAvg, bottomOuterAvg) : 
            this.calculateOpenness(basicLandmarks);
        
        const width = (leftCorner && rightCorner) ? 
            this.distance(leftCorner, rightCorner) : 
            this.calculateWidth(basicLandmarks);

        const area = this.calculateArea({ 
            topOuter: topOuterAvg, 
            bottomOuter: bottomOuterAvg, 
            leftEnd: leftCorner, 
            rightEnd: rightCorner 
        });
        
        const aspectRatio = width / (openness + 0.0001);

        return {
            openness,
            width,
            area,
            aspectRatio
        };
    }

    /**
     * ランドマークデータから全計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク（オプション、より正確な計測に使用）
     * @returns {Object} 計測値
     */
    static calculateAllMetrics(mouthLandmarks, contourLandmarks = null) {
        // 輪郭ランドマークが提供されている場合は、それを使用
        if (contourLandmarks && contourLandmarks.length > 0) {
            return this.calculateMetricsFromContour(contourLandmarks, mouthLandmarks);
        }

        // フォールバック: 基本ランドマークを使用
        return {
            openness: this.calculateOpenness(mouthLandmarks),
            width: this.calculateWidth(mouthLandmarks),
            area: this.calculateArea(mouthLandmarks),
            aspectRatio: this.calculateAspectRatio(mouthLandmarks)
        };
    }
}

