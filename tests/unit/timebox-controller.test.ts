/**
 * TimeboxController ユニットテスト
 * 
 * Requirements: 3.2, 3.3
 * - 3.2: timeout_ms で指定された時間が経過したらプロセスを強制終了
 * - 3.3: no_output_timeout_ms で指定された時間、出力がなければ強制終了
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  TimeboxController, 
  createTimeboxController,
  type TimeoutType 
} from '../../src/executor/timebox-controller.js';

describe('TimeboxController ユニットテスト', () => {
  // タイマーをモック化
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('setHardTimeout()', () => {
    describe('ハードタイムアウト発火', () => {
      it('指定時間経過後にコールバックが呼ばれる', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setHardTimeout(1000, callback);

        // 999ms経過 - まだ発火しない
        vi.advanceTimersByTime(999);
        expect(callback).not.toHaveBeenCalled();

        // 1000ms経過 - 発火する
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('hard');
      });

      it('タイムアウト後、isTimedOut()がtrueを返す', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setHardTimeout(500, callback);
        expect(controller.isTimedOut()).toBe(false);

        vi.advanceTimersByTime(500);
        expect(controller.isTimedOut()).toBe(true);
      });

      it('タイムアウト後、getTimeoutType()が"hard"を返す', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setHardTimeout(500, callback);
        expect(controller.getTimeoutType()).toBeNull();

        vi.advanceTimersByTime(500);
        expect(controller.getTimeoutType()).toBe('hard');
      });

      it('clear()前にタイムアウトが発火しない', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setHardTimeout(1000, callback);
        controller.clear();

        vi.advanceTimersByTime(2000);
        expect(callback).not.toHaveBeenCalled();
      });

      it('再設定すると前のタイマーがキャンセルされる', () => {
        const controller = new TimeboxController();
        const callback1 = vi.fn();
        const callback2 = vi.fn();

        controller.setHardTimeout(1000, callback1);
        vi.advanceTimersByTime(500);

        // 再設定
        controller.setHardTimeout(1000, callback2);
        vi.advanceTimersByTime(500);

        // 最初のコールバックは呼ばれない
        expect(callback1).not.toHaveBeenCalled();

        // さらに500ms経過で2番目が発火
        vi.advanceTimersByTime(500);
        expect(callback2).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('setNoOutputTimeout()', () => {
    describe('無出力タイムアウト発火', () => {
      it('指定時間出力がないとコールバックが呼ばれる', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setNoOutputTimeout(500, callback);

        // 499ms経過 - まだ発火しない
        vi.advanceTimersByTime(499);
        expect(callback).not.toHaveBeenCalled();

        // 500ms経過 - 発火する
        vi.advanceTimersByTime(1);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('no_output');
      });

      it('タイムアウト後、isTimedOut()がtrueを返す', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setNoOutputTimeout(300, callback);
        expect(controller.isTimedOut()).toBe(false);

        vi.advanceTimersByTime(300);
        expect(controller.isTimedOut()).toBe(true);
      });

      it('タイムアウト後、getTimeoutType()が"no_output"を返す', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setNoOutputTimeout(300, callback);
        expect(controller.getTimeoutType()).toBeNull();

        vi.advanceTimersByTime(300);
        expect(controller.getTimeoutType()).toBe('no_output');
      });
    });

    describe('出力によるタイマーリセット', () => {
      it('notifyOutput()でタイマーがリセットされる', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setNoOutputTimeout(500, callback);

        // 400ms経過
        vi.advanceTimersByTime(400);
        expect(callback).not.toHaveBeenCalled();

        // 出力通知 - タイマーリセット
        controller.notifyOutput();

        // さらに400ms経過 - まだ発火しない（リセットされたため）
        vi.advanceTimersByTime(400);
        expect(callback).not.toHaveBeenCalled();

        // さらに100ms経過 - 発火する（リセット後500ms経過）
        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('複数回のnotifyOutput()でタイマーが繰り返しリセットされる', () => {
        const controller = new TimeboxController();
        const callback = vi.fn();

        controller.setNoOutputTimeout(100, callback);

        // 50ms間隔で出力を通知
        for (let i = 0; i < 10; i++) {
          vi.advanceTimersByTime(50);
          controller.notifyOutput();
        }

        // 500ms経過したが、タイムアウトしていない
        expect(callback).not.toHaveBeenCalled();

        // 出力なしで100ms経過 - 発火
        vi.advanceTimersByTime(100);
        expect(callback).toHaveBeenCalledTimes(1);
      });

      it('無出力タイムアウト未設定時、notifyOutput()は何もしない', () => {
        const controller = new TimeboxController();
        
        // エラーが発生しないことを確認
        expect(() => controller.notifyOutput()).not.toThrow();
      });
    });
  });

  describe('clear()', () => {
    it('ハードタイムアウトをクリアする', () => {
      const controller = new TimeboxController();
      const callback = vi.fn();

      controller.setHardTimeout(500, callback);
      controller.clear();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('無出力タイムアウトをクリアする', () => {
      const controller = new TimeboxController();
      const callback = vi.fn();

      controller.setNoOutputTimeout(500, callback);
      controller.clear();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('両方のタイムアウトを同時にクリアする', () => {
      const controller = new TimeboxController();
      const hardCallback = vi.fn();
      const noOutputCallback = vi.fn();

      controller.setHardTimeout(1000, hardCallback);
      controller.setNoOutputTimeout(500, noOutputCallback);
      controller.clear();

      vi.advanceTimersByTime(2000);
      expect(hardCallback).not.toHaveBeenCalled();
      expect(noOutputCallback).not.toHaveBeenCalled();
    });

    it('複数回呼び出しても安全', () => {
      const controller = new TimeboxController();
      const callback = vi.fn();

      controller.setHardTimeout(500, callback);
      controller.clear();
      controller.clear();
      controller.clear();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('両方のタイムアウトの組み合わせ', () => {
    it('ハードタイムアウトが先に発火する場合', () => {
      const controller = new TimeboxController();
      const hardCallback = vi.fn();
      const noOutputCallback = vi.fn();

      controller.setHardTimeout(500, hardCallback);
      controller.setNoOutputTimeout(1000, noOutputCallback);

      vi.advanceTimersByTime(500);

      // ハードタイムアウトが発火
      expect(hardCallback).toHaveBeenCalledTimes(1);
      expect(controller.getTimeoutType()).toBe('hard');

      // 無出力タイムアウトはクリアされている
      vi.advanceTimersByTime(1000);
      expect(noOutputCallback).not.toHaveBeenCalled();
    });

    it('無出力タイムアウトが先に発火する場合', () => {
      const controller = new TimeboxController();
      const hardCallback = vi.fn();
      const noOutputCallback = vi.fn();

      controller.setHardTimeout(1000, hardCallback);
      controller.setNoOutputTimeout(500, noOutputCallback);

      vi.advanceTimersByTime(500);

      // 無出力タイムアウトが発火
      expect(noOutputCallback).toHaveBeenCalledTimes(1);
      expect(controller.getTimeoutType()).toBe('no_output');

      // ハードタイムアウトはクリアされている
      vi.advanceTimersByTime(1000);
      expect(hardCallback).not.toHaveBeenCalled();
    });

    it('出力があるとハードタイムアウトのみ発火する', () => {
      const controller = new TimeboxController();
      const hardCallback = vi.fn();
      const noOutputCallback = vi.fn();

      controller.setHardTimeout(1000, hardCallback);
      controller.setNoOutputTimeout(300, noOutputCallback);

      // 定期的に出力を通知
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(200);
        controller.notifyOutput();
      }

      // 1000ms経過 - ハードタイムアウト発火
      expect(hardCallback).toHaveBeenCalledTimes(1);
      expect(noOutputCallback).not.toHaveBeenCalled();
    });
  });

  describe('createTimeboxController()', () => {
    it('新しいTimeboxControllerインスタンスを返す', () => {
      const controller = createTimeboxController();
      expect(controller).toBeDefined();
      expect(controller.isTimedOut()).toBe(false);
    });

    it('ITimeboxControllerインターフェースを実装している', () => {
      const controller = createTimeboxController();
      
      expect(typeof controller.setHardTimeout).toBe('function');
      expect(typeof controller.setNoOutputTimeout).toBe('function');
      expect(typeof controller.notifyOutput).toBe('function');
      expect(typeof controller.clear).toBe('function');
      expect(typeof controller.isTimedOut).toBe('function');
      expect(typeof controller.getTimeoutType).toBe('function');
    });
  });

  describe('初期状態', () => {
    it('isTimedOut()はfalseを返す', () => {
      const controller = new TimeboxController();
      expect(controller.isTimedOut()).toBe(false);
    });

    it('getTimeoutType()はnullを返す', () => {
      const controller = new TimeboxController();
      expect(controller.getTimeoutType()).toBeNull();
    });
  });
});
