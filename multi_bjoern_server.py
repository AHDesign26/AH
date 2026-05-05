import bjoern
from app import app
from os import getenv
from multiprocessing import Process


def runner(port):
    SOCKET = getenv("SOCKET", False)
    if SOCKET:
        print("serving from socket")
        bjoern.run(app, 'unix:/var/run/ah_front.socket')
    else:
        print(f"serving from tcp port {port}")
        bjoern.run(app, "0.0.0.0", port)


p = []


for port in range(8080, 8082):
    p.append(Process(target=runner, args=(port,)))
    p[-1].start()


for p in p:
    p.join()

