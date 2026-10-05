"""AINOID 本地服务器（禁用缓存）。
用法:
  python tools/serve.py            # 仅本机访问 http://127.0.0.1:5173
  python tools/serve.py --lan      # 局域网访问（手机和电脑连同一个 Wi-Fi，用手机打开显示的地址）
"""
import http.server
import os
import socket
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 5173
for a in sys.argv[1:]:
    if a.isdigit():
        PORT = int(a)
LAN = '--lan' in sys.argv


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


def lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return '127.0.0.1'


if __name__ == '__main__':
    host = '0.0.0.0' if LAN else '127.0.0.1'
    httpd = http.server.ThreadingHTTPServer((host, PORT), Handler)
    print(f'AINOID 已启动: http://127.0.0.1:{PORT}')
    if LAN:
        print(f'手机访问（同一 Wi-Fi）: http://{lan_ip()}:{PORT}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
