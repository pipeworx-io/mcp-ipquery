# mcp-ipquery

IPQuery MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `lookup_ip` | Full IP intelligence for an IPv4 or IPv6 address — geolocation (country, city, state, postal code, lat/long, timezone, local time), ISP/ASN/org, and security risk flags (VPN, proxy, Tor, datacenter, mobile + a 0-100 risk score). Keyless. |
| `check_risk` | Fraud/security view of an IP: is it a VPN, proxy, Tor exit, datacenter/hosting, or mobile network, plus a 0-100 risk score and a one-line assessment. Answers "is this IP an anonymizer / bot / datacenter, or a clean residential IP?". Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "ipquery": {
      "url": "https://gateway.pipeworx.io/ipquery/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Ipquery data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
