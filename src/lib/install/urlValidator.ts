/**
 * URL 验证和安全检查
 *
 * 支持 HTTP/HTTPS/FILE/GIT 协议验证，防止 SSRF 攻击和路径遍历。
 */

import path from 'path';
import type { UrlValidationResult } from '@/types';

/** 被阻止的私有网络 CIDR（用于 SSRF 防护） */
const BLOCKED_PRIVATE_RANGES = [
  { start: 0x7F000000, end: 0x7FFFFFFF },   // 127.0.0.0/8
  { start: 0x0A000000, end: 0x0AFFFFFF },   // 10.0.0.0/8
  { start: 0xAC100000, end: 0xAC1FFFFF },   // 172.16.0.0/12
  { start: 0xC0A80000, end: 0xC0A8FFFF },   // 192.168.0.0/16
  { start: 0xA9FE0000, end: 0xA9FEFFFF },   // 169.254.0.0/16
];

/** 允许的协议 */
const ALLOWED_PROTOCOLS = ['http:', 'https:', 'file:', 'git:'];

/**
 * 验证 URL 格式和安全
 */
export function validateUrl(url: string): UrlValidationResult {
  try {
    const parsed = new URL(url);

    // 检查协议
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return {
        valid: false,
        error: `Protocol "${parsed.protocol}" not allowed. Allowed: http, https, file, git`,
      };
    }

    // 检查私有网络（仅对 http/https）
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      const hostname = parsed.hostname;

      // 检查 localhost
      if (hostname === 'localhost' || hostname === 'localhost.localdomain') {
        return { valid: false, error: 'SSRF: localhost access blocked' };
      }

      // 检查 IP 地址
      if (isPrivateIP(hostname)) {
        return { valid: false, error: 'SSRF: Private network address blocked' };
      }
    }

    // 检查 file 协议的路径遍历
    if (parsed.protocol === 'file:') {
      const filePath = decodeURIComponent(parsed.pathname);
      if (filePath.includes('..')) {
        return { valid: false, error: 'Path traversal detected in file URL' };
      }
    }

    // 检查 git 协议
    if (parsed.protocol === 'git:') {
      const gitHostname = parsed.hostname;
      if (isPrivateIP(gitHostname)) {
        return { valid: false, error: 'SSRF: Private network address blocked for git URL' };
      }
    }

    // 也支持 https://*.git 形式
    if (parsed.protocol === 'https:' && parsed.pathname.endsWith('.git')) {
      // 这是合法的 Git HTTPS URL，正常处理
    }

    const type = parsed.protocol.replace(':', '') as 'http' | 'https' | 'file' | 'git';
    return { valid: true, type };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * 检查 IP 地址是否为私有网络
 */
function isPrivateIP(hostname: string): boolean {
  // 尝试解析为 IPv4
  const parts = hostname.split('.');
  if (parts.length === 4) {
    const octets = parts.map(p => parseInt(p, 10));
    if (octets.every(o => !isNaN(o) && o >= 0 && o <= 255)) {
      const ip = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
      for (const range of BLOCKED_PRIVATE_RANGES) {
        if (ip >= range.start && ip <= range.end) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 清理路径，防止路径遍历
 */
export function sanitizePath(baseDir: string, targetPath: string): string {
  const resolved = path.resolve(baseDir, targetPath);
  const normalizedBase = path.resolve(baseDir);
  if (!resolved.startsWith(normalizedBase)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}
