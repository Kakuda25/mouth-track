/**
 * CameraManager - カメラ管理クラス
 * カメラの取得、選択、制御を行います
 */

import { CAMERA_CONFIG } from '../config/constants.js';
import { ErrorHandler } from '../utils/ErrorHandler.js';

export class CameraManager {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.currentStream = null;
        this.availableCameras = [];
    }

    /**
     * 利用可能なカメラのリストを取得（リトライ機能付き）
     * @param {number} maxRetries - 最大リトライ回数（デフォルト: 3）
     * @param {number} retryDelay - リトライ間隔（ミリ秒、デフォルト: 1000）
     * @returns {Promise<Array>} カメラデバイスの配列
     */
    async getAvailableCameras(maxRetries = 3, retryDelay = 1000) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('このブラウザはカメラアクセスをサポートしていません。HTTPSまたはlocalhostでアクセスしてください。');
        }

        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // 既存のストリームがあれば停止
                if (this.currentStream) {
                    this.currentStream.getTracks().forEach(track => track.stop());
                }

                // カメラへのアクセス権限を取得（列挙のため）
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true
                });

                // 一時的なストリームを停止
                stream.getTracks().forEach(track => track.stop());

                // デバイス情報を取得
                const devices = await navigator.mediaDevices.enumerateDevices();
                this.availableCameras = devices.filter(device => device.kind === 'videoinput');

                if (this.availableCameras.length === 0) {
                    throw new Error('カメラデバイスが見つかりませんでした');
                }

                return this.availableCameras.map((device, index) => ({
                    deviceId: device.deviceId,
                    label: device.label || `カメラ ${index + 1}`,
                    index: index
                }));
            } catch (error) {
                lastError = error;

                // リトライ可能なエラーの場合のみリトライ
                if (error.name === 'NotReadableError' || error.name === 'OverconstrainedError') {
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                }

                // リトライ不可能なエラーまたは最後の試行
                const message = ErrorHandler.handleCameraError(error);
                throw new Error(message);
            }
        }

        // すべてのリトライが失敗した場合
        const message = ErrorHandler.handleCameraError(lastError);
        throw new Error(message);
    }

    /**
     * 指定されたカメラを起動（リトライ機能付き）
     * @param {string} deviceId - カメラデバイスID（省略時はデフォルト）
     * @param {number} maxRetries - 最大リトライ回数（デフォルト: 3）
     * @param {number} retryDelay - リトライ間隔（ミリ秒、デフォルト: 1000）
     * @returns {Promise<MediaStream>}
     */
    async startCamera(deviceId = null, maxRetries = 3, retryDelay = 1000) {
        // 既存のストリームを停止
        this.stopCamera();

        let lastError = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // カメラ設定
                const constraints = {
                    video: {
                        width: { ideal: CAMERA_CONFIG.width },
                        height: { ideal: CAMERA_CONFIG.height },
                        facingMode: CAMERA_CONFIG.facingMode
                    }
                };

                if (deviceId) {
                    constraints.video.deviceId = { exact: deviceId };
                }

                // カメラストリームを取得
                this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);

                // ビデオ要素にストリームを設定
                if (this.videoElement) {
                    this.videoElement.srcObject = this.currentStream;

                    // ビデオの読み込みを待機
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('ビデオの読み込みがタイムアウトしました'));
                        }, 5000);

                        this.videoElement.addEventListener('loadedmetadata', () => {
                            clearTimeout(timeout);
                            resolve();
                        }, { once: true });

                        this.videoElement.addEventListener('error', (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        }, { once: true });
                    });

                    // ビデオを再生
                    try {
                        await this.videoElement.play();
                    } catch (playError) {
                        // 自動再生がブロックされた場合でもストリームは取得できている

                    }
                }

                return this.currentStream;
            } catch (error) {
                lastError = error;

                // リトライ可能なエラーの場合のみリトライ
                if (error.name === 'NotReadableError' ||
                    error.name === 'OverconstrainedError' ||
                    error.name === 'NotFoundError') {
                    if (attempt < maxRetries - 1) {
                        // ストリームをクリーンアップ
                        this.stopCamera();
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        continue;
                    }
                }

                // リトライ不可能なエラーまたは最後の試行
                const message = ErrorHandler.handleCameraError(error);
                throw new Error(message);
            }
        }

        // すべてのリトライが失敗した場合
        const message = ErrorHandler.handleCameraError(lastError);
        throw new Error(message);
    }

    /**
     * カメラを停止
     */
    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
            });
            this.currentStream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
    }

    /**
     * 現在のカメラストリームを取得
     * @returns {MediaStream|null}
     */
    getCurrentStream() {
        return this.currentStream;
    }

    /**
     * ビデオ要素の幅と高さを取得
     * @returns {Object} {width, height}
     */
    getVideoDimensions() {
        if (!this.videoElement) {
            return { width: 0, height: 0 };
        }
        return {
            width: this.videoElement.videoWidth || 0,
            height: this.videoElement.videoHeight || 0
        };
    }
}

