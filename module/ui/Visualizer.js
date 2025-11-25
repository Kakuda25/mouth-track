/**
 * Visualizer - Canvas描画クラス（最小限の構成）
 * ランドマークとトラッキング情報を描画します
 */

export class Visualizer {
    constructor(canvasElement, videoElement) {
        this.canvas = canvasElement;
        this.videoElement = videoElement;
        this.ctx = this.canvas.getContext('2d');
        this.showLandmarks = true;

        // Canvasサイズをビデオに合わせる
        this.resize();
        if (this.videoElement) {
            this.videoElement.addEventListener('loadedmetadata', () => this.resize());
        }
    }

    /**
     * Canvasサイズをビデオに合わせる
     */
    resize() {
        if (this.videoElement && this.canvas) {
            this.canvas.width = this.videoElement.videoWidth || this.videoElement.clientWidth;
            this.canvas.height = this.videoElement.videoHeight || this.videoElement.clientHeight;
        }
    }

    /**
     * 口の領域を計算（8点を使用）
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @returns {Object} 口の領域 {x, y, width, height}
     */
    calculateMouthRegion(mouthLandmarks) {
        if (!mouthLandmarks) return null;

        const videoWidth = this.videoElement.videoWidth || this.canvas.width;
        const videoHeight = this.videoElement.videoHeight || this.canvas.height;

        // すべてのランドマークを使用（8点）
        const points = [
            mouthLandmarks.leftEnd,
            mouthLandmarks.rightEnd,
            mouthLandmarks.topOuter,
            mouthLandmarks.bottomOuter,
            mouthLandmarks.topLeft,
            mouthLandmarks.topRight,
            mouthLandmarks.bottomLeft,
            mouthLandmarks.bottomRight
        ].filter(p => p);

        if (points.length === 0) return null;

        const canvasPoints = points.map(p => ({
            x: p.x * videoWidth,
            y: p.y * videoHeight
        }));

        const minX = Math.min(...canvasPoints.map(p => p.x));
        const maxX = Math.max(...canvasPoints.map(p => p.x));
        const minY = Math.min(...canvasPoints.map(p => p.y));
        const maxY = Math.max(...canvasPoints.map(p => p.y));

        const margin = Math.max((maxX - minX) * 0.5, (maxY - minY) * 0.5);
        return {
            x: minX - margin,
            y: minY - margin,
            width: (maxX - minX) + margin * 2,
            height: (maxY - minY) + margin * 2
        };
    }

