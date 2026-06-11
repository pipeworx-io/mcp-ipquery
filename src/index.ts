interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * IPQuery MCP.
 *
 * Keyless IP intelligence — geolocation, ISP/ASN, and fraud/security risk flags
 * (VPN / Tor / proxy / datacenter / mobile + a 0-100 risk score) for any IPv4 or
 * IPv6 address. The risk/anonymizer detection is the differentiator over a plain
 * geo-IP lookup. Keyless. Source: api.ipquery.io.
 */


const BASE = 'https://api.ipquery.io';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'lookup_ip',
    description:
      'Full IP intelligence for an IPv4 or IPv6 address — geolocation (country, city, state, postal code, lat/long, timezone, local time), ISP/ASN/org, and security risk flags (VPN, proxy, Tor, datacenter, mobile + a 0-100 risk score). Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        ip: {
          type: 'string',
          description: 'An IPv4 or IPv6 address to look up, e.g. "8.8.8.8" or "2606:4700:4700::1111".',
        },
      },
      required: ['ip'],
    },
  },
  {
    name: 'check_risk',
    description:
      'Fraud/security view of an IP: is it a VPN, proxy, Tor exit, datacenter/hosting, or mobile network, plus a 0-100 risk score and a one-line assessment. Answers "is this IP an anonymizer / bot / datacenter, or a clean residential IP?". Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        ip: {
          type: 'string',
          description: 'An IPv4 or IPv6 address to assess, e.g. "8.8.8.8" or "185.220.101.1".',
        },
      },
      required: ['ip'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'lookup_ip':
        return lookupIp(args);
      case 'check_risk':
        return checkRisk(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// --- helpers ---------------------------------------------------------------

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

function looksLikeIp(ip: string): boolean {
  if (IPV4_RE.test(ip)) {
    return ip.split('.').every((o) => Number(o) <= 255);
  }
  // crude IPv6: must contain a colon and only hex/colon chars
  return ip.includes(':') && IPV6_RE.test(ip);
}

interface RawResult {
  ip?: string;
  isp?: { asn?: string; org?: string; isp?: string };
  location?: {
    country?: string;
    country_code?: string;
    city?: string;
    state?: string;
    zipcode?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    localtime?: string;
  };
  risk?: {
    is_mobile?: boolean;
    is_vpn?: boolean;
    is_tor?: boolean;
    is_proxy?: boolean;
    is_datacenter?: boolean;
    risk_score?: number;
  };
}

async function ipqGet(ip: string): Promise<RawResult | { error: string }> {
  const trimmed = ip.trim();
  if (!trimmed) return { error: 'provide an ip address' };
  if (!looksLikeIp(trimmed)) return { error: `not a valid IP address: ${trimmed}` };

  const res = await fetch(`${BASE}/${encodeURIComponent(trimmed)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: `IP not found: ${trimmed}` };
  if (!res.ok) return { error: `ipquery: ${res.status} ${(await res.text()).slice(0, 200)}` };
  return (await res.json()) as RawResult;
}

function mapResult(raw: RawResult) {
  const loc = raw.location ?? {};
  const isp = raw.isp ?? {};
  const risk = raw.risk ?? {};
  return {
    ip: raw.ip,
    isp: { asn: isp.asn, org: isp.org, isp: isp.isp },
    location: {
      country: loc.country,
      country_code: loc.country_code,
      city: loc.city,
      state: loc.state,
      postal_code: loc.zipcode,
      latitude: loc.latitude,
      longitude: loc.longitude,
      timezone: loc.timezone,
      local_time: loc.localtime,
    },
    risk: {
      risk_score: risk.risk_score,
      is_vpn: risk.is_vpn,
      is_proxy: risk.is_proxy,
      is_tor: risk.is_tor,
      is_datacenter: risk.is_datacenter,
      is_mobile: risk.is_mobile,
    },
  };
}

function assess(risk: NonNullable<RawResult['risk']>): string {
  const score = typeof risk.risk_score === 'number' ? risk.risk_score : 0;
  if (risk.is_tor) return 'Tor exit node — anonymized traffic';
  if (score >= 80) return 'High risk — likely VPN/proxy/anonymizer';
  if (risk.is_vpn) return 'VPN endpoint';
  if (risk.is_proxy) return 'Proxy endpoint';
  if (risk.is_datacenter) return 'Datacenter/hosting IP (not residential)';
  if (risk.is_mobile) return 'Mobile carrier IP';
  if (score >= 40) return 'Elevated risk';
  return 'Clean residential IP';
}

// --- tools -----------------------------------------------------------------

async function lookupIp(args: Record<string, unknown>): Promise<unknown> {
  const ip = typeof args.ip === 'string' ? args.ip : '';
  const raw = await ipqGet(ip);
  if ('error' in raw) return raw;
  return mapResult(raw);
}

async function checkRisk(args: Record<string, unknown>): Promise<unknown> {
  const ip = typeof args.ip === 'string' ? args.ip : '';
  const raw = await ipqGet(ip);
  if ('error' in raw) return raw;

  const risk = raw.risk ?? {};
  const loc = raw.location ?? {};
  const isp = raw.isp ?? {};
  return {
    ip: raw.ip,
    risk_score: risk.risk_score,
    is_vpn: risk.is_vpn,
    is_proxy: risk.is_proxy,
    is_tor: risk.is_tor,
    is_datacenter: risk.is_datacenter,
    is_mobile: risk.is_mobile,
    assessment: assess(risk),
    isp: { org: isp.org, asn: isp.asn },
    country: loc.country,
  };
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
