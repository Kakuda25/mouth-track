/**
 * MouthLandmarks - 口ランドマーク定義とユーティリティ
 */

import { MOUTH_LANDMARKS } from '../config/constants.js';

/**
 * 口ランドマークのインデックス配列を取得
 */
export function getMouthLandmarkIndices() {
    return Object.values(MOUTH_LANDMARKS);
}

/**
 * ランドマーク名からインデックスを取得
 */
export function getLandmarkIndex(name) {
    return MOUTH_LANDMARKS[name] || null;
}

/**
 * ランドマークデータを構造化（8点：外側のみ）
 */
export function structureMouthLandmarks(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return null;
    }

    return {
        leftEnd: landmarks[MOUTH_LANDMARKS.leftEnd],
        rightEnd: landmarks[MOUTH_LANDMARKS.rightEnd],
        topOuter: landmarks[MOUTH_LANDMARKS.topOuter],
        bottomOuter: landmarks[MOUTH_LANDMARKS.bottomOuter],
        topLeft: landmarks[MOUTH_LANDMARKS.topLeft],
        topRight: landmarks[MOUTH_LANDMARKS.topRight],
        bottomLeft: landmarks[MOUTH_LANDMARKS.bottomLeft],
        bottomRight: landmarks[MOUTH_LANDMARKS.bottomRight]
    };
}

