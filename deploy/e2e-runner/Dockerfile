# Self-hosted GitHub Actions runner for the DCC E2E suite. See README.md.
#
# The image holds tools only. Foundry and the license come from the
# felddy/foundryvtt container's data volume at runtime, and dcc-core-book is
# cloned from GitHub, so nothing licensed ends up in an image layer.

# Bump at least monthly: the runner runs with --disableupdate (its install dir
# is read-only), and GitHub stops sending jobs to runners that fall too far
# behind the current release.
FROM ghcr.io/actions/actions-runner:2.338.0

USER root

ARG NODE_MAJOR=24
ARG PNPM_VERSION=11.25.0
# Keep in step with @playwright/test in pnpm-lock.yaml — jobs skip
# `playwright install` and use these baked browsers.
ARG PLAYWRIGHT_VERSION=1.63.0

ENV PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git jq procps rsync unzip util-linux \
 && curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g "pnpm@${PNPM_VERSION}" \
 && npx -y "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium chromium-headless-shell \
 && chmod -R a+rX "$PLAYWRIGHT_BROWSERS_PATH" \
 && rm -rf /var/lib/apt/lists/* /root/.npm

# The base image gives `runner` passwordless sudo. Jobs run PR code, so take
# it away: nothing a job does should be able to reach root.
RUN rm -f /etc/sudoers.d/* \
 && (gpasswd -d runner sudo || true) \
 && (gpasswd -d runner docker || true)

COPY entrypoint.sh /usr/local/bin/e2e-runner-entrypoint
RUN chmod 0755 /usr/local/bin/e2e-runner-entrypoint

ENTRYPOINT ["/usr/local/bin/e2e-runner-entrypoint"]
