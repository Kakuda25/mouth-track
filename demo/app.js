/**
 * アプリケーションエントリーポイント
 * 各モジュールを初期化し、アプリケーションを起動します
 */

import { CameraManager } from '../module/core/CameraManager.js';
import { ErrorHandler } from '../module/utils/ErrorHandler.js';
import { MouthTracker } from '../module/core/MouthTracker.js';
import { VowelClassifier } from '../module/core/VowelClassifier.js';
import { Visualizer } from '../module/ui/Visualizer.js';

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', async () => {

    // MediaDevices APIの確認
    if (!navigator.mediaDevices) {
        console.error('navigator.mediaDevices が利用できません');
        alert('このブラウザはカメラアクセスをサポートしていません。\\nChrome、Edge、Firefoxなどの最新版ブラウザをご使用ください。');
        return;
    }

    // DOM要素の取得
    const videoElement = document.getElementById('videoElement');
    const canvasElement = document.getElementById('canvasElement');
    const cameraSelect = document.getElementById('cameraSelect');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const overlayInfo = document.getElementById('overlayInfo');

    // データ表示要素
    const fpsValue = document.getElementById('fpsValue');
    const confidenceValue = document.getElementById('confidenceValue');
    const opennessValue = document.getElementById('opennessValue');
    const widthValue = document.getElementById('widthValue');
    const vowelValue = document.getElementById('vowelValue');
    const vowelConfidenceValue = document.getElementById('vowelConfidenceValue');

    // 母音判別器の初期化
    let vowelClassifier = null;

    if (!videoElement || !cameraSelect || !startBtn || !stopBtn) {
        console.error('必要なDOM要素が見つかりません', {
            videoElement: !!videoElement,
            cameraSelect: !!cameraSelect,
            startBtn: !!startBtn,
            stopBtn: !!stopBtn
        });
        return;
    }

    // CameraManagerの初期化
    const cameraManager = new CameraManager(videoElement);

    // MouthTrackerとVisualizerの初期化
    let mouthTracker = null;
    let visualizer = null;

    // Visualizerの初期化
    if (canvasElement && videoElement) {
        visualizer = new Visualizer(canvasElement, videoElement);
    }

    // カメラリストの取得と表示（ユーザー操作で実行）
    async function loadCameraList() {
        try {
            cameraSelect.innerHTML = '<option value="">カメラを検索中...</option>';
            overlayInfo.innerHTML = '<p>カメラを検索中...</p>';
            overlayInfo.style.display = 'block';
            overlayInfo.classList.remove('error');

            const cameras = await cameraManager.getAvailableCameras();

            // カメラ選択ドロップダウンを更新
            cameraSelect.innerHTML = '';

            if (cameras.length === 0) {
                cameraSelect.innerHTML = '<option value="">カメラが見つかりません</option>';
                overlayInfo.innerHTML = '<p>カメラが見つかりません。<br>カメラが接続されているか確認してください。</p>';
                overlayInfo.classList.add('error');
                overlayInfo.style.display = 'block';
            } else {
                cameras.forEach(camera => {
                    const option = document.createElement('option');
                    option.value = camera.deviceId;
                    option.textContent = camera.label;
                    cameraSelect.appendChild(option);
                });

                // デフォルトで最初のカメラを選択
                if (cameras.length > 0) {
                    cameraSelect.value = cameras[0].deviceId;
                    overlayInfo.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('カメラの取得に失敗:', error);
            console.error('エラー詳細:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            cameraSelect.innerHTML = '<option value="">カメラへのアクセスに失敗しました</option>';
            overlayInfo.innerHTML = `<p>${error.message}<br><small>「カメラを再検索」ボタンで再試行できます</small></p>`;
            overlayInfo.classList.add('error');
            overlayInfo.style.display = 'block';
        }
    }

    // カメラ再検索ボタンの追加
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'カメラを再検索';
    refreshBtn.className = 'btn btn-secondary';
    refreshBtn.style.marginTop = '10px';
    refreshBtn.style.width = '100%';
    refreshBtn.addEventListener('click', () => {
        loadCameraList();
    });
    cameraSelect.parentElement.appendChild(refreshBtn);

    // 初期カメラリストの読み込み（非同期で実行）
    loadCameraList();

    // トラッキング開始ボタンのイベント
    startBtn.addEventListener('click', async () => {
        try {
            let selectedDeviceId = cameraSelect.value;

            // カメラが選択されていない場合、デフォルトカメラを試す
            if (!selectedDeviceId) {
                selectedDeviceId = null; // nullを渡すとデフォルトカメラが使用される
            }

            overlayInfo.style.display = 'none';
            await cameraManager.startCamera(selectedDeviceId);

            // ビデオのメタデータが読み込まれるまで待機
            await new Promise((resolve) => {
                if (videoElement.readyState >= 2) {
                    resolve();
                } else {
                    videoElement.addEventListener('loadedmetadata', resolve, { once: true });
                }
            });

            // Canvasサイズを調整
            if (visualizer) {
                visualizer.resize();
            }

            // 母音判別器の初期化
            vowelClassifier = new VowelClassifier({
                onVowelDetected: (result) => {
                    // 母音判別結果を表示
                    if (vowelValue) {
                        vowelValue.textContent = result.vowel || '-';
                        vowelValue.className = result.vowel ? 'vowel-value detected' : 'vowel-value';
                    }
                    if (vowelConfidenceValue) {
                        vowelConfidenceValue.textContent = result.vowel ?
                            `信頼度: ${(result.confidence * 100).toFixed(1)}%` : '-';
                        vowelConfidenceValue.className = result.vowel ? 'vowel-confidence active' : 'vowel-confidence';
                    }
                }
            });

            // MouthTrackerの初期化と開始
            try {
                mouthTracker = new MouthTracker(videoElement, (data) => {
                    // データ更新時のコールバック
                    updateDataDisplay(data);

                    // 母音判別を実行
                    if (data.metrics && vowelClassifier) {
                        const result = vowelClassifier.classify(data.metrics, data.temporalFeatures);

                        // デバッグ: 実際の計測値をログ出力（最初の10フレームのみ）
                        if (result.metrics && (!window._debugFrameCount || window._debugFrameCount < 10)) {
                            window._debugFrameCount = (window._debugFrameCount || 0) + 1;
                            console.log(`[Frame ${window._debugFrameCount}] 計測値:`, {
                                metrics: {
                                    openness: data.metrics.openness?.toFixed(4),
                                    width: data.metrics.width?.toFixed(4),
                                    aspectRatio: data.metrics.aspectRatio?.toFixed(2),
                                    upperLipThickness: data.metrics.upperLipThickness?.toFixed(4),
                                    lowerLipThickness: data.metrics.lowerLipThickness?.toFixed(4),
                                    circularity: data.metrics.circularity?.toFixed(3)
                                },
                                temporalFeatures: data.temporalFeatures ? {
                                    opennessVelocity: data.temporalFeatures.openness?.velocity?.toFixed(4),
                                    widthVelocity: data.temporalFeatures.width?.velocity?.toFixed(4)
                                } : null,
                                scores: result.scores,
                                vowel: result.vowel,
                                confidence: result.confidence?.toFixed(2)
                            });
                        }
                    }

                    // ランドマークを描画（全ランドマークも含む）
                    if (visualizer) {
                        if (data.landmarks) {
                            // 顔が検出されている
                            overlayInfo.style.display = 'none';
                            visualizer.drawLandmarks(data.landmarks, data.allLandmarks);
                        } else {
                            // 顔が検出されていない
                            overlayInfo.innerHTML = '<p>顔を検出できませんでした<br>カメラに向かって顔を映してください</p>';
                            overlayInfo.classList.remove('error');
                            overlayInfo.style.display = 'block';
                            visualizer.clear();

                            // 母音表示をリセット
                            if (vowelValue) {
                                vowelValue.textContent = '-';
                                vowelValue.className = 'vowel-value';
                            }
                            if (vowelConfidenceValue) {
                                vowelConfidenceValue.textContent = '-';
                                vowelConfidenceValue.className = 'vowel-confidence';
                            }
                        }
                    }
                });

                await mouthTracker.initialize();
                mouthTracker.start();
            } catch (error) {
                console.error('トラッキング初期化エラー:', error);
                ErrorHandler.handleError(error, 'MouthTracker');
            }

            startBtn.disabled = true;
            stopBtn.disabled = false;
            cameraSelect.disabled = true;
            refreshBtn.disabled = true;
        } catch (error) {
            console.error('✗ カメラの起動に失敗:', error);
            console.error('エラー詳細:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            overlayInfo.innerHTML = `<p>${error.message}</p>`;
            overlayInfo.classList.add('error');
            overlayInfo.style.display = 'block';
            ErrorHandler.handleError(error, 'Camera Start');

            // エラー時もボタンを有効化
            startBtn.disabled = false;
            stopBtn.disabled = true;
            cameraSelect.disabled = false;
            refreshBtn.disabled = false;
        }
    });

    // トラッキング停止ボタンのイベント
    stopBtn.addEventListener('click', () => {

        // トラッキングを停止
        if (mouthTracker) {
            mouthTracker.stop();
            mouthTracker = null;
        }

        // Canvasをクリア
        if (visualizer) {
            visualizer.clear();
        }

        // カメラを停止
        cameraManager.stopCamera();

        // UIをリセット
        startBtn.disabled = false;
        stopBtn.disabled = true;
        cameraSelect.disabled = false;
        refreshBtn.disabled = false;
        overlayInfo.innerHTML = '<p>カメラを停止しました</p>';
        overlayInfo.classList.remove('error');
        overlayInfo.style.display = 'block';

        // データ表示をリセット
        resetDataDisplay();
    });

    // データ表示を更新
    function updateDataDisplay(data) {
        if (fpsValue) {
            fpsValue.textContent = data.fps || 0;
        }
        if (confidenceValue) {
            confidenceValue.textContent = data.confidence ? (data.confidence * 100).toFixed(1) + '%' : '-';
        }
        if (opennessValue && data.metrics) {
            opennessValue.textContent = data.metrics.openness ? data.metrics.openness.toFixed(3) : '-';
        }
        if (widthValue && data.metrics) {
            widthValue.textContent = data.metrics.width ? data.metrics.width.toFixed(3) : '-';
        }
    }

    // データ表示をリセット
    function resetDataDisplay() {
        if (fpsValue) fpsValue.textContent = '-';
        if (confidenceValue) confidenceValue.textContent = '-';
        if (opennessValue) opennessValue.textContent = '-';
        if (widthValue) widthValue.textContent = '-';
        if (vowelValue) {
            vowelValue.textContent = '-';
            vowelValue.className = 'vowel-value';
        }
        if (vowelConfidenceValue) {
            vowelConfidenceValue.textContent = '-';
            vowelConfidenceValue.className = 'vowel-confidence';
        }
    }

    // ミラーモードは削除（不要なため）
});

