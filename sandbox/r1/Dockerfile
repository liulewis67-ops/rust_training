FROM --platform=linux/amd64 rust:1.95.0-slim-bookworm@sha256:d7482085ff5b415f84dba5647ae71606650bdef00db7aeb69f4b3d170c3e4082

# Named volumes inherit this directory's non-root ownership when first mounted.
RUN mkdir -p /workspace \
    && chown 1000:1000 /workspace \
    && chmod 0700 /workspace

ENV HOME=/tmp
LABEL org.rust.training.rust-version="1.95.0"
LABEL org.rust.training.environment-version="1.0.0"
LABEL org.rust.training.base-image-digest="sha256:d7482085ff5b415f84dba5647ae71606650bdef00db7aeb69f4b3d170c3e4082"
LABEL org.rust.training.platform="linux/amd64"
USER 1000:1000
WORKDIR /workspace
