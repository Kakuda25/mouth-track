/**
 * ErrorHandler - エラー処理クラス
 * アプリケーション全体のエラーハンドリングを行います
 */

export class ErrorHandler {
    /**
     * エラーを処理してユーザーに表示
     * @param {Error} error - エラーオブジェクト
     * @param {string} context - エラーが発生したコンテキスト
     */
    static handleError(error, context = '') {
        console.error(`[Error${context ? ` in ${context}` : ''}]:`, error);
        // エラーログはconsole.errorで記録
        // UIへのエラー表示は呼び出し側で実装（demo/app.jsなど）
    }

    /**
     * カメラエラーを処理
     */
    static handleCameraError(error) {
        let message = 'カメラへのアクセスに失敗しました。';

        if (error.name === 'NotAllowedError') {
            message = 'カメラへのアクセスが拒否されました。ブラウザの設定でカメラの権限を許可してください。';
        } else if (error.name === 'NotFoundError') {
            message = 'カメラが見つかりませんでした。カメラが接続されているか確認してください。';
        } else if (error.name === 'NotReadableError') {
            message = 'カメラが他のアプリケーションで使用中の可能性があります。';
        }

        this.handleError(error, 'Camera');
        return message;
    }

    /**
     * MediaPipeエラーを処理
     */
    static handleMediaPipeError(error) {
        let message = 'MediaPipe FaceMeshの初期化に失敗しました。';

        this.handleError(error, 'MediaPipe');
        return message;
    }
}

