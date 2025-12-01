/**
 * MouthTracker - メインのトラッキングクラス
 * MediaPipe FaceMeshを使用して口の動きをトラッキングします
 */

import { FaceMeshHandler } from './FaceMeshHandler.js';
import { DataProcessor } from './DataProcessor.js';
import { Smoother } from '../utils/Smoother.js';
import { TemporalFeatureExtractor } from './TemporalFeatureExtractor.js';

export class MouthTracker {
    constructor(videoElement, onDataUpdate, options = {}) {
        this.videoElement = videoElement;
        this.onDataUpdate = onDataUpdate || (() => { });
        this.faceMeshHandler = new FaceMeshHandler();
        // 依存性注入: Smootherをカスタマイズ可能にする
        this.smoother = options.smoother || new Smoother(options.smoothingFactor || 0.5);
        // 時間的特徴量抽出器を初期化
        this.temporalExtractor = options.temporalExtractor || new TemporalFeatureExtractor({
            bufferSize: options.temporalBufferSize || 30
        });
        this.use34Points = options.use34Points !== false;
        this.isTracking = false;
        this.animationFrameId = null;
        this.lastMetrics = null;
        this.lastNoFaceWarning = null;
        this.fpsCounter = {
            frames: 0,
            lastTime: Date.now(),
            currentFps: 0
        };
    }

    /**
     * トラッキングを初期化
     * @returns {Promise<void>}
     */
    async initialize() {
        try {
            await this.faceMeshHandler.initialize(this.videoElement);

            // 結果コールバックを設定
            this.faceMeshHandler.setOnResults((results) => {
                this.processResults(results);
            });


        } catch (error) {
            console.error('MouthTracker初期化エラー:', error);
            throw error;
        }
    }

    /**
     * FaceMeshの結果を処理
     * @param {Object} results - FaceMeshの結果
     */
    processResults(results) {
        const mouthLandmarks = this.faceMeshHandler.getMouthLandmarks(results);
        const allMouthLandmarksExtended = this.faceMeshHandler.getAllMouthLandmarksExtended(results);
        const allFaceLandmarks = this.faceMeshHandler.getAllFaceLandmarks(results);
        const contourLandmarks = this.faceMeshHandler.getMouthContourLandmarks(results, this.use34Points);
        const confidence = this.faceMeshHandler.getConfidence(results);

        if (!mouthLandmarks) {
            const now = Date.now();
            if (!this.lastNoFaceWarning || now - this.lastNoFaceWarning > 2000) {
                this.lastNoFaceWarning = now;
                this.onDataUpdate({
                    landmarks: null,
                    metrics: null,
                    contourLandmarks34: null,
                    confidence: 0,
                    fps: this.fpsCounter.currentFps,
                    faceDetected: false
                });
            }
            return;
        }

        this.lastNoFaceWarning = null;

        const smoothedLandmarks = {};
        Object.keys(mouthLandmarks).forEach(key => {
            smoothedLandmarks[key] = this.smoother.smooth(key, mouthLandmarks[key]);
        });

        const smoothedAllMouthLandmarksExtended = this._smoothLandmarks(allMouthLandmarksExtended, 'all_extended_');

        let metrics;
        if (this.use34Points && contourLandmarks && contourLandmarks.length >= 34) {
            metrics = DataProcessor.calculateMetricsFromContour34(
                smoothedLandmarks, 
                contourLandmarks, 
                smoothedAllMouthLandmarksExtended
            );
        } else {
            metrics = DataProcessor.calculateAllMetrics(smoothedLandmarks, contourLandmarks);
            if (smoothedAllMouthLandmarksExtended && smoothedAllMouthLandmarksExtended.length > 0) {
                metrics.lipProtrusion = DataProcessor.calculateLipProtrusion(smoothedAllMouthLandmarksExtended);
            } else {
                metrics.lipProtrusion = 0;
            }
        }

        if (this.lastMetrics) {
            metrics.opennessRate = DataProcessor.calculateChangeRate(
                metrics.openness,
                this.lastMetrics.openness
            );
            metrics.widthRate = DataProcessor.calculateChangeRate(
                metrics.width,
                this.lastMetrics.width
            );
        } else {
            metrics.opennessRate = 0;
            metrics.widthRate = 0;
        }
        this.lastMetrics = metrics;

        this.temporalExtractor.addFrame(metrics);
        const temporalFeatures = this.temporalExtractor.getAllTemporalFeatures();
        this.updateFPS();

        const smoothedAllFaceLandmarks = this._smoothLandmarks(allFaceLandmarks, 'face_');

        this.onDataUpdate({
            landmarks: smoothedLandmarks,
            allMouthLandmarksExtended: smoothedAllMouthLandmarksExtended,
            allFaceLandmarks: smoothedAllFaceLandmarks,
            metrics: metrics,
            temporalFeatures: temporalFeatures,
            contourLandmarks34: this.use34Points && contourLandmarks && contourLandmarks.length >= 34 ? contourLandmarks : null,
            confidence: confidence,
            fps: this.fpsCounter.currentFps,
            timestamp: Date.now(),
            faceDetected: true
        });
    }

    /**
     * ランドマーク配列を平滑化
     * @private
     * @param {Array|null} landmarks - ランドマーク配列
     * @param {string} keyPrefix - 平滑化キーのプレフィックス
     * @returns {Array|null} 平滑化されたランドマーク配列
     */
    _smoothLandmarks(landmarks, keyPrefix) {
        if (!landmarks || landmarks.length === 0) {
            return null;
        }
        return landmarks.map(item => {
            const smoothedPoint = this.smoother.smooth(`${keyPrefix}${item.index}`, item.point);
            return {
                ...item,
                point: smoothedPoint,
                x: smoothedPoint.x,
                y: smoothedPoint.y,
                z: smoothedPoint.z || 0
            };
        });
    }

    /**
     * FPSを更新
     */
    updateFPS() {
        this.fpsCounter.frames++;
        const now = Date.now();
        const elapsed = now - this.fpsCounter.lastTime;

        if (elapsed >= 1000) {
            this.fpsCounter.currentFps = Math.round(
                (this.fpsCounter.frames * 1000) / elapsed
            );
            this.fpsCounter.frames = 0;
            this.fpsCounter.lastTime = now;
        }
    }

    /**
     * トラッキングを開始
     */
    start() {
        if (this.isTracking) {

            return;
        }

        if (!this.videoElement) {
            console.error('ビデオ要素が設定されていません');
            return;
        }

        this.isTracking = true;
        this.smoother.reset();
        this.temporalExtractor.reset();
        this.lastMetrics = null;
        this.fpsCounter = {
            frames: 0,
            lastTime: Date.now(),
            currentFps: 0
        };

        this.trackingLoop();

    }

    /**
     * トラッキングループ
     */
    async trackingLoop() {
        if (!this.isTracking) {
            return;
        }

        try {
            if (this.videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
                await this.faceMeshHandler.send(this.videoElement);
            }
        } catch (error) {
            console.error('トラッキングループエラー:', error);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.trackingLoop();
        });
    }

    /**
     * トラッキングを停止
     */
    stop() {
        if (!this.isTracking) {
            return;
        }

        this.isTracking = false;

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }


    }

    /**
     * 平滑化係数を設定
     * @param {number} factor - 平滑化係数 (0.0 - 1.0)
     */
    setSmoothingFactor(factor) {
        this.smoother.setSmoothingFactor(factor);
    }

    /**
     * トラッキング状態を取得
     * @returns {boolean} トラッキング中かどうか
     */
    getIsTracking() {
        return this.isTracking;
    }
}

