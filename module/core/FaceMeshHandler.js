/**
 * FaceMeshHandler - MediaPipe FaceMesh連携クラス
 * FaceMeshの初期化と結果の処理を行います
 */

import { FACE_MESH_CONFIG, DEFAULT_LANDMARKS } from '../config/constants.js';
import { structureMouthLandmarks } from '../utils/MouthLandmarks.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

// MediaPipe FaceMeshの動的インポート
let FaceMesh = null;

export class FaceMeshHandler {
    constructor() {
        this.faceMesh = null;
        this.onResultsCallback = null;
    }

    /**
     * FaceMeshを初期化
     * @param {HTMLVideoElement} videoElement - ビデオ要素（オプション、未使用）
     * @returns {Promise<void>}
     */
    async initialize(videoElement) {
        return new Promise((resolve, reject) => {
            try {
                // MediaPipe FaceMeshがグローバルに読み込まれているか確認
                // CDNから読み込まれた場合はwindow.FaceMeshに存在
                const FaceMeshClass = window.FaceMesh;

                if (!FaceMeshClass) {
                    reject(new Error('MediaPipe FaceMeshが読み込まれていません。npmパッケージがインストールされているか確認してください。'));
                    return;
                }

                // FaceMesh初期化
                this.faceMesh = new FaceMeshClass({
                    locateFile: (file) => {
                        // npmパッケージから読み込む
                        return `/node_modules/@mediapipe/face_mesh/${file}`;
                    }
                });

                // 設定を適用
                this.faceMesh.setOptions({
                    maxNumFaces: FACE_MESH_CONFIG.maxNumFaces,
                    refineLandmarks: FACE_MESH_CONFIG.refineLandmarks,
                    minDetectionConfidence: FACE_MESH_CONFIG.minDetectionConfidence,
                    minTrackingConfidence: FACE_MESH_CONFIG.minTrackingConfidence
                });

                // 結果受信のコールバック
                this.faceMesh.onResults((results) => {
                    if (this.onResultsCallback) {
                        this.onResultsCallback(results);
                    }
                });

                // FaceMeshの初期化を実行
                this.faceMesh.initialize().then(() => {

                    resolve();
                }).catch(error => {
                    const message = ErrorHandler.handleMediaPipeError(error);
                    reject(new Error(message + ': ' + error.message));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 結果コールバックを設定
     * @param {Function} callback - 結果を受け取るコールバック関数
     */
    setOnResults(callback) {
        this.onResultsCallback = callback;
    }

    /**
     * ビデオフレームを処理
     * @param {HTMLVideoElement} videoElement - ビデオ要素
     */
    async send(videoElement) {
        if (this.faceMesh && videoElement) {
            await this.faceMesh.send({ image: videoElement });
        }
    }

    /**
     * 口ランドマークを抽出（8点：外側のみ）
     * @param {Object} results - FaceMeshの結果
     * @returns {Object|null} 口ランドマークの構造化データ
     */
    getMouthLandmarks(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];
        return structureMouthLandmarks(landmarks);
    }

    /**
     * DEFAULT_LANDMARKSからランドマークを取得
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} DEFAULT_LANDMARKSのランドマーク配列
     */
    getDefaultLandmarks(results) {
        if (!DEFAULT_LANDMARKS || !Array.isArray(DEFAULT_LANDMARKS) || DEFAULT_LANDMARKS.length === 0) {
            return null;
        }

        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];

        const defaultLandmarks = DEFAULT_LANDMARKS
            .map(index => {
                if (landmarks[index]) {
                    return {
                        index: index,
                        point: landmarks[index],
                        x: landmarks[index].x,
                        y: landmarks[index].y,
                        z: landmarks[index].z || 0,
                        visibility: typeof landmarks[index].visibility === 'number' ? landmarks[index].visibility : 1
                    };
                }
                return null;
            })
            .filter(item => item !== null);

        return defaultLandmarks.length > 0 ? defaultLandmarks : null;
    }

    /**
     * 口の輪郭ランドマークを取得（DEFAULT_LANDMARKSから口周辺のみ抽出）
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} 口の輪郭ランドマーク配列
     */
    getMouthContourLandmarks(results) {
        const defaultLandmarks = this.getDefaultLandmarks(results);
        if (!defaultLandmarks) {
            return null;
        }

        // DEFAULT_LANDMARKSから口周辺のランドマークのみ抽出
        const mouthIndices = [2, 11, 12, 13, 14, 15, 16, 17, 18, 37, 39, 40, 41, 61, 78, 79, 80, 81, 82, 84, 116, 117, 172, 175, 176, 200, 267, 269, 270, 271, 291, 308, 309, 310, 311, 312, 314, 345, 346, 397];
        return defaultLandmarks.filter(lm => mouthIndices.includes(lm.index));
    }

    /**
     * 口周辺の全ランドマークを取得（DEFAULT_LANDMARKSから口周辺のみ抽出）
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} 口周辺の全ランドマーク配列
     */
    getAllMouthLandmarksExtended(results) {
        return this.getMouthContourLandmarks(results);
    }

    /**
     * 顔全体のランドマークを取得（DEFAULT_LANDMARKSのみ）
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} DEFAULT_LANDMARKSのランドマーク配列
     */
    getAllFaceLandmarks(results) {
        return this.getDefaultLandmarks(results);
    }

    /**
     * 信頼度を取得
     * @param {Object} results - FaceMeshの結果
     * @returns {number} 信頼度 (0.0 - 1.0)
     */
    getConfidence(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return 0;
        }
        return 1.0; // MediaPipeは全体の信頼度を提供
    }
}
