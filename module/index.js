/**
 * Mouth Track - メインモジュールエントリーポイント
 * モジュールとして使用する場合のエクスポート
 * 
 * コア機能をデフォルトでエクスポートします。
 * UI関連の機能は別途 './ui' からインポートしてください。
 */

// コア機能（主要なクラス）
export { MouthTracker } from './core/MouthTracker.js';
export { CameraManager } from './core/CameraManager.js';
export { VowelClassifier } from './core/VowelClassifier.js';

// コア機能（詳細な制御が必要な場合）
export { FaceMeshHandler } from './core/FaceMeshHandler.js';
export { DataProcessor } from './core/DataProcessor.js';

// ユーティリティ
export { ErrorHandler } from './utils/ErrorHandler.js';
export { Smoother } from './utils/Smoother.js';
export * from './utils/MouthLandmarks.js';

// 設定・定数
export * from './config/constants.js';

// UI関連（オプショナル、別途 './ui' からもインポート可能）
export { Visualizer } from './ui/Visualizer.js';

