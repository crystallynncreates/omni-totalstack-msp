#!/usr/bin/env python3
"""
Omni Agent — network discovery for Omni TotalStack MSP.

Pure Python 3 standard library (no installs). Works on Windows, macOS and Linux.

  python omni_scan.py --range 192.168.1.0/24 --out results.json
  python omni_scan.py --range 192.168.1.0/24 --post https://YOUR-DOMAIN/api/discovery/ingest --site SITE_ID --token TOKEN
  python omni_scan.py --auto            # detect the local /24 automatically

Only scan networks you own or have written authorization to manage.
"""
from __future__ import annotations
import argparse, concurrent.futures as cf, ipaddress, json, platform, re, socket, subprocess, sys, time, urllib.request
from datetime import datetime, timezone

PORTS = [21, 22, 23, 53, 80, 135, 139, 161, 443, 445, 515, 631, 1900, 3389, 5000, 5060, 5900, 8080, 8443, 9100]
RISKY = {21: "FTP open", 23: "Telnet open", 3389: "RDP exposed", 445: "SMB open", 5900: "VNC open", 1900: "UPnP"}
# Small built-in OUI table (first 3 bytes of MAC). Extend as needed.
OUI = {
    "00:1A:2B": "Dell", "F8:BC:12": "Dell", "B8:CA:3A": "Dell", "3C:2A:F4": "Brother", "00:80:77": "Brother",
    "74:83:C2": "Ubiquiti", "F4:92:BF": "Ubiquiti", "24:5A:4C": "Ubiquiti", "78:8A:20": "Ubiquiti", "D8:B3:70": "Ubiquiti",
    "3C:D9:2B": "HP", "A0:D3:C1": "HP", "00:21:5A": "HP", "B8:27:EB": "Raspberry Pi", "DC:A6:32": "Raspberry Pi",
    "00:1B:63": "Apple", "F0:18:98": "Apple", "AC:DE:48": "Apple", "00:0C:29": "VMware", "00:50:56": "VMware",
    "00:11:32": "Synology", "00:15:65": "Yealink", "80:5E:C0": "Yealink", "24:0A:C4": "Espressif", "C4:2F:90": "Hikvision",
    "00:1E:C9": "Dell", "E8:6A:64": "Lenovo", "54:E1:AD": "Lenovo", "00:00:48": "Epson", "00:26:73": "Ricoh", "00:00:85": "Canon",
}
IS_WIN = platform.system().lower() == "windows"


def ping(ip: str, timeout_ms: int = 600) -> bool:
    cmd = ["ping", "-n", "1", "-w", str(timeout_ms), ip] if IS_WIN else ["ping", "-c", "1", "-W", "1", ip]
    try:
        return subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3).returncode == 0
    except Exception:
        return False


def port_open(ip: str, port: int, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except Exception:
        return False


def arp_table() -> dict:
    out = {}
    try:
        text = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=10).stdout
        for line in text.splitlines():
            ip = re.search(r"(\d+\.\d+\.\d+\.\d+)", line)
            mac = re.search(r"([0-9a-fA-F]{1,2}[:-]){5}[0-9a-fA-F]{1,2}", line)
            if ip and mac:
                m = ":".join(p.zfill(2) for p in re.split("[:-]", mac.group(0))).upper()
                out[ip.group(1)] = m
    except Exception:
        pass
    return out


def guess_type(vendor: str, ports: list) -> str:
    v = vendor.lower()
    if 9100 in ports or 515 in ports or 631 in ports or v in ("brother", "epson", "ricoh", "canon"):
        return "printer"
    if v == "ubiquiti":
        return "ap"
    if 5060 in ports or v == "yealink":
        return "phone"
    if 3389 in ports or 135 in ports:
        return "workstation"
    if v in ("synology", "vmware") or (445 in ports and 22 in ports):
        return "server"
    if v in ("espressif", "hikvision", "raspberry pi"):
        return "iot"
    if 53 in ports and 443 in ports:
        return "firewall"
    return "unknown"


def probe(ip: str) -> dict | None:
    alive = ping(ip)
    ports = [p for p in PORTS if port_open(ip, p)] if alive else [p for p in (80, 443, 445, 22) if port_open(ip, p, 0.25)]
    if not alive and not ports:
        return None
    try:
        hostname = socket.gethostbyaddr(ip)[0]
    except Exception:
        hostname = ip
    return {"ip": ip, "hostname": hostname, "openPorts": ports}


def local_range() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    finally:
        s.close()
    return str(ipaddress.ip_network(ip + "/24", strict=False))


def main():
    ap = argparse.ArgumentParser(description="Omni Agent network discovery")
    ap.add_argument("--range", help="CIDR, e.g. 192.168.1.0/24")
    ap.add_argument("--auto", action="store_true", help="detect local /24")
    ap.add_argument("--out", default="omni_results.json")
    ap.add_argument("--post", help="Omni ingest URL")
    ap.add_argument("--site", help="Omni site ID")
    ap.add_argument("--token", help="agent token")
    ap.add_argument("--workers", type=int, default=128)
    a = ap.parse_args()

    cidr = local_range() if a.auto or not a.range else a.range
    net = ipaddress.ip_network(cidr, strict=False)
    if net.num_addresses > 4096:
        sys.exit("Range too large (max /20). Split it into smaller scans.")
    hosts = [str(h) for h in net.hosts()]
    print(f"[omni] scanning {cidr} ({len(hosts)} addresses)…")
    started = datetime.now(timezone.utc).isoformat()
    t0 = time.time()
    found = []
    with cf.ThreadPoolExecutor(max_workers=a.workers) as ex:
        for i, r in enumerate(ex.map(probe, hosts), 1):
            if r:
                found.append(r)
            if i % 32 == 0:
                print(f"[omni] {i}/{len(hosts)} probed, {len(found)} alive", end="\r")
    arp = arp_table()
    for h in found:
        mac = arp.get(h["ip"], "")
        h["mac"] = mac
        h["vendor"] = OUI.get(mac[:8], "Unknown") if mac else "Unknown"
        h["guessedType"] = guess_type(h["vendor"], h["openPorts"])
        h["risk"] = ", ".join(RISKY[p] for p in h["openPorts"] if p in RISKY) or None
    result = {"agent": "omni_scan/1.0", "range": cidr, "startedAt": started, "durationSec": round(time.time() - t0, 1), "site": a.site, "hosts": found}
    with open(a.out, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\n[omni] {len(found)} hosts found in {result['durationSec']}s → {a.out}")
    if a.post:
        req = urllib.request.Request(a.post, data=json.dumps(result).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {a.token or ''}"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                print(f"[omni] uploaded to Omni: HTTP {resp.status}")
        except Exception as e:
            print(f"[omni] upload failed: {e} (results saved locally)")


if __name__ == "__main__":
    main()
