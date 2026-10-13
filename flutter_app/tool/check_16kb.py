#!/usr/bin/env python3
"""Checks an AAB or APK for Google Play's 16 KB memory page size requirement.

Usage:  python -I tool/check_16kb.py build/app/outputs/bundle/release/app-release.aab
        python -I tool/check_16kb.py build/app/outputs/flutter-apk/app-arm64-v8a-release.apk

For every 64-bit native library (arm64-v8a, x86_64) it reads the ELF program headers and
requires each PT_LOAD segment to be aligned to at least 16384 bytes. For an APK it also asks
zipalign (Android SDK build-tools) to verify that stored .so files start on a 16 KB boundary:
  zipalign -c -P 16 -v 4 <apk>
(An AAB is not a zip-aligned archive; Play and bundletool align the APKs it generates, so for an
AAB only the ELF check applies.)  Exit code 0 means every 64-bit library passed.
"""
import glob
import os
import struct
import subprocess
import sys
import zipfile

PT_LOAD = 1
ABIS_64 = ("arm64-v8a", "x86_64")
NEEDED = 16384


def elf_load_alignments(data):
    if data[:4] != b"\x7fELF":
        raise ValueError("not an ELF file")
    is64 = data[4] == 2
    little = data[5] == 1
    e = "<" if little else ">"
    if is64:
        phoff, = struct.unpack_from(e + "Q", data, 0x20)
        phentsize, phnum = struct.unpack_from(e + "HH", data, 0x36)
    else:
        phoff, = struct.unpack_from(e + "I", data, 0x1C)
        phentsize, phnum = struct.unpack_from(e + "HH", data, 0x2A)
    aligns = []
    for i in range(phnum):
        off = phoff + i * phentsize
        p_type, = struct.unpack_from(e + "I", data, off)
        if p_type != PT_LOAD:
            continue
        if is64:
            align, = struct.unpack_from(e + "Q", data, off + 48)
        else:
            align, = struct.unpack_from(e + "I", data, off + 28)
        aligns.append(align)
    return aligns


def find_zipalign():
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT") or ""
    hits = sorted(glob.glob(os.path.join(sdk, "build-tools", "*", "zipalign*")), reverse=True)
    return hits[0] if hits else None


def main(path):
    failures = 0
    checked = 0
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            name = info.filename
            if not name.endswith(".so"):
                continue
            parts = name.split("/")
            abi = next((a for a in ABIS_64 if a in parts), None)
            if abi is None:
                continue  # 32-bit libraries are exempt from the 16 KB requirement
            aligns = elf_load_alignments(z.read(info))
            ok = bool(aligns) and all(a >= NEEDED for a in aligns)
            checked += 1
            if not ok:
                failures += 1
            stored = "stored" if info.compress_type == 0 else "deflated"
            print(("OK   " if ok else "FAIL ") + f"{name}  LOAD align={sorted(set(aligns))}  {stored}")
    print(f"\n{checked} 64-bit libraries checked, {failures} failing the 16 KB ELF alignment.")
    if checked == 0:
        print("No 64-bit native libraries found; nothing to check.")

    if path.endswith(".apk"):
        zipalign = find_zipalign()
        if zipalign is None:
            print("zipalign not found (set ANDROID_HOME); skipped the zip alignment check.")
        else:
            print("\n$ zipalign -c -P 16 -v 4 " + path)
            r = subprocess.run([zipalign, "-c", "-P", "16", "-v", "4", path], capture_output=True, text=True)
            lines = (r.stdout or "").strip().splitlines()
            bad = [ln for ln in lines if "(BAD" in ln]
            print("\n".join(lines[-3:]))
            if r.returncode != 0 or bad:
                failures += 1
                print("zipalign: NOT 16 KB aligned")
                for ln in bad[:20]:
                    print("  " + ln)
            else:
                print("zipalign: 16 KB aligned (Verification successful)")
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
