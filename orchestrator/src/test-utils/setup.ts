// test-utils/setup.ts
/**
 * Jest 测试设置文件
 */

import { jest } from '@jest/globals';

// 设置测试超时
jest.setTimeout(30000);

// 全局 mock
beforeAll(() => {
  // 可以在这里设置全局 mock
});

afterAll(() => {
  // 清理
});
