"""Linuxの子プロセスだけに通信拒否のseccompフィルターを継承させる。"""
import ctypes
import errno
import os
import platform
import sys


def main():
    if sys.platform != "linux" or len(sys.argv) < 2:
        raise SystemExit("Linuxで検証するコマンドを指定してください")
    architectures = {
        "aarch64": (0xC00000B7, [198, 203, 206, 207, 211, 212, 243, 269]),
        "x86_64": (0xC000003E, [41, 42, 44, 45, 46, 47, 299, 307]),
    }
    if platform.machine() not in architectures:
        raise SystemExit("このCPUの通信拒否フィルターは未対応です")
    arch, denied = architectures[platform.machine()]

    class Filter(ctypes.Structure):
        _fields_ = [("code", ctypes.c_ushort), ("jt", ctypes.c_ubyte),
                    ("jf", ctypes.c_ubyte), ("k", ctypes.c_uint)]

    class Program(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ushort), ("filter", ctypes.POINTER(Filter))]

    # 別のABIでシステムコール番号を解釈しない。socketpairはローカルIPCのため許可する。
    instructions = [(0x20, 0, 0, 4), (0x15, 1, 0, arch), (0x06, 0, 0, 0x80000000),
                    (0x20, 0, 0, 0)]
    for number in denied:
        instructions.extend([(0x15, 0, 1, number), (0x06, 0, 0, 0x50000 | errno.EPERM)])
    instructions.append((0x06, 0, 0, 0x7FFF0000))
    filters = (Filter * len(instructions))(*(Filter(*item) for item in instructions))
    program = Program(len(filters), filters)
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_void_p,
                          ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    for args in [(38, 1, None, 0, 0), (22, 2, ctypes.byref(program), 0, 0)]:
        if libc.prctl(*args) != 0:
            raise OSError(ctypes.get_errno(), "通信拒否フィルターを設定できません")
    os.execvpe(sys.argv[1], sys.argv[1:], os.environ)


if __name__ == "__main__":
    main()
