/**
 * Report モジュール
 * 
 * ログ抽出とレポート生成に関するコンポーネントをエクスポート
 */

export {
  // LogExtractor
  LogExtractor,
  createLogExtractor,
  extractImportantLines,
  getTailLines,
  getTailBytes,
  formatExtractedBlocks,
  IMPORTANT_PATTERNS,
  type ExtractedBlock,
  type ExtractOptions,
} from './log-extractor.js';

export {
  // ReportGenerator
  ReportGenerator,
  createReportGenerator,
  type Summary,
  type GeneratedArtifacts,
  type IReportGenerator,
} from './report-generator.js';
