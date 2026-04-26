FROM --platform=${BUILDPLATFORM} node:24 AS build

WORKDIR /opt/node_app

COPY . .

# do not ignore optional dependencies:
# Error: Cannot find module @rollup/rollup-linux-x64-gnu
RUN --mount=type=cache,target=/root/.cache/yarn \
    npm_config_target_arch=${TARGETARCH} yarn --network-timeout 600000

ARG NODE_ENV=production

# Albert API configuration — injected at build time as Vite env vars
ARG VITE_APP_ALBERT_API_KEY=""
ARG VITE_APP_ALBERT_API_BASE="https://albert.api.etalab.gouv.fr/v1"
ARG VITE_APP_ALBERT_MODEL="AgentPublic/llama3-instruct-8b"

ENV VITE_APP_ALBERT_API_KEY=${VITE_APP_ALBERT_API_KEY}
ENV VITE_APP_ALBERT_API_BASE=${VITE_APP_ALBERT_API_BASE}
ENV VITE_APP_ALBERT_MODEL=${VITE_APP_ALBERT_MODEL}

RUN npm_config_target_arch=${TARGETARCH} yarn build:app:docker

FROM nginx:1.27-alpine

COPY --from=build /opt/node_app/excalidraw-app/build /usr/share/nginx/html

HEALTHCHECK CMD wget -q -O /dev/null http://localhost || exit 1
