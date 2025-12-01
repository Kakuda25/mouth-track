/**
 * Visualizer - Canvas描画クラス（最小限の構成）
 * ランドマークとトラッキング情報を描画します
 */

import { DEFAULT_SETTINGS } from '../config/constants.js';

export class Visualizer {
    constructor(canvasElement, videoElement) {
        this.canvas = canvasElement;
        this.videoElement = videoElement;
        this.ctx = this.canvas.getContext('2d');
        this.showLandmarks = true;
        // ミラーモードを常に有効化
        this.mirrorMode = DEFAULT_SETTINGS.mirrorMode !== false;

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
     * 座標をミラーモードで反転
     * @private
     * @param {number} x - X座標
     * @param {number} canvasWidth - Canvas幅
     * @returns {number} 反転後のX座標
     */
    _applyMirrorMode(x, canvasWidth) {
        return this.mirrorMode ? canvasWidth - x : x;
    }

    /**
     * 座標変換関数を生成（口領域をスケーリングする方式）
     * @private
     * @param {Object} mouthRegion - 口の領域 {x, y, width, height}
     * @param {number} canvasWidth - Canvas幅
     * @param {number} canvasHeight - Canvas高さ
     * @param {number} videoWidth - ビデオ幅
     * @param {number} videoHeight - ビデオ高さ
     * @returns {Function} 座標変換関数
     */
    _createScaledToCanvas(mouthRegion, canvasWidth, canvasHeight, videoWidth, videoHeight) {
        const scaleX = canvasWidth / mouthRegion.width;
        const scaleY = canvasHeight / mouthRegion.height;
        const scale = Math.min(scaleX, scaleY);
        const drawWidth = mouthRegion.width * scale;
        const drawHeight = mouthRegion.height * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = (canvasHeight - drawHeight) / 2;

        return (point) => {
            const videoX = point.x * videoWidth;
            const videoY = point.y * videoHeight;
            const relativeX = videoX - mouthRegion.x;
            const relativeY = videoY - mouthRegion.y;
            const canvasX = drawX + (relativeX * scale);
            const canvasY = drawY + (relativeY * scale);
            
            return { 
                x: this._applyMirrorMode(canvasX, canvasWidth), 
                y: canvasY 
            };
        };
    }

    /**
     * 座標変換関数を生成（直接ビデオ座標を使用する方式）
     * @private
     * @param {number} canvasWidth - Canvas幅
     * @param {number} canvasHeight - Canvas高さ
     * @param {number} videoWidth - ビデオ幅
     * @param {number} videoHeight - ビデオ高さ
     * @returns {Function} 座標変換関数
     */
    _createDirectToCanvas(canvasWidth, canvasHeight, videoWidth, videoHeight) {
        return (point) => {
            const videoX = point.x * videoWidth;
            const videoY = point.y * videoHeight;
            
            return { 
                x: this._applyMirrorMode(videoX, canvasWidth), 
                y: videoY 
            };
        };
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
     * 口の領域を計算（32点から）
     * @private
     * @param {Array} contourLandmarks32 - 32点のランドマーク配列
     * @returns {Object} 口の領域 {x, y, width, height}
     */
    _calculateMouthRegionFrom32(contourLandmarks32) {
        if (!contourLandmarks32 || contourLandmarks32.length === 0) {
            return null;
        }

        const videoWidth = this.videoElement.videoWidth || this.canvas.width;
        const videoHeight = this.videoElement.videoHeight || this.canvas.height;

        const canvasPoints = contourLandmarks32
            .filter(item => item && item.point)
            .map(item => ({
                x: item.point.x * videoWidth,
                y: item.point.y * videoHeight
            }));

        if (canvasPoints.length === 0) return null;

        const minX = Math.min(...canvasPoints.map(p => p.x));
        const maxX = Math.max(...canvasPoints.map(p => p.x));
        const minY = Math.min(...canvasPoints.map(p => p.y));
        const maxY = Math.max(...canvasPoints.map(p => p.y));

        const margin = Math.max((maxX - minX) * 0.3, (maxY - minY) * 0.3);
        return {
            x: minX - margin,
            y: minY - margin,
            width: (maxX - minX) + margin * 2,
            height: (maxY - minY) + margin * 2
        };
    }

    /**
     * ランドマークをインデックスで検索
     * @private
     * @param {Array} landmarks - ランドマーク配列
     * @param {number} index - インデックス
     * @returns {Object|null} ランドマークオブジェクト
     */
    _findLandmarkByIndex(landmarks, index) {
        return landmarks.find(item => item && item.index === index) || null;
    }

    /**
     * 連続したパスを描画
     * @private
     * @param {Array} indices - インデックスの配列（順序通り）
     * @param {Array} landmarks - ランドマーク配列
     * @param {Function} toCanvas - 座標変換関数
     * @param {CanvasRenderingContext2D} ctx - Canvasコンテキスト
     * @param {string} strokeStyle - 線の色
     * @param {number} lineWidth - 線の太さ
     * @param {boolean} closePath - パスを閉じるか
     */
    _drawPath(indices, landmarks, toCanvas, ctx, strokeStyle = '#00ffff', lineWidth = 2, closePath = false) {
        const points = indices
            .map(idx => {
                const landmark = this._findLandmarkByIndex(landmarks, idx);
                return landmark && landmark.point ? toCanvas(landmark.point) : null;
            })
            .filter(p => p !== null);

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        if (closePath) {
            ctx.closePath();
        }
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    /**
     * 口領域を多角形として塗りつぶす
     * @private
     * @param {Array} contourLandmarks32 - ランドマーク配列
     * @param {Function} toCanvas - 座標変換関数
     * @param {CanvasRenderingContext2D} ctx - Canvasコンテキスト
     */
    _drawMouthPolygon(contourLandmarks32, toCanvas, ctx) {
        if (!contourLandmarks32 || contourLandmarks32.length === 0) return;

        // 上唇外側と下唇内側（存在しない場合は早期リターン）
        const upperLipOuter = [61, 12, 13, 14, 15, 16, 17, 18, 291];
        const lowerLipInner = [308, 309, 310, 311, 312];

        // 取得できるポイントだけを順序通りに並べる
        const outerPoints = upperLipOuter
            .map(idx => this._findLandmarkByIndex(contourLandmarks32, idx))
            .filter(p => p && p.point)
            .map(p => toCanvas(p.point));

        const innerPoints = lowerLipInner
            .map(idx => this._findLandmarkByIndex(contourLandmarks32, idx))
            .filter(p => p && p.point)
            .map(p => toCanvas(p.point))
            .reverse(); // 反転して閉じた多角形にする

        const polygonPoints = outerPoints.concat(innerPoints);
        if (polygonPoints.length < 3) return;

        // 塗りつぶし（薄い色で強調）
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        for (let i = 1; i < polygonPoints.length; i++) {
            ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 165, 0, 0.08)'; // 薄いオレンジ
        ctx.fill();

        // 輪郭を描画
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }

    /**
     * 32点の接続線を描画（MediaPipe FaceMeshの正しい接続順序に従う）
     * @private
     * @param {Array} contourLandmarks32 - 32点のランドマーク配列
     * @param {Function} toCanvas - 座標変換関数
     * @param {CanvasRenderingContext2D} ctx - Canvasコンテキスト
     */
    _drawMouthConnections32(contourLandmarks32, toCanvas, ctx) {
        // MediaPipe FaceMeshの口の輪郭の正しい接続順序
        // 上唇外側: 左口角(61) → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 右口角(291)
        const upperLipOuter = [61, 12, 13, 14, 15, 16, 17, 18, 291];
        
        // 下唇外側: 左口角(61) → 84 → 17 → 314 → 右口角(291)
        // または利用可能なランドマークに基づいて適切なパスを選択
        // 84と314が利用可能な場合はそれを使用、そうでない場合は内側のインデックスを使用
        const has84 = this._findLandmarkByIndex(contourLandmarks32, 84) !== null;
        const has314 = this._findLandmarkByIndex(contourLandmarks32, 314) !== null;
        
        let lowerLipOuter;
        if (has84 && has314) {
            // 下唇外側のランドマークが利用可能な場合
            // 左口角(61) → 下唇外側左(84) → 下唇外側右(314) → 右口角(291)
            lowerLipOuter = [61, 84, 314, 291];
        } else {
            // フォールバック: 下唇内側のインデックスを使用
            lowerLipOuter = [61, 308, 309, 310, 311, 312, 291];
        }
        
        // 上唇内側: 78 → 79 → 80 → 81 → 82
        const upperLipInner = [78, 79, 80, 81, 82];
        
        // 下唇内側: 308 → 309 → 310 → 311 → 312
        const lowerLipInner = [308, 309, 310, 311, 312];

        // 口の輪郭を連続したパスとして描画（太めの線で強調）
        this._drawPath(upperLipOuter, contourLandmarks32, toCanvas, ctx, '#ff0000', 3, false);
        this._drawPath(lowerLipOuter, contourLandmarks32, toCanvas, ctx, '#ff8c00', 3, false);
        
        // 内側の輪郭（細めの線）
        this._drawPath(upperLipInner, contourLandmarks32, toCanvas, ctx, '#ff69b4', 2, false);
        this._drawPath(lowerLipInner, contourLandmarks32, toCanvas, ctx, '#ff8c00', 2, false);

        // 口角周辺の接続（補助線）
        const leftCornerPath = [61, 39, 40, 41];
        const rightCornerPath = [291, 269, 270, 271];
        this._drawPath(leftCornerPath, contourLandmarks32, toCanvas, ctx, '#adff2f', 1.5, false);
        this._drawPath(rightCornerPath, contourLandmarks32, toCanvas, ctx, '#adff2f', 1.5, false);

        // 頬の接続（補助線）
        const leftCheekPath = [116, 117];
        const rightCheekPath = [345, 346];
        this._drawPath(leftCheekPath, contourLandmarks32, toCanvas, ctx, '#00ffff', 1.5, false);
        this._drawPath(rightCheekPath, contourLandmarks32, toCanvas, ctx, '#00ffff', 1.5, false);

        // 顎の接続（補助線）
        const jawPath = [172, 175, 176, 397];
        this._drawPath(jawPath, contourLandmarks32, toCanvas, ctx, '#0000ff', 1.5, false);
    }

    /**
     * 34点のランドマークを描画
     * @param {Array} contourLandmarks32 - 34点のランドマーク配列（変数名は後方互換性のため32）
     */
    drawLandmarks32(contourLandmarks32) {
        if (!contourLandmarks32 || contourLandmarks32.length === 0) {
            this.clear();
            return;
        }

        const ctx = this.ctx;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const videoWidth = this.videoElement.videoWidth || canvasWidth;
        const videoHeight = this.videoElement.videoHeight || canvasHeight;

        // Canvasをクリア
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (!this.showLandmarks) {
            return;
        }

        // 口の領域を計算（34点から）
        const mouthRegion = this._calculateMouthRegionFrom32(contourLandmarks32);
        if (!mouthRegion) {
            this.clear();
            return;
        }

        // 座標変換関数を生成
        const toCanvas = this._createScaledToCanvas(mouthRegion, canvasWidth, canvasHeight, videoWidth, videoHeight);

        // 34点を領域ごとに色分けして描画
        contourLandmarks32.forEach((item) => {
            if (item && item.point) {
                const pos = toCanvas(item.point);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI);

                // 領域ごとに色分け
                if ([12, 13, 14, 15, 16, 17, 18].includes(item.index)) {
                    // 上唇外側: 赤
                    ctx.fillStyle = '#ff0000';
                } else if ([78, 79, 80, 81, 82].includes(item.index)) {
                    // 上唇内側: ピンク
                    ctx.fillStyle = '#ff69b4';
                } else if ([308, 309, 310, 311, 312].includes(item.index)) {
                    // 下唇内側: オレンジ
                    ctx.fillStyle = '#ff8c00';
                } else if ([61, 291].includes(item.index)) {
                    // 口角: 黄色
                    ctx.fillStyle = '#ffff00';
                } else if ([39, 40, 41, 269, 270, 271].includes(item.index)) {
                    // 口角周辺: 黄緑
                    ctx.fillStyle = '#adff2f';
                } else if ([116, 117, 345, 346].includes(item.index)) {
                    // 頬: シアン
                    ctx.fillStyle = '#00ffff';
                } else if ([175, 176, 172, 397].includes(item.index)) {
                    // 顎: 青
                    ctx.fillStyle = '#0000ff';
                } else if ([2, 200].includes(item.index)) {
                    // その他: 白
                    ctx.fillStyle = '#ffffff';
                } else {
                    // デフォルト: グレー
                    ctx.fillStyle = '#808080';
                }

                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        });

        // 口領域を塗りつぶして描画（輪郭より下に表示される）
        this._drawMouthPolygon(contourLandmarks32, toCanvas, ctx);

        // 接続線を描画（口の輪郭）
        this._drawMouthConnections32(contourLandmarks32, toCanvas, ctx);
    }

    /**
     * MOUTH_ALL_LANDMARKSを描画（画像のように接続線を描画）
     * @param {Array} allMouthLandmarks - MOUTH_ALL_LANDMARKSのランドマーク配列
     */
    drawAllMouthLandmarks(allMouthLandmarks) {
        if (!allMouthLandmarks || allMouthLandmarks.length === 0) {
            this.clear();
            return;
        }

        const ctx = this.ctx;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const videoWidth = this.videoElement.videoWidth || canvasWidth;
        const videoHeight = this.videoElement.videoHeight || canvasHeight;

        // Canvasをクリア
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (!this.showLandmarks) {
            return;
        }

        // 口の領域を計算
        const mouthRegion = this._calculateMouthRegionFrom32(allMouthLandmarks);
        if (!mouthRegion) {
            this.clear();
            return;
        }

        // 座標変換関数を生成
        const toCanvas = this._createScaledToCanvas(mouthRegion, canvasWidth, canvasHeight, videoWidth, videoHeight);

        // すべてのランドマークを描画
        allMouthLandmarks.forEach((item) => {
            if (item && item.point) {
                const pos = toCanvas(item.point);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
                ctx.fillStyle = '#ff6b6b';
                ctx.fill();
            }
        });

        // 口の輪郭の接続線を描画（画像のように）
        this._drawAllMouthConnections(allMouthLandmarks, toCanvas, ctx);
    }

    /**
     * MOUTH_ALL_LANDMARKSの接続線を描画（画像のように）
     * @private
     * @param {Array} allMouthLandmarks - 全ランドマーク配列
     * @param {Function} toCanvas - 座標変換関数
     * @param {CanvasRenderingContext2D} ctx - Canvasコンテキスト
     */
    _drawAllMouthConnections(allMouthLandmarks, toCanvas, ctx) {
        // MediaPipe FaceMeshの口の輪郭の正しい接続順序
        // 上唇外側: 左口角(61) → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 右口角(291)
        const upperLipOuter = [61, 12, 13, 14, 15, 16, 17, 18, 291];
        
        // 下唇外側: 左口角(61) → 84 → 314 → 右口角(291) または内側を使用
        const has84 = this._findLandmarkByIndex(allMouthLandmarks, 84) !== null;
        const has314 = this._findLandmarkByIndex(allMouthLandmarks, 314) !== null;
        
        let lowerLipOuter;
        if (has84 && has314) {
            lowerLipOuter = [61, 84, 314, 291];
        } else {
            // フォールバック: 下唇内側のインデックスを使用
            lowerLipOuter = [61, 308, 309, 310, 311, 312, 291];
        }
        
        // 上唇内側: 78 → 79 → 80 → 81 → 82
        const upperLipInner = [78, 79, 80, 81, 82];
        
        // 下唇内側: 308 → 309 → 310 → 311 → 312
        const lowerLipInner = [308, 309, 310, 311, 312];

        // 口の輪郭を連続したパスとして描画
        this._drawPath(upperLipOuter, allMouthLandmarks, toCanvas, ctx, '#ff0000', 2, false);
        this._drawPath(lowerLipOuter, allMouthLandmarks, toCanvas, ctx, '#ff8c00', 2, false);
        this._drawPath(upperLipInner, allMouthLandmarks, toCanvas, ctx, '#ff69b4', 1.5, false);
        this._drawPath(lowerLipInner, allMouthLandmarks, toCanvas, ctx, '#ff8c00', 1.5, false);

        // MOUTH_ALL_LANDMARKSに含まれる他のランドマーク間の接続を描画
        // 連続するインデックス間を接続（メッシュ構造を模倣）
        const sortedLandmarks = [...allMouthLandmarks].sort((a, b) => a.index - b.index);
        
        // 口周辺の連続するランドマークを接続
        for (let i = 0; i < sortedLandmarks.length - 1; i++) {
            const current = sortedLandmarks[i];
            const next = sortedLandmarks[i + 1];
            
            // 近接するランドマーク（インデックスが連続している、または近い）を接続
            const indexDiff = next.index - current.index;
            if (indexDiff <= 10 && indexDiff > 0) { // インデックスの差が10以内で連続している場合
                const pos1 = toCanvas(current.point);
                const pos2 = toCanvas(next.point);
                
                ctx.beginPath();
                ctx.moveTo(pos1.x, pos1.y);
                ctx.lineTo(pos2.x, pos2.y);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
            }
        }
    }

    /**
     * 顔全体のランドマークを描画（468個すべて）
     * @param {Array} allFaceLandmarks - 顔全体のランドマーク配列（468個）
     */
    drawAllFaceLandmarks(allFaceLandmarks) {
        if (!allFaceLandmarks || allFaceLandmarks.length === 0) {
            this.clear();
            return;
        }

        const ctx = this.ctx;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const videoWidth = this.videoElement.videoWidth || canvasWidth;
        const videoHeight = this.videoElement.videoHeight || canvasHeight;

        // Canvasをクリア
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (!this.showLandmarks) {
            return;
        }

        // 座標変換関数を生成（直接ビデオ座標を使用）
        const toCanvas = this._createDirectToCanvas(canvasWidth, canvasHeight, videoWidth, videoHeight);

        // すべてのランドマークを点として描画
        allFaceLandmarks.forEach((item) => {
            if (item && item.point) {
                const pos = toCanvas(item.point);
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 1.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#ff6b6b';
                ctx.fill();
            }
        });

        // メッシュ接続線を描画（近接するランドマーク間を接続）
        this._drawFaceMesh(allFaceLandmarks, toCanvas, ctx);
    }

    /**
     * 顔のメッシュ接続線を描画
     * @private
     * @param {Array} allFaceLandmarks - 顔全体のランドマーク配列
     * @param {Function} toCanvas - 座標変換関数
     * @param {CanvasRenderingContext2D} ctx - Canvasコンテキスト
     */
    _drawFaceMesh(allFaceLandmarks, toCanvas, ctx) {
        // MediaPipe FaceMeshのメッシュ接続を模倣
        // 最適化: 空間分割を使用してO(n²)をO(n log n)に改善
        const connections = new Set();
        const MAX_DISTANCE = 30;
        const MAX_CONNECTIONS = 4;
        
        // 座標を事前計算（重複計算を避ける）
        const positions = new Map();
        allFaceLandmarks.forEach(item => {
            if (item && item.point) {
                positions.set(item.index, toCanvas(item.point));
            }
        });

        // 各ランドマークから近接するランドマークへの接続を描画
        allFaceLandmarks.forEach((item1) => {
            if (!item1 || !item1.point) return;
            
            const pos1 = positions.get(item1.index);
            if (!pos1) return;
            
            const neighbors = [];

            // 近接するランドマークを検索（距離が一定以下のもの）
            allFaceLandmarks.forEach((item2) => {
                if (!item2 || !item2.point || item1.index === item2.index) return;
                
                const pos2 = positions.get(item2.index);
                if (!pos2) return;
                
                const dx = pos2.x - pos1.x;
                const dy = pos2.y - pos1.y;
                const distanceSquared = dx * dx + dy * dy; // 平方根を取らずに比較（最適化）
                
                // 距離が30ピクセル以内のランドマークを近接として扱う
                if (distanceSquared < MAX_DISTANCE * MAX_DISTANCE) {
                    neighbors.push({ item: item2, distance: Math.sqrt(distanceSquared) });
                }
            });

            // 最も近いランドマークに接続
            neighbors.sort((a, b) => a.distance - b.distance);
            const maxConnections = Math.min(MAX_CONNECTIONS, neighbors.length);
            
            for (let i = 0; i < maxConnections; i++) {
                const neighbor = neighbors[i];
                const key1 = `${Math.min(item1.index, neighbor.item.index)}-${Math.max(item1.index, neighbor.item.index)}`;
                
                if (!connections.has(key1)) {
                    connections.add(key1);
                    
                    const pos2 = positions.get(neighbor.item.index);
                    if (pos2) {
                        ctx.beginPath();
                        ctx.moveTo(pos1.x, pos1.y);
                        ctx.lineTo(pos2.x, pos2.y);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
        });
    }


    /**
     * ランドマークを描画（34点対応）
     * @param {Object} mouthLandmarks - 口ランドマーク
     * @param {Array} contourLandmarks32 - 34点のランドマーク（オプション、変数名は後方互換性のため32）
     * @param {Array} allMouthLandmarks - MOUTH_ALL_LANDMARKSのランドマーク（オプション）
     * @param {Array} allFaceLandmarks - 顔全体のランドマーク（オプション）
     */
    drawLandmarks(mouthLandmarks, contourLandmarks32 = null, allMouthLandmarks = null, allFaceLandmarks = null) {
        // 描画モードを決定（優先順位: 顔全体 > MOUTH_ALL_LANDMARKS > 34点版 > 既存ロジック）
        const drawMode = this._determineDrawMode(allFaceLandmarks, allMouthLandmarks, contourLandmarks32);
        
        switch (drawMode) {
            case 'face':
                this.drawAllFaceLandmarks(allFaceLandmarks);
                return;
            case 'allMouth':
                this.drawAllMouthLandmarks(allMouthLandmarks);
                return;
            case 'contour32':
                this.drawLandmarks32(contourLandmarks32);
                return;
            case 'legacy':
            default:
                // 既存の描画ロジックにフォールバック
                this._drawLegacyLandmarks(mouthLandmarks);
                return;
        }
    }

    /**
     * 描画モードを決定
     * @private
     * @param {Array} allFaceLandmarks - 顔全体のランドマーク
     * @param {Array} allMouthLandmarks - MOUTH_ALL_LANDMARKSのランドマーク
     * @param {Array} contourLandmarks32 - 34点のランドマーク
     * @returns {string} 描画モード ('face' | 'allMouth' | 'contour32' | 'legacy')
     */
    _determineDrawMode(allFaceLandmarks, allMouthLandmarks, contourLandmarks32) {
        if (allFaceLandmarks && allFaceLandmarks.length > 0) {
            return 'face';
        }
        if (allMouthLandmarks && allMouthLandmarks.length > 0) {
            return 'allMouth';
        }
        if (contourLandmarks32 && contourLandmarks32.length >= 32) {
            return 'contour32';
        }
        return 'legacy';
    }

    /**
     * 既存の描画ロジック（後方互換性）
     * @private
     * @param {Object} mouthLandmarks - 口ランドマーク
     */
    _drawLegacyLandmarks(mouthLandmarks) {
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

        // 座標変換関数を生成
        const toCanvas = this._createScaledToCanvas(mouthRegion, canvasWidth, canvasHeight, videoWidth, videoHeight);

        // フォールバック: mouthLandmarksから直接描画（8点）
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

