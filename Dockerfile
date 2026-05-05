FROM pypy:3.9-bullseye
ENV PYTHONUNBUFFERED 1
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN apt-get update && apt-get upgrade -y && apt-get install -y -qq libev-dev
# RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
RUN pip3 install -U pip setuptools wheel
# RUN pip3 install faster-than-requests
RUN pip3 install -r requirements.txt
COPY . /app