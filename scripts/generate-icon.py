"""Generate minimal icon.ico and icon.png for Tauri. Run from repo root."""
import os
import struct
import zlib

icons_dir = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
os.makedirs(icons_dir, exist_ok=True)

w, h = 32, 32
# Purple/blue color (B, G, R, A)
b, g, r, a = 0x6B, 0x5B, 0xFB, 255

# --- ICO: header + directory + BMP (DIB header + pixels + AND mask) ---
image_size = 40 + w * h * 4 + (w * h // 8)  # DIB + 32bpp pixels + 1bpp AND
offset = 6 + 16
ico = bytearray()
ico += struct.pack("<HHH", 0, 1, 1)  # header
ico += struct.pack("<BBHHIIII", w, h, 0, 0, 1, 32, image_size, offset)
ico += struct.pack("<IIIHHIIIIII", 40, w, h * 2, 1, 32, 0, 0, 0, 0, 0, 0)
# Pixels (bottom-up in BMP)
for y in range(h - 1, -1, -1):
    for x in range(w):
        ico += bytes((b, g, r, a))
# AND mask (1 bit per pixel, rows padded to 4 bytes)
row_pad = (w + 31) // 32 * 4
for _ in range(h):
    ico += b"\x00" * row_pad

with open(os.path.join(icons_dir, "icon.ico"), "wb") as f:
    f.write(ico)

# --- PNG: signature + IHDR + IDAT + IEND ---
def png_chunk(typ, data=b""):
    chunk = typ + data
    crc = zlib.crc32(chunk) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)

ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)  # 8bpp, RGB
raw = bytearray()
for y in range(h):
    raw.append(0)  # filter None
    for x in range(w):
        raw += bytes((r, g, b))
idat = zlib.compress(bytes(raw), 9)

png = b"\x89PNG\r\n\x1a\n"
png += png_chunk(b"IHDR", ihdr)
png += png_chunk(b"IDAT", idat)
png += png_chunk(b"IEND")

with open(os.path.join(icons_dir, "icon.png"), "wb") as f:
    f.write(png)

print("Created icon.ico and icon.png in src-tauri/icons/")
