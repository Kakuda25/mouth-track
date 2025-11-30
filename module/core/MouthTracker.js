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
        const allMouthLandmarks = this.faceMeshHandler.getAllMouthLandmarks(results);
        const contourLandmarks = this.faceMeshHandler.getMouthContourLandmarks(results);
        const confidence = this.faceMeshHandler.getConfidence(results);

        if (!mouthLandmarks) {
            // 顔が検出されていない
            // 定期的に通知を送る（毎秒1回程度）
            const now = Date.now();
            if (!this.lastNoFaceWarning || now - this.lastNoFaceWarning > 2000) {
                this.lastNoFaceWarning = now;
                this.onDataUpdate({
                    landmarks: null,
                    allLandmarks: null,
                    metrics: null,
                    confidence: 0,
                    fps: this.fpsCounter.currentFps,
                    faceDetected: false
                });
            }
            return;
        }

        // 顔が検出されている
        this.lastNoFaceWarning = null;

        // 座標の平滑化
        const smoothedLandmarks = {};
        Object.keys(mouthLandmarks).forEach(key => {
            smoothedLandmarks[key] = this.smoother.smooth(key, mouthLandmarks[key]);
        });

        // 計測値を計算（MOUTH_CONTOUR_INDICESを使用してより正確に）
        const metrics = DataProcessor.calculateAllMetrics(smoothedLandmarks, contourLandmarks);

        // 変化率を計算
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

        // 時間的特徴量を計算
        this.temporalExtractor.addFrame(metrics);
        const temporalFeatures = this.temporalExtractor.getAllTemporalFeatures();

        // FPS計算
        this.updateFPS();

        // 全ランドマークも平滑化（オプション）
        let smoothedAllLandmarks = null;
        if (allMouthLandmarks && allMouthLandmarks.length > 0) {
            smoothedAllLandmarks = allMouthLandmarks.map(item => {
                const smoothedPoint = this.smoother.smooth(`all_${item.index}`, item.point);
                return {
                    ...item,
                    point: smoothedPoint,
                    x: smoothedPoint.x,
                    y: smoothedPoint.y,
                    z: smoothedPoint.z || 0
                };
            });
        }

        // データ更新コールバック
        this.onDataUpdate({
            landmarks: smoothedLandmarks,
            allLandmarks: smoothedAllLandmarks,
            metrics: metrics,
            temporalFeatures: temporalFeatures,
            confidence: confidence,
            fps: this.fpsCounter.currentFps,
            timestamp: Date.now(),
            faceDetected: true
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

        // トラッキングループを開始
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

        // 次のフレームをリクエスト
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

