// 类型声明文件 for fast-levenshtein
declare module 'fast-levenshtein' {
  /**
   * 计算两个字符串之间的 Levenshtein 编辑距离
   * @param str1 - 第一个字符串
   * @param str2 - 第二个字符串
   * @returns 编辑距离
   */
  export function distance(str1: string, str2: string): number;
}

// 类型声明文件 for jaro-winkler
declare module 'jaro-winkler' {
  /**
   * 计算两个字符串之间的 Jaro-Winkler 相似度
   * @param str1 - 第一个字符串
   * @param str2 - 第二个字符串
   * @returns 相似度 (0-1)
   */
  export function distance(str1: string, str2: string): number;
}
