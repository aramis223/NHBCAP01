'use strict';

const DEFAULT_HTTP_TIMEOUT_MS = 10000;

function getHttpTimeoutMs() {
    const configured = process.env.NHB_HTTP_TIMEOUT_MS;

    if (!configured) {
        return DEFAULT_HTTP_TIMEOUT_MS;
    }

    const timeoutMs = Number(configured);

    if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs <= 0
    ) {
        throw new Error(
            'NHB_HTTP_TIMEOUT_MS must be a positive integer.'
        );
    }

    return timeoutMs;
}

async function fetchWithTimeout(
    url,
    options = {},
    timeoutMs = getHttpTimeoutMs(),
    fetchImpl = fetch
) {
    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        return await fetchImpl(
            url,
            {
                ...options,
                signal: controller.signal
            }
        );
    } catch (error) {
        if (
            error?.name === 'AbortError' ||
            controller.signal.aborted
        ) {
            const timeoutError = new Error(
                `Outbound HTTP request timed out after ${timeoutMs} ms.`
            );

            timeoutError.name = 'OutboundTimeoutError';
            timeoutError.code = 'NHB_HTTP_TIMEOUT';
            timeoutError.timeoutMs = timeoutMs;

            throw timeoutError;
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    DEFAULT_HTTP_TIMEOUT_MS,
    getHttpTimeoutMs,
    fetchWithTimeout
};