    /**
     * ランドマークを描画
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} allLandmarks - 口周辺の全ランドマーク（オプション）
     */
    drawLandmarks(mouthLandmarks, allLandmarks = null) {
        if (!mouthLandmarks) {
            this.clear();
            return;
        }

        const ctx = this.ctx;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const videoWidth = this.videoElement.videoWidth || canvasWidth;
        const videoHeight = this.videoElement.videoHeight || canvasHeight;

        const mouthRegion = this.calculateMouthRegion(mouthLandmarks);
        if (!mouthRegion) {
            this.clear();
            return;
        }

        // Canvasをクリア
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (!this.showLandmarks) {
            return;
        }

        // 座標変換
        const scaleX = canvasWidth / mouthRegion.width;
        const scaleY = canvasHeight / mouthRegion.height;
        const scale = Math.min(scaleX, scaleY);
        const drawWidth = mouthRegion.width * scale;
        const drawHeight = mouthRegion.height * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = (canvasHeight - drawHeight) / 2;

        const toCanvas = (point) => {
            const videoX = point.x * videoWidth;
            const videoY = point.y * videoHeight;
            const relativeX = videoX - mouthRegion.x;
            const relativeY = videoY - mouthRegion.y;
            return {
                x: drawX + (relativeX * scale),
                y: drawY + (relativeY * scale)
            };
        };

        // 全ランドマークを描画（6点のみ）
        // allLandmarksが存在する場合はそれを使用、ない場合はmouthLandmarksから直接描画
        const landmarksToDraw = (allLandmarks && allLandmarks.length > 0) ? allLandmarks : null;

        if (landmarksToDraw) {
            // すべての点を描画（色分け）
            landmarksToDraw.forEach((item) => {
                if (item && item.point) {
                    const pos = toCanvas(item.point);
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);

                    // インデックスによって色を変える
                    if (item.index === 37 || item.index === 267 || item.index === 84 || item.index === 314) {
                        // 黄色: 上下左右の外側ポイント
                        ctx.fillStyle = '#ffff00';
                    } else {
                        // シアン色: その他のポイント
                        ctx.fillStyle = '#00ffff';
                    }

                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });

            // 個別の線分を描画
            const connections = [
                [61, 13],   // 左端 → 上中央
                [291, 13],  // 右端 → 上中央
                [61, 14],   // 左端 → 下中央
                [291, 14],  // 右端 → 下中央
                [314, 84],  // 下右 → 下左
                [37, 267],  // 上左 → 上右
                [61, 37],   // 左端 → 上左
                [61, 84],   // 左端 → 下左
                [291, 267], // 右端 → 上右
                [291, 314]  // 右端 → 下右
            ];

            connections.forEach(([idx1, idx2]) => {
                const point1 = landmarksToDraw.find(item => item.index === idx1);
                const point2 = landmarksToDraw.find(item => item.index === idx2);

                if (point1 && point2 && point1.point && point2.point) {
                    ctx.beginPath();
                    const pos1 = toCanvas(point1.point);
                    const pos2 = toCanvas(point2.point);
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            });


        }

        // フォールバック: mouthLandmarksから直接描画（allLandmarksがない場合）
        if (!landmarksToDraw) {
            // フォールバック: 8点を描画（mouthLandmarksから直接）
            const points = [
                { key: 'leftEnd', color: '#00ffff', label: '左端' },
                { key: 'rightEnd', color: '#00ffff', label: '右端' },
                { key: 'topOuter', color: '#00ffff', label: '上中央' },
                { key: 'bottomOuter', color: '#00ffff', label: '下中央' },
                { key: 'topLeft', color: '#ffff00', label: '上左' },
                { key: 'topRight', color: '#ffff00', label: '上右' },
                { key: 'bottomLeft', color: '#ffff00', label: '下左' },
                { key: 'bottomRight', color: '#ffff00', label: '下右' }
            ];

            // すべての点を描画
            points.forEach(({ key, color, label }) => {
                const landmark = mouthLandmarks[key];
                if (landmark) {
                    const pos = toCanvas(landmark);
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, 5, 0, 2 * Math.PI);
                    ctx.fillStyle = color;
                    ctx.fill();
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            });

            // 個別の線分を描画
            const connections = [
                ['leftEnd', 'topOuter'],      // 左端 → 上中央
                ['rightEnd', 'topOuter'],     // 右端 → 上中央
                ['leftEnd', 'bottomOuter'],   // 左端 → 下中央
                ['rightEnd', 'bottomOuter'],  // 右端 → 下中央
                ['bottomRight', 'bottomLeft'], // 下右 → 下左
                ['topLeft', 'topRight'],      // 上左 → 上右
                ['leftEnd', 'topLeft'],       // 左端 → 上左
                ['leftEnd', 'bottomLeft'],    // 左端 → 下左
                ['rightEnd', 'topRight'],     // 右端 → 上右
                ['rightEnd', 'bottomRight']   // 右端 → 下右
            ];

            connections.forEach(([key1, key2]) => {
                const point1 = mouthLandmarks[key1];
                const point2 = mouthLandmarks[key2];

                if (point1 && point2) {
                    ctx.beginPath();
                    const pos1 = toCanvas(point1);
                    const pos2 = toCanvas(point2);
                    ctx.moveTo(pos1.x, pos1.y);
                    ctx.lineTo(pos2.x, pos2.y);
                    ctx.strokeStyle = '#00ffff';
                    ctx.lineWidth = 3;
                    ctx.stroke();
                }
            });


        }
    }

    /**
     * Canvasをクリア
     */
    clear() {
        const ctx = this.ctx;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * 表示設定を更新
     * @param {Object} settings - 設定オブジェクト
     */
    updateSettings(settings) {
        if (settings.showLandmarks !== undefined) {
            this.showLandmarks = settings.showLandmarks;
        }
    }
}

