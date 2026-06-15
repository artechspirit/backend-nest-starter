import * as dns from 'dns';
import { promisify } from 'util';
import { BadRequestException } from '@nestjs/common';

const dnsLookup = promisify(dns.lookup);

/**
 * Checks if the given IP address falls within private, loopback, or link-local ranges.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback & Private & Link-local ranges
  if (ip.startsWith('127.') || ip.startsWith('0.')) return true;
  if (ip.startsWith('169.254.')) return true; // Link-local

  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    const [p0, p1] = parts;
    if (p0 === 10) return true; // 10.0.0.0/8
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true; // 172.16.0.0/12
    if (p0 === 192 && p1 === 168) return true; // 192.168.0.0/16
  }

  // IPv6 Loopback & Local & Link-local ranges
  const cleanIp = ip.toLowerCase().trim();
  if (cleanIp === '::1' || cleanIp === '::') return true;
  if (cleanIp.startsWith('fe80:')) return true; // Link-local
  if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) return true; // Unique local

  return false;
}

/**
 * Validates a URL to ensure it uses HTTP/HTTPS and does not resolve to a private or local IP address.
 */
export async function validateUrl(urlStr: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch (err) {
    throw new BadRequestException('Invalid URL format');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only HTTP and HTTPS protocols are allowed');
  }

  const hostname = url.hostname;

  // Check if hostname is directly an IP address
  const isIp = /^[0-9a-f.:]+$/i.test(hostname);
  if (isIp) {
    if (isPrivateIp(hostname)) {
      throw new BadRequestException('Requests to private or local IP addresses are forbidden');
    }
    return;
  }

  // Resolve hostname via DNS
  try {
    const { address } = await dnsLookup(hostname);
    if (isPrivateIp(address)) {
      throw new BadRequestException('Requests to private or local IP addresses are forbidden');
    }
  } catch (err) {
    throw new BadRequestException(`Failed to resolve host: ${hostname}`);
  }
}
