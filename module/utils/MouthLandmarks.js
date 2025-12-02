/**
 * MouthLandmarks - 口ランドマーク定義とユーティリティ
 */

import { DEFAULT_LANDMARKS } from '../config/constants.js';

const BASIC_MOUTH_INDICES = {
    leftEnd: 61,
    rightEnd: 291,
    topOuter: 13,
    bottomOuter: 14,
    topLeft: 37,
    topRight: 267,
    bottomLeft: 84,
    bottomRight: 314
};

/**
 * DEFAULT_LANDMARKSが読み込めない場合のチェック
 */
function validateDefaultLandmarks() {
    if (!DEFAULT_LANDMARKS || !Array.isArray(DEFAULT_LANDMARKS) || DEFAULT_LANDMARKS.length === 0) {
        return false;
    }
    return true;
}

/**
 * 口ランドマークのインデックス配列を取得
 */
export function getMouthLandmarkIndices() {
    if (!validateDefaultLandmarks()) {
        return [];
    }
    return Object.values(BASIC_MOUTH_INDICES).filter(idx => DEFAULT_LANDMARKS.includes(idx));
}

/**
 * ランドマーク名からインデックスを取得
 */
export function getLandmarkIndex(name) {
    if (!validateDefaultLandmarks()) {
        return null;
    }
    const index = BASIC_MOUTH_INDICES[name];
    return index && DEFAULT_LANDMARKS.includes(index) ? index : null;
}

/**
 * ランドマークデータを構造化（8点：外側のみ）
 */
export function structureMouthLandmarks(landmarks) {
    if (!landmarks || landmarks.length === 0) {
        return null;
    }

    if (!validateDefaultLandmarks()) {
        return null;
    }

    const result = {};
    for (const [key, index] of Object.entries(BASIC_MOUTH_INDICES)) {
        if (DEFAULT_LANDMARKS.includes(index) && landmarks[index]) {
            result[key] = landmarks[index];
        } else {
            return null;
        }
    }

    return result;
}

