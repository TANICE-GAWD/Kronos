let serverTimeOffset = 0;

export const setServerTime = (serverTimeMs) => {
    // server time is currently in unix nano then to ms, in backend it is time.Now().UnixNano() / int64(time.Millisecond)
    const clientTimeMs = Date.now();
    serverTimeOffset = serverTimeMs - clientTimeMs;
};

export const getSyncedTimeSeconds = () => {
    return (Date.now() + serverTimeOffset) / 1000;
};
