import ipaddress, socket
from urllib.parse import urlparse

def validate_public_http_url(url: str) -> None:
    p=urlparse(url)
    if p.scheme not in {"http","https"} or not p.hostname:
        raise ValueError("Only valid http:// and https:// URLs are supported.")
    host=p.hostname.lower()
    if host in {"localhost","localhost.localdomain","ip6-localhost","ip6-loopback","0.0.0.0","127.0.0.1","::1"} or host.endswith(".local"):
        raise ValueError("Local/private hosts are blocked by WebScope.")
    try:
        ip=ipaddress.ip_address(host)
        if any((ip.is_private,ip.is_loopback,ip.is_link_local,ip.is_reserved,ip.is_multicast,ip.is_unspecified)):
            raise ValueError("Private or local network addresses are blocked by WebScope.")
        return
    except ValueError as e:
        if str(e).startswith(("Private","Local")): raise
    try: infos=socket.getaddrinfo(host,None,type=socket.SOCK_STREAM)
    except socket.gaierror: return
    for info in infos:
        try: ip=ipaddress.ip_address(info[4][0])
        except ValueError: continue
        if any((ip.is_private,ip.is_loopback,ip.is_link_local,ip.is_reserved,ip.is_multicast,ip.is_unspecified)):
            raise ValueError("The target resolves to a private or local network address.")

def same_origin(a,b):
    x,y=urlparse(a),urlparse(b)
    return x.scheme==y.scheme and x.hostname==y.hostname and (x.port or (443 if x.scheme=="https" else 80))==(y.port or (443 if y.scheme=="https" else 80))
