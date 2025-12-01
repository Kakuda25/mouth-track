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
     * 口の開き具合を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 開き具合
     */
    static calculateOpenness(mouthLandmarks) {
        if (!mouthLandmarks || !mouthLandmarks.topOuter || !mouthLandmarks.bottomOuter) {
            return 0;
        }
        return this.distance(mouthLandmarks.topOuter, mouthLandmarks.bottomOuter);
    }

    /**
     * 口の幅を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 幅
     */
    static calculateWidth(mouthLandmarks) {
        if (!mouthLandmarks || !mouthLandmarks.leftEnd || !mouthLandmarks.rightEnd) {
            return 0;
        }
        return this.distance(mouthLandmarks.leftEnd, mouthLandmarks.rightEnd);
    }

    /**
     * 口の面積を推定
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {number} 面積
     */
    static calculateArea(mouthLandmarks) {
        const width = this.calculateWidth(mouthLandmarks);
        const openness = this.calculateOpenness(mouthLandmarks);
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
            return this.calculateAllMetrics(basicLandmarks);
        }

        const topOuterPoints = contourLandmarks.filter(lm =>
            [12, 13, 14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const bottomOuterPoints = contourLandmarks.filter(lm =>
            [14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const topInnerPoints = contourLandmarks.filter(lm =>
            [78, 79, 80, 81, 82].includes(lm.index)
        ).map(lm => lm.point || lm);

        const bottomInnerPoints = contourLandmarks.filter(lm =>
            [308, 309, 310, 311, 312].includes(lm.index)
        ).map(lm => lm.point || lm);

        const cornerPoints = contourLandmarks.filter(lm =>
            [61, 291].includes(lm.index)
        ).map(lm => lm.point || lm);

        const topOuterAvg = this.calculateAveragePoint(topOuterPoints) ||
            (basicLandmarks?.topOuter ? { x: basicLandmarks.topOuter.x, y: basicLandmarks.topOuter.y, z: basicLandmarks.topOuter.z || 0 } : null);
        const bottomOuterAvg = this.calculateAveragePoint(bottomOuterPoints) ||
            (basicLandmarks?.bottomOuter ? { x: basicLandmarks.bottomOuter.x, y: basicLandmarks.bottomOuter.y, z: basicLandmarks.bottomOuter.z || 0 } : null);
        const leftCorner = cornerPoints.find(p => p.x < 0.5) ||
            (basicLandmarks?.leftEnd ? { x: basicLandmarks.leftEnd.x, y: basicLandmarks.leftEnd.y, z: basicLandmarks.leftEnd.z || 0 } : null);
        const rightCorner = cornerPoints.find(p => p.x >= 0.5) ||
            (basicLandmarks?.rightEnd ? { x: basicLandmarks.rightEnd.x, y: basicLandmarks.rightEnd.y, z: basicLandmarks.rightEnd.z || 0 } : null);

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
     * 上唇の厚さを計算
     * 上唇外側と内側の平均距離
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 上唇の厚さ
     */
    static calculateUpperLipThickness(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return 0;
        }

        const topOuterPoints = contourLandmarks.filter(lm =>
            [12, 13, 14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const topInnerPoints = contourLandmarks.filter(lm =>
            [78, 79, 80, 81, 82].includes(lm.index)
        ).map(lm => lm.point || lm);

        if (topOuterPoints.length === 0 || topInnerPoints.length === 0) {
            return 0;
        }

        const distances = topOuterPoints.map(outerPoint => {
            const minDistance = Math.min(...topInnerPoints.map(innerPoint =>
                this.distance(outerPoint, innerPoint)
            ));
            return minDistance;
        });

        return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    }

    /**
     * 下唇の厚さを計算
     * 下唇外側と内側の平均距離
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 下唇の厚さ
     */
    static calculateLowerLipThickness(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return 0;
        }

        const bottomOuterPoints = contourLandmarks.filter(lm =>
            [14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const bottomInnerPoints = contourLandmarks.filter(lm =>
            [308, 309, 310, 311, 312].includes(lm.index)
        ).map(lm => lm.point || lm);

        if (bottomOuterPoints.length === 0 || bottomInnerPoints.length === 0) {
            return 0;
        }

        const distances = bottomOuterPoints.map(outerPoint => {
            const minDistance = Math.min(...bottomInnerPoints.map(innerPoint =>
                this.distance(outerPoint, innerPoint)
            ));
            return minDistance;
        });

        return distances.reduce((sum, d) => sum + d, 0) / distances.length;
    }

    /**
     * 口角の角度を計算
     * 口角が上がっているか下がっているかを示す角度（ラジアン）
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {Object} 左右の口角の角度 {left, right, average}
     */
    static calculateMouthCornerAngle(mouthLandmarks, contourLandmarks) {
        if (!mouthLandmarks || !mouthLandmarks.leftEnd || !mouthLandmarks.rightEnd) {
            return { left: 0, right: 0, average: 0 };
        }

        const centerY = mouthLandmarks.topOuter && mouthLandmarks.bottomOuter
            ? (mouthLandmarks.topOuter.y + mouthLandmarks.bottomOuter.y) / 2
            : 0.5;

        const leftAngle = Math.atan2(
            centerY - mouthLandmarks.leftEnd.y,
            mouthLandmarks.leftEnd.x - (mouthLandmarks.topOuter?.x || 0.5)
        );

        const rightAngle = Math.atan2(
            centerY - mouthLandmarks.rightEnd.y,
            (mouthLandmarks.topOuter?.x || 0.5) - mouthLandmarks.rightEnd.x
        );

        return {
            left: leftAngle,
            right: rightAngle,
            average: (leftAngle + rightAngle) / 2
        };
    }

    /**
     * 唇の曲率を計算
     * 上唇と下唇の曲がり具合を測定
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {Object} 上唇と下唇の曲率 {upper, lower, average}
     */
    static calculateLipCurvature(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return { upper: 0, lower: 0, average: 0 };
        }

        const topOuterPoints = contourLandmarks.filter(lm =>
            [12, 13, 14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const bottomOuterPoints = contourLandmarks.filter(lm =>
            [14, 15, 16, 17, 18].includes(lm.index)
        ).map(lm => lm.point || lm);

        const calculateCurvature = (points) => {
            if (points.length < 3) return 0;

            const start = points[0];
            const end = points[points.length - 1];
            const lineLength = this.distance(start, end);

            if (lineLength === 0) return 0;

            let maxDistance = 0;
            for (let i = 1; i < points.length - 1; i++) {
                const point = points[i];
                const distance = Math.abs(
                    (end.y - start.y) * point.x -
                    (end.x - start.x) * point.y +
                    end.x * start.y - end.y * start.x
                ) / lineLength;
                maxDistance = Math.max(maxDistance, distance);
            }

            return maxDistance;
        };

        const upperCurvature = calculateCurvature(topOuterPoints);
        const lowerCurvature = calculateCurvature(bottomOuterPoints);

        return {
            upper: upperCurvature,
            lower: lowerCurvature,
            average: (upperCurvature + lowerCurvature) / 2
        };
    }

    /**
     * 口の円形度を計算
     * 口の形状がどれだけ円に近いかを測定（0-1、1が完全な円）
     * @param {number} area - 口の面積
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 円形度
     */
    static calculateCircularity(area, contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0 || area === 0) {
            return 0;
        }

        // 輪郭の周長を計算
        let perimeter = 0;
        const points = contourLandmarks.map(lm => lm.point || lm);

        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            perimeter += this.distance(current, next);
        }

        if (perimeter === 0) return 0;

        const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
        return Math.min(Math.max(circularity, 0), 1);
    }

    /**
     * 口の中心を計算（補助メソッド）
     * @private
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {Object|null} 口の中心座標 {x, y, z}
     */
    static _calculateMouthCenter(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return null;
        }

        const corners = contourLandmarks.filter(lm => [61, 291].includes(lm.index));
        if (corners.length === 0) {
            return null;
        }

        return this.calculateAveragePoint(corners.map(lm => lm.point));
    }

    /**
     * 口角の動きを計測（34点版で追加）
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列（34点）
     * @returns {Object} 口角の動き {left, right, average}
     */
    static calculateCornerMovement(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return { left: 0, right: 0, average: 0 };
        }

        // 左口角とその周辺
        const leftCorner = contourLandmarks.find(lm => lm.index === 61);
        const leftCornerAdjacent = contourLandmarks.filter(lm => [39, 40, 41].includes(lm.index));
        const rightCorner = contourLandmarks.find(lm => lm.index === 291);
        const rightCornerAdjacent = contourLandmarks.filter(lm => [269, 270, 271].includes(lm.index));

        const leftMovement = leftCorner && leftCornerAdjacent.length > 0
            ? leftCornerAdjacent.reduce((sum, lm) => sum + this.distance(leftCorner.point, lm.point), 0) / leftCornerAdjacent.length
            : 0;
        
        const rightMovement = rightCorner && rightCornerAdjacent.length > 0
            ? rightCornerAdjacent.reduce((sum, lm) => sum + this.distance(rightCorner.point, lm.point), 0) / rightCornerAdjacent.length
            : 0;

        return {
            left: leftMovement,
            right: rightMovement,
            average: (leftMovement + rightMovement) / 2
        };
    }

    /**
     * 頬の動きを計測（34点版で追加）
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列（34点）
     * @returns {Object} 頬の動き {left, right, average}
     */
    static calculateCheekMovement(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return { left: 0, right: 0, average: 0 };
        }

        const leftCheek = contourLandmarks.filter(lm => [116, 117].includes(lm.index));
        const rightCheek = contourLandmarks.filter(lm => [345, 346].includes(lm.index));

        // 頬の点の平均位置を計算
        const leftAvg = leftCheek.length > 0
            ? this.calculateAveragePoint(leftCheek.map(lm => lm.point))
            : null;
        const rightAvg = rightCheek.length > 0
            ? this.calculateAveragePoint(rightCheek.map(lm => lm.point))
            : null;

        const mouthCenter = this._calculateMouthCenter(contourLandmarks);
        
        const leftMovement = leftAvg && mouthCenter
            ? this.distance(leftAvg, mouthCenter)
            : 0;
        const rightMovement = rightAvg && mouthCenter
            ? this.distance(rightAvg, mouthCenter)
            : 0;

        return {
            left: leftMovement,
            right: rightMovement,
            average: (leftMovement + rightMovement) / 2
        };
    }

    /**
     * 顎の動きを計測（34点版で追加）
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列（34点）
     * @returns {number} 顎の動き（口の中心からの距離）
     */
    static calculateJawMovement(contourLandmarks) {
        if (!contourLandmarks || contourLandmarks.length === 0) {
            return 0;
        }

        const jawPoints = contourLandmarks.filter(lm => [175, 176, 172, 397].includes(lm.index));
        
        if (jawPoints.length === 0) {
            return 0;
        }

        const jawAvg = this.calculateAveragePoint(jawPoints.map(lm => lm.point));
        const mouthCenter = this._calculateMouthCenter(contourLandmarks);

        return jawAvg && mouthCenter
            ? this.distance(jawAvg, mouthCenter)
            : 0;
    }

    /**
     * 34点版の計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列（34点）
     * @returns {Object} 計測値（拡張特徴量を含む）
     */
    static calculateMetricsFromContour34(mouthLandmarks, contourLandmarks) {
        const baseMetrics = this.calculateAllMetrics(mouthLandmarks, contourLandmarks);

        if (contourLandmarks && contourLandmarks.length >= 34) {
            baseMetrics.cornerMovement = this.calculateCornerMovement(contourLandmarks);
            baseMetrics.cheekMovement = this.calculateCheekMovement(contourLandmarks);
            baseMetrics.jawMovement = this.calculateJawMovement(contourLandmarks);
        } else {
            baseMetrics.cornerMovement = { left: 0, right: 0, average: 0 };
            baseMetrics.cheekMovement = { left: 0, right: 0, average: 0 };
            baseMetrics.jawMovement = 0;
        }

        return baseMetrics;
    }

    /**
     * ランドマークデータから全計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク（オプション、より正確な計測に使用）
     * @returns {Object} 計測値
     */
    static calculateAllMetrics(mouthLandmarks, contourLandmarks = null) {
        let metrics;

        if (contourLandmarks && contourLandmarks.length > 0) {
            metrics = this.calculateMetricsFromContour(contourLandmarks, mouthLandmarks);
        } else {
            metrics = {
                openness: this.calculateOpenness(mouthLandmarks),
                width: this.calculateWidth(mouthLandmarks),
                area: this.calculateArea(mouthLandmarks),
                aspectRatio: this.calculateAspectRatio(mouthLandmarks)
            };
        }

        if (contourLandmarks && contourLandmarks.length > 0) {
            metrics.upperLipThickness = this.calculateUpperLipThickness(contourLandmarks);
            metrics.lowerLipThickness = this.calculateLowerLipThickness(contourLandmarks);
            metrics.mouthCornerAngle = this.calculateMouthCornerAngle(mouthLandmarks, contourLandmarks);
            metrics.lipCurvature = this.calculateLipCurvature(contourLandmarks);
            metrics.circularity = this.calculateCircularity(metrics.area, contourLandmarks);
        } else {
            metrics.upperLipThickness = 0;
            metrics.lowerLipThickness = 0;
            metrics.mouthCornerAngle = { left: 0, right: 0, average: 0 };
            metrics.lipCurvature = { upper: 0, lower: 0, average: 0 };
            metrics.circularity = 0;
        }

        return metrics;
    }
}

