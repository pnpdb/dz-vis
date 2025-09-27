const isDev = import.meta.env.DEV
const logLevel = (import.meta.env.VITE_LOG_LEVEL || 'INFO').toUpperCase()

const levels = {
    DEBUG: 1,
    INFO: 2,
    WARN: 3,
    ERROR: 4
}

const shouldLog = (level) => {
    return isDev || levels[level] >= levels[logLevel]
}

const logHelper = {
    debug(component, ...args) {
        if (shouldLog('DEBUG')) {
            console.debug(`[${component}]`, ...args)
        }
    },
    info(component, ...args) {
        if (shouldLog('INFO')) {
            console.info(`[${component}]`, ...args)
        }
    },
    warn(component, ...args) {
        if (shouldLog('WARN')) {
            console.warn(`[${component}]`, ...args)
        }
    },
    error(component, ...args) {
        console.error(`[${component}]`, ...args)
    }
}

export default logHelper
