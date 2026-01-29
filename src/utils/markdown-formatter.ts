/**
 * Markdown 格式化工具
 * 将 AI 返回的 Markdown 内容转换为企业微信 markdown_v2 兼容格式
 */

/**
 * 格式化 Markdown 内容为企业微信 markdown_v2 格式
 *
 * 转换规则:
 * 1. 列表符号标准化: • ● ◦ → -
 * 2. 清理多余空行
 * 3. 保留标准 Markdown 语法 (加粗、斜体、链接、引用、代码块等)
 *
 * @param content - 原始 Markdown 内容
 * @returns 格式化后的内容
 */
export function formatMarkdownForWecom(content: string): string {
  if (!content) {
    return '';
  }

  let formatted = content;

  // 1. 统一列表符号为标准 Markdown 格式
  // 替换各种 bullet 符号为 "-"
  formatted = formatted.replace(/^[•●◦]\s+/gm, '- ');
  formatted = formatted.replace(/\n[•●◦]\s+/g, '\n- ');

  // 2. 清理多余的连续空行 (保留最多2个连续换行)
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  // 3. 去除首尾空白
  formatted = formatted.trim();

  return formatted;
}
