/**
 * DataProcessor - データ処理クラス
 * ランドマークデータから計測値を計算します
 */

export class DataProcessor {
    /**
     * ランドマーク配列のバリデーション
     * @private
     * @param {Array} contourLandmarks - ランドマーク配列
     * @returns {boolean} 有効な場合true
     */
    static _validateContourLandmarks(contourLandmarks) {
        return contourLandmarks && contourLandmarks.length > 0;
    }

    /**
     * ランドマークをフィルタリングしてポイント配列を取得
     * @private
     * @param {Array} contourLandmarks - ランドマーク配列
     * @param {Array} indices - フィルタリングするインデックス配列
     * @returns {Array} ポイント配列
     */
    static _filterLandmarksByIndices(contourLandmarks, indices) {
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return [];
        }
        return contourLandmarks
            .filter(lm => indices.includes(lm.index))
            .map(lm => lm.point || lm);
    }

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
     * 口の輪郭ランドマークから計測値を計算（DEFAULT_LANDMARKSから抽出）
     * より多くの点を使用することで、より正確な計測が可能
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @param {Object} basicLandmarks - 基本ランドマーク（左端、右端等）
     * @returns {Object} 計測値
     */
    static calculateMetricsFromContour(contourLandmarks, basicLandmarks) {
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return this.calculateAllMetrics(basicLandmarks);
        }

        const topOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [12, 13, 14, 15, 16, 17, 18]);
        const bottomOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [14, 15, 16, 17, 18]);
        const topInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [78, 79, 80, 81, 82]);
        const bottomInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [308, 309, 310, 311, 312]);
        const cornerPoints = this._filterLandmarksByIndices(contourLandmarks, [61, 291]);

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
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return 0;
        }

        const topOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [12, 13, 14, 15, 16, 17, 18]);
        const topInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [78, 79, 80, 81, 82]);

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
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return 0;
        }

        const bottomOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [14, 15, 16, 17, 18]);
        const bottomInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [308, 309, 310, 311, 312]);

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
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return { upper: 0, lower: 0, average: 0 };
        }

        const topOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [12, 13, 14, 15, 16, 17, 18]);
        const bottomOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [14, 15, 16, 17, 18]);

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
        if (!this._validateContourLandmarks(contourLandmarks) || area === 0) {
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
        if (!this._validateContourLandmarks(contourLandmarks)) {
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
        if (!this._validateContourLandmarks(contourLandmarks)) {
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
        if (!this._validateContourLandmarks(contourLandmarks)) {
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
     * 口の楕円度を計算
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 楕円度（長軸/短軸比）
     */
    static calculateMouthEllipticity(contourLandmarks) {
        if (!this._validateContourLandmarks(contourLandmarks) || contourLandmarks.length < 3) {
            return 1.0;
        }

        const points = contourLandmarks.map(lm => lm.point || lm);
        const center = this.calculateAveragePoint(points);
        if (!center) return 1.0;

        let maxDist = 0;
        let minDist = Infinity;
        let maxDir = { x: 0, y: 0 };
        let minDir = { x: 0, y: 0 };

        for (let i = 0; i < points.length; i++) {
            const dx = points[i].x - center.x;
            const dy = points[i].y - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > maxDist) {
                maxDist = dist;
                maxDir = { x: dx / dist, y: dy / dist };
            }
            if (dist < minDist && dist > 0) {
                minDist = dist;
                minDir = { x: dx / dist, y: dy / dist };
            }
        }

        if (minDist === 0 || maxDist === 0) return 1.0;
        return maxDist / minDist;
    }

    /**
     * 口の左右対称性を計算
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 対称性（0-1、1が完全対称）
     */
    static calculateMouthSymmetry(contourLandmarks) {
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return 0;
        }

        const leftCorner = contourLandmarks.find(lm => lm.index === 61);
        const rightCorner = contourLandmarks.find(lm => lm.index === 291);
        if (!leftCorner || !rightCorner) return 0;

        const centerX = (leftCorner.point.x + rightCorner.point.x) / 2;
        const centerY = (leftCorner.point.y + rightCorner.point.y) / 2;

        const leftPoints = contourLandmarks.filter(lm => (lm.point || lm).x < centerX);
        const rightPoints = contourLandmarks.filter(lm => (lm.point || lm).x > centerX);

        if (leftPoints.length === 0 || rightPoints.length === 0) return 0;

        let totalDiff = 0;
        let count = 0;

        for (const leftPoint of leftPoints) {
            const lp = leftPoint.point || leftPoint;
            const mirrorX = 2 * centerX - lp.x;
            const mirrorY = lp.y;

            let minDist = Infinity;
            for (const rightPoint of rightPoints) {
                const rp = rightPoint.point || rightPoint;
                const dist = Math.sqrt(
                    Math.pow(rp.x - mirrorX, 2) + Math.pow(rp.y - mirrorY, 2)
                );
                minDist = Math.min(minDist, dist);
            }

            totalDiff += minDist;
            count++;
        }

        return count > 0 ? Math.max(0, 1.0 - (totalDiff / count) * 10) : 0;
    }

    /**
     * 唇の突出度を計算（Z軸方向）
     * @param {Array} allMouthLandmarksExtended - 拡張口ランドマーク配列
     * @returns {number} 突出度
     */
    static calculateLipProtrusion(allMouthLandmarksExtended) {
        if (!allMouthLandmarksExtended || allMouthLandmarksExtended.length === 0) {
            return 0;
        }

        const outerPoints = allMouthLandmarksExtended
            .filter(lm => [12, 13, 14, 15, 16, 17, 18].includes(lm.index))
            .map(lm => lm.point || lm);

        if (outerPoints.length === 0) return 0;

        const avgZ = outerPoints.reduce((sum, p) => sum + (p.z || 0), 0) / outerPoints.length;
        return Math.max(0, avgZ);
    }

    /**
     * 上唇の高さを計算
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 上唇の高さ
     */
    static calculateUpperLipHeight(contourLandmarks) {
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return 0;
        }

        const topOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [12, 13, 14, 15, 16, 17, 18]);
        const topInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [78, 79, 80, 81, 82]);

        if (topOuterPoints.length === 0 || topInnerPoints.length === 0) return 0;

        const outerAvgY = topOuterPoints.reduce((sum, p) => sum + p.y, 0) / topOuterPoints.length;
        const innerAvgY = topInnerPoints.reduce((sum, p) => sum + p.y, 0) / topInnerPoints.length;

        return Math.abs(outerAvgY - innerAvgY);
    }

    /**
     * 下唇の高さを計算
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @returns {number} 下唇の高さ
     */
    static calculateLowerLipHeight(contourLandmarks) {
        if (!this._validateContourLandmarks(contourLandmarks)) {
            return 0;
        }

        const bottomOuterPoints = this._filterLandmarksByIndices(contourLandmarks, [14, 15, 16, 17, 18]);
        const bottomInnerPoints = this._filterLandmarksByIndices(contourLandmarks, [308, 309, 310, 311, 312]);

        if (bottomOuterPoints.length === 0 || bottomInnerPoints.length === 0) return 0;

        const outerAvgY = bottomOuterPoints.reduce((sum, p) => sum + p.y, 0) / bottomOuterPoints.length;
        const innerAvgY = bottomInnerPoints.reduce((sum, p) => sum + p.y, 0) / bottomInnerPoints.length;

        return Math.abs(outerAvgY - innerAvgY);
    }

    /**
     * 口の開き方の形状を計算
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列
     * @param {number} area - 口の面積
     * @returns {string} 'circular', 'elliptical', 'linear'
     */
    static calculateMouthOpeningShape(contourLandmarks, area = 0) {
        if (!this._validateContourLandmarks(contourLandmarks) || contourLandmarks.length < 3) {
            return 'linear';
        }

        const circularity = area > 0 ? this.calculateCircularity(area, contourLandmarks) : 0;
        const ellipticity = this.calculateMouthEllipticity(contourLandmarks);

        if (circularity > 0.7) return 'circular';
        if (ellipticity > 1.5) return 'elliptical';
        return 'linear';
    }

    /**
     * DEFAULT_LANDMARKSから計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク配列（DEFAULT_LANDMARKSから抽出）
     * @param {Array} allMouthLandmarksExtended - 拡張口ランドマーク配列（DEFAULT_LANDMARKSから抽出）
     * @param {Array} allFaceLandmarks - 顔ランドマーク配列（DEFAULT_LANDMARKSから抽出）
     * @returns {Object} 計測値（拡張特徴量を含む）
     */
    static calculateMetricsFromDefaultLandmarks(mouthLandmarks, contourLandmarks = null, allMouthLandmarksExtended = null, allFaceLandmarks = null) {
        const baseMetrics = this.calculateAllMetrics(mouthLandmarks, contourLandmarks, allMouthLandmarksExtended, allFaceLandmarks, false);

        if (contourLandmarks && contourLandmarks.length > 0) {
            baseMetrics.cornerMovement = this.calculateCornerMovement(contourLandmarks);
            baseMetrics.cheekMovement = this.calculateCheekMovement(contourLandmarks);
            baseMetrics.jawMovement = this.calculateJawMovement(contourLandmarks);
            baseMetrics.ellipticity = this.calculateMouthEllipticity(contourLandmarks);
            baseMetrics.symmetry = this.calculateMouthSymmetry(contourLandmarks);
            baseMetrics.upperLipHeight = this.calculateUpperLipHeight(contourLandmarks);
            baseMetrics.lowerLipHeight = this.calculateLowerLipHeight(contourLandmarks);
            baseMetrics.openingShape = this.calculateMouthOpeningShape(contourLandmarks, baseMetrics.area);
        } else {
            baseMetrics.cornerMovement = { left: 0, right: 0, average: 0 };
            baseMetrics.cheekMovement = { left: 0, right: 0, average: 0 };
            baseMetrics.jawMovement = 0;
            baseMetrics.ellipticity = 1.0;
            baseMetrics.symmetry = 0;
            baseMetrics.upperLipHeight = 0;
            baseMetrics.lowerLipHeight = 0;
            baseMetrics.openingShape = 'linear';
        }

        if (allMouthLandmarksExtended && allMouthLandmarksExtended.length > 0) {
            baseMetrics.lipProtrusion = this.calculateLipProtrusion(allMouthLandmarksExtended);
        } else {
            baseMetrics.lipProtrusion = 0;
        }

        const scale = this.calculateFaceScale(allFaceLandmarks);
        return this._applyScaleNormalization(baseMetrics, scale);
    }

    /**
     * ランドマークデータから全計測値を計算
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks - 口の輪郭ランドマーク（オプション、より正確な計測に使用）
     * @param {Array} allMouthLandmarksExtended - 拡張口ランドマーク配列（オプション、lipProtrusion計算用）
     * @returns {Object} 計測値
     */
    static calculateAllMetrics(mouthLandmarks, contourLandmarks = null, allMouthLandmarksExtended = null, allFaceLandmarks = null, applyNormalization = true) {
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

        if (allMouthLandmarksExtended && allMouthLandmarksExtended.length > 0) {
            metrics.lipProtrusion = this.calculateLipProtrusion(allMouthLandmarksExtended);
        } else {
            metrics.lipProtrusion = 0;
        }

        const scale = this.calculateFaceScale(allFaceLandmarks);
        return applyNormalization ? this._applyScaleNormalization(metrics, scale) : { ...metrics, scale };
    }

    /**
     * 顔スケールを計算（距離正規化用）
     * @param {Array|null} allFaceLandmarks - 顔ランドマーク一覧
     * @returns {number} スケール距離
     */
    static calculateFaceScale(allFaceLandmarks) {
        if (!allFaceLandmarks || allFaceLandmarks.length === 0) {
            return 1;
        }
        const getPoint = (index) => allFaceLandmarks.find(lm => lm.index === index)?.point || allFaceLandmarks.find(lm => lm.index === index);
        const leftEyeOuter = getPoint(33);
        const rightEyeOuter = getPoint(263);
        const noseBridge = getPoint(1);
        const chin = getPoint(152);

        const eyeDistance = (leftEyeOuter && rightEyeOuter) ? this.distance(leftEyeOuter, rightEyeOuter) : 0;
        const faceHeight = (noseBridge && chin) ? this.distance(noseBridge, chin) : 0;

        const primary = eyeDistance || faceHeight || 1;
        return primary || 1;
    }

    /**
     * スケール正規化を適用
     * @param {Object} metrics - 未正規化の計測値
     * @param {number} scale - スケール距離
     * @returns {Object} 正規化済み計測値
     */
    static _applyScaleNormalization(metrics, scale) {
        const safeScale = scale && scale > 0 ? scale : 1;
        const scaleSq = safeScale * safeScale;

        const normalizeDistance = (value) => typeof value === 'number' ? value / safeScale : value;
        const normalizeArea = (value) => typeof value === 'number' ? value / scaleSq : value;

        const normalized = { ...metrics };
        normalized.scale = safeScale;
        normalized.openness = normalizeDistance(metrics.openness);
        normalized.width = normalizeDistance(metrics.width);
        normalized.area = normalizeArea(metrics.area);

        normalized.upperLipThickness = normalizeDistance(metrics.upperLipThickness);
        normalized.lowerLipThickness = normalizeDistance(metrics.lowerLipThickness);
        normalized.cornerMovement = metrics.cornerMovement ? {
            left: normalizeDistance(metrics.cornerMovement.left),
            right: normalizeDistance(metrics.cornerMovement.right),
            average: normalizeDistance(metrics.cornerMovement.average)
        } : metrics.cornerMovement;
        normalized.cheekMovement = metrics.cheekMovement ? {
            left: normalizeDistance(metrics.cheekMovement.left),
            right: normalizeDistance(metrics.cheekMovement.right),
            average: normalizeDistance(metrics.cheekMovement.average)
        } : metrics.cheekMovement;
        normalized.jawMovement = normalizeDistance(metrics.jawMovement);
        normalized.upperLipHeight = normalizeDistance(metrics.upperLipHeight);
        normalized.lowerLipHeight = normalizeDistance(metrics.lowerLipHeight);
        normalized.lipProtrusion = normalizeDistance(metrics.lipProtrusion);

        return normalized;
    }
}
