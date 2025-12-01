/**
 * FaceMeshHandler - MediaPipe FaceMesh連携クラス
 * FaceMeshの初期化と結果の処理を行います
 */

import { FACE_MESH_CONFIG, MOUTH_CONTOUR_INDICES, MOUTH_CONTOUR_INDICES_34, MOUTH_ALL_LANDMARKS } from '../config/constants.js';
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
     * 口の輪郭ランドマークを取得（34点版）
     * より多くの点を使用することで、より正確な計測が可能
     * @param {Object} results - FaceMeshの結果
     * @param {boolean} use34Points - 34点版を使用するか（デフォルト: true）
     * @returns {Array|null} 口の輪郭ランドマーク配列（34点）
     */
    getMouthContourLandmarks(results, use34Points = true) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];
        
        const indices = use34Points ? MOUTH_CONTOUR_INDICES_34 : MOUTH_CONTOUR_INDICES;

        // ランドマークを取得（存在するもののみ）
        const contourLandmarks = indices
            .map(index => {
                if (landmarks[index]) {
                    return {
                        index: index,
                        point: landmarks[index],
                        x: landmarks[index].x,
                        y: landmarks[index].y,
                        z: landmarks[index].z || 0
                    };
                }
                return null;
            })
            .filter(item => item !== null);

        return contourLandmarks.length > 0 ? contourLandmarks : null;
    }

    /**
     * 口周辺の全ランドマークを取得（MOUTH_ALL_LANDMARKSを使用）
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} 口周辺の全ランドマーク配列
     */
    getAllMouthLandmarksExtended(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];

        // MOUTH_ALL_LANDMARKSを使用してランドマークを取得
        const mouthLandmarks = MOUTH_ALL_LANDMARKS
            .map(index => {
                if (landmarks[index]) {
                    return {
                        index: index,
                        point: landmarks[index],
                        x: landmarks[index].x,
                        y: landmarks[index].y,
                        z: landmarks[index].z || 0
                    };
                }
                return null;
            })
            .filter(item => item !== null);

        return mouthLandmarks.length > 0 ? mouthLandmarks : null;
    }

    /**
     * 顔全体のランドマークを取得（468個すべて）
     * @param {Object} results - FaceMeshの結果
     * @returns {Array|null} 顔全体のランドマーク配列（468個）
     */
    getAllFaceLandmarks(results) {
        if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
            return null;
        }

        const landmarks = results.multiFaceLandmarks[0];

        // すべてのランドマーク（468個）を取得
        const allLandmarks = landmarks.map((point, index) => {
            if (point) {
                return {
                    index: index,
                    point: point,
                    x: point.x,
                    y: point.y,
                    z: point.z || 0
                };
            }
            return null;
        }).filter(item => item !== null);

        return allLandmarks.length > 0 ? allLandmarks : null;
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

