import bjoern
from app import app
from os import getenv

SOCKET = getenv("SOCKET", False)
if SOCKET:
    print("serving from socket")
    bjoern.run(app, 'unix:/var/run/ah_front.socket')
else:
    print("serving from tcp port 8080")
    bjoern.run(app, "0.0.0.0", 8080)
