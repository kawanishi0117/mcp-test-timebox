/**
 * PathValidator - パス検証ユーティリティ
 * 
 * パスがリポジトリ配下かを検証し、パストラバーサル攻撃を防ぐ。
 * 
 * Requirements:
 * - 2.6: targetパラメータがリポジトリ配下であることを検証
 * - 4.6: report_dirがリポジトリ配下であることを検証
 * - 4.7: リポジトリ外を指すパスはエラーを返す
 */
import * as path from 'node:path';

/**
 * パス検証結果
 */
export interface PathValidationResult {
  /** 検証が成功したかどうか */
  valid: boolean;
  /** 正規化されたパス（validがtrueの場合のみ有効） */
  normalizedPath?: string;
  /** エラーメッセージ（validがfalseの場合のみ有効） */
  error?: string;
}

/**
 * パスがリポジトリ配下かを検証する
 * 
 * @param targetPath - 検証対象のパス
 * @param repoRoot - リポジトリのルートパス（絶対パス）
 * @returns 検証結果
 */
export function isUnderRepo(targetPath: string, repoRoot: string): boolean {
  // 空文字列チェック
  if (!targetPath || !repoRoot) {
    return false;
  }

  // repoRootを正規化（絶対パスに変換）
  const normalizedRepoRoot = path.resolve(repoRoot);
  
  // targetPathを正規化
  // 相対パスの場合はrepoRootを基準に解決
  const absoluteTargetPath = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(normalizedRepoRoot, targetPath);

  // 正規化されたパスがrepoRoot配下かチェック
  // path.relative()を使用して相対パスを計算し、
  // 「..」で始まる場合はリポジトリ外
  const relativePath = path.relative(normalizedRepoRoot, absoluteTargetPath);
  
  // 相対パスが空（同じディレクトリ）または「..」で始まらない場合は配下
  if (relativePath === '') {
    return true;
  }
  
  // 「..」で始まる場合はリポジトリ外
  if (relativePath.startsWith('..')) {
    return false;
  }
  
  // Windowsの場合、絶対パスが異なるドライブを指している可能性
  // path.relative()は異なるドライブの場合、絶対パスを返す
  if (path.isAbsolute(relativePath)) {
    return false;
  }

  return true;
}

/**
 * パスを正規化し、リポジトリ配下であることを検証する
 * 
 * @param targetPath - 正規化対象のパス
 * @param repoRoot - リポジトリのルートパス（絶対パス）
 * @returns 検証結果（正規化されたパスまたはエラー）
 */
export function normalizePath(targetPath: string, repoRoot: string): PathValidationResult {
  // 空文字列チェック
  if (!targetPath) {
    return {
      valid: false,
      error: 'パスが空です',
    };
  }

  if (!repoRoot) {
    return {
      valid: false,
      error: 'リポジトリルートが指定されていません',
    };
  }

  // repoRootを正規化
  const normalizedRepoRoot = path.resolve(repoRoot);

  // 絶対パスの場合は拒否（相対パスのみ許可）
  if (path.isAbsolute(targetPath)) {
    return {
      valid: false,
      error: `絶対パスは許可されていません: ${targetPath}`,
    };
  }

  // パスを正規化
  const absolutePath = path.resolve(normalizedRepoRoot, targetPath);
  
  // リポジトリ配下かチェック
  if (!isUnderRepo(absolutePath, normalizedRepoRoot)) {
    return {
      valid: false,
      error: `パスがリポジトリ外を指しています: ${targetPath}`,
    };
  }

  // リポジトリルートからの相対パスを返す
  const relativePath = path.relative(normalizedRepoRoot, absolutePath);

  return {
    valid: true,
    normalizedPath: relativePath || '.',
  };
}

/**
 * PathValidatorクラス（オブジェクト指向インターフェース）
 * 
 * リポジトリルートを保持し、パス検証を行う
 */
export class PathValidator {
  private readonly repoRoot: string;

  /**
   * @param repoRoot - リポジトリのルートパス
   */
  constructor(repoRoot: string) {
    this.repoRoot = path.resolve(repoRoot);
  }

  /**
   * パスがリポジトリ配下かを検証する
   */
  isUnderRepo(targetPath: string): boolean {
    return isUnderRepo(targetPath, this.repoRoot);
  }

  /**
   * パスを正規化し、リポジトリ配下であることを検証する
   */
  normalizePath(targetPath: string): PathValidationResult {
    return normalizePath(targetPath, this.repoRoot);
  }

  /**
   * リポジトリルートを取得する
   */
  getRepoRoot(): string {
    return this.repoRoot;
  }
}
